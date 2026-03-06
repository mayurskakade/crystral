import type { AgentConfig, Message, ToolDefinition, CompletionOptions, CompletionResult, ToolConfig, Provider, ImageInput } from '../types/index.js';
import { resolveSystemPrompt } from '../prompts/index.js';
import { loadAgentConfig, loadToolConfig, findProjectRoot } from '../config/loader.js';
import { resolveApiKey } from '../credentials/resolver.js';
import { createProvider } from '../providers/index.js';
import { SQLiteStorage, type StorageAdapter } from '../storage/adapter.js';
import { executeTool, toOpenAIFunction, type ToolResult, type ToolContext } from '../tools/index.js';
import { createRAGSearcher } from '../rag/index.js';
import { MCPClientManager } from '../mcp/client.js';
import {
  ProviderError,
  RateLimitError,
} from '../errors/index.js';
import { withRetry } from '../retry/index.js';
import { withFallback } from '../retry/fallback.js';
import { checkInputGuardrails, checkOutputGuardrails } from '../guardrails/index.js';
import { CacheManager } from '../cache/index.js';
import { Logger } from '../observability/logger.js';
import { Tracer } from '../observability/tracer.js';
import { parseOutput, buildRetryPrompt } from '../output/index.js';

/**
 * Internal message format for provider calls
 */
interface InternalMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  tool_call_id?: string;
}

/**
 * Agent run options
 */
export interface AgentRunOptions {
  /** Override session ID to continue a conversation */
  sessionId?: string;
  /** Working directory for resolving paths */
  cwd?: string;
  /** Variables for tool templates */
  variables?: Record<string, string>;
  /** Maximum iterations for tool loop */
  maxToolIterations?: number;
  /** Enable streaming */
  stream?: boolean;
  /** Callback for streaming tokens */
  onToken?: (token: string) => void;
  /** Callback for tool execution */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  /** Callback for tool result */
  onToolResult?: (toolName: string, result: ToolResult) => void;
  /** Images for multimodal input */
  images?: ImageInput[];
  /** Agent call stack for circular delegation detection */
  agentCallStack?: string[];
  /** Callback when an agent delegation starts */
  onAgentDelegation?: (parentAgent: string, targetAgent: string, task: string) => void;
  /** Callback when an agent delegation completes */
  onAgentDelegationResult?: (parentAgent: string, targetAgent: string, result: string, success: boolean) => void;
}

/**
 * Agent run result
 */
export interface AgentRunResult {
  /** Final response content */
  content: string;
  /** Session ID for continuing conversation */
  sessionId: string;
  /** Messages exchanged */
  messages: Message[];
  /** Tool calls made */
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: ToolResult;
  }>;
  /** RAG context used (if applicable) */
  ragContext?: string;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Execution time in ms */
  durationMs: number;
  /** Which provider/model actually served the response (primary or fallback) */
  providerUsed?: { provider: string; model: string };
  /** Guardrail check results */
  guardrails?: { inputBlocked?: boolean; outputBlocked?: boolean; piiRedacted: boolean };
  /** Whether the response was served from cache */
  cached?: boolean;
  /** Trace ID for observability (if tracing enabled) */
  traceId?: string;
  /** Parsed structured output (if output config defined) */
  parsed?: unknown;
}

/**
 * Agent runner class
 */
export class AgentRunner {
  private config: AgentConfig;
  private provider: ReturnType<typeof createProvider>;
  private storage: StorageAdapter;
  private projectRoot: string | null;
  private sessionId: string | null = null;
  private mcpManager?: MCPClientManager;

  constructor(config: AgentConfig, storage?: StorageAdapter) {
    this.config = config;
    this.projectRoot = findProjectRoot();

    // Initialize storage
    this.storage = storage ?? SQLiteStorage.getInstance();

    // Initialize provider with API key
    const apiKey = resolveApiKey(config.provider);
    this.provider = createProvider(config.provider, apiKey);

    // Initialize MCP manager if MCP servers are configured
    if (config.mcp && config.mcp.length > 0) {
      this.mcpManager = new MCPClientManager();
    }
  }
  
  /**
   * Run the agent with a user message
   */
  async run(
    userMessage: string,
    options?: AgentRunOptions
  ): Promise<AgentRunResult> {
    const startTime = Date.now();
    const toolCalls: Array<{ name: string; args: Record<string, unknown>; result: ToolResult }> = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Initialize observability
    const logger = Logger.getInstance(this.config.logging);
    const tracer = this.config.logging?.trace ? new Tracer() : undefined;

    logger.info('Agent run started', { agent: this.config.name, provider: this.config.provider, model: this.config.model });
    tracer?.startSpan('agent.run', { agent: this.config.name });
    
    // Get or create session
    const sessionId = options?.sessionId ?? this.sessionId;
    if (sessionId) {
      const session = this.storage.getSession(sessionId);
      if (!session) {
        this.sessionId = this.storage.createSession(this.config.name).id;
      } else {
        this.sessionId = sessionId;
      }
    } else {
      this.sessionId = this.storage.createSession(this.config.name).id;
    }
    
    // Build messages array for provider
    const messages: InternalMessage[] = [];
    
    // Add system prompt (resolve template if needed)
    if (this.config.system_prompt) {
      const resolvedPrompt = resolveSystemPrompt(this.config.system_prompt);
      if (resolvedPrompt) {
        messages.push({
          role: 'system',
          content: resolvedPrompt,
        });
      }
    }
    
    // Add conversation history (convert from storage format)
    const history = this.storage.getMessages(this.sessionId);
    for (const msg of history) {
      const internalMsg: InternalMessage = {
        role: msg.role,
        content: msg.content,
      };
      if (msg.tool_calls) {
        internalMsg.tool_calls = msg.tool_calls;
      }
      if (msg.tool_call_id) {
        internalMsg.tool_call_id = msg.tool_call_id;
      }
      messages.push(internalMsg);
    }
    
    // Add RAG context if configured
    let ragContext: string | undefined;
    if (this.config.rag) {
      const searcher = createRAGSearcher(this.storage, this.config.rag);
      const searchResult = await searcher.searchWithContext(userMessage, {
        maxContextLength: 2000,
        includeSources: true,
      });
      
      if (searchResult.context) {
        ragContext = searchResult.context;
        messages.push({
          role: 'system',
          content: `Use the following context to help answer the user's question:\n\n${ragContext}`,
        });
      }
    }
    
    // Check input guardrails
    let effectiveUserMessage = userMessage;
    let inputBlocked = false;
    let piiRedacted = false;

    const inputGuardrailResult = checkInputGuardrails(userMessage, this.config.guardrails?.input);
    if (!inputGuardrailResult.passed) {
      inputBlocked = true;

      // Store user message and return refusal
      this.storage.addMessage(this.sessionId, {
        role: 'user',
        content: userMessage,
      });

      const refusalContent = `I cannot process this request. ${inputGuardrailResult.violation ?? 'Input guardrail violation.'}`;

      this.storage.addMessage(this.sessionId, {
        role: 'assistant',
        content: refusalContent,
      });

      const resultMessages = this.storage.getMessages(this.sessionId);
      const durationMs = Date.now() - startTime;

      return {
        content: refusalContent,
        sessionId: this.sessionId,
        messages: resultMessages,
        toolCalls,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        durationMs,
        guardrails: { inputBlocked: true, piiRedacted: false },
      };
    }

    if (inputGuardrailResult.transformed) {
      effectiveUserMessage = inputGuardrailResult.transformed;
      piiRedacted = true;
    }

    // Add user message
    messages.push({
      role: 'user',
      content: effectiveUserMessage,
    });

    // Store user message
    this.storage.addMessage(this.sessionId, {
      role: 'user',
      content: effectiveUserMessage,
    });

    // Cache lookup
    const cacheEnabled = this.config.cache?.enabled === true;
    const cacheManager = cacheEnabled ? new CacheManager(this.storage, this.config.cache!) : undefined;
    let cacheKey: string | undefined;

    if (cacheManager) {
      const systemPrompt = typeof this.config.system_prompt === 'string' ? this.config.system_prompt : '';
      cacheKey = cacheManager.generateKey(
        this.config.provider,
        this.config.model,
        messages,
        systemPrompt,
        this.config.temperature,
        undefined,
      );

      const cachedResponse = cacheManager.get(cacheKey);
      if (cachedResponse) {
        logger.info('Cache hit', { agent: this.config.name, cacheKey });
        tracer?.endSpan();

        this.storage.addMessage(this.sessionId, {
          role: 'assistant',
          content: cachedResponse,
        });

        const resultMessages = this.storage.getMessages(this.sessionId);
        const durationMs = Date.now() - startTime;

        return {
          content: cachedResponse,
          sessionId: this.sessionId,
          messages: resultMessages,
          toolCalls,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          durationMs,
          cached: true,
          ...(tracer ? { traceId: tracer.id } : {}),
        };
      }

      logger.debug('Cache miss', { agent: this.config.name, cacheKey });
    }

    // Load tool definitions
    const tools = await this.loadTools();
    
    // Build completion options
    const completionOptions: CompletionOptions = {
      temperature: this.config.temperature,
      max_tokens: this.config.max_tokens,
      top_p: this.config.top_p,
      presence_penalty: this.config.presence_penalty,
      frequency_penalty: this.config.frequency_penalty,
    };
    
    // Conditionally add tools
    if (tools.length > 0) {
      completionOptions.tools = tools;
    }
    
    // Conditionally add stop_sequences
    if (this.config.stop_sequences) {
      completionOptions.stop_sequences = this.config.stop_sequences;
    }

    // Multimodal: pass images if provided
    if (options?.images && options.images.length > 0) {
      completionOptions.images = options.images;
      logger.debug('Multimodal input', { imageCount: options.images.length });
    }

    // Structured output: set response_format if output config requests JSON
    if (this.config.output?.format === 'json') {
      completionOptions.response_format = { type: 'json_object' };
    }
    
    // Tool loop
    const maxIterations = options?.maxToolIterations ?? 10;
    let iteration = 0;
    let finalContent = '';
    let providerUsed: { provider: string; model: string } | undefined;
    let outputBlocked = false;

    while (iteration < maxIterations) {
      iteration++;

      // Get completion (with retry and fallback wrapping)
      let response: CompletionResult;
      logger.debug('LLM call start', { agent: this.config.name, iteration });
      tracer?.startSpan('provider.complete', { provider: this.config.provider, model: this.config.model, iteration });
      try {
        // Build the base completion function
        const completeFn = (): Promise<CompletionResult> => {
          if (options?.stream && options.onToken) {
            return this.streamCompletion(messages, completionOptions, options.onToken);
          }
          return this.provider.complete(messages as Message[], this.config.model, completionOptions);
        };

        // Wrap with retry if configured
        const retryWrappedFn = this.config.retry
          ? () => withRetry(completeFn, this.config.retry!)
          : completeFn;

        // Wrap with fallback if configured
        if (this.config.fallback && this.config.fallback.length > 0) {
          const fallbackEntries = this.config.fallback;
          const createFallbackFn = (fbProvider: Provider, fbModel: string) => {
            const fbApiKey = resolveApiKey(fbProvider);
            const fbClient = createProvider(fbProvider, fbApiKey);
            const fbFn = (): Promise<CompletionResult> =>
              fbClient.complete(messages as Message[], fbModel, completionOptions);
            return this.config.retry
              ? () => withRetry(fbFn, this.config.retry!)
              : fbFn;
          };

          const fallbackResult = await withFallback(
            retryWrappedFn,
            fallbackEntries,
            createFallbackFn,
            this.config.provider,
            this.config.model,
          );
          response = fallbackResult.result;
          providerUsed = fallbackResult.providerUsed;
        } else {
          response = await retryWrappedFn();
          providerUsed = { provider: this.config.provider, model: this.config.model };
        }
      } catch (error) {
        if (error instanceof RateLimitError) {
          throw error;
        }
        if (error instanceof ProviderError) {
          throw error;
        }
        throw new ProviderError(
          this.config.provider,
          this.config.model,
          0,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      tracer?.endSpan();
      logger.debug('LLM call complete', { inputTokens: response.input_tokens, outputTokens: response.output_tokens });

      // Track tokens
      totalInputTokens += response.input_tokens;
      totalOutputTokens += response.output_tokens;

      // Check output guardrails on the response content
      let responseContent = response.content;
      if (response.content && (!response.tool_calls || response.tool_calls.length === 0)) {
        const outputGuardrailResult = checkOutputGuardrails(response.content, this.config.guardrails?.output);
        if (!outputGuardrailResult.passed) {
          outputBlocked = true;
          responseContent = `I cannot provide this response. ${outputGuardrailResult.violation ?? 'Output guardrail violation.'}`;
        } else if (outputGuardrailResult.transformed) {
          responseContent = outputGuardrailResult.transformed;
          piiRedacted = true;
        }
      }

      // Add assistant message to history
      const assistantMessage: InternalMessage = {
        role: 'assistant',
        content: responseContent,
      };

      if (response.tool_calls && response.tool_calls.length > 0) {
        assistantMessage.tool_calls = response.tool_calls;
      }

      messages.push(assistantMessage);

      // Check if we're done (no tool calls)
      if (!response.tool_calls || response.tool_calls.length === 0) {
        finalContent = responseContent;
        break;
      }
      
      // Execute tool calls
      const toolContext: ToolContext = {
        cwd: this.projectRoot ?? process.cwd(),
        variables: options?.variables ?? {},
        agentCallStack: options?.agentCallStack ?? [this.config.name],
        parentMessages: messages.map(m => ({ role: m.role, content: m.content })),
      };
      if (options?.onAgentDelegation) {
        toolContext.onAgentDelegation = options.onAgentDelegation;
      }
      if (options?.onAgentDelegationResult) {
        toolContext.onAgentDelegationResult = options.onAgentDelegationResult;
      }
      
      for (const toolCall of response.tool_calls) {
        const toolName = toolCall.name;
        const args = toolCall.arguments;

        logger.debug('Tool execution start', { tool: toolName });
        tracer?.startSpan('tool.execute', { tool: toolName });

        options?.onToolCall?.(toolName, args);

        let result: ToolResult;

        // Check if this is an MCP tool
        if (this.mcpManager?.isMCPTool(toolName)) {
          try {
            result = await this.mcpManager.callTool(toolName, args);
          } catch (error) {
            result = {
              content: error instanceof Error ? error.message : 'Unknown error',
              success: false,
            };
          }
        } else {
          // Find file-based tool config
          const toolConfig = this.toolDefinitions.find(t => t.function.name === toolName);

          if (!toolConfig) {
            result = {
              content: `Error: Unknown tool '${toolName}'`,
              success: false,
            };
          } else {
            try {
              result = await executeTool(
                toolConfig.config,
                args,
                toolContext
              );
            } catch (error) {
              result = {
                content: error instanceof Error ? error.message : 'Unknown error',
                success: false,
              };
            }
          }
        }
        
        tracer?.endSpan();
        logger.debug('Tool execution complete', { tool: toolName, success: result.success });

        options?.onToolResult?.(toolName, result);

        toolCalls.push({
          name: toolName,
          args,
          result,
        });
        
        // Add tool result message
        const toolMessage: InternalMessage = {
          role: 'tool',
          content: result.content,
          tool_call_id: toolCall.id,
        };
        messages.push(toolMessage);
      }
    }
    
    if (iteration >= maxIterations && !finalContent) {
      finalContent = 'Maximum tool iterations reached. Please try a simpler request.';
    }

    // Structured output parsing
    let parsedOutput: unknown;
    if (this.config.output && finalContent) {
      const outputResult = parseOutput(finalContent, this.config.output);
      if (outputResult.valid) {
        parsedOutput = outputResult.parsed;
        logger.debug('Structured output parsed successfully');
      } else {
        // Retry once: ask the LLM to fix the output
        logger.warn('Structured output parse failed, retrying', { error: outputResult.error });
        const retryPrompt = buildRetryPrompt(outputResult.error ?? 'Invalid output format');
        messages.push({ role: 'user', content: retryPrompt });

        try {
          tracer?.startSpan('provider.complete.output_retry', { provider: this.config.provider });
          const retryResponse = await this.provider.complete(
            messages as Message[],
            this.config.model,
            completionOptions,
          );
          tracer?.endSpan();

          totalInputTokens += retryResponse.input_tokens;
          totalOutputTokens += retryResponse.output_tokens;

          const retryOutputResult = parseOutput(retryResponse.content, this.config.output);
          if (retryOutputResult.valid) {
            finalContent = retryResponse.content;
            parsedOutput = retryOutputResult.parsed;
            logger.debug('Structured output retry succeeded');
          } else {
            // Use the original content; parsedOutput stays undefined
            logger.warn('Structured output retry also failed', { error: retryOutputResult.error });
          }
        } catch {
          logger.warn('Structured output retry LLM call failed');
        }
      }
    }

    // Cache storage
    if (cacheManager && cacheKey && finalContent) {
      const shouldCache = this.config.temperature === 0 || this.config.cache?.force === true;
      if (shouldCache) {
        cacheManager.set(cacheKey, finalContent);
        logger.debug('Response cached', { cacheKey });
      }
    }

    // End the top-level agent.run span
    tracer?.endSpan();
    logger.info('Agent run complete', { agent: this.config.name, durationMs: Date.now() - startTime });

    // Store final assistant message
    this.storage.addMessage(this.sessionId, {
      role: 'assistant',
      content: finalContent,
    });
    
    // Calculate cost
    const costUsd = this.calculateCost(totalInputTokens, totalOutputTokens);
    
    // Log inference
    const durationMs = Date.now() - startTime;
    this.storage.logInference({
      session_id: this.sessionId,
      agent_name: this.config.name,
      provider: this.config.provider,
      model: this.config.model,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cost_usd: costUsd,
      latency_ms: durationMs,
    });
    
    // Cleanup MCP connections
    this.mcpManager?.closeAll();

    // Get all messages for result
    const resultMessages = this.storage.getMessages(this.sessionId);

    // Build guardrails metadata if guardrails were configured
    const guardrailsMeta = this.config.guardrails
      ? {
          guardrails: {
            ...(inputBlocked ? { inputBlocked: true as const } : {}),
            ...(outputBlocked ? { outputBlocked: true as const } : {}),
            piiRedacted,
          },
        }
      : {};

    return {
      content: finalContent,
      sessionId: this.sessionId,
      messages: resultMessages,
      toolCalls,
      ...(ragContext ? { ragContext } : {}),
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
      durationMs,
      ...(providerUsed ? { providerUsed } : {}),
      ...guardrailsMeta,
      ...(parsedOutput !== undefined ? { parsed: parsedOutput } : {}),
      ...(tracer ? { traceId: tracer.id } : {}),
    };
  }
  
  /**
   * Tool definitions with config storage
   */
  private toolDefinitions: Array<{ function: { name: string; description: string }; config: ToolConfig }> = [];
  
  /**
   * Stream completion and collect full response
   */
  private async streamCompletion(
    messages: InternalMessage[],
    options: CompletionOptions,
    onToken: (token: string) => void
  ): Promise<CompletionResult> {
    // Get non-streaming for now (streaming support varies by provider)
    const response = await this.provider.complete(messages as Message[], this.config.model, options);

    // Simulate streaming by calling onToken with chunks
    if (response.content) {
      const words = response.content.split(' ');
      for (let i = 0; i < words.length; i++) {
        const token = i === 0 ? words[i]! : ' ' + words[i];
        onToken(token);
      }
    }

    const result: CompletionResult = {
      content: response.content,
      input_tokens: response.input_tokens,
      output_tokens: response.output_tokens,
      finish_reason: response.finish_reason,
    };

    if (response.tool_calls) {
      result.tool_calls = response.tool_calls;
    }

    return result;
  }
  
  /**
   * Inject additional tool configs (used by workflow engine to add virtual agent tools)
   */
  injectToolConfigs(configs: ToolConfig[]): void {
    for (const config of configs) {
      const def = toOpenAIFunction(config);
      this.toolDefinitions.push({
        function: { name: def.function.name, description: def.function.description },
        config,
      });
    }
  }

  /**
   * Load tool definitions from tool configs and MCP servers
   */
  private async loadTools(): Promise<ToolDefinition[]> {
    const toolNames = this.config.tools;
    const cwd = this.projectRoot ?? undefined;

    // Load file-based tools
    if (toolNames && toolNames.length > 0) {
      for (const name of toolNames) {
        // Skip if already injected
        if (this.toolDefinitions.some(t => t.function.name === name)) {
          continue;
        }
        try {
          const config = loadToolConfig(name, cwd, this.config.name);
          const def = toOpenAIFunction(config);
          this.toolDefinitions.push({
            function: { name: def.function.name, description: def.function.description },
            config,
          });
        } catch {
          // Tool not found — skip silently (will fail at call time if used)
        }
      }
    }

    // Connect to MCP servers and discover their tools
    if (this.mcpManager && this.config.mcp && this.config.mcp.length > 0) {
      try {
        await this.mcpManager.connectAll(this.config.mcp);
      } catch {
        // MCP connection failure is non-fatal
      }
    }

    // Combine file-based tool definitions with MCP tool definitions
    const fileDefs = this.toolDefinitions.map(t => toOpenAIFunction(t.config));
    const mcpDefs = this.mcpManager?.getAllTools() ?? [];

    return [...fileDefs, ...mcpDefs];
  }
  
  /**
   * Calculate cost based on token usage
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    // Simple cost calculation - would use COST_RATES from providers
    const inputCost = (inputTokens / 1_000_000) * 5; // $5/1M tokens
    const outputCost = (outputTokens / 1_000_000) * 15; // $15/1M tokens
    return inputCost + outputCost;
  }
  
  /**
   * Clear the current session
   */
  clearSession(): void {
    if (this.sessionId) {
      this.storage.deleteSession(this.sessionId);
      this.sessionId = null;
    }
  }
  
  /**
   * Get session history
   */
  getHistory(): Message[] {
    if (!this.sessionId) {
      return [];
    }
    return this.storage.getMessages(this.sessionId);
  }
}

/**
 * Load and run an agent by name
 */
export async function runAgent(
  agentName: string,
  message: string,
  options?: AgentRunOptions
): Promise<AgentRunResult> {
  // Load agent config
  const config = loadAgentConfig(agentName, options?.cwd);
  
  // Create runner and execute
  const runner = new AgentRunner(config);
  return runner.run(message, options);
}

/**
 * Create an agent runner from config
 */
export function createAgentRunner(
  config: AgentConfig,
  storage?: StorageAdapter
): AgentRunner {
  return new AgentRunner(config, storage);
}
