import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../retry/index.ts';
import { withFallback } from '../retry/fallback.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('2.1 withRetry', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('2.1.1 succeeds on first try', async () => {
    execute("withRetry(() => Promise.resolve('ok'), { max_attempts:3, backoff:'none', retry_on:[] })");
    const fn = vi.fn().mockResolvedValue('ok');
    const p = withRetry(fn, { max_attempts: 3, backoff: 'none', retry_on: [] });
    await vi.runAllTimersAsync();
    const r = await p;
    result(r);
    assert('r === "ok" && fn called once');
    expect(r).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    pass('2.1.1');
  });

  it('2.1.2 re-throws when non-retryable error', async () => {
    execute('withRetry throws non-retryable immediately');
    const err = new Error('bad input');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      withRetry(fn, { max_attempts: 3, backoff: 'none', retry_on: ['rate_limit'] }),
    ).rejects.toThrow('bad input');
    expect(fn).toHaveBeenCalledTimes(1);
    pass('2.1.2');
  });

  it('2.1.3 retries on rate_limit error', async () => {
    execute('withRetry retries on 429 error');
    const rateLimitErr = Object.assign(new Error('rate limited'), { status: 429 });
    const fn = vi.fn()
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValue('success');
    const p = withRetry(fn, { max_attempts: 3, backoff: 'none', retry_on: ['rate_limit'] });
    await vi.runAllTimersAsync();
    const r = await p;
    result(r);
    assert('r === "success" && fn called twice');
    expect(r).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
    pass('2.1.3');
  });

  it('2.1.4 retries on server_error (5xx)', async () => {
    execute('withRetry retries on 500 error');
    const serverErr = Object.assign(new Error('internal server error'), { status: 500 });
    const fn = vi.fn()
      .mockRejectedValueOnce(serverErr)
      .mockResolvedValue('recovered');
    const p = withRetry(fn, { max_attempts: 3, backoff: 'none', retry_on: ['server_error'] });
    await vi.runAllTimersAsync();
    const r = await p;
    result(r);
    assert('r === "recovered"');
    expect(r).toBe('recovered');
    pass('2.1.4');
  });

  it('2.1.5 retries on timeout error', async () => {
    execute('withRetry retries on timeout message');
    const timeoutErr = new Error('request timeout occurred');
    const fn = vi.fn()
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValue('done');
    const p = withRetry(fn, { max_attempts: 3, backoff: 'none', retry_on: ['timeout'] });
    await vi.runAllTimersAsync();
    const r = await p;
    result(r);
    assert('r === "done"');
    expect(r).toBe('done');
    pass('2.1.5');
  });

  it('2.1.6 exhausts max_attempts and throws', async () => {
    execute('withRetry exhausts 3 attempts');
    const rateLimitErr = Object.assign(new Error('rate limited'), { status: 429 });
    const fn = vi.fn().mockRejectedValue(rateLimitErr);
    const p = withRetry(fn, { max_attempts: 3, backoff: 'none', retry_on: ['rate_limit'] });
    const assertion = expect(p).rejects.toThrow('rate limited');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
    pass('2.1.6');
  });

  it('2.1.7 max_attempts=1 does not retry', async () => {
    execute('withRetry with max_attempts=1 never retries');
    const err = Object.assign(new Error('fail'), { status: 429 });
    const fn = vi.fn().mockRejectedValue(err);
    const p = withRetry(fn, { max_attempts: 1, backoff: 'none', retry_on: ['rate_limit'] });
    const assertion = expect(p).rejects.toThrow('fail');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
    pass('2.1.7');
  });

  it('2.1.8 linear backoff uses setTimeout with delay', async () => {
    execute('withRetry linear backoff delay test');
    const rateLimitErr = Object.assign(new Error('rate limited'), { status: 429 });
    const fn = vi.fn()
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValue('ok');
    const p = withRetry(fn, { max_attempts: 3, backoff: 'linear', retry_on: ['rate_limit'] });
    // Advance timers to trigger the delay
    await vi.runAllTimersAsync();
    const r = await p;
    result(r);
    assert('r === "ok" (linear backoff completed)');
    expect(r).toBe('ok');
    pass('2.1.8');
  });

  it('2.1.9 exponential backoff resolves after timer advance', async () => {
    execute('withRetry exponential backoff test');
    const serverErr = Object.assign(new Error('server error'), { status: 503 });
    const fn = vi.fn()
      .mockRejectedValueOnce(serverErr)
      .mockResolvedValue('recovered');
    const p = withRetry(fn, { max_attempts: 3, backoff: 'exponential', retry_on: ['server_error'] });
    await vi.runAllTimersAsync();
    const r = await p;
    result(r);
    assert('r === "recovered" (exponential backoff completed)');
    expect(r).toBe('recovered');
    pass('2.1.9');
  });
});

describe('2.2 withFallback', () => {
  it('2.2.1 returns primary result on success', async () => {
    execute('withFallback primary succeeds');
    const primaryFn = vi.fn().mockResolvedValue('primary-result');
    const r = await withFallback(
      primaryFn,
      [],
      () => () => Promise.resolve('fallback'),
      'openai',
      'gpt-4',
    );
    result(r);
    assert('r.result === "primary-result" && r.providerUsed.provider === "openai"');
    expect(r.result).toBe('primary-result');
    expect(r.providerUsed.provider).toBe('openai');
    expect(r.providerUsed.model).toBe('gpt-4');
    pass('2.2.1');
  });

  it('2.2.2 falls through to first fallback on primary failure', async () => {
    execute('withFallback primary fails, fallback1 succeeds');
    const primaryFn = vi.fn().mockRejectedValue(new Error('primary down'));
    const fallbackFn = vi.fn().mockResolvedValue('fallback-result');
    const r = await withFallback(
      primaryFn,
      [{ provider: 'anthropic', model: 'claude-3' }],
      () => fallbackFn,
      'openai',
      'gpt-4',
    );
    result(r);
    assert('r.result === "fallback-result" && r.providerUsed.provider === "anthropic"');
    expect(r.result).toBe('fallback-result');
    expect(r.providerUsed.provider).toBe('anthropic');
    pass('2.2.2');
  });

  it('2.2.3 tries fallbacks in order', async () => {
    execute('withFallback primary+fallback1 fail, fallback2 succeeds');
    const primaryFn = vi.fn().mockRejectedValue(new Error('primary down'));
    const fallback1Fn = vi.fn().mockRejectedValue(new Error('fb1 down'));
    const fallback2Fn = vi.fn().mockResolvedValue('fb2-result');
    const createFn = vi.fn()
      .mockReturnValueOnce(fallback1Fn)
      .mockReturnValueOnce(fallback2Fn);
    const r = await withFallback(
      primaryFn,
      [
        { provider: 'anthropic', model: 'claude-3' },
        { provider: 'groq', model: 'llama' },
      ],
      createFn,
      'openai',
      'gpt-4',
    );
    result(r);
    assert('r.result === "fb2-result" && r.providerUsed.provider === "groq"');
    expect(r.result).toBe('fb2-result');
    expect(r.providerUsed.provider).toBe('groq');
    pass('2.2.3');
  });

  it('2.2.4 throws when all fallbacks fail', async () => {
    execute('withFallback all fail → throws last error');
    const primaryFn = vi.fn().mockRejectedValue(new Error('primary down'));
    const fallbackFn = vi.fn().mockRejectedValue(new Error('all down'));
    await expect(
      withFallback(
        primaryFn,
        [{ provider: 'anthropic', model: 'claude-3' }],
        () => fallbackFn,
        'openai',
        'gpt-4',
      ),
    ).rejects.toThrow('all down');
    pass('2.2.4');
  });

  it('2.2.5 no fallbacks configured — primary success still works', async () => {
    execute('withFallback no fallbacks, primary ok');
    const primaryFn = vi.fn().mockResolvedValue(42);
    const r = await withFallback(primaryFn, [], () => () => Promise.resolve(0), 'groq', 'llama');
    result(r);
    assert('r.result === 42');
    expect(r.result).toBe(42);
    pass('2.2.5');
  });
});
