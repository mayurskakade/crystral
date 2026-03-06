import type { Provider } from '../types.js';
import { InvalidConfigError } from '../errors.js';
import type { ProviderClient } from './base.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GroqProvider } from './groq.js';
import { GoogleProvider } from './google.js';
import { TogetherProvider } from './together.js';

export function createProvider(provider: Provider, apiKey: string, baseUrl?: string): ProviderClient {
  switch (provider) {
    case 'openai': return new OpenAIProvider(apiKey, baseUrl);
    case 'anthropic': return new AnthropicProvider(apiKey, baseUrl);
    case 'groq': return new GroqProvider(apiKey, baseUrl);
    case 'google': return new GoogleProvider(apiKey, baseUrl);
    case 'together': return new TogetherProvider(apiKey, baseUrl);
    default: throw new InvalidConfigError(`Unknown provider: ${provider as string}`);
  }
}

export { OpenAIProvider, AnthropicProvider, GroqProvider, GoogleProvider, TogetherProvider };
export type { ProviderClient };
