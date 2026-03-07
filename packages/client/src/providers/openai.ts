import type { Message, CompletionOptions, CompletionResult, AudioBlock, AudioOutput, ImageOutput } from '../types.js';
import { ProviderError, RateLimitError } from '../errors.js';
import type { ProviderClient } from './base.js';
import { formatMessages, formatTools, buildOpenAIImageContent, buildOpenAIAudioContent } from './base.js';

export class OpenAIProvider implements ProviderClient {
  constructor(private apiKey: string, private baseUrl = 'https://api.openai.com/v1') {}

  supportsVision(): boolean { return true; }
  supportsTranscription(): boolean { return true; }
  supportsAudioInput(): boolean { return true; }
  supportsTTS(): boolean { return true; }
  supportsImageGeneration(): boolean { return true; }
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
      throw new ProviderError('openai', model, response.status, (err.error as Record<string, unknown>)?.message as string || 'Unknown error');
    }
    return ((await response.json()) as Record<string, unknown>).text as string ?? '';
  }

  async synthesize(text: string, model: string, voice?: string): Promise<AudioOutput> {
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, input: text, voice: voice ?? 'alloy', response_format: 'mp3' }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new ProviderError('openai', model, response.status, (err.error as Record<string, unknown>)?.message as string || 'Unknown error');
    }
    const buffer = await response.arrayBuffer();
    return { type: 'audio', data: btoa(String.fromCharCode(...new Uint8Array(buffer))), media_type: 'audio/mpeg' };
  }

  async generateImage(prompt: string, model: string, opts?: { size?: string; n?: number }): Promise<ImageOutput[]> {
    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model, prompt, n: opts?.n ?? 1, size: opts?.size ?? '1024x1024', response_format: 'b64_json' }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new ProviderError('openai', model, response.status, (err.error as Record<string, unknown>)?.message as string || 'Unknown error');
    }
    const data = await response.json() as Record<string, unknown>;
    return (data.data as Array<Record<string, unknown>>).map(img => ({
      type: 'image' as const, data: img.b64_json as string, media_type: 'image/png',
      ...(img.revised_prompt ? { revised_prompt: img.revised_prompt as string } : {}),
    }));
  }

  async complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult> {
    let formatted = formatMessages(messages);
    if (opts?.images?.length) formatted = buildOpenAIImageContent(formatted, opts.images);
    if (opts?.input_blocks?.length) {
      const audioBlocks = opts.input_blocks.filter(b => b.type === 'audio') as AudioBlock[];
      if (audioBlocks.length) formatted = buildOpenAIAudioContent(formatted, audioBlocks);
    }

    const body: Record<string, unknown> = {
      model,
      messages: formatted,
      temperature: opts?.temperature ?? 1.0,
      max_tokens: opts?.max_tokens ?? 4096,
    };
    if (opts?.top_p !== undefined) body.top_p = opts.top_p;
    if (opts?.stop_sequences?.length) body.stop = opts.stop_sequences;
    if (opts?.tools?.length) { body.tools = formatTools(opts.tools); body.tool_choice = opts.tool_choice ?? 'auto'; }
    if (opts?.response_format) body.response_format = { type: opts.response_format.type };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (err.error as Record<string, unknown>)?.message as string || 'Unknown error';
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        throw new RateLimitError('openai', model, retryAfter ? parseInt(retryAfter) * 1000 : undefined);
      }
      throw new ProviderError('openai', model, response.status, msg);
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
    if (!response.ok) throw new ProviderError('openai', model, response.status);

    yield* readSSE(response, chunk => {
      const delta = (chunk.choices as Array<Record<string, unknown>>)?.[0]?.delta as Record<string, unknown>;
      return (delta?.content as string) ?? '';
    });
  }
}

async function* readSSE(response: Response, extract: (chunk: Record<string, unknown>) => string): AsyncIterable<string> {
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
      if (!t || t === 'data: [DONE]' || !t.startsWith('data: ')) continue;
      try {
        const text = extract(JSON.parse(t.slice(6)) as Record<string, unknown>);
        if (text) yield text;
      } catch { /* skip */ }
    }
  }
}

export { readSSE };
