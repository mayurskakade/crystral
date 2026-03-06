import type { CacheConfig } from '../types/index.js';
import type { StorageAdapter } from '../storage/adapter.js';
import { hashCacheKey } from './hasher.js';

/**
 * Manages LLM response caching backed by SQLite storage.
 *
 * Provides get/set/clear operations with TTL-based expiry
 * and deterministic cache key generation from request parameters.
 */
export class CacheManager {
  private storage: StorageAdapter;
  private config: CacheConfig;

  constructor(storage: StorageAdapter, config: CacheConfig) {
    this.storage = storage;
    this.config = config;
  }

  /**
   * Look up a cached response by key.
   * Returns null if not found or expired.
   */
  get(key: string): string | null {
    if (!this.config.enabled) {
      return null;
    }
    return this.storage.getCachedResponse(key);
  }

  /**
   * Store a response in the cache.
   * @param key - Cache key (typically from generateKey)
   * @param response - The response string to cache
   * @param ttl - TTL in seconds; falls back to config.ttl
   */
  set(key: string, response: string, ttl?: number): void {
    if (!this.config.enabled) {
      return;
    }
    const ttlSeconds = ttl ?? this.config.ttl;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    this.storage.setCachedResponse(key, response, expiresAt);
  }

  /**
   * Delete all cache entries.
   */
  clear(): void {
    this.storage.clearCache();
  }

  /**
   * Delete only expired cache entries.
   */
  clearExpired(): void {
    this.storage.clearExpiredCache();
  }

  /**
   * Generate a deterministic cache key from LLM request parameters.
   * Uses SHA-256 hash of a stable JSON serialization.
   */
  generateKey(
    provider: string,
    model: string,
    messages: unknown[],
    systemPrompt: string,
    temperature?: number,
    tools?: unknown[],
  ): string {
    const data = {
      provider,
      model,
      messages,
      systemPrompt,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(tools !== undefined ? { tools } : {}),
    };
    return hashCacheKey(data);
  }
}

export { hashCacheKey, stableStringify } from './hasher.js';
