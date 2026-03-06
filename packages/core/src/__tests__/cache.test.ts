import { describe, it, expect } from 'vitest';
import { CacheManager, hashCacheKey, stableStringify } from '../cache/index.ts';
import { createMockStorage } from './helpers/fixtures.ts';
import { execute, result, assert, pass } from './helpers/test-logger.ts';

describe('6.1 cache key generation', () => {
  it('6.1.1 same inputs produce same key', () => {
    execute('hashCacheKey({ a: 1, b: 2 }) called twice');
    const k1 = hashCacheKey({ a: 1, b: 2 });
    const k2 = hashCacheKey({ a: 1, b: 2 });
    result({ k1, k2 });
    assert('k1 === k2');
    expect(k1).toBe(k2);
    pass('6.1.1');
  });

  it('6.1.2 different inputs produce different keys', () => {
    execute('hashCacheKey({ a: 1 }) vs hashCacheKey({ a: 2 })');
    const k1 = hashCacheKey({ a: 1 });
    const k2 = hashCacheKey({ a: 2 });
    result({ k1, k2 });
    assert('k1 !== k2');
    expect(k1).not.toBe(k2);
    pass('6.1.2');
  });

  it('6.1.3 stableStringify sorts keys', () => {
    execute('stableStringify({ b: 2, a: 1 }) vs { a: 1, b: 2 }');
    const s1 = stableStringify({ b: 2, a: 1 });
    const s2 = stableStringify({ a: 1, b: 2 });
    result({ s1, s2 });
    assert('s1 === s2 (key order normalized)');
    expect(s1).toBe(s2);
    pass('6.1.3');
  });

  it('6.1.4 CacheManager.generateKey is deterministic', () => {
    execute('cacheManager.generateKey same args twice');
    const storage = createMockStorage();
    const manager = new CacheManager(storage, { enabled: true, ttl: 3600 });
    const k1 = manager.generateKey('openai', 'gpt-4', [{ role: 'user', content: 'hi' }], 'system');
    const k2 = manager.generateKey('openai', 'gpt-4', [{ role: 'user', content: 'hi' }], 'system');
    result({ k1, k2 });
    assert('k1 === k2');
    expect(k1).toBe(k2);
    pass('6.1.4');
  });
});

describe('6.2 CacheManager get/set/miss/TTL/clear', () => {
  it('6.2.1 miss returns null', () => {
    execute('cache.get("missing-key")');
    const storage = createMockStorage();
    const manager = new CacheManager(storage, { enabled: true, ttl: 3600 });
    const r = manager.get('missing-key');
    result(r);
    assert('r === null');
    expect(r).toBeNull();
    pass('6.2.1');
  });

  it('6.2.2 set then get returns the value', () => {
    execute('cache.set("k", "response") then cache.get("k")');
    const storage = createMockStorage();
    const manager = new CacheManager(storage, { enabled: true, ttl: 3600 });
    manager.set('k', 'cached-response');
    const r = manager.get('k');
    result(r);
    assert('r === "cached-response"');
    expect(r).toBe('cached-response');
    pass('6.2.2');
  });

  it('6.2.3 disabled cache always returns null', () => {
    execute('disabled cache manager.get(key)');
    const storage = createMockStorage();
    const manager = new CacheManager(storage, { enabled: false, ttl: 3600 });
    manager.set('k', 'value'); // should no-op
    const r = manager.get('k');
    result(r);
    assert('r === null (cache disabled)');
    expect(r).toBeNull();
    pass('6.2.3');
  });

  it('6.2.4 expired TTL returns null', () => {
    execute('set with 1s TTL, expire, then get');
    const storage = createMockStorage();
    // Set a cache entry that expires in the past
    const key = 'ttl-test';
    const pastExpiry = new Date(Date.now() - 1000); // 1 second ago
    storage.setCachedResponse(key, 'expired', pastExpiry);
    const manager = new CacheManager(storage, { enabled: true, ttl: 1 });
    const r = manager.get(key);
    result(r);
    assert('r === null (TTL expired)');
    expect(r).toBeNull();
    pass('6.2.4');
  });

  it('6.2.5 clear removes all entries', () => {
    execute('set two entries, then clear, then get');
    const storage = createMockStorage();
    const manager = new CacheManager(storage, { enabled: true, ttl: 3600 });
    manager.set('k1', 'v1');
    manager.set('k2', 'v2');
    manager.clear();
    const r1 = manager.get('k1');
    const r2 = manager.get('k2');
    result({ r1, r2 });
    assert('r1 === null && r2 === null');
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    pass('6.2.5');
  });
});

describe('6.3 clearExpired and stats', () => {
  it('6.3.1 clearExpired removes only expired entries', () => {
    execute('set valid + expired, clearExpired, check valid remains');
    const storage = createMockStorage();
    const manager = new CacheManager(storage, { enabled: true, ttl: 3600 });
    // Set a valid entry
    manager.set('valid-key', 'still-good');
    // Set an expired entry directly via storage
    storage.setCachedResponse('expired-key', 'gone', new Date(Date.now() - 1000));
    manager.clearExpired();
    const valid = manager.get('valid-key');
    const expired = storage.getCachedResponse('expired-key');
    result({ valid, expired });
    assert('valid === "still-good" && expired === null');
    expect(valid).toBe('still-good');
    expect(expired).toBeNull();
    pass('6.3.1');
  });

  it('6.3.2 getCacheStats returns correct entry count', () => {
    execute('set 3 entries, getCacheStats()');
    const storage = createMockStorage();
    const manager = new CacheManager(storage, { enabled: true, ttl: 3600 });
    manager.set('a', 'val1');
    manager.set('b', 'val2');
    manager.set('c', 'val3');
    const stats = storage.getCacheStats();
    result(stats);
    assert('stats.entries === 3');
    expect(stats.entries).toBe(3);
    pass('6.3.2');
  });

  it('6.3.3 getCacheStats sizeBytes > 0 after set', () => {
    execute('set entry with long response, check sizeBytes > 0');
    const storage = createMockStorage();
    storage.setCachedResponse('key', 'a'.repeat(100), new Date(Date.now() + 3600_000));
    const stats = storage.getCacheStats();
    result(stats);
    assert('stats.sizeBytes >= 100');
    expect(stats.sizeBytes).toBeGreaterThanOrEqual(100);
    pass('6.3.3');
  });

  it('6.3.4 getCacheStats empty after clear', () => {
    execute('set + clear, check stats.entries === 0');
    const storage = createMockStorage();
    const manager = new CacheManager(storage, { enabled: true, ttl: 3600 });
    manager.set('x', 'y');
    manager.clear();
    const stats = storage.getCacheStats();
    result(stats);
    assert('stats.entries === 0');
    expect(stats.entries).toBe(0);
    pass('6.3.4');
  });

  it('6.3.5 custom TTL overrides config TTL', () => {
    execute('set with custom 1h TTL, verify it is still retrievable');
    const storage = createMockStorage();
    const manager = new CacheManager(storage, { enabled: true, ttl: 1 }); // 1s default
    manager.set('long-ttl-key', 'long-lived', 3600); // override to 1h
    const r = manager.get('long-ttl-key');
    result(r);
    assert('r === "long-lived" (custom TTL used)');
    expect(r).toBe('long-lived');
    pass('6.3.5');
  });
});
