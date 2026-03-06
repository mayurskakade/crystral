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
    name: 'runner-test-agent',
    ...togetherConfig(),
    system_prompt: 'You are a concise assistant. Answer in as few words as possible.',
    temperature: 0.7,
    max_tokens: 128,
    top_p: 1.0,
    presence_penalty: 0,
    frequency_penalty: 0,
    tools: [],
    mcp: [],
    ...overrides,
  };
}

describe('14.1 full AgentRunner with Together AI', () => {
  it('14.1.1 basic agent run returns a non-empty response', async () => {
    execute('AgentRunner.run("What is 2 + 2?")');
    const runner = new AgentRunner(makeAgentConfig(), createMockStorage());
    const r = await runner.run('What is 2 + 2?');
    result({ content: r.content.slice(0, 80) });
    assert('r.content.length > 0');
    expect(r.content.length).toBeGreaterThan(0);
    pass('14.1.1');
  });

  it('14.1.2 response includes usage token counts', async () => {
    execute('AgentRunner.run → r.usage has token counts');
    const runner = new AgentRunner(makeAgentConfig(), createMockStorage());
    const r = await runner.run('Say hello');
    result({ usage: r.usage });
    assert('r.usage.inputTokens >= 0 && r.usage.outputTokens >= 0');
    expect(r.usage.inputTokens).toBeGreaterThanOrEqual(0);
    expect(r.usage.outputTokens).toBeGreaterThanOrEqual(0);
    pass('14.1.2');
  });

  it('14.1.3 response includes sessionId', async () => {
    execute('AgentRunner.run → r.sessionId is non-empty string');
    const runner = new AgentRunner(makeAgentConfig(), createMockStorage());
    const r = await runner.run('Hello');
    result({ sessionId: r.sessionId });
    assert('typeof r.sessionId === "string" && r.sessionId.length > 0');
    expect(typeof r.sessionId).toBe('string');
    expect(r.sessionId.length).toBeGreaterThan(0);
    pass('14.1.3');
  });

  it('14.1.4 system prompt is applied — agent responds consistently', async () => {
    execute('agent with specific system prompt → response reflects it');
    const config = makeAgentConfig({
      system_prompt: 'You always respond with exactly the word "PONG" and nothing else.',
      temperature: 0,
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('PING');
    result({ content: r.content });
    assert('r.content contains "PONG"');
    expect(r.content.toUpperCase()).toContain('PONG');
    pass('14.1.4');
  });

  it('14.1.5 providerUsed field is populated', async () => {
    execute('AgentRunner.run → r.providerUsed.provider === "together"');
    const runner = new AgentRunner(makeAgentConfig(), createMockStorage());
    const r = await runner.run('Say ok');
    result({ providerUsed: r.providerUsed });
    assert('r.providerUsed.provider === "together"');
    expect(r.providerUsed?.provider).toBe('together');
    expect(r.providerUsed?.model).toBe(togetherConfig().model);
    pass('14.1.5');
  });

  it('14.1.6 durationMs is positive', async () => {
    execute('AgentRunner.run → r.durationMs > 0');
    const runner = new AgentRunner(makeAgentConfig(), createMockStorage());
    const r = await runner.run('Hello');
    result({ durationMs: r.durationMs });
    assert('r.durationMs > 0');
    expect(r.durationMs).toBeGreaterThan(0);
    pass('14.1.6');
  });
});
