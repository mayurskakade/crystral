import type { Message, ToolDefinition, CompletionOptions, CompletionResult, Provider, ImageInput } from '../types/index.js';

/**
 * Base provider client interface
 */
export interface ProviderClient {
  /**
   * Complete a chat completion
   */
  complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult>;
  
  /**
   * Stream a chat completion
   */
  stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string>;
  
  /**
   * Generate embeddings for text
   */
  embed(text: string, model: string): Promise<number[]>;
  
  /**
   * Check if provider supports embeddings
   */
  supportsEmbeddings(): boolean;
}

/**
 * Provider factory function type
 */
export type ProviderFactory = (apiKey: string) => ProviderClient;

/**
 * Convert internal message format to provider-specific format
 */
export interface ProviderMessage {
  role: string;
  content: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
}

/**
 * Format messages for a provider
 */
export function formatMessagesForProvider(messages: Message[]): ProviderMessage[] {
  return messages.map(msg => {
    const formatted: ProviderMessage = {
      role: msg.role,
      content: msg.content,
    };
    
    if (msg.tool_calls) {
      formatted.tool_calls = msg.tool_calls;
    }
    
    if (msg.tool_call_id) {
      formatted.tool_call_id = msg.tool_call_id;
    }
    
    return formatted;
  });
}

/**
 * Convert tool definitions to OpenAI function format
 */
export function formatToolsForProvider(tools: ToolDefinition[]): unknown {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  }));
}

/**
 * Cost calculation rates (USD per 1M tokens)
 */
export const COST_RATES: Record<string, { input: number; output: number }> = {
  'openai:gpt-4o': { input: 5.00, output: 15.00 },
  'openai:gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai:gpt-4-turbo': { input: 10.00, output: 30.00 },
  'openai:gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'anthropic:claude-opus': { input: 15.00, output: 75.00 },
  'anthropic:claude-sonnet': { input: 3.00, output: 15.00 },
  'anthropic:claude-haiku': { input: 0.25, output: 1.25 },
  'google:gemini-1.5-pro': { input: 3.50, output: 10.50 },
  'google:gemini-1.5-flash': { input: 0.35, output: 1.05 },
};

/**
 * Calculate cost based on token usage
 */
export function calculateCost(
  provider: Provider,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const key = `${provider}:${model.split('-').slice(0, 2).join('-')}`;
  const rates = COST_RATES[key];
  
  if (!rates) {
    // Default to 0 if rates not found
    return 0;
  }
  
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  
  return inputCost + outputCost;
}

/**
 * Build OpenAI-compatible content blocks with images for multimodal requests.
 * Appends image_url parts to the last user message.
 */
export function buildOpenAIImageContent(
  messages: ProviderMessage[],
  images: ImageInput[]
): ProviderMessage[] {
  if (images.length === 0) return messages;

  const result = messages.map(m => ({ ...m }));
  // Find the last user message and convert its content to content blocks
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      const textPart = { type: 'text' as const, text: msg.content };
      const imageParts = images.map(img => {
        const url = img.data.startsWith('http')
          ? img.data
          : `data:${img.media_type};base64,${img.data}`;
        return {
          type: 'image_url' as const,
          image_url: { url },
        };
      });
      // Replace content with content blocks array (cast to any for provider-specific format)
      (msg as Record<string, unknown>).content = [textPart, ...imageParts];
      break;
    }
  }
  return result;
}

/**
 * Build Anthropic-compatible content blocks with images for multimodal requests.
 * Appends image parts to the last user message.
 */
export function buildAnthropicImageContent(
  messages: Array<{ role: string; content: unknown }>,
  images: ImageInput[]
): Array<{ role: string; content: unknown }> {
  if (images.length === 0) return messages;

  const result = messages.map(m => ({ ...m }));
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      const textPart = { type: 'text' as const, text: msg.content as string };
      const imageParts = images.map(img => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.media_type,
          data: img.data.startsWith('http') ? img.data : img.data,
        },
      }));
      msg.content = [textPart, ...imageParts];
      break;
    }
  }
  return result;
}

/**
 * Build Google Gemini-compatible content parts with images for multimodal requests.
 * Appends inlineData parts to the last user content.
 */
export function buildGeminiImageParts(
  contents: Array<{ role: string; parts: unknown[] }>,
  images: ImageInput[]
): Array<{ role: string; parts: unknown[] }> {
  if (images.length === 0) return contents;

  const result = contents.map(c => ({ ...c, parts: [...c.parts] }));
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      const imageParts = images.map(img => ({
        inlineData: {
          mimeType: img.media_type,
          data: img.data,
        },
      }));
      msg.parts = [...msg.parts, ...imageParts];
      break;
    }
  }
  return result;
}

/**
 * Provider status page URLs
 */
export const PROVIDER_STATUS_URLS: Record<Provider, string> = {
  openai: 'https://status.openai.com/',
  anthropic: 'https://status.anthropic.com/',
  groq: 'https://groq.com/status',
  google: 'https://status.cloud.google.com/',
  together: 'https://status.together.ai/',
};
