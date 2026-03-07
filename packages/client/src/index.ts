export { CrystralClient } from './client.js';
export { registerProvider, unregisterProvider, listProviders } from './providers/index.js';
export { MemoryStorage } from './storage/memory.js';
export { LocalStorageAdapter } from './storage/local-storage.js';
export {
  CrystralClientError,
  ProviderError,
  RateLimitError,
  ToolExecutionError,
  InvalidConfigError,
} from './errors.js';
export { BUILT_IN_PROVIDERS } from './types.js';
export type {
  Provider,
  BuiltInProvider,
  Message,
  ImageInput,
  ClientTool,
  StorageAdapter,
  ClientConfig,
  RunOptions,
  RunResult,
  // Multimodal types
  ContentBlock,
  TextBlock,
  ImageBlock,
  AudioBlock,
  DocumentBlock,
  MediaOutput,
  ImageOutput,
  AudioOutput,
} from './types.js';
