import { BUILT_IN_PROVIDERS, type BuiltInProvider } from '../types/index.js';
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
 * Runtime-extensible provider registry — built-ins pre-loaded.
 */
const registry = new Map<string, ProviderFactory>([
  ['openai',    (apiKey) => new OpenAIProvider(apiKey)],
  ['anthropic', (apiKey) => new AnthropicProvider(apiKey)],
  ['groq',      (apiKey) => new GroqProvider(apiKey)],
  ['google',    (apiKey) => new GoogleProvider(apiKey)],
  ['together',  (apiKey) => new TogetherProvider(apiKey)],
]);

/**
 * Register a custom provider. Call before creating any agent that uses it.
 *
 * @example
 * registerProvider('replicate', (apiKey) => new ReplicateProvider(apiKey));
 */
export function registerProvider(name: string, factory: ProviderFactory): void {
  registry.set(name, factory);
}

/**
 * Remove a previously registered custom provider.
 * Throws if you attempt to unregister a built-in provider.
 */
export function unregisterProvider(name: string): void {
  if ((BUILT_IN_PROVIDERS as readonly string[]).includes(name)) {
    throw new Error(`Cannot unregister built-in provider: ${name}`);
  }
  registry.delete(name);
}

/**
 * List all registered provider names (built-in + custom).
 */
export function listProviders(): string[] {
  return Array.from(registry.keys());
}

/**
 * Create a provider client for the given provider name.
 *
 * Special values:
 * - `"openai-compatible"` — zero-code shortcut for any OpenAI-compatible API
 *   (Perplexity, Fireworks, Ollama, proxies). Requires `baseUrl`.
 */
export function createProvider(provider: string, apiKey: string, baseUrl?: string): ProviderClient {
  // Built-in OpenAI-compatible shortcut — no registration needed
  if (provider === 'openai-compatible') {
    if (!baseUrl) {
      throw new Error(
        '`openai-compatible` provider requires `base_url` in agent config.'
      );
    }
    return new OpenAIProvider(apiKey, baseUrl);
  }

  const factory = registry.get(provider);
  if (!factory) {
    throw new Error(
      `Unknown provider: "${provider}". ` +
      `Built-in providers: ${BUILT_IN_PROVIDERS.join(', ')}. ` +
      `Use registerProvider() to add custom providers.`
    );
  }

  // For built-in providers that accept a baseUrl, honour the override
  if (baseUrl) {
    switch (provider as BuiltInProvider) {
      case 'openai':    return new OpenAIProvider(apiKey, baseUrl);
      case 'anthropic': return new AnthropicProvider(apiKey, baseUrl);
      case 'groq':      return new GroqProvider(apiKey, baseUrl);
      case 'google':    return new GoogleProvider(apiKey, baseUrl);
      case 'together':  return new TogetherProvider(apiKey, baseUrl);
    }
    // For custom providers, baseUrl handling is their responsibility
  }

  return factory(apiKey);
}

/**
 * Get the default model for a provider.
 * Returns `undefined` for custom providers — they must specify `model` in config.
 */
export function getDefaultModel(provider: string): string | undefined {
  const defaults: Record<BuiltInProvider, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-haiku-20240307',
    groq: 'llama-3.1-70b-versatile',
    google: 'gemini-1.5-flash',
    together: 'meta-llama/Llama-3-70b-chat-hf',
  };

  return defaults[provider as BuiltInProvider];
}
