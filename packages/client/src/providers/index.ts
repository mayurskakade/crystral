import { BUILT_IN_PROVIDERS, type BuiltInProvider } from '../types.js';
import { InvalidConfigError } from '../errors.js';
import type { ProviderClient } from './base.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GroqProvider } from './groq.js';
import { GoogleProvider } from './google.js';
import { TogetherProvider } from './together.js';

/** Factory function type for creating provider clients. */
export type ProviderFactory = (apiKey: string, baseUrl?: string) => ProviderClient;

/**
 * Runtime-extensible provider registry — built-ins pre-loaded.
 */
const registry = new Map<string, ProviderFactory>([
  ['openai',    (apiKey, baseUrl) => new OpenAIProvider(apiKey, baseUrl)],
  ['anthropic', (apiKey, baseUrl) => new AnthropicProvider(apiKey, baseUrl)],
  ['groq',      (apiKey, baseUrl) => new GroqProvider(apiKey, baseUrl)],
  ['google',    (apiKey, baseUrl) => new GoogleProvider(apiKey, baseUrl)],
  ['together',  (apiKey, baseUrl) => new TogetherProvider(apiKey, baseUrl)],
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
    throw new InvalidConfigError(`Cannot unregister built-in provider: ${name}`);
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
 * - `"openai-compatible"` — zero-code shortcut for any OpenAI-compatible API.
 *   Requires `baseUrl`.
 */
export function createProvider(provider: string, apiKey: string, baseUrl?: string): ProviderClient {
  // Built-in OpenAI-compatible shortcut — no registration needed
  if (provider === 'openai-compatible') {
    if (!baseUrl) {
      throw new InvalidConfigError(
        '`openai-compatible` provider requires `baseUrl` in ClientConfig.'
      );
    }
    return new OpenAIProvider(apiKey, baseUrl);
  }

  const factory = registry.get(provider);
  if (!factory) {
    throw new InvalidConfigError(
      `Unknown provider: "${provider}". ` +
      `Built-in providers: ${BUILT_IN_PROVIDERS.join(', ')}. ` +
      `Use registerProvider() to add custom providers.`
    );
  }

  return factory(apiKey, baseUrl);
}

export { OpenAIProvider, AnthropicProvider, GroqProvider, GoogleProvider, TogetherProvider };
export type { ProviderClient };
