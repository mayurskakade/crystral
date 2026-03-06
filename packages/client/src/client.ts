import type {
  ClientConfig,
  ClientTool,
  Message,
  RunOptions,
  RunResult,
  ToolDefinition,
  CompletionOptions,
} from './types.js';
import { InvalidConfigError, ToolExecutionError } from './errors.js';
import { createProvider } from './providers/index.js';
import type { ProviderClient } from './providers/index.js';
import { MemoryStorage } from './storage/memory.js';
import type { StorageAdapter } from './types.js';

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function toToolDefinitions(tools: ClientTool[]): ToolDefinition[] {
  return tools.map(t => ({
    function: { name: t.name, description: t.description, parameters: t.parameters as Record<string, unknown> },
  }));
}

/**
 * Universal AI agent client for browser, React Native, Electron, and Edge environments.
 *
 * @example
 * ```typescript
 * import { CrystralClient } from '@crystralai/client';
 *
 * const client = new CrystralClient({
 *   provider: 'openai',
 *   model: 'gpt-4o',
 *   apiKey: userProvidedKey,
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 *
 * const result = await client.run('What is the capital of France?');
 * console.log(result.content); // "Paris"
 * ```
 */
export class CrystralClient {
  private config: ClientConfig;
  private provider: ProviderClient;
  private storage: StorageAdapter;

  constructor(config: ClientConfig) {
    if (!config.apiKey) throw new InvalidConfigError('apiKey is required');
    if (!config.provider) throw new InvalidConfigError('provider is required');
    if (!config.model) throw new InvalidConfigError('model is required');

    this.config = config;
    this.provider = createProvider(config.provider, config.apiKey, config.baseUrl);
    this.storage = config.storage ?? new MemoryStorage();
  }

  /**
   * Send a message and get a response.
   * Manages conversation history and tool execution automatically.
   */
  async run(message: string, options?: RunOptions): Promise<RunResult> {
    const start = Date.now();
    const maxIter = options?.maxToolIterations ?? 10;

    // Resolve or create session
    const sessionId = options?.sessionId ?? this.storage.createSession();
    const history = this.storage.getMessages(sessionId);

    // Build system prompt
    const systemPrompt = this.config.systemPrompt
      ? interpolate(this.config.systemPrompt, options?.variables ?? {})
      : undefined;

    // Construct message list for this turn
    const messages: Message[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...history,
      {
        role: 'user' as const,
        content: message,
        ...(options?.images ? { images: options.images } : {}),
      },
    ];

    const tools = this.config.tools ?? [];
    const toolDefs = tools.length ? toToolDefinitions(tools) : undefined;
    const toolMap = new Map(tools.map(t => [t.name, t]));

    const completionOpts: CompletionOptions = {
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      ...(toolDefs?.length ? { tools: toolDefs } : {}),
      ...(options?.images ? { images: options.images } : {}),
    };

    const allToolCalls: RunResult['toolCalls'] = [];
    let finalContent = '';

    // Tool loop
    for (let iter = 0; iter < maxIter; iter++) {
      let result;

      if (options?.stream && options.onToken && iter === 0) {
        // Stream first turn, collect full content
        let streamed = '';
        for await (const token of this.provider.stream(messages, this.config.model, completionOpts)) {
          streamed += token;
          options.onToken(token);
        }
        // For streaming we do a non-streaming call to get tool_calls
        // (most providers don't expose tool calls in stream easily)
        result = await this.provider.complete(messages, this.config.model, completionOpts);
        if (!result.tool_calls?.length) {
          finalContent = streamed;
          messages.push({ role: 'assistant', content: streamed });
          break;
        }
      } else {
        result = await this.provider.complete(messages, this.config.model, completionOpts);
      }

      finalContent = result.content;

      if (!result.tool_calls?.length) {
        messages.push({ role: 'assistant', content: result.content });
        break;
      }

      // Append assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: result.content,
        tool_calls: result.tool_calls,
      });

      // Execute each tool call
      for (const tc of result.tool_calls) {
        const tool = toolMap.get(tc.name);
        options?.onToolCall?.(tc.name, tc.arguments);

        let toolResult: unknown;
        let success = true;

        if (!tool) {
          toolResult = `Tool "${tc.name}" not found.`;
          success = false;
        } else {
          try {
            toolResult = await tool.execute(tc.arguments);
          } catch (err) {
            success = false;
            toolResult = err instanceof Error ? err.message : String(err);
            if (!(err instanceof ToolExecutionError)) {
              throw new ToolExecutionError(tc.name, toolResult as string);
            }
          }
        }

        options?.onToolResult?.(tc.name, toolResult, success);
        allToolCalls.push({ name: tc.name, args: tc.arguments, result: toolResult, success });

        messages.push({
          role: 'tool',
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          tool_call_id: tc.id,
        });
      }
    }

    // Persist only non-system messages
    const toSave = messages.filter(m => m.role !== 'system');
    this.storage.saveMessages(sessionId, toSave);

    return {
      content: finalContent,
      sessionId,
      messages: toSave,
      toolCalls: allToolCalls,
      usage: { input: 0, output: 0, total: 0 }, // usage not tracked in streaming path
      durationMs: Date.now() - start,
    };
  }

  /**
   * Stream a response token by token via an async generator.
   * Does not support tool calls — for tool support use run() with stream: true.
   *
   * @example
   * ```typescript
   * for await (const token of client.stream('Write a poem')) {
   *   process.stdout.write(token);
   * }
   * ```
   */
  async *stream(message: string, options?: Omit<RunOptions, 'stream' | 'onToken'>): AsyncIterable<string> {
    const systemPrompt = this.config.systemPrompt
      ? interpolate(this.config.systemPrompt, options?.variables ?? {})
      : undefined;

    const sessionId = options?.sessionId ?? this.storage.createSession();
    const history = this.storage.getMessages(sessionId);

    const messages: Message[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...history,
      { role: 'user' as const, content: message },
    ];

    let full = '';
    for await (const token of this.provider.stream(messages, this.config.model, {
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    })) {
      full += token;
      yield token;
    }

    const updated = [...messages.filter(m => m.role !== 'system'), { role: 'assistant' as const, content: full }];
    this.storage.saveMessages(sessionId, updated);
  }

  /** Return stored messages for a session */
  getHistory(sessionId: string): Message[] {
    return this.storage.getMessages(sessionId);
  }

  /** Clear a session's history */
  clearSession(sessionId: string): void {
    this.storage.saveMessages(sessionId, []);
  }

  /** Delete a session entirely */
  deleteSession(sessionId: string): void {
    this.storage.deleteSession(sessionId);
  }

  /** List all session IDs in the current storage */
  listSessions(): string[] {
    return this.storage.listSessions();
  }

  /** Update the API key at runtime (useful when user changes their key) */
  setApiKey(apiKey: string): void {
    this.config = { ...this.config, apiKey };
    this.provider = createProvider(this.config.provider, apiKey, this.config.baseUrl);
  }
}
