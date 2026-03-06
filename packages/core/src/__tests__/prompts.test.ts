import { describe, it, expect } from 'vitest';
import { interpolateVariables, mergeVariables } from '../prompts/index.ts';
import { resolveSystemPrompt } from '../prompts/index.ts';
import { createTempProject, writeProjectConfig, writePrompt } from './helpers/fixtures.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('4.1 string passthrough (no variables)', () => {
  it('4.1.1 plain string with no placeholders is returned as-is', () => {
    execute("interpolateVariables('You are an assistant', {})");
    const r = interpolateVariables('You are an assistant', {});
    result(r);
    assert('r === "You are an assistant"');
    expect(r).toBe('You are an assistant');
    pass('4.1.1');
  });

  it('4.1.2 string with unreferenced placeholder is returned unchanged', () => {
    execute("interpolateVariables('Hello {name}', {})");
    const r = interpolateVariables('Hello {name}', {});
    result(r);
    assert('r === "Hello {name}" (placeholder preserved)');
    expect(r).toBe('Hello {name}');
    pass('4.1.2');
  });

  it('4.1.3 resolveSystemPrompt with plain string returns interpolated', () => {
    execute("resolveSystemPrompt('Hello {user}', { user: 'Alice' })");
    const r = resolveSystemPrompt('Hello {user}', { user: 'Alice' });
    result(r);
    assert('r === "Hello Alice"');
    expect(r).toBe('Hello Alice');
    pass('4.1.3');
  });
});

describe('4.2 template interpolation', () => {
  it('4.2.1 replaces {name} with value', () => {
    execute("interpolateVariables('Hi {name}', { name: 'Bob' })");
    const r = interpolateVariables('Hi {name}', { name: 'Bob' });
    result(r);
    assert('r === "Hi Bob"');
    expect(r).toBe('Hi Bob');
    pass('4.2.1');
  });

  it('4.2.2 replaces multiple placeholders', () => {
    execute("interpolateVariables('{greeting}, {name}!', { greeting: 'Hello', name: 'Alice' })");
    const r = interpolateVariables('{greeting}, {name}!', { greeting: 'Hello', name: 'Alice' });
    result(r);
    assert('r === "Hello, Alice!"');
    expect(r).toBe('Hello, Alice!');
    pass('4.2.2');
  });

  it('4.2.3 replaces same placeholder multiple times', () => {
    execute("interpolateVariables('{x} + {x} = 2{x}', { x: '5' })");
    const r = interpolateVariables('{x} + {x} = 2{x}', { x: '5' });
    result(r);
    assert('r === "5 + 5 = 25"');
    expect(r).toBe('5 + 5 = 25');
    pass('4.2.3');
  });

  it('4.2.4 resolveSystemPrompt with template object loads from file', () => {
    const tmp = createTempProject();
    try {
      writeProjectConfig(tmp.dir);
      writePrompt(tmp.dir, 'greeting', {
        template: 'Hello, {name}! You are a {role}.',
        defaults: { name: 'World', role: 'helper' },
      });
      execute("resolveSystemPrompt({ template: 'greeting', variables: { name: 'Alice' } }, {}, tmp.dir)");
      const r = resolveSystemPrompt(
        { template: 'greeting', variables: { name: 'Alice' } },
        {},
        tmp.dir,
      );
      result(r);
      assert('r === "Hello, Alice! You are a helper."');
      expect(r).toBe('Hello, Alice! You are a helper.');
      pass('4.2.4');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('4.3 variable merging', () => {
  it('4.3.1 mergeVariables combines two sources', () => {
    execute("mergeVariables({ a: '1' }, { b: '2' })");
    const r = mergeVariables({ a: '1' }, { b: '2' });
    result(r);
    assert('r.a === "1" && r.b === "2"');
    expect(r.a).toBe('1');
    expect(r.b).toBe('2');
    pass('4.3.1');
  });

  it('4.3.2 later source overrides earlier', () => {
    execute("mergeVariables({ x: 'first' }, { x: 'second' })");
    const r = mergeVariables({ x: 'first' }, { x: 'second' });
    result(r);
    assert('r.x === "second"');
    expect(r.x).toBe('second');
    pass('4.3.2');
  });

  it('4.3.3 undefined source is skipped', () => {
    execute("mergeVariables({ a: '1' }, undefined, { b: '2' })");
    const r = mergeVariables({ a: '1' }, undefined, { b: '2' });
    result(r);
    assert('r.a === "1" && r.b === "2"');
    expect(r.a).toBe('1');
    expect(r.b).toBe('2');
    pass('4.3.3');
  });
});

describe('4.4 missing variable behavior', () => {
  it('4.4.1 missing variable preserves placeholder', () => {
    execute("interpolateVariables('Hello {missing}', {})");
    const r = interpolateVariables('Hello {missing}', {});
    result(r);
    assert('r === "Hello {missing}"');
    expect(r).toBe('Hello {missing}');
    pass('4.4.1');
  });

  it('4.4.2 template defaults used when variable not provided', () => {
    const tmp = createTempProject();
    try {
      writeProjectConfig(tmp.dir);
      writePrompt(tmp.dir, 'mytemplate', {
        template: 'Role: {role}',
        defaults: { role: 'default-role' },
      });
      execute("resolveSystemPrompt({ template: 'mytemplate' }, {}, tmp.dir)");
      const r = resolveSystemPrompt({ template: 'mytemplate' }, {}, tmp.dir);
      result(r);
      assert('r === "Role: default-role"');
      expect(r).toBe('Role: default-role');
      pass('4.4.2');
    } finally {
      tmp.cleanup();
    }
  });

  it('4.4.3 runtime variables override template defaults', () => {
    const tmp = createTempProject();
    try {
      writeProjectConfig(tmp.dir);
      writePrompt(tmp.dir, 'mytemplate2', {
        template: 'Role: {role}',
        defaults: { role: 'default-role' },
      });
      execute("resolveSystemPrompt({ template: 'mytemplate2' }, { role: 'custom-role' }, tmp.dir)");
      const r = resolveSystemPrompt({ template: 'mytemplate2' }, { role: 'custom-role' }, tmp.dir);
      result(r);
      assert('r === "Role: custom-role"');
      expect(r).toBe('Role: custom-role');
      pass('4.4.3');
    } finally {
      tmp.cleanup();
    }
  });

  it('4.4.4 missing template file throws error', () => {
    const tmp = createTempProject();
    try {
      writeProjectConfig(tmp.dir);
      execute("resolveSystemPrompt({ template: 'nonexistent' }, {}, tmp.dir) should throw");
      expect(() => resolveSystemPrompt({ template: 'nonexistent' }, {}, tmp.dir)).toThrow();
      pass('4.4.4');
    } finally {
      tmp.cleanup();
    }
  });
});
