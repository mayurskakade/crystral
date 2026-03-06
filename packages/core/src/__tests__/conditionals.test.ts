import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../workflow/conditionals.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('7.1 evaluateCondition', () => {
  it('7.1.1 "always" returns true', () => {
    execute("evaluateCondition('always', {})");
    const r = evaluateCondition('always', {});
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('7.1.1');
  });

  it('7.1.2 "never" returns false', () => {
    execute("evaluateCondition('never', {})");
    const r = evaluateCondition('never', {});
    result(r);
    assert('r === false');
    expect(r).toBe(false);
    pass('7.1.2');
  });

  it('7.1.3 equality == match', () => {
    execute("evaluateCondition(\"status == 'done'\", { status: 'done' })");
    const r = evaluateCondition("status == 'done'", { status: 'done' });
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('7.1.3');
  });

  it('7.1.4 equality == no match', () => {
    execute("evaluateCondition(\"status == 'done'\", { status: 'pending' })");
    const r = evaluateCondition("status == 'done'", { status: 'pending' });
    result(r);
    assert('r === false');
    expect(r).toBe(false);
    pass('7.1.4');
  });

  it('7.1.5 inequality != match (values differ)', () => {
    execute("evaluateCondition(\"status != 'error'\", { status: 'ok' })");
    const r = evaluateCondition("status != 'error'", { status: 'ok' });
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('7.1.5');
  });

  it('7.1.6 inequality != no match (values same)', () => {
    execute("evaluateCondition(\"status != 'error'\", { status: 'error' })");
    const r = evaluateCondition("status != 'error'", { status: 'error' });
    result(r);
    assert('r === false');
    expect(r).toBe(false);
    pass('7.1.6');
  });

  it('7.1.7 in — substring match', () => {
    execute("evaluateCondition(\"'hello' in message\", { message: 'say hello world' })");
    const r = evaluateCondition("'hello' in message", { message: 'say hello world' });
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('7.1.7');
  });

  it('7.1.8 in — no match', () => {
    execute("evaluateCondition(\"'bye' in message\", { message: 'say hello world' })");
    const r = evaluateCondition("'bye' in message", { message: 'say hello world' });
    result(r);
    assert('r === false');
    expect(r).toBe(false);
    pass('7.1.8');
  });

  it('7.1.9 not — negates true', () => {
    execute("evaluateCondition('not always', {})");
    const r = evaluateCondition('not always', {});
    result(r);
    assert('r === false');
    expect(r).toBe(false);
    pass('7.1.9');
  });

  it('7.1.10 not — negates false', () => {
    execute("evaluateCondition('not never', {})");
    const r = evaluateCondition('not never', {});
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('7.1.10');
  });

  it('7.1.11 and — both true', () => {
    execute("evaluateCondition('always and always', {})");
    const r = evaluateCondition('always and always', {});
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('7.1.11');
  });

  it('7.1.12 and — one false', () => {
    execute("evaluateCondition('always and never', {})");
    const r = evaluateCondition('always and never', {});
    result(r);
    assert('r === false');
    expect(r).toBe(false);
    pass('7.1.12');
  });

  it('7.1.13 or — both false', () => {
    execute("evaluateCondition('never or never', {})");
    const r = evaluateCondition('never or never', {});
    result(r);
    assert('r === false');
    expect(r).toBe(false);
    pass('7.1.13');
  });

  it('7.1.14 or — one true', () => {
    execute("evaluateCondition('never or always', {})");
    const r = evaluateCondition('never or always', {});
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('7.1.14');
  });

  it('7.1.15 dot-access nested field', () => {
    execute("evaluateCondition(\"research.status == 'done'\", { research: { status: 'done' } })");
    const r = evaluateCondition("research.status == 'done'", { research: { status: 'done' } });
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('7.1.15');
  });

  it('7.1.16 truthy bare reference', () => {
    execute("evaluateCondition('result', { result: 'some value' })");
    const r = evaluateCondition('result', { result: 'some value' });
    result(r);
    assert('r === true (truthy string)');
    expect(r).toBe(true);
    pass('7.1.16');
  });

  it('7.1.17 falsy bare reference (undefined)', () => {
    execute("evaluateCondition('missing', {})");
    const r = evaluateCondition('missing', {});
    result(r);
    assert('r === false (undefined is falsy)');
    expect(r).toBe(false);
    pass('7.1.17');
  });

  it('7.1.18 empty expression defaults to true', () => {
    execute("evaluateCondition('', {})");
    const r = evaluateCondition('', {});
    result(r);
    assert('r === true');
    expect(r).toBe(true);
    pass('7.1.18');
  });
});
