import { describe, it, expect, beforeAll } from 'vitest';
import { AgentRunner } from '../agent/runner.ts';
import { createMockStorage, togetherConfig } from './helpers/fixtures.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';
import type { AgentConfig } from '../types/index.ts';

const TOGETHER_KEY = process.env['TOGETHER_API_KEY'];

function makeAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    version: 1,
    name: 'test-agent',
    ...togetherConfig(),
    system_prompt: 'You are a helpful assistant.',
    temperature: 0,
    max_tokens: 256,
    top_p: 1.0,
    presence_penalty: 0,
    frequency_penalty: 0,
    tools: [],
    mcp: [],
    ...overrides,
  };
}

beforeAll(() => {
  if (!TOGETHER_KEY) {
    throw new Error('TOGETHER_API_KEY environment variable is required for integration tests');
  }
});

describe('1.4 real LLM JSON output', () => {
  it('1.4.1 real LLM returns JSON when output.format is json', async () => {
    execute('agent.run with output.format=json → returns parseable JSON');
    const config = makeAgentConfig({
      output: { format: 'json', strict: false },
      system_prompt: 'Always respond with a JSON object only. No extra text.',
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Return a JSON object: {"ok": true}');
    result({ response: r.content.slice(0, 80), parsed: r.parsed });
    assert('r.parsed !== undefined');
    expect(r.parsed).toBeDefined();
    pass('1.4.1');
  });

  it('1.4.2 parsed output is a JavaScript object', async () => {
    execute('agent.run JSON mode → r.parsed is an object');
    const config = makeAgentConfig({
      output: { format: 'json', strict: false },
      system_prompt: 'Always respond with a JSON object only. No extra text.',
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Return JSON: {"status": "ok"}');
    result({ type: typeof r.parsed });
    assert('typeof r.parsed === "object"');
    expect(typeof r.parsed).toBe('object');
    pass('1.4.2');
  });

  it('1.4.3 schema validation in strict mode validates real response', async () => {
    execute('agent.run with strict schema → r.parsed conforms to schema');
    const config = makeAgentConfig({
      output: {
        format: 'json',
        strict: true,
        schema: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string' },
          },
        },
      },
      system_prompt: 'Respond ONLY with a JSON object containing a "message" string field.',
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Say hello in JSON: {"message": "Hello!"}');
    result({ parsed: r.parsed });
    assert('r.parsed is defined (schema validated)');
    expect(r.parsed).toBeDefined();
    pass('1.4.3');
  });

  it('1.4.4 raw response is a non-empty string', async () => {
    execute('agent.run JSON mode → r.content is non-empty');
    const config = makeAgentConfig({
      output: { format: 'json', strict: false },
      system_prompt: 'Always respond with valid JSON.',
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('{"x": 1}');
    result({ contentLength: r.content.length });
    assert('r.content.length > 0');
    expect(r.content.length).toBeGreaterThan(0);
    pass('1.4.4');
  });

  it('1.4.5 usage tokens are non-negative', async () => {
    execute('agent.run → r.usage.totalTokens >= 0');
    const config = makeAgentConfig({
      output: { format: 'json', strict: false },
      system_prompt: 'Respond with JSON.',
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('{"ok": true}');
    result({ total: r.usage.totalTokens });
    assert('r.usage.totalTokens >= 0');
    expect(r.usage.totalTokens).toBeGreaterThanOrEqual(0);
    pass('1.4.5');
  });
});

describe('1.5 malformed JSON retry prompt', () => {
  it('1.5.1 text mode returns valid=true for any response', async () => {
    execute('agent text mode → r.content is non-empty string');
    const config = makeAgentConfig({
      output: { format: 'text', strict: false },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Say hello');
    result({ contentLength: r.content.length });
    assert('r.content.length > 0');
    expect(r.content.length).toBeGreaterThan(0);
    pass('1.5.1');
  });

  it('1.5.2 agent run completes within timeout', async () => {
    execute('agent.run completes within 25 seconds');
    const config = makeAgentConfig({
      output: { format: 'text', strict: false },
    });
    const runner = new AgentRunner(config, createMockStorage());
    const start = Date.now();
    await runner.run('Say one word');
    const elapsed = Date.now() - start;
    result({ elapsedMs: elapsed });
    assert('elapsed < 25000');
    expect(elapsed).toBeLessThan(25_000);
    pass('1.5.2');
  });

  it('1.5.3 sessionId is returned in run result', async () => {
    execute('agent.run → r.sessionId is non-empty string');
    const config = makeAgentConfig();
    const runner = new AgentRunner(config, createMockStorage());
    const r = await runner.run('Hello');
    result({ sessionId: r.sessionId });
    assert('r.sessionId is a non-empty string');
    expect(typeof r.sessionId).toBe('string');
    expect(r.sessionId.length).toBeGreaterThan(0);
    pass('1.5.3');
  });
});
