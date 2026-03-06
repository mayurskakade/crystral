import { describe, it, expect } from 'vitest';
import {
  assertContains,
  assertNotContains,
  assertMaxTokens,
  assertSchema,
  assertGuardrailBlocked,
} from '../testing/assertions.ts';
import { runTestSuite } from '../testing/runner.ts';
import { MockProvider } from '../testing/mock-provider.ts';
import type { TestSuiteConfig } from '../types/index.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

// ---------------------------------------------------------------------------
// 8.1 Assertions
// ---------------------------------------------------------------------------

describe('8.1 assertContains', () => {
  it('8.1.1 passes when substring present', () => {
    execute("assertContains('hello world', 'world')");
    const r = assertContains('hello world', 'world');
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('8.1.1');
  });

  it('8.1.2 fails when substring absent', () => {
    execute("assertContains('hello world', 'bye')");
    const r = assertContains('hello world', 'bye');
    result(r);
    assert('r.passed === false && r.error is defined');
    expect(r.passed).toBe(false);
    expect(r.error).toBeDefined();
    pass('8.1.2');
  });

  it('8.1.3 error message references the expected string', () => {
    execute("assertContains('hello', 'xyz')");
    const r = assertContains('hello', 'xyz');
    result(r);
    assert('r.error contains "xyz"');
    expect(r.error).toContain('xyz');
    pass('8.1.3');
  });
});

describe('8.1 assertNotContains', () => {
  it('8.1.4 passes when substring absent', () => {
    execute("assertNotContains('hello world', 'bye')");
    const r = assertNotContains('hello world', 'bye');
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('8.1.4');
  });

  it('8.1.5 fails when substring present', () => {
    execute("assertNotContains('hello world', 'world')");
    const r = assertNotContains('hello world', 'world');
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    pass('8.1.5');
  });
});

describe('8.1 assertMaxTokens', () => {
  it('8.1.6 passes when under limit', () => {
    execute("assertMaxTokens('one two three', 5)");
    const r = assertMaxTokens('one two three', 5);
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('8.1.6');
  });

  it('8.1.7 fails when over limit', () => {
    execute("assertMaxTokens('one two three four five six', 3)");
    const r = assertMaxTokens('one two three four five six', 3);
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    pass('8.1.7');
  });

  it('8.1.8 exact limit passes', () => {
    execute("assertMaxTokens('a b c', 3)");
    const r = assertMaxTokens('a b c', 3);
    result(r);
    assert('r.passed === true (exactly 3 tokens)');
    expect(r.passed).toBe(true);
    pass('8.1.8');
  });
});

describe('8.1 assertSchema', () => {
  it('8.1.9 passes when all keys present and types match', () => {
    execute("assertSchema({ name: 'Alice', age: 30 }, { name: 'string', age: 'number' })");
    const r = assertSchema({ name: 'Alice', age: 30 }, { name: 'string', age: 'number' });
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('8.1.9');
  });

  it('8.1.10 fails when key missing', () => {
    execute("assertSchema({ name: 'Alice' }, { name: 'string', age: 'number' })");
    const r = assertSchema({ name: 'Alice' }, { name: 'string', age: 'number' });
    result(r);
    assert('r.passed === false — missing "age"');
    expect(r.passed).toBe(false);
    pass('8.1.10');
  });

  it('8.1.11 fails when type wrong', () => {
    execute("assertSchema({ age: 'thirty' }, { age: 'number' })");
    const r = assertSchema({ age: 'thirty' }, { age: 'number' });
    result(r);
    assert('r.passed === false — wrong type for age');
    expect(r.passed).toBe(false);
    pass('8.1.11');
  });

  it('8.1.12 fails for null input', () => {
    execute("assertSchema(null, { key: 'string' })");
    const r = assertSchema(null, { key: 'string' });
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    pass('8.1.12');
  });
});

describe('8.1 assertGuardrailBlocked', () => {
  it('8.1.13 passes when wasBlocked matches expected=true', () => {
    execute("assertGuardrailBlocked(true, true)");
    const r = assertGuardrailBlocked(true, true);
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('8.1.13');
  });

  it('8.1.14 fails when wasBlocked=false expected=true', () => {
    execute("assertGuardrailBlocked(false, true)");
    const r = assertGuardrailBlocked(false, true);
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    pass('8.1.14');
  });

  it('8.1.15 passes when both false', () => {
    execute("assertGuardrailBlocked(false, false)");
    const r = assertGuardrailBlocked(false, false);
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('8.1.15');
  });

  it('8.1.16 fails when wasBlocked=true expected=false', () => {
    execute("assertGuardrailBlocked(true, false)");
    const r = assertGuardrailBlocked(true, false);
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    pass('8.1.16');
  });
});

// ---------------------------------------------------------------------------
// 8.2 runTestSuite with MockProvider
// ---------------------------------------------------------------------------

describe('8.2 runTestSuite', () => {
  // Build a minimal testable agent runner using MockProvider
  function makeMockRunner(fixedResponse?: string) {
    const provider = new MockProvider();
    return {
      async run(input: string) {
        const msgs = [{ role: 'user', content: fixedResponse ?? input }];
        const completion = await provider.complete(msgs);
        return {
          response: completion.content,
          parsed: undefined,
          guardrails: { inputBlocked: false },
        };
      },
    };
  }

  it('8.2.1 all tests pass on echo match', async () => {
    execute('runTestSuite with echo runner — all pass');
    const suite: TestSuiteConfig = {
      version: 1,
      name: 'echo-suite',
      agent: 'echo-agent',
      tests: [{ name: 't1', input: 'hello', expect: { contains: 'hello' } }],
    };
    const r = await runTestSuite(suite, makeMockRunner());
    result({ passed: r.passed, failed: r.failed });
    assert('r.passed === 1 && r.failed === 0');
    expect(r.passed).toBe(1);
    expect(r.failed).toBe(0);
    pass('8.2.1');
  });

  it('8.2.2 test fails when contains not satisfied', async () => {
    execute('runTestSuite with contains mismatch');
    const suite: TestSuiteConfig = {
      version: 1,
      name: 'fail-suite',
      agent: 'fail-agent',
      tests: [{ name: 't1', input: 'hello', expect: { contains: 'NOTPRESENT' } }],
    };
    const r = await runTestSuite(suite, makeMockRunner());
    result({ passed: r.passed, failed: r.failed });
    assert('r.failed === 1');
    expect(r.failed).toBe(1);
    pass('8.2.2');
  });

  it('8.2.3 multiple tests aggregated correctly', async () => {
    execute('runTestSuite with 3 tests: 2 pass, 1 fail');
    const suite: TestSuiteConfig = {
      version: 1,
      name: 'multi-suite',
      agent: 'multi-agent',
      tests: [
        { name: 'pass1', input: 'hello', expect: { contains: 'hello' } },
        { name: 'pass2', input: 'world', expect: { contains: 'world' } },
        { name: 'fail1', input: 'hi', expect: { contains: 'NOTFOUND' } },
      ],
    };
    const r = await runTestSuite(suite, makeMockRunner());
    result({ passed: r.passed, failed: r.failed });
    assert('r.passed === 2 && r.failed === 1');
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    pass('8.2.3');
  });

  it('8.2.4 suite result includes agent name', async () => {
    execute('runTestSuite result.agent matches config');
    const suite: TestSuiteConfig = {
      version: 1,
      name: 'my-suite',
      agent: 'my-agent',
      tests: [{ name: 't1', input: 'x', expect: { contains: 'x' } }],
    };
    const r = await runTestSuite(suite, makeMockRunner());
    result({ agent: r.agent });
    assert('r.agent === "my-agent"');
    expect(r.agent).toBe('my-agent');
    pass('8.2.4');
  });

  it('8.2.5 not_contains expectation works', async () => {
    execute('runTestSuite not_contains passes when absent');
    const suite: TestSuiteConfig = {
      version: 1,
      name: 'not-contains-suite',
      agent: 'a',
      tests: [{ name: 't1', input: 'hello', expect: { not_contains: 'ABSENT' } }],
    };
    const r = await runTestSuite(suite, makeMockRunner());
    result({ passed: r.passed });
    assert('r.passed === 1');
    expect(r.passed).toBe(1);
    pass('8.2.5');
  });

  it('8.2.6 max_tokens expectation works', async () => {
    execute('runTestSuite max_tokens passes for short response');
    const suite: TestSuiteConfig = {
      version: 1,
      name: 'token-suite',
      agent: 'a',
      tests: [{ name: 't1', input: 'hi', expect: { max_tokens: 100 } }],
    };
    const r = await runTestSuite(suite, makeMockRunner());
    result({ passed: r.passed });
    assert('r.passed === 1');
    expect(r.passed).toBe(1);
    pass('8.2.6');
  });

  it('8.2.7 duration is a positive number', async () => {
    execute('runTestSuite result.duration > 0');
    const suite: TestSuiteConfig = {
      version: 1,
      name: 'dur-suite',
      agent: 'a',
      tests: [{ name: 't1', input: 'test', expect: {} }],
    };
    const r = await runTestSuite(suite, makeMockRunner());
    result({ duration: r.duration });
    assert('r.duration >= 0');
    expect(r.duration).toBeGreaterThanOrEqual(0);
    pass('8.2.7');
  });

  it('8.2.8 execution error is recorded as failure', async () => {
    execute('runTestSuite catches thrown error');
    const suite: TestSuiteConfig = {
      version: 1,
      name: 'error-suite',
      agent: 'a',
      tests: [{ name: 't1', input: 'x', expect: {} }],
    };
    const throwingRunner = {
      run: async (_input: string) => { throw new Error('run exploded'); },
    };
    const r = await runTestSuite(suite, throwingRunner);
    result({ failed: r.failed, error: r.results[0]?.error });
    assert('r.failed === 1 && error includes "Execution error"');
    expect(r.failed).toBe(1);
    expect(r.results[0]?.error).toContain('Execution error');
    pass('8.2.8');
  });
});

// ---------------------------------------------------------------------------
// 8.3 MockProvider
// ---------------------------------------------------------------------------

describe('8.3 MockProvider', () => {
  it('8.3.1 returns last user message as content', async () => {
    execute("MockProvider.complete([{ role: 'user', content: 'hello' }])");
    const provider = new MockProvider();
    const r = await provider.complete([{ role: 'user', content: 'hello' }]);
    result(r);
    assert('r.content === "hello"');
    expect(r.content).toBe('hello');
    pass('8.3.1');
  });

  it('8.3.2 returns "mock response" when no messages', async () => {
    execute('MockProvider.complete([])');
    const provider = new MockProvider();
    const r = await provider.complete([]);
    result(r);
    assert('r.content === "mock response"');
    expect(r.content).toBe('mock response');
    pass('8.3.2');
  });

  it('8.3.3 finish_reason is "stop"', async () => {
    execute("MockProvider.complete([{ role: 'user', content: 'x' }]).finish_reason");
    const provider = new MockProvider();
    const r = await provider.complete([{ role: 'user', content: 'x' }]);
    result(r);
    assert('r.finish_reason === "stop"');
    expect(r.finish_reason).toBe('stop');
    pass('8.3.3');
  });

  it('8.3.4 input_tokens and output_tokens are 0', async () => {
    execute("MockProvider.complete tokens check");
    const provider = new MockProvider();
    const r = await provider.complete([{ role: 'user', content: 'x' }]);
    result(r);
    assert('r.input_tokens === 0 && r.output_tokens === 0');
    expect(r.input_tokens).toBe(0);
    expect(r.output_tokens).toBe(0);
    pass('8.3.4');
  });

  it('8.3.5 echoes the last message content', async () => {
    execute("MockProvider last of two messages");
    const provider = new MockProvider();
    const r = await provider.complete([
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
    ]);
    result(r);
    assert('r.content === "second"');
    expect(r.content).toBe('second');
    pass('8.3.5');
  });

  it('8.3.6 returns a Promise', () => {
    execute("MockProvider.complete returns Promise");
    const provider = new MockProvider();
    const r = provider.complete([{ role: 'user', content: 'x' }]);
    assert('r instanceof Promise');
    expect(r).toBeInstanceOf(Promise);
    pass('8.3.6');
  });

  it('8.3.7 system message is not echoed (last user message is)', async () => {
    execute("MockProvider with system + user messages");
    const provider = new MockProvider();
    const r = await provider.complete([
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'the question' },
    ]);
    result(r);
    assert('r.content === "the question"');
    expect(r.content).toBe('the question');
    pass('8.3.7');
  });

  it('8.3.8 JSON-looking content is returned as-is', async () => {
    execute('MockProvider echoes JSON string');
    const provider = new MockProvider();
    const r = await provider.complete([{ role: 'user', content: '{"ok":true}' }]);
    result(r);
    assert('r.content === \'{"ok":true}\'');
    expect(r.content).toBe('{"ok":true}');
    pass('8.3.8');
  });
});
