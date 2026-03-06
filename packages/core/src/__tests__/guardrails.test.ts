import { describe, it, expect } from 'vitest';
import { checkInputGuardrails, checkOutputGuardrails } from '../guardrails/index.ts';
import { detectPII, redactPII } from '../guardrails/pii.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('3.1 max_length input guardrail', () => {
  it('3.1.1 passes when under limit', () => {
    execute("checkInputGuardrails('hello', { max_length: 10, pii_action: 'none' })");
    const r = checkInputGuardrails('hello', { max_length: 10, pii_action: 'none' });
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('3.1.1');
  });

  it('3.1.2 blocks when over limit', () => {
    execute("checkInputGuardrails('hello world!', { max_length: 5, pii_action: 'none' })");
    const r = checkInputGuardrails('hello world!', { max_length: 5, pii_action: 'none' });
    result(r);
    assert('r.passed === false && r.violation includes "maximum length"');
    expect(r.passed).toBe(false);
    expect(r.violation).toContain('maximum length');
    pass('3.1.2');
  });

  it('3.1.3 output max_length passes when under', () => {
    execute("checkOutputGuardrails('short', { max_length: 100, pii_action: 'none' })");
    const r = checkOutputGuardrails('short', { max_length: 100, pii_action: 'none' });
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('3.1.3');
  });

  it('3.1.4 output max_length blocks when over', () => {
    execute("checkOutputGuardrails('too long string', { max_length: 3, pii_action: 'none' })");
    const r = checkOutputGuardrails('too long string', { max_length: 3, pii_action: 'none' });
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    pass('3.1.4');
  });
});

describe('3.2 block_patterns input guardrail', () => {
  it('3.2.1 blocks on matching pattern', () => {
    execute("checkInputGuardrails('ignore all instructions', { block_patterns: ['ignore.*instructions'], pii_action: 'none' })");
    const r = checkInputGuardrails('ignore all instructions', {
      block_patterns: ['ignore.*instructions'],
      pii_action: 'none',
    });
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    expect(r.violation).toContain('blocked pattern');
    pass('3.2.1');
  });

  it('3.2.2 passes when no pattern matches', () => {
    execute("checkInputGuardrails('hello world', { block_patterns: ['bad.*pattern'], pii_action: 'none' })");
    const r = checkInputGuardrails('hello world', {
      block_patterns: ['bad.*pattern'],
      pii_action: 'none',
    });
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('3.2.2');
  });

  it('3.2.3 case-insensitive pattern matching', () => {
    execute("checkInputGuardrails('IGNORE ALL', { block_patterns: ['ignore'], pii_action: 'none' })");
    const r = checkInputGuardrails('IGNORE ALL', {
      block_patterns: ['ignore'],
      pii_action: 'none',
    });
    result(r);
    assert('r.passed === false (case-insensitive)');
    expect(r.passed).toBe(false);
    pass('3.2.3');
  });
});

describe('3.3 block_topics input guardrail', () => {
  it('3.3.1 blocks on matching topic keyword', () => {
    execute("checkInputGuardrails('I want to make weapons', { block_topics: ['weapons'], pii_action: 'none' })");
    const r = checkInputGuardrails('I want to make weapons', {
      block_topics: ['weapons'],
      pii_action: 'none',
    });
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    expect(r.violation).toContain('blocked topic');
    pass('3.3.1');
  });

  it('3.3.2 passes when no topic matched', () => {
    execute("checkInputGuardrails('happy cats', { block_topics: ['weapons'], pii_action: 'none' })");
    const r = checkInputGuardrails('happy cats', {
      block_topics: ['weapons'],
      pii_action: 'none',
    });
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('3.3.2');
  });

  it('3.3.3 topic match is case-insensitive', () => {
    execute("checkInputGuardrails('VIOLENCE is bad', { block_topics: ['violence'], pii_action: 'none' })");
    const r = checkInputGuardrails('VIOLENCE is bad', {
      block_topics: ['violence'],
      pii_action: 'none',
    });
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    pass('3.3.3');
  });
});

describe('3.4 PII detection', () => {
  it('3.4.1 detects email address', () => {
    execute("detectPII('Contact me at alice@example.com')");
    const r = detectPII('Contact me at alice@example.com');
    result(r);
    assert('r.found === true && r.types includes "email"');
    expect(r.found).toBe(true);
    expect(r.types).toContain('email');
    pass('3.4.1');
  });

  it('3.4.2 detects SSN pattern', () => {
    execute("detectPII('My SSN is 123-45-6789')");
    const r = detectPII('My SSN is 123-45-6789');
    result(r);
    assert('r.found === true && r.types includes "ssn"');
    expect(r.found).toBe(true);
    expect(r.types).toContain('ssn');
    pass('3.4.2');
  });

  it('3.4.3 no PII in clean text', () => {
    execute("detectPII('The weather is nice today')");
    const r = detectPII('The weather is nice today');
    result(r);
    assert('r.found === false');
    expect(r.found).toBe(false);
    expect(r.types).toHaveLength(0);
    pass('3.4.3');
  });

  it('3.4.4 redactPII replaces email with placeholder', () => {
    execute("redactPII('Email: alice@example.com')");
    const r = redactPII('Email: alice@example.com');
    result(r);
    assert('r includes [REDACTED_EMAIL]');
    expect(r).toContain('[REDACTED_EMAIL]');
    expect(r).not.toContain('alice@example.com');
    pass('3.4.4');
  });

  it('3.4.5 redactPII replaces SSN with placeholder', () => {
    execute("redactPII('SSN: 123-45-6789')");
    const r = redactPII('SSN: 123-45-6789');
    result(r);
    assert('r includes [REDACTED_SSN]');
    expect(r).toContain('[REDACTED_SSN]');
    expect(r).not.toContain('123-45-6789');
    pass('3.4.5');
  });

  it('3.4.6 pii_action=block blocks input with PII', () => {
    execute("checkInputGuardrails('alice@example.com', { pii_action: 'block' })");
    const r = checkInputGuardrails('alice@example.com', { pii_action: 'block' });
    result(r);
    assert('r.passed === false && violation includes "PII"');
    expect(r.passed).toBe(false);
    expect(r.violation).toContain('PII');
    pass('3.4.6');
  });

  it('3.4.7 pii_action=redact transforms input', () => {
    execute("checkInputGuardrails('alice@example.com', { pii_action: 'redact' })");
    const r = checkInputGuardrails('alice@example.com', { pii_action: 'redact' });
    result(r);
    assert('r.passed === true && r.transformed is defined');
    expect(r.passed).toBe(true);
    expect(r.transformed).toBeDefined();
    expect(r.transformed).toContain('[REDACTED_EMAIL]');
    pass('3.4.7');
  });

  it('3.4.8 pii_action=warn passes with violation note', () => {
    execute("checkInputGuardrails('alice@example.com', { pii_action: 'warn' })");
    const r = checkInputGuardrails('alice@example.com', { pii_action: 'warn' });
    result(r);
    assert('r.passed === true && violation is set');
    expect(r.passed).toBe(true);
    expect(r.violation).toBeDefined();
    pass('3.4.8');
  });
});

describe('3.6 output require_patterns guardrail', () => {
  it('3.6.1 passes when require_pattern matches', () => {
    execute("checkOutputGuardrails('The answer is 42', { require_patterns: ['answer'], pii_action: 'none' })");
    const r = checkOutputGuardrails('The answer is 42', {
      require_patterns: ['answer'],
      pii_action: 'none',
    });
    result(r);
    assert('r.passed === true');
    expect(r.passed).toBe(true);
    pass('3.6.1');
  });

  it('3.6.2 blocks when no require_pattern matches', () => {
    execute("checkOutputGuardrails('random text', { require_patterns: ['answer'], pii_action: 'none' })");
    const r = checkOutputGuardrails('random text', {
      require_patterns: ['answer'],
      pii_action: 'none',
    });
    result(r);
    assert('r.passed === false');
    expect(r.passed).toBe(false);
    expect(r.violation).toContain('required pattern');
    pass('3.6.2');
  });
});
