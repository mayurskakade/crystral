import type { Message, CompletionOptions, CompletionResult, AudioBlock } from '../types.js';
import { ProviderError, RateLimitError } from '../errors.js';
import type { ProviderClient } from './base.js';
import { formatMessages, formatTools } from './base.js';
import { readSSE } from './openai.js';

export class GroqProvider implements ProviderClient {
  constructor(private apiKey: string, private baseUrl = 'https://api.groq.com/openai/v1') {}

  supportsVision(): boolean { return false; }
  supportsTranscription(): boolean { return true; }
  supportsAudioInput(): boolean { return false; }
  supportsTTS(): boolean { return false; }
  supportsImageGeneration(): boolean { return false; }
  supportsDocuments(): boolean { return false; }

  async transcribe(audio: AudioBlock, model: string): Promise<string> {
    const ext = audio.media_type.replace('audio/', '') || 'mp3';
    const binaryStr = atob(audio.data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: audio.media_type }), `audio.${ext}`);
    form.append('model', model);
    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new ProviderError('groq', model, response.status, (err.error as Record<string, unknown>)?.message as string || 'Unknown error');
    }
    return ((await response.json()) as Record<string, unknown>).text as string ?? '';
  }

  async complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model, messages: formatMessages(messages),
      temperature: opts?.temperature ?? 1.0, max_tokens: opts?.max_tokens ?? 4096,
    };
    if (opts?.top_p !== undefined) body.top_p = opts.top_p;
    if (opts?.stop_sequences?.length) body.stop = opts.stop_sequences;
    if (opts?.tools?.length) { body.tools = formatTools(opts.tools); body.tool_choice = 'auto'; }
    if (opts?.response_format) body.response_format = { type: opts.response_format.type };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (err.error as Record<string, unknown>)?.message as string || 'Unknown error';
      if (response.status === 429) throw new RateLimitError('groq', model);
      throw new ProviderError('groq', model, response.status, msg);
    }

    const data = await response.json() as Record<string, unknown>;
    const choice = (data.choices as Array<Record<string, unknown>>)?.[0];
    const message = choice?.message as Record<string, unknown>;
    const usage = data.usage as Record<string, number>;
    const rawToolCalls = message?.tool_calls as Array<Record<string, unknown>> | undefined;

    return {
      content: (message?.content as string) ?? '',
      ...(rawToolCalls?.length ? {
        tool_calls: rawToolCalls.map(tc => {
          const fn = tc.function as Record<string, unknown>;
          return { id: tc.id as string, name: fn.name as string, arguments: JSON.parse(fn.arguments as string || '{}') };
        }),
      } : {}),
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      finish_reason: (choice?.finish_reason as CompletionResult['finish_reason']) ?? 'stop',
    };
  }

  async *stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string> {
    const body: Record<string, unknown> = {
      model, messages: formatMessages(messages),
      temperature: opts?.temperature ?? 1.0, max_tokens: opts?.max_tokens ?? 4096, stream: true,
    };
    if (opts?.tools?.length) { body.tools = formatTools(opts.tools); body.tool_choice = 'auto'; }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new ProviderError('groq', model, response.status);

    yield* readSSE(response, chunk => {
      const delta = (chunk.choices as Array<Record<string, unknown>>)?.[0]?.delta as Record<string, unknown>;
      return (delta?.content as string) ?? '';
    });
  }
}
