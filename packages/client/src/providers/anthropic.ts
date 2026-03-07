import type { Message, CompletionOptions, CompletionResult } from '../types.js';
import { ProviderError, RateLimitError } from '../errors.js';
import type { ProviderClient } from './base.js';
import { buildAnthropicImageContent, buildAnthropicDocumentContent } from './base.js';

export class AnthropicProvider implements ProviderClient {
  constructor(private apiKey: string, private baseUrl = 'https://api.anthropic.com/v1') {}

  supportsVision(): boolean { return true; }
  supportsTranscription(): boolean { return false; }
  supportsAudioInput(): boolean { return false; }
  supportsTTS(): boolean { return false; }
  supportsImageGeneration(): boolean { return false; }
  supportsDocuments(): boolean { return true; }

  async complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult> {
    const system = messages.find(m => m.role === 'system');
    let formatted: Array<{ role: string; content: unknown }> = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content }));

    if (opts?.images?.length) formatted = buildAnthropicImageContent(formatted, opts.images);
    if (opts?.input_blocks?.length) {
      const docs = opts.input_blocks.filter(b => b.type === 'document') as import('../types.js').DocumentBlock[];
      if (docs.length) formatted = buildAnthropicDocumentContent(formatted, docs);
    }

    const body: Record<string, unknown> = {
      model, messages: formatted, max_tokens: opts?.max_tokens ?? 4096,
    };
    if (system) body.system = system.content;
    if (opts?.temperature !== undefined) body.temperature = opts.temperature;
    if (opts?.top_p !== undefined) body.top_p = opts.top_p;
    if (opts?.stop_sequences?.length) body.stop_sequences = opts.stop_sequences;
    if (opts?.tools?.length) {
      body.tools = opts.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (err.error as Record<string, unknown>)?.message as string || 'Unknown error';
      if (response.status === 429) throw new RateLimitError('anthropic', model);
      throw new ProviderError('anthropic', model, response.status, msg);
    }

    const data = await response.json() as Record<string, unknown>;
    const content = data.content as Array<Record<string, unknown>>;
    const usage = data.usage as Record<string, number>;

    let text = '';
    const toolCalls: CompletionResult['tool_calls'] = [];
    for (const block of content ?? []) {
      if (block.type === 'text') text += block.text as string;
      else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id as string, name: block.name as string, arguments: block.input as Record<string, unknown> });
      }
    }

    return {
      content: text,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      finish_reason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    };
  }

  async *stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string> {
    const system = messages.find(m => m.role === 'system');
    const body: Record<string, unknown> = {
      model,
      messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content })),
      max_tokens: opts?.max_tokens ?? 4096,
      stream: true,
    };
    if (system) body.system = system.content;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new ProviderError('anthropic', model, response.status);

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
          if (json.type === 'content_block_delta') {
            const delta = json.delta as Record<string, unknown>;
            if (delta.type === 'text_delta' && delta.text) yield delta.text as string;
          }
        } catch { /* skip */ }
      }
    }
  }
}
