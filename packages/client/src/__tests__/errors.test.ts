import { describe, it, expect } from 'vitest';
import {
  CrystralClientError,
  ProviderError,
  RateLimitError,
  ToolExecutionError,
  InvalidConfigError,
} from '../errors.js';

describe('Error classes', () => {
  it('CrystralClientError has code', () => {
    const err = new CrystralClientError('test', 'PROVIDER_ERROR');
    expect(err.message).toBe('test');
    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err instanceof Error).toBe(true);
  });

  it('ProviderError carries provider, model, statusCode', () => {
    const err = new ProviderError('openai', 'gpt-4o', 500, 'Internal error');
    expect(err.provider).toBe('openai');
    expect(err.model).toBe('gpt-4o');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err instanceof CrystralClientError).toBe(true);
  });

  it('RateLimitError sets statusCode 429 and retryAfterMs', () => {
    const err = new RateLimitError('anthropic', 'claude-3-5-sonnet', 3000);
    expect(err.statusCode).toBe(429);
    expect(err.retryAfterMs).toBe(3000);
    expect(err instanceof ProviderError).toBe(true);
  });

  it('RateLimitError works without retryAfterMs', () => {
    const err = new RateLimitError('groq', 'llama3');
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('ToolExecutionError carries toolName', () => {
    const err = new ToolExecutionError('get_weather', 'Network timeout');
    expect(err.toolName).toBe('get_weather');
    expect(err.message).toContain('get_weather');
    expect(err.message).toContain('Network timeout');
    expect(err.code).toBe('TOOL_EXECUTION_ERROR');
  });

  it('InvalidConfigError has INVALID_CONFIG code', () => {
    const err = new InvalidConfigError('apiKey is required');
    expect(err.code).toBe('INVALID_CONFIG');
  });
});
