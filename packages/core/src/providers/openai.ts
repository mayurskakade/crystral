import type { Message, CompletionOptions, CompletionResult, AudioBlock, AudioOutput, ImageOutput } from '../types/index.js';
import { ProviderError, RateLimitError } from '../errors/index.js';
import { ProviderClient, formatMessagesForProvider, formatToolsForProvider, buildOpenAIImageContent, buildOpenAIAudioContent } from './base.js';

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements ProviderClient {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? 'https://api.openai.com/v1';
  }
  
  supportsVision(): boolean { return true; }
  supportsTranscription(): boolean { return true; }
  supportsAudioInput(): boolean { return true; }
  supportsTTS(): boolean { return true; }
  supportsImageGeneration(): boolean { return true; }
  supportsDocuments(): boolean { return false; }

  async transcribe(audio: AudioBlock, model: string): Promise<string> {
    const mimeType = audio.media_type;
    const ext = mimeType.replace('audio/', '') || 'mp3';
    // Decode base64 to binary
    const binaryStr = atob(audio.data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    const form = new FormData();
    form.append('file', blob, `audio.${ext}`);
    form.append('model', model);

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
      throw new ProviderError('openai', model, response.status, msg);
    }

    const data = await response.json() as Record<string, unknown>;
    return (data.text as string) ?? '';
  }

  async synthesize(text: string, model: string, voice?: string): Promise<AudioOutput> {
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        voice: voice ?? 'alloy',
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
      throw new ProviderError('openai', model, response.status, msg);
    }

    const buffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { type: 'audio', data: base64, media_type: 'audio/mpeg' };
  }

  async generateImage(prompt: string, model: string, opts?: { size?: string; n?: number }): Promise<ImageOutput[]> {
    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        n: opts?.n ?? 1,
        size: opts?.size ?? '1024x1024',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
      throw new ProviderError('openai', model, response.status, msg);
    }

    const data = await response.json() as Record<string, unknown>;
    const images = data.data as Array<Record<string, unknown>>;
    return images.map(img => ({
      type: 'image' as const,
      data: img.b64_json as string,
      media_type: 'image/png',
      ...(img.revised_prompt ? { revised_prompt: img.revised_prompt as string } : {}),
    }));
  }

  async complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult> {
    let formattedMessages = formatMessagesForProvider(messages);

    // Vision support: convert to content blocks with images
    if (opts?.images && opts.images.length > 0) {
      formattedMessages = buildOpenAIImageContent(formattedMessages, opts.images);
    }

    // Native audio-in-chat support (gpt-4o-audio-preview)
    if (opts?.input_blocks && opts.input_blocks.length > 0) {
      const audioBlocks = opts.input_blocks.filter(b => b.type === 'audio') as import('../types/index.js').AudioBlock[];
      if (audioBlocks.length > 0) {
        formattedMessages = buildOpenAIAudioContent(formattedMessages, audioBlocks);
      }
    }

    const requestBody: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      temperature: opts?.temperature ?? 1.0,
      max_tokens: opts?.max_tokens ?? 4096,
    };

    if (opts?.top_p !== undefined) {
      requestBody.top_p = opts.top_p;
    }

    if (opts?.presence_penalty !== undefined) {
      requestBody.presence_penalty = opts.presence_penalty;
    }

    if (opts?.frequency_penalty !== undefined) {
      requestBody.frequency_penalty = opts.frequency_penalty;
    }

    if (opts?.stop_sequences?.length) {
      requestBody.stop = opts.stop_sequences;
    }

    if (opts?.tools?.length) {
      requestBody.tools = formatToolsForProvider(opts.tools);
      requestBody.tool_choice = opts.tool_choice ?? 'auto';
    }

    // JSON mode support
    if (opts?.response_format) {
      requestBody.response_format = { type: opts.response_format.type };
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        const errorMessage = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
        
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          throw new RateLimitError('openai', model, retryAfterMs);
        }
        
        throw new ProviderError('openai', model, response.status, errorMessage, 'https://status.openai.com/');
        }
      
      const data = await response.json() as Record<string, unknown>;
      const choices = data.choices as Array<Record<string, unknown>>;
      const choice = choices?.[0];
      const message = choice?.message as Record<string, unknown>;
      const usage = data.usage as Record<string, number>;
      
      const toolCalls = message?.tool_calls as Array<Record<string, unknown>> | undefined;
      const mappedToolCalls = toolCalls?.map(tc => {
        const func = tc.function as Record<string, unknown>;
        return {
          id: tc.id as string,
          name: func?.name as string,
          arguments: JSON.parse(func?.arguments as string || '{}'),
        };
      });
      
      return {
        content: (message?.content as string) ?? '',
        ...(mappedToolCalls && mappedToolCalls.length > 0 ? { tool_calls: mappedToolCalls } : {}),
        input_tokens: usage?.prompt_tokens ?? 0,
        output_tokens: usage?.completion_tokens ?? 0,
        finish_reason: (choice?.finish_reason as string)?.replace('tool_calls', 'tool_calls') as CompletionResult['finish_reason'] ?? 'stop',
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError('openai', model, 0, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  async *stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string> {
    const requestBody: Record<string, unknown> = {
      model,
      messages: formatMessagesForProvider(messages),
      temperature: opts?.temperature ?? 1.0,
      max_tokens: opts?.max_tokens ?? 4096,
      stream: true,
    };
    
    if (opts?.tools?.length) {
      requestBody.tools = formatToolsForProvider(opts.tools);
      requestBody.tool_choice = opts.tool_choice ?? 'auto';
    }
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const errorMessage = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
      
      if (response.status === 429) {
        throw new RateLimitError('openai', model);
      }
      
      throw new ProviderError('openai', model, response.status, errorMessage);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new ProviderError('openai', model, 0, 'No response body');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
            const choices = json.choices as Array<Record<string, unknown>>;
            const delta = choices?.[0]?.delta as Record<string, unknown>;
            const content = delta?.content as string;
            
            if (content) {
              yield content;
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }
  }
  
  async embed(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const errorMessage = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
      throw new ProviderError('openai', model, response.status, errorMessage);
    }
    
    const data = await response.json() as Record<string, unknown>;
    const dataArray = data.data as Array<Record<string, unknown>>;
    const embedding = dataArray?.[0]?.embedding as number[];
    
    return embedding ?? [];
  }
  
  supportsEmbeddings(): boolean { return true; }
}
