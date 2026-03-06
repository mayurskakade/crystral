import { describe, it, expect, beforeAll } from 'vitest';
import { AgentRunner } from '../agent/runner.ts';
import { withRetry } from '../retry/index.ts';
import { createMockStorage, togetherConfig } from './helpers/fixtures.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';
import type { AgentConfig } from '../types/index.ts';

const TOGETHER_KEY = process.env['TOGETHER_API_KEY'];

beforeAll(() => {
  if (!TOGETHER_KEY) {
    throw new Error('TOGETHER_API_KEY environment variable is required for integration tests');
  }
});

function makeAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    version: 1,
    name: 'retry-test-agent',
    ...togetherConfig(),
    system_prompt: 'You are a helpful assistant.',
    temperature: 0,
    max_tokens: 128,
    top_p: 1.0,
    presence_penalty: 0,
    frequency_penalty: 0,
    tools: [],
    mcp: [],
    ...overrides,
  };
}

describe('2.3 real provider retry behavior', () => {
  it('2.3.1 successful call with retry config completes normally', async () => {
    execute('agent with retry config → run succeeds on first attempt');
    const config = makeAgentConfig({
      retry: { max_attempts: 3, backoff: 'exponential', retry_on: ['rate_limit', 'server_error'] },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Say "hello" in one word only');
    result({ content: r.content.slice(0, 40) });
    assert('r.content.length > 0');
    expect(r.content.length).toBeGreaterThan(0);
    pass('2.3.1');
  });

  it('2.3.2 withRetry wrapping a real-provider fn succeeds', async () => {
    execute('withRetry wrapping Together AI call');
    const config = makeAgentConfig();
    const runner = new AgentRunner(config, createMockStorage());
    let callCount = 0;
    const r = await withRetry(
      async () => {
        callCount++;
        return runner.run('Say yes');
      },
      { max_attempts: 3, backoff: 'none', retry_on: ['rate_limit', 'server_error'] },
    );
    result({ content: r.content.slice(0, 40), callCount });
    assert('r.content.length > 0 && callCount === 1');
    expect(r.content.length).toBeGreaterThan(0);
    expect(callCount).toBe(1);
    pass('2.3.2');
  });

  it('2.3.3 run with retry config returns providerUsed field', async () => {
    execute('agent with retry config → r.providerUsed.provider === "together"');
    const config = makeAgentConfig({
      retry: { max_attempts: 2, backoff: 'none', retry_on: ['rate_limit'] },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Say "ok"');
    result({ providerUsed: r.providerUsed });
    assert('r.providerUsed.provider === "together"');
    expect(r.providerUsed?.provider).toBe('together');
    pass('2.3.3');
  });
});
