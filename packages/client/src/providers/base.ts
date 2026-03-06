import type { Message, CompletionOptions, CompletionResult, ImageInput } from '../types.js';

export interface ProviderClient {
  complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult>;
  stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string>;
}

export interface ProviderMessage {
  role: string;
  content: unknown;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

export function formatMessages(messages: Message[]): ProviderMessage[] {
  return messages.map(msg => {
    const out: ProviderMessage = { role: msg.role, content: msg.content };
    if (msg.tool_calls) out.tool_calls = msg.tool_calls;
    if (msg.tool_call_id) out.tool_call_id = msg.tool_call_id;
    return out;
  });
}

export function formatTools(tools: CompletionOptions['tools']): unknown {
  return tools?.map(t => ({
    type: 'function',
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));
}

export function buildOpenAIImageContent(
  messages: ProviderMessage[],
  images: ImageInput[]
): ProviderMessage[] {
  if (!images.length) return messages;
  const result = messages.map(m => ({ ...m }));
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      const url = (img: ImageInput) =>
        img.data.startsWith('http') ? img.data : `data:${img.media_type};base64,${img.data}`;
      msg.content = [
        { type: 'text', text: msg.content as string },
        ...images.map(img => ({ type: 'image_url', image_url: { url: url(img) } })),
      ];
      break;
    }
  }
  return result;
}

export function buildAnthropicImageContent(
  messages: Array<{ role: string; content: unknown }>,
  images: ImageInput[]
): Array<{ role: string; content: unknown }> {
  if (!images.length) return messages;
  const result = messages.map(m => ({ ...m }));
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      msg.content = [
        { type: 'text', text: msg.content as string },
        ...images.map(img => ({
          type: 'image',
          source: { type: 'base64', media_type: img.media_type, data: img.data },
        })),
      ];
      break;
    }
  }
  return result;
}

export function buildGeminiImageParts(
  contents: Array<{ role: string; parts: unknown[] }>,
  images: ImageInput[]
): Array<{ role: string; parts: unknown[] }> {
  if (!images.length) return contents;
  const result = contents.map(c => ({ ...c, parts: [...c.parts] }));
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      msg.parts = [
        ...msg.parts,
        ...images.map(img => ({ inlineData: { mimeType: img.media_type, data: img.data } })),
      ];
      break;
    }
  }
  return result;
}
