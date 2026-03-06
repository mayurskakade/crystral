import type { Provider } from '../types/index.js';
import type { ProviderClient, ProviderFactory } from './base.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GroqProvider } from './groq.js';
import { GoogleProvider } from './google.js';
import { TogetherProvider } from './together.js';

export * from './base.js';
export * from './openai.js';
export * from './anthropic.js';
export * from './groq.js';
export * from './google.js';
export * from './together.js';

/**
 * Provider factories registry
 */
const PROVIDER_FACTORIES: Record<Provider, ProviderFactory> = {
  openai: (apiKey: string) => new OpenAIProvider(apiKey),
  anthropic: (apiKey: string) => new AnthropicProvider(apiKey),
  groq: (apiKey: string) => new GroqProvider(apiKey),
  google: (apiKey: string) => new GoogleProvider(apiKey),
  together: (apiKey: string) => new TogetherProvider(apiKey),
};

/**
 * Create a provider client for the given provider
 */
export function createProvider(provider: Provider, apiKey: string, baseUrl?: string): ProviderClient {
  const factory = PROVIDER_FACTORIES[provider];
  
  if (!factory) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  
  if (baseUrl) {
    // Create with custom base URL
    switch (provider) {
      case 'openai':
        return new OpenAIProvider(apiKey, baseUrl);
      case 'anthropic':
        return new AnthropicProvider(apiKey, baseUrl);
      case 'groq':
        return new GroqProvider(apiKey, baseUrl);
      case 'google':
        return new GoogleProvider(apiKey, baseUrl);
      case 'together':
        return new TogetherProvider(apiKey, baseUrl);
    }
  }
  
  return factory(apiKey);
}

/**
 * Get the default model for a provider
 */
export function getDefaultModel(provider: Provider): string {
  const defaults: Record<Provider, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-haiku-20240307',
    groq: 'llama-3.1-70b-versatile',
    google: 'gemini-1.5-flash',
    together: 'meta-llama/Llama-3-70b-chat-hf',
  };
  
  return defaults[provider];
}
