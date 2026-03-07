import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerProvider,
  unregisterProvider,
  listProviders,
  createProvider,
} from '../providers/index.js';
import { OpenAIProvider } from '../providers/openai.js';
import type { ProviderClient } from '../providers/base.js';

// Minimal mock provider that satisfies the ProviderClient interface
function makeMockProvider(): ProviderClient {
  return {
    complete: vi.fn().mockResolvedValue({
      content: 'mock response',
      tool_calls: [],
      input_tokens: 10,
      output_tokens: 5,
      finish_reason: 'stop' as const,
    }),
    stream: vi.fn(async function* () { yield 'mock'; }),
    embed: vi.fn().mockResolvedValue([0.1, 0.2]),
    supportsEmbeddings: () => false,
    supportsVision: () => false,
    supportsTranscription: () => false,
    supportsAudioInput: () => false,
    supportsTTS: () => false,
    supportsImageGeneration: () => false,
    supportsDocuments: () => false,
  };
}

describe('custom provider registry', () => {
  // Clean up any custom providers registered during tests
  afterEach(() => {
    try { unregisterProvider('custom-llm'); } catch { /* not registered */ }
    try { unregisterProvider('another-llm'); } catch { /* not registered */ }
  });

  it('registerProvider + createProvider returns the custom instance', () => {
    const instance = makeMockProvider();
    registerProvider('custom-llm', () => instance);

    const result = createProvider('custom-llm', 'test-key');
    expect(result).toBe(instance);
  });

  it('unregisterProvider removes it; subsequent createProvider throws', () => {
    registerProvider('custom-llm', () => makeMockProvider());
    unregisterProvider('custom-llm');

    expect(() => createProvider('custom-llm', 'test-key')).toThrow(
      'Unknown provider: "custom-llm"'
    );
  });

  it('listProviders includes built-ins and custom', () => {
    registerProvider('another-llm', () => makeMockProvider());

    const providers = listProviders();
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
    expect(providers).toContain('groq');
    expect(providers).toContain('google');
    expect(providers).toContain('together');
    expect(providers).toContain('another-llm');
  });

  it('unregisterProvider on a built-in throws', () => {
    expect(() => unregisterProvider('openai')).toThrow(
      'Cannot unregister built-in provider: openai'
    );
    expect(() => unregisterProvider('anthropic')).toThrow(
      'Cannot unregister built-in provider: anthropic'
    );
  });

  it('openai-compatible without base_url throws a descriptive error', () => {
    expect(() => createProvider('openai-compatible', 'test-key')).toThrow(
      '`openai-compatible` provider requires `base_url`'
    );
  });

  it('openai-compatible with base_url returns an OpenAIProvider instance', () => {
    const client = createProvider(
      'openai-compatible',
      'test-key',
      'https://api.example.com/v1'
    );
    expect(client).toBeInstanceOf(OpenAIProvider);
  });

  it('completely unknown provider throws with helpful message', () => {
    expect(() => createProvider('unknown-xyz', 'test-key')).toThrow(
      'Unknown provider: "unknown-xyz"'
    );
    expect(() => createProvider('unknown-xyz', 'test-key')).toThrow(
      'Built-in providers:'
    );
    expect(() => createProvider('unknown-xyz', 'test-key')).toThrow(
      'registerProvider()'
    );
  });
});
