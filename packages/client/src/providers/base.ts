import type { Message, CompletionOptions, CompletionResult, ImageInput, AudioBlock, AudioOutput, ImageOutput, DocumentBlock } from '../types.js';

export interface ProviderClient {
  complete(messages: Message[], model: string, opts?: CompletionOptions): Promise<CompletionResult>;
  stream(messages: Message[], model: string, opts?: CompletionOptions): AsyncIterable<string>;

  // Capability flags
  supportsVision(): boolean;
  supportsTranscription(): boolean;
  supportsAudioInput(): boolean;
  supportsTTS(): boolean;
  supportsImageGeneration(): boolean;
  supportsDocuments(): boolean;

  // Optional actions
  transcribe?(audio: AudioBlock, model: string): Promise<string>;
  synthesize?(text: string, model: string, voice?: string): Promise<AudioOutput>;
  generateImage?(prompt: string, model: string, opts?: { size?: string; n?: number }): Promise<ImageOutput[]>;
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

export function buildOpenAIAudioContent(
  messages: ProviderMessage[],
  audioBlocks: AudioBlock[]
): ProviderMessage[] {
  if (!audioBlocks.length) return messages;
  const result = messages.map(m => ({ ...m }));
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      const existing = Array.isArray(msg.content)
        ? (msg.content as unknown[])
        : [{ type: 'text' as const, text: msg.content as string }];
      const audioParts = audioBlocks.map(ab => ({
        type: 'input_audio' as const,
        input_audio: { data: ab.data, format: ab.media_type.replace('audio/', '') },
      }));
      msg.content = [...existing, ...audioParts];
      break;
    }
  }
  return result;
}

export function buildGeminiAudioParts(
  contents: Array<{ role: string; parts: unknown[] }>,
  audioBlocks: AudioBlock[]
): Array<{ role: string; parts: unknown[] }> {
  if (!audioBlocks.length) return contents;
  const result = contents.map(c => ({ ...c, parts: [...c.parts] }));
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      msg.parts = [
        ...msg.parts,
        ...audioBlocks.map(ab => ({ inlineData: { mimeType: ab.media_type, data: ab.data } })),
      ];
      break;
    }
  }
  return result;
}

export function buildAnthropicDocumentContent(
  messages: Array<{ role: string; content: unknown }>,
  documents: DocumentBlock[]
): Array<{ role: string; content: unknown }> {
  if (!documents.length) return messages;
  const result = messages.map(m => ({ ...m }));
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      const existing = Array.isArray(msg.content)
        ? (msg.content as unknown[])
        : [{ type: 'text' as const, text: msg.content as string }];
      const docParts = documents.map(doc => ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: doc.media_type, data: doc.data },
        ...(doc.filename ? { title: doc.filename } : {}),
      }));
      msg.content = [...existing, ...docParts];
      break;
    }
  }
  return result;
}

export function buildGeminiDocumentParts(
  contents: Array<{ role: string; parts: unknown[] }>,
  documents: DocumentBlock[]
): Array<{ role: string; parts: unknown[] }> {
  if (!documents.length) return contents;
  const result = contents.map(c => ({ ...c, parts: [...c.parts] }));
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg && msg.role === 'user') {
      msg.parts = [
        ...msg.parts,
        ...documents.map(doc => ({ inlineData: { mimeType: doc.media_type, data: doc.data } })),
      ];
      break;
    }
  }
  return result;
}
