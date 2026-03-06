import { describe, it, expect, beforeAll } from 'vitest';
import { AgentRunner } from '../agent/runner.ts';
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
    name: 'cache-test-agent',
    ...togetherConfig(),
    system_prompt: 'You are a helpful assistant.',
    temperature: 0, // required for caching to work (cache only stores when temp=0)
    max_tokens: 64,
    top_p: 1.0,
    presence_penalty: 0,
    frequency_penalty: 0,
    tools: [],
    mcp: [],
    ...overrides,
  };
}

describe('6.4 cache hit with real LLM', () => {
  it('6.4.1 second identical call returns cached=true', async () => {
    execute('two identical agent.run calls → second returns cached=true');
    const storage = createMockStorage();
    const config = makeAgentConfig({
      cache: { enabled: true, ttl: 3600 },
    });
    const msg = 'Say exactly: CACHE_TEST_HELLO';
    // Use fresh runners sharing storage so message history doesn't differ
    const first = await new AgentRunner(config, storage).run(msg);
    const second = await new AgentRunner(config, storage).run(msg);
    result({ firstCached: first.cached, secondCached: second.cached });
    assert('second.cached === true');
    expect(second.cached).toBe(true);
    pass('6.4.1');
  });

  it('6.4.2 cached response content matches original', async () => {
    execute('second call returns same content as first');
    const storage = createMockStorage();
    const config = makeAgentConfig({
      cache: { enabled: true, ttl: 3600 },
    });
    const msg = 'Reply with only: UNIQUE_CACHE_MARKER';
    const first = await new AgentRunner(config, storage).run(msg);
    const second = await new AgentRunner(config, storage).run(msg);
    result({ firstContent: first.content.slice(0, 40), secondContent: second.content.slice(0, 40) });
    assert('second.content === first.content');
    expect(second.content).toBe(first.content);
    pass('6.4.2');
  });

  it('6.4.3 first call does not have cached=true', async () => {
    execute('first call → r.cached !== true');
    const storage = createMockStorage();
    const config = makeAgentConfig({
      cache: { enabled: true, ttl: 3600 },
    });
    const runner = new AgentRunner(config, storage);
    const r = await runner.run('Unique uncached query ' + Date.now());
    result({ cached: r.cached });
    assert('r.cached !== true');
    expect(r.cached).not.toBe(true);
    pass('6.4.3');
  });
});

describe('6.5 cache miss calls LLM', () => {
  it('6.5.1 cache miss results in real LLM response', async () => {
    execute('cache miss → r.content is non-empty (real LLM call)');
    const storage = createMockStorage();
    const config = makeAgentConfig({
      cache: { enabled: true, ttl: 3600 },
    });
    const runner = new AgentRunner(config, storage);
    const r = await runner.run('What is 2 + 2? Answer in one word.');
    result({ content: r.content.slice(0, 60), cached: r.cached });
    assert('r.content.length > 0 && r.cached !== true');
    expect(r.content.length).toBeGreaterThan(0);
    expect(r.cached).not.toBe(true);
    pass('6.5.1');
  });

  it('6.5.2 cache disabled always calls LLM', async () => {
    execute('cache disabled → two calls both hit LLM (neither cached)');
    const storage = createMockStorage();
    const config = makeAgentConfig({
      cache: { enabled: false, ttl: 3600 },
    });
    const runner = new AgentRunner(config, storage);
    const msg = 'Say "yes" only';
    const first = await runner.run(msg);
    const second = await runner.run(msg);
    result({ firstCached: first.cached, secondCached: second.cached });
    assert('first.cached !== true && second.cached !== true');
    expect(first.cached).not.toBe(true);
    expect(second.cached).not.toBe(true);
    pass('6.5.2');
  });
});
