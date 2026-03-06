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
    name: 'guardrail-test-agent',
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

describe('3.5 guardrails applied to real LLM response', () => {
  it('3.5.1 input max_length blocks long input before LLM call', async () => {
    execute('agent with input max_length=5 → blocks long input');
    const config = makeAgentConfig({
      guardrails: {
        input: { max_length: 5, pii_action: 'none' },
      },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('This is a very long input message that exceeds the limit');
    result({ inputBlocked: r.guardrails?.inputBlocked, contentSnippet: r.content.slice(0, 40) });
    assert('r.guardrails.inputBlocked === true');
    expect(r.guardrails?.inputBlocked).toBe(true);
    pass('3.5.1');
  });

  it('3.5.2 input within max_length passes and gets a real response', async () => {
    execute('agent with input max_length=200 → short input passes through');
    const config = makeAgentConfig({
      guardrails: {
        input: { max_length: 200, pii_action: 'none' },
      },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Say hello');
    result({ inputBlocked: r.guardrails?.inputBlocked });
    assert('r.guardrails.inputBlocked is not true');
    expect(r.guardrails?.inputBlocked).not.toBe(true);
    expect(r.content.length).toBeGreaterThan(0);
    pass('3.5.2');
  });

  it('3.5.3 pii_action=block on input with email blocks request', async () => {
    execute('agent with pii_action=block → input with email is blocked');
    const config = makeAgentConfig({
      guardrails: {
        input: { pii_action: 'block' },
      },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('My email is test@example.com, what do you think?');
    result({ inputBlocked: r.guardrails?.inputBlocked });
    assert('r.guardrails.inputBlocked === true');
    expect(r.guardrails?.inputBlocked).toBe(true);
    pass('3.5.3');
  });

  it('3.5.4 no guardrails configured → normal run completes', async () => {
    execute('agent with no guardrails → r.content.length > 0');
    const config = makeAgentConfig();
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('What is 1 + 1?');
    result({ content: r.content.slice(0, 60) });
    assert('r.content.length > 0 (guardrails did not interfere)');
    expect(r.content.length).toBeGreaterThan(0);
    pass('3.5.4');
  });
});
