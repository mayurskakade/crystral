import { createHash } from 'node:crypto';

/**
 * Deterministically serialize data and produce a SHA-256 hex hash.
 */
export function hashCacheKey(data: unknown): string {
  const serialized = stableStringify(data);
  return createHash('sha256').update(serialized).digest('hex');
}

/**
 * JSON.stringify with sorted keys for deterministic output.
 * Handles nested objects, arrays, and primitive values.
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }

  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map((item) => stableStringify(item));
    return `[${items.join(',')}]`;
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${pairs.join(',')}}`;
}
