import type { RetryConfig } from '../types/index.js';

/**
 * Determine the delay in milliseconds for a given attempt based on backoff strategy.
 */
function getBackoffDelay(attempt: number, backoff: RetryConfig['backoff']): number {
  switch (backoff) {
    case 'none':
      return 0;
    case 'linear':
      return attempt * 1000;
    case 'exponential':
      return Math.pow(2, attempt) * 500;
  }
}

/**
 * Check if an error matches any of the configured retry_on error types.
 */
function isRetryableError(error: unknown, retryOn: RetryConfig['retry_on']): boolean {
  if (!(error instanceof Error)) return false;

  const err = error as Error & { code?: string; status?: number; httpStatus?: number };

  for (const errorType of retryOn) {
    switch (errorType) {
      case 'rate_limit':
        if (err.code === 'RATE_LIMIT' || err.status === 429 || err.httpStatus === 429) {
          return true;
        }
        break;
      case 'server_error': {
        const status = err.status ?? err.httpStatus;
        if (typeof status === 'number' && status >= 500) {
          return true;
        }
        break;
      }
      case 'timeout':
        if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
          return true;
        }
        break;
    }
  }

  return false;
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrap a function with retry logic based on the provided config.
 *
 * Retries up to `max_attempts` total (including the first attempt).
 * Only retries on errors matching the configured `retry_on` types.
 * Uses the configured backoff strategy between attempts.
 * Re-throws the last error on final failure.
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < config.max_attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this is the last attempt, don't retry
      if (attempt === config.max_attempts - 1) {
        break;
      }

      // Only retry on matching error types
      if (!isRetryableError(error, config.retry_on)) {
        break;
      }

      // Wait before retrying
      const delay = getBackoffDelay(attempt + 1, config.backoff);
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
