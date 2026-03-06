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
    name: 'obs-test-agent',
    ...togetherConfig(),
    system_prompt: 'You are a helpful assistant.',
    temperature: 0,
    max_tokens: 64,
    top_p: 1.0,
    presence_penalty: 0,
    frequency_penalty: 0,
    tools: [],
    mcp: [],
    ...overrides,
  };
}

describe('12.3 trace spans captured during real agent run', () => {
  it('12.3.1 traceId is returned when logging.trace=true', async () => {
    execute('agent with logging.trace=true → r.traceId is defined');
    const config = makeAgentConfig({
      logging: { level: 'info', trace: true, export: 'stdout' },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Say hello');
    result({ traceId: r.traceId });
    assert('r.traceId is a non-empty string starting with "trc_"');
    expect(r.traceId).toBeDefined();
    expect(typeof r.traceId).toBe('string');
    expect(r.traceId).toMatch(/^trc_/);
    pass('12.3.1');
  });

  it('12.3.2 traceId is absent when logging.trace=false', async () => {
    execute('agent with logging.trace=false → r.traceId is undefined');
    const config = makeAgentConfig({
      logging: { level: 'info', trace: false, export: 'stdout' },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Say hello');
    result({ traceId: r.traceId });
    assert('r.traceId === undefined');
    expect(r.traceId).toBeUndefined();
    pass('12.3.2');
  });

  it('12.3.3 traceId is absent when no logging config', async () => {
    execute('agent with no logging config → r.traceId is undefined');
    const config = makeAgentConfig();
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Say hello');
    result({ traceId: r.traceId });
    assert('r.traceId === undefined (no trace configured)');
    expect(r.traceId).toBeUndefined();
    pass('12.3.3');
  });

  it('12.3.4 two separate runs have different traceIds', async () => {
    execute('two agent runs with trace=true → different traceIds');
    const config = makeAgentConfig({
      logging: { level: 'info', trace: true, export: 'stdout' },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r1 = await runner.run('Hello');
    const r2 = await runner.run('World');
    result({ traceId1: r1.traceId, traceId2: r2.traceId });
    assert('r1.traceId !== r2.traceId');
    expect(r1.traceId).not.toBe(r2.traceId);
    pass('12.3.4');
  });
});
