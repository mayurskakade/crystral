export interface FallbackEntry {
  provider: string;
  model: string;
}

export interface FallbackResult<T> {
  result: T;
  providerUsed: { provider: string; model: string };
}

/**
 * Try a primary function, and if it fails, try each fallback in order.
 *
 * @param primaryFn - The primary function to try first
 * @param fallbacks - Ordered list of fallback provider/model pairs
 * @param createFallbackFn - Factory to create a function for each fallback entry
 * @returns The result along with which provider/model actually served
 */
export async function withFallback<T>(
  primaryFn: () => Promise<T>,
  fallbacks: FallbackEntry[],
  createFallbackFn: (provider: string, model: string) => () => Promise<T>,
  primaryProvider: string,
  primaryModel: string,
): Promise<FallbackResult<T>> {
  // Try primary first
  try {
    const result = await primaryFn();
    return {
      result,
      providerUsed: { provider: primaryProvider, model: primaryModel },
    };
  } catch {
    // Primary failed, try fallbacks
  }

  // Try each fallback in order
  let lastError: unknown;
  for (const fb of fallbacks) {
    try {
      const fn = createFallbackFn(fb.provider, fb.model);
      const result = await fn();
      return {
        result,
        providerUsed: { provider: fb.provider, model: fb.model },
      };
    } catch (error) {
      lastError = error;
      // Continue to next fallback
    }
  }

  // All fallbacks failed
  throw lastError;
}
