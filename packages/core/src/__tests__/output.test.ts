import { describe, it, expect } from 'vitest';
import { parseOutput, buildRetryPrompt } from '../output/index.ts';
import { validateJsonSchema } from '../output/parser.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('1.1 parseOutput — text format', () => {
  it('1.1.1 returns valid=true for plain text', () => {
    execute("parseOutput('hello world', { format: 'text' })");
    const r = parseOutput('hello world', { format: 'text', strict: false });
    result(r);
    assert('r.valid === true && r.parsed === "hello world"');
    expect(r.valid).toBe(true);
    expect(r.parsed).toBe('hello world');
    pass('1.1.1');
  });

  it('1.1.2 raw equals the input string', () => {
    execute("parseOutput('some text', { format: 'text' })");
    const r = parseOutput('some text', { format: 'text', strict: false });
    result(r);
    assert('r.raw === "some text"');
    expect(r.raw).toBe('some text');
    pass('1.1.2');
  });

  it('1.1.3 no error field on success', () => {
    execute("parseOutput('ok', { format: 'text' })");
    const r = parseOutput('ok', { format: 'text', strict: false });
    result(r);
    assert('r.error === undefined');
    expect(r.error).toBeUndefined();
    pass('1.1.3');
  });

  it('1.1.4 empty string is valid text', () => {
    execute("parseOutput('', { format: 'text' })");
    const r = parseOutput('', { format: 'text', strict: false });
    result(r);
    assert('r.valid === true');
    expect(r.valid).toBe(true);
    pass('1.1.4');
  });

  it('1.1.5 multiline text is valid', () => {
    execute("parseOutput('line1\\nline2', { format: 'text' })");
    const r = parseOutput('line1\nline2', { format: 'text', strict: false });
    result(r);
    assert('r.valid === true && r.parsed includes newline');
    expect(r.valid).toBe(true);
    expect(r.parsed as string).toContain('\n');
    pass('1.1.5');
  });

  it('1.1.6 JSON-looking string treated as text', () => {
    execute("parseOutput('{\"a\":1}', { format: 'text' })");
    const r = parseOutput('{"a":1}', { format: 'text', strict: false });
    result(r);
    assert('r.valid === true && r.parsed === \'{"a":1}\'');
    expect(r.valid).toBe(true);
    expect(r.parsed).toBe('{"a":1}');
    pass('1.1.6');
  });
});

describe('1.1 parseOutput — JSON format', () => {
  it('1.1.7 parses valid JSON object', () => {
    execute("parseOutput('{\"ok\":true}', { format: 'json' })");
    const r = parseOutput('{"ok":true}', { format: 'json', strict: false });
    result(r);
    assert('r.valid === true && r.parsed.ok === true');
    expect(r.valid).toBe(true);
    expect((r.parsed as Record<string, unknown>).ok).toBe(true);
    pass('1.1.7');
  });

  it('1.1.8 parses JSON from markdown code fence', () => {
    execute('parseOutput("```json\\n{\"x\":1}\\n```", { format: "json" })');
    const r = parseOutput('```json\n{"x":1}\n```', { format: 'json', strict: false });
    result(r);
    assert('r.valid === true && r.parsed.x === 1');
    expect(r.valid).toBe(true);
    expect((r.parsed as Record<string, unknown>).x).toBe(1);
    pass('1.1.8');
  });

  it('1.1.9 parses JSON from plain code fence', () => {
    execute('parseOutput("```\\n{\"y\":2}\\n```", { format: "json" })');
    const r = parseOutput('```\n{"y":2}\n```', { format: 'json', strict: false });
    result(r);
    assert('r.valid === true && r.parsed.y === 2');
    expect(r.valid).toBe(true);
    expect((r.parsed as Record<string, unknown>).y).toBe(2);
    pass('1.1.9');
  });

  it('1.1.10 invalid JSON returns valid=false', () => {
    execute("parseOutput('not json', { format: 'json' })");
    const r = parseOutput('not json', { format: 'json', strict: false });
    result(r);
    assert('r.valid === false');
    expect(r.valid).toBe(false);
    expect(r.error).toBeDefined();
    pass('1.1.10');
  });

  it('1.1.11 invalid JSON in fence returns valid=false', () => {
    execute('parseOutput("```\\nnot json\\n```", { format: "json" })');
    const r = parseOutput('```\nnot json\n```', { format: 'json', strict: false });
    result(r);
    assert('r.valid === false');
    expect(r.valid).toBe(false);
    pass('1.1.11');
  });

  it('1.1.12 schema validation pass in strict mode', () => {
    execute("parseOutput('{\"name\":\"Alice\"}', { format: 'json', strict: true, schema: {type:'object',properties:{name:{type:'string'}}} })");
    const r = parseOutput('{"name":"Alice"}', {
      format: 'json',
      strict: true,
      schema: { type: 'object', properties: { name: { type: 'string' } } },
    });
    result(r);
    assert('r.valid === true');
    expect(r.valid).toBe(true);
    pass('1.1.12');
  });
});

describe('1.2 validateJsonSchema', () => {
  it('1.2.1 validates object type', () => {
    execute("validateJsonSchema({}, { type: 'object' })");
    const r = validateJsonSchema({}, { type: 'object' });
    result(r);
    assert('r.valid === true');
    expect(r.valid).toBe(true);
    pass('1.2.1');
  });

  it('1.2.2 rejects wrong type', () => {
    execute("validateJsonSchema('hello', { type: 'object' })");
    const r = validateJsonSchema('hello', { type: 'object' });
    result(r);
    assert('r.valid === false && r.errors.length > 0');
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    pass('1.2.2');
  });

  it('1.2.3 validates required fields', () => {
    execute("validateJsonSchema({}, { type: 'object', required: ['name'] })");
    const r = validateJsonSchema({}, { type: 'object', required: ['name'] });
    result(r);
    assert('r.valid === false — missing required field');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e: string) => e.includes('required'))).toBe(true);
    pass('1.2.3');
  });

  it('1.2.4 validates nested properties', () => {
    execute("validateJsonSchema({ age: 'not a number' }, { type: 'object', properties: { age: { type: 'number' } } })");
    const r = validateJsonSchema(
      { age: 'not a number' },
      { type: 'object', properties: { age: { type: 'number' } } },
    );
    result(r);
    assert('r.valid === false — wrong type for age');
    expect(r.valid).toBe(false);
    pass('1.2.4');
  });
});

describe('1.3 buildRetryPrompt', () => {
  it('1.3.1 includes the error message', () => {
    execute("buildRetryPrompt('Parse error')");
    const r = buildRetryPrompt('Parse error');
    result({ snippet: r.slice(0, 80) });
    assert('r includes "Parse error"');
    expect(r).toContain('Parse error');
    pass('1.3.1');
  });

  it('1.3.2 instructs to respond with JSON only', () => {
    execute("buildRetryPrompt('bad format')");
    const r = buildRetryPrompt('bad format');
    result({ snippet: r.slice(0, 80) });
    assert('r contains "valid JSON"');
    expect(r.toLowerCase()).toContain('json');
    pass('1.3.2');
  });
});
