import type { Message, CompletionOptions, CompletionResult } from '../types/index.js';
import { ProviderError, RateLimitError } from '../errors/index.js';
import { ProviderClient, buildAnthropicImageContent } from './base.js';

/**
 * Anthropic provider implementation
 */
export class AnthropicProvider implements ProviderClient {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? 'https://api.anthropic.com/v1';
  }
  
  async complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult> {
    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    let formattedMessages: Array<{ role: string; content: unknown }> = nonSystemMessages.map(m => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content: m.content,
    }));

    // Vision support: convert to content blocks with images
    if (opts?.images && opts.images.length > 0) {
      formattedMessages = buildAnthropicImageContent(formattedMessages, opts.images);
    }

    const requestBody: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      max_tokens: opts?.max_tokens ?? 4096,
    };

    if (systemMessage) {
      requestBody.system = systemMessage.content;
    }

    if (opts?.temperature !== undefined) {
      requestBody.temperature = opts.temperature;
    }

    if (opts?.top_p !== undefined) {
      requestBody.top_p = opts.top_p;
    }

    if (opts?.stop_sequences?.length) {
      requestBody.stop_sequences = opts.stop_sequences;
    }

    if (opts?.tools?.length) {
      requestBody.tools = opts.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      }));
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        const errorMessage = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
        
        if (response.status === 429) {
          throw new RateLimitError('anthropic', model);
        }
        
        throw new ProviderError('anthropic', model, response.status, errorMessage, 'https://status.anthropic.com/');
      }
      
      const data = await response.json() as Record<string, unknown>;
      const content = data.content as Array<Record<string, unknown>>;
      const usage = data.usage as Record<string, number>;
      
      let textContent = '';
      const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
      
      for (const block of content ?? []) {
        if (block.type === 'text') {
          textContent += block.text as string;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id as string,
            name: block.name as string,
            arguments: block.input as Record<string, unknown>,
          });
        }
      }
      
      const stopReason = data.stop_reason as string;
      
      return {
        content: textContent,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        input_tokens: usage?.input_tokens ?? 0,
        output_tokens: usage?.output_tokens ?? 0,
        finish_reason: stopReason === 'tool_use' ? 'tool_calls' : 'stop',
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError('anthropic', model, 0, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  async *stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    const requestBody: Record<string, unknown> = {
      model,
      messages: nonSystemMessages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      })),
      max_tokens: opts?.max_tokens ?? 4096,
      stream: true,
    };
    
    if (systemMessage) {
      requestBody.system = systemMessage.content;
    }
    
    if (opts?.tools?.length) {
      requestBody.tools = opts.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      }));
    }
    
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const errorMessage = (errorData.error as Record<string, unknown>)?.message as string || 'Unknown error';
      throw new ProviderError('anthropic', model, response.status, errorMessage);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new ProviderError('anthropic', model, 0, 'No response body');
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
          const type = json.type as string;
          
          if (type === 'content_block_delta') {
            const delta = json.delta as Record<string, unknown>;
            if (delta.type === 'text_delta') {
              const text = delta.text as string;
              if (text) {
                yield text;
              }
            }
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }
  }
  
  async embed(_text: string, _model: string): Promise<number[]> {
    throw new ProviderError('anthropic', '', 0, 'Anthropic does not support embeddings');
  }
  
  supportsEmbeddings(): boolean {
    return false;
  }
}
