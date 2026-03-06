import type { Message, CompletionOptions, CompletionResult } from '../types.js';
import { ProviderError, RateLimitError } from '../errors.js';
import type { ProviderClient } from './base.js';
import { buildGeminiImageParts } from './base.js';

export class GoogleProvider implements ProviderClient {
  constructor(private apiKey: string, private baseUrl = 'https://generativelanguage.googleapis.com/v1beta') {}

  async complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult> {
    const system = messages.find(m => m.role === 'system');
    let contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] as unknown[] }));

    if (opts?.images?.length) contents = buildGeminiImageParts(contents, opts.images);

    const generationConfig: Record<string, unknown> = {
      temperature: opts?.temperature ?? 1.0,
      maxOutputTokens: opts?.max_tokens ?? 4096,
    };
    if (opts?.top_p !== undefined) generationConfig.topP = opts.top_p;
    if (opts?.stop_sequences?.length) generationConfig.stopSequences = opts.stop_sequences;
    if (opts?.response_format?.type === 'json_object') generationConfig.responseMimeType = 'application/json';

    const body: Record<string, unknown> = { contents, generationConfig };
    if (system) body.systemInstruction = { parts: [{ text: system.content }] };
    if (opts?.tools?.length) {
      body.tools = [{ functionDeclarations: opts.tools.map(t => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters })) }];
    }

    const response = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (err.error as Record<string, unknown>)?.message as string || 'Unknown error';
      if (response.status === 429) throw new RateLimitError('google', model);
      throw new ProviderError('google', model, response.status, msg);
    }

    const data = await response.json() as Record<string, unknown>;
    const candidate = (data.candidates as Array<Record<string, unknown>>)?.[0];
    const parts = (candidate?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>>;
    const usage = data.usageMetadata as Record<string, number>;

    let text = '';
    const toolCalls: CompletionResult['tool_calls'] = [];
    for (const part of parts ?? []) {
      if (part.text) text += part.text as string;
      else if (part.functionCall) {
        const fc = part.functionCall as Record<string, unknown>;
        toolCalls.push({ id: `call_${toolCalls.length}`, name: fc.name as string, arguments: fc.args as Record<string, unknown> });
      }
    }

    return {
      content: text,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      input_tokens: usage?.promptTokenCount ?? 0,
      output_tokens: usage?.candidatesTokenCount ?? 0,
      finish_reason: candidate?.finishReason === 'FUNCTION_CALL' ? 'tool_calls' : 'stop',
    };
  }

  async *stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string> {
    const system = messages.find(m => m.role === 'system');
    const body: Record<string, unknown> = {
      contents: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: opts?.temperature ?? 1.0, maxOutputTokens: opts?.max_tokens ?? 4096 },
    };
    if (system) body.systemInstruction = { parts: [{ text: system.content }] };

    const response = await fetch(`${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new ProviderError('google', model, response.status);

    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t || !t.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(t.slice(6)) as Record<string, unknown>;
          const parts = ((json.candidates as Array<Record<string, unknown>>)?.[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>>;
          for (const part of parts ?? []) if (part.text) yield part.text as string;
        } catch { /* skip */ }
      }
    }
  }
}
