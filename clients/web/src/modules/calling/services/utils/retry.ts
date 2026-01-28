/**
 * Retry Utility
 * Provides exponential backoff retry logic for API calls
 */

import { logger } from '@/lib/logger';

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add jitter to delay (default: true) */
  jitter?: boolean;
  /** Error types to retry on (default: all errors) */
  retryOn?: (error: unknown) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'retryOn'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Delay for a given number of milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'onRetry' | 'retryOn'>>
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  let delayMs = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);

  // Cap at maximum delay
  delayMs = Math.min(delayMs, options.maxDelay);

  // Add jitter (±25%)
  if (options.jitter) {
    const jitterRange = delayMs * 0.25;
    delayMs = delayMs - jitterRange + Math.random() * (jitterRange * 2);
  }

  return Math.round(delayMs);
}

/**
 * Check if an error is a network error that should be retried
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // HTTP status codes that are retryable
  if (error instanceof Response) {
    // 5xx server errors, 429 rate limit, 408 timeout
    return error.status >= 500 || error.status === 429 || error.status === 408;
  }

  // Custom error types
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('rate limit')
    );
  }

  return false;
}

/**
 * Execute a function with retry logic
 *
 * @param fn - The async function to execute
 * @param options - Retry options
 * @returns The result of the function
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('/api/data'),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      const shouldRetry = opts.retryOn ? opts.retryOn(error) : isRetryableError(error);

      // Don't retry if it's not a retryable error or we've exhausted retries
      if (!shouldRetry || attempt >= opts.maxRetries) {
        throw error;
      }

      // Calculate delay for next attempt
      const delayMs = calculateDelay(attempt, opts);

      // Log retry attempt
      logger.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delayMs}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, error, delayMs);
      }

      // Wait before retrying
      await delay(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Execute a fetch request with retry logic
 *
 * @param url - The URL to fetch
 * @param init - Fetch options
 * @param retryOptions - Retry options
 * @returns The fetch response
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * const response = await fetchWithRetry('/api/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' }),
 * });
 * ```
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, init);

    // Treat 5xx, 429, 408 as errors for retry purposes
    if (response.status >= 500 || response.status === 429 || response.status === 408) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      (error as Error & { response: Response }).response = response;
      throw error;
    }

    return response;
  }, {
    ...retryOptions,
    // Override retryOn to check HTTP status codes
    retryOn: (error) => {
      if (retryOptions.retryOn) {
        return retryOptions.retryOn(error);
      }
      return isRetryableError(error);
    },
  });
}

/**
 * Create a retryable version of any async function
 *
 * @param fn - The async function to wrap
 * @param options - Default retry options
 * @returns A new function that will retry on failure
 *
 * @example
 * ```typescript
 * const retryableGetUser = createRetryable(
 *   (id: string) => api.getUser(id),
 *   { maxRetries: 3 }
 * );
 *
 * const user = await retryableGetUser('123');
 * ```
 */
export function createRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => {
    return withRetry(() => fn(...args) as Promise<ReturnType<T>>, options);
  }) as T;
}

export default withRetry;
