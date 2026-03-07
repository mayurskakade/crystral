import type { Message, CompletionOptions, CompletionResult, AudioOutput } from '../types/index.js';
import { ProviderError, RateLimitError } from '../errors/index.js';
import { ProviderClient, buildGeminiImageParts, buildGeminiAudioParts, buildGeminiDocumentParts } from './base.js';

/**
 * Google (Gemini) provider implementation
 */
export class GoogleProvider implements ProviderClient {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }
  
  supportsVision(): boolean { return true; }
  supportsTranscription(): boolean { return false; }
  supportsAudioInput(): boolean { return true; }
  supportsTTS(): boolean { return true; }
  supportsImageGeneration(): boolean { return false; }
  supportsDocuments(): boolean { return true; }

  /**
   * Gemini native TTS via generateContent with responseModalities: ["AUDIO"].
   * Uses speechConfig.voiceConfig.prebuiltVoiceConfig for voice selection.
   * Available voices: Aoede, Charon, Fenrir, Kore, Puck.
   * Response audio is PCM at 24000Hz returned as inlineData base64.
   */
  async synthesize(text: string, model: string, voice?: string): Promise<AudioOutput> {
    const requestBody = {
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice ?? 'Aoede',
            },
          },
        },
      },
    };

    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const errorMessage = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
      if (response.status === 429) throw new RateLimitError('google', model);
      throw new ProviderError('google', model, response.status, errorMessage);
    }

    const data = await response.json() as Record<string, unknown>;
    const candidates = data.candidates as Array<Record<string, unknown>>;
    const parts = (candidates?.[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>>;

    for (const part of parts ?? []) {
      const inlineData = part.inlineData as Record<string, unknown> | undefined;
      if (inlineData?.data) {
        return {
          type: 'audio',
          data: inlineData.data as string,
          // Gemini returns audio/pcm;rate=24000 — normalise to audio/pcm
          media_type: ((inlineData.mimeType as string) ?? 'audio/pcm').split(';')[0] as string,
        };
      }
    }

    throw new ProviderError('google', model, 0, 'No audio data in Gemini TTS response');
  }

  async complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult> {
    // Convert messages to Gemini format
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    let contents = nonSystemMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }] as unknown[],
    }));

    // Vision support: add inlineData parts for images
    if (opts?.images && opts.images.length > 0) {
      contents = buildGeminiImageParts(contents, opts.images);
    }

    // Native audio-in-chat support (Gemini inlineData)
    if (opts?.input_blocks && opts.input_blocks.length > 0) {
      const audioBlocks = opts.input_blocks.filter(b => b.type === 'audio') as import('../types/index.js').AudioBlock[];
      if (audioBlocks.length > 0) {
        contents = buildGeminiAudioParts(contents, audioBlocks);
      }
      const docBlocks = opts.input_blocks.filter(b => b.type === 'document') as import('../types/index.js').DocumentBlock[];
      if (docBlocks.length > 0) {
        contents = buildGeminiDocumentParts(contents, docBlocks);
      }
    }

    const generationConfig: Record<string, unknown> = {
      temperature: opts?.temperature ?? 1.0,
      maxOutputTokens: opts?.max_tokens ?? 4096,
      topP: opts?.top_p,
      stopSequences: opts?.stop_sequences,
    };

    // JSON mode support
    if (opts?.response_format?.type === 'json_object') {
      generationConfig.responseMimeType = 'application/json';
    }

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig,
    };

    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    if (opts?.tools?.length) {
      requestBody.tools = [{
        functionDeclarations: opts.tools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        })),
      }];
    }
    
    try {
      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        const errorMessage = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
        
        if (response.status === 429) {
          throw new RateLimitError('google', model);
        }
        
        throw new ProviderError('google', model, response.status, errorMessage, 'https://status.cloud.google.com/');
      }
      
      const data = await response.json() as Record<string, unknown>;
      const candidates = data.candidates as Array<Record<string, unknown>>;
      const candidate = candidates?.[0];
      const content = candidate?.content as Record<string, unknown>;
      const parts = content?.parts as Array<Record<string, unknown>>;
      const usageMetadata = data.usageMetadata as Record<string, number>;
      
      let textContent = '';
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
      
      for (const part of parts ?? []) {
        if (part.text) {
          textContent += part.text as string;
        } else if (part.functionCall) {
          const fc = part.functionCall as Record<string, unknown>;
          toolCalls.push({
            id: `call_${toolCalls.length}`,
            name: fc.name as string,
            arguments: fc.args as Record<string, unknown>,
          });
        }
      }
      
      const finishReason = candidate?.finishReason as string;
      
      return {
        content: textContent,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        input_tokens: usageMetadata?.promptTokenCount ?? 0,
        output_tokens: usageMetadata?.candidatesTokenCount ?? 0,
        finish_reason: finishReason === 'STOP' ? 'stop' : finishReason === 'FUNCTION_CALL' ? 'tool_calls' : 'stop',
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError('google', model, 0, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  async *stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    const contents = nonSystemMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    
    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: opts?.temperature ?? 1.0,
        maxOutputTokens: opts?.max_tokens ?? 4096,
      },
    };
    
    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }
    
    const response = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    if (!response.ok) {
      throw new ProviderError('google', model, response.status);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new ProviderError('google', model, 0, 'No response body');
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        
        try {
          const json = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
          const candidates = json.candidates as Array<Record<string, unknown>>;
          const content = candidates?.[0]?.content as Record<string, unknown>;
          const parts = content?.parts as Array<Record<string, unknown>>;
          
          for (const part of parts ?? []) {
            if (part.text) {
              yield part.text as string;
            }
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }
  }
  
  async embed(text: string, model: string = 'text-embedding-004'): Promise<number[]> {
    const response = await fetch(
      `${this.baseUrl}/models/${model}:embedContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: `models/${model}`,
          content: {
            parts: [{ text }],
          },
        }),
      }
    );
    
    if (!response.ok) {
      throw new ProviderError('google', model, response.status);
    }
    
    const data = await response.json() as Record<string, unknown>;
    const embedding = data.embedding as Record<string, unknown>;
    
    return embedding?.values as number[] ?? [];
  }
  
  supportsEmbeddings(): boolean { return true; }
}
