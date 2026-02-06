import { logger } from '@/lib/logger';

/**
 * Rate Limiter for Security-Critical Operations
 *
 * Implements exponential backoff to protect against brute-force attacks.
 * Specifically designed for password/unlock operations.
 *
 * Security Features:
 * - Exponential backoff: wait time doubles after each failure
 * - Maximum lockout period: 1 hour
 * - Per-identity tracking: each identity has its own failure count
 * - Automatic reset: successful auth clears failure count
 */

interface RateLimitState {
  failureCount: number;
  lastFailure: number;
  lockedUntil: number;
}

// Store rate limit state per identity
const rateLimitStates = new Map<string, RateLimitState>();

// Configuration
const BASE_DELAY_MS = 1000; // 1 second initial delay
const MAX_DELAY_MS = 60 * 60 * 1000; // 1 hour max lockout
const FAILURE_WINDOW_MS = 15 * 60 * 1000; // Reset failures after 15 min of inactivity
const MAX_FAILURES_BEFORE_LOCKOUT = 3; // Start exponential backoff after 3 failures

/**
 * Get current rate limit state for an identity
 */
function getState(identityKey: string): RateLimitState {
  let state = rateLimitStates.get(identityKey);

  if (!state) {
    state = {
      failureCount: 0,
      lastFailure: 0,
      lockedUntil: 0,
    };
    rateLimitStates.set(identityKey, state);
  }

  // Reset failure count if enough time has passed since last failure
  const now = Date.now();
  if (state.lastFailure > 0 && now - state.lastFailure > FAILURE_WINDOW_MS) {
    state.failureCount = 0;
    state.lastFailure = 0;
    state.lockedUntil = 0;
  }

  return state;
}

/**
 * Calculate lockout time based on failure count using exponential backoff
 */
function calculateLockoutTime(failureCount: number): number {
  if (failureCount <= MAX_FAILURES_BEFORE_LOCKOUT) {
    return 0;
  }

  // Exponential backoff: 2^(failures - threshold) * base_delay
  const exponent = failureCount - MAX_FAILURES_BEFORE_LOCKOUT;
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, exponent), MAX_DELAY_MS);

  return delay;
}

/**
 * Check if an operation is currently rate limited
 * Returns the number of milliseconds to wait, or 0 if not limited
 */
export function checkRateLimit(identityKey: string): number {
  const state = getState(identityKey);
  const now = Date.now();

  if (state.lockedUntil > now) {
    return state.lockedUntil - now;
  }

  return 0;
}

/**
 * Get a human-readable message about the rate limit status
 */
export function getRateLimitMessage(identityKey: string): string | null {
  const waitTime = checkRateLimit(identityKey);

  if (waitTime === 0) {
    return null;
  }

  const seconds = Math.ceil(waitTime / 1000);
  if (seconds < 60) {
    return `Too many failed attempts. Please wait ${seconds} seconds.`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `Too many failed attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }

  const hours = Math.ceil(minutes / 60);
  return `Too many failed attempts. Please wait ${hours} hour${hours === 1 ? '' : 's'}.`;
}

/**
 * Record a failed authentication attempt
 * Increases failure count and calculates new lockout time
 */
export function recordFailure(identityKey: string): void {
  const state = getState(identityKey);
  const now = Date.now();

  state.failureCount++;
  state.lastFailure = now;

  const lockoutDuration = calculateLockoutTime(state.failureCount);
  state.lockedUntil = now + lockoutDuration;

  rateLimitStates.set(identityKey, state);

  // Log for security monitoring (don't include sensitive info)
  console.warn(
    `Auth failure recorded for identity ${identityKey.slice(0, 8)}... ` +
      `(attempt ${state.failureCount}, lockout: ${lockoutDuration}ms)`
  );
}

/**
 * Record a successful authentication
 * Resets the failure count for the identity
 */
export function recordSuccess(identityKey: string): void {
  const state = getState(identityKey);

  // Log if there were previous failures (potential attack that stopped)
  if (state.failureCount > 0) {
    logger.info(
      `Auth success for identity ${identityKey.slice(0, 8)}... ` +
        `(clearing ${state.failureCount} previous failures)`
    );
  }

  state.failureCount = 0;
  state.lastFailure = 0;
  state.lockedUntil = 0;

  rateLimitStates.set(identityKey, state);
}

/**
 * Get the current failure count for an identity (for debugging/monitoring)
 */
export function getFailureCount(identityKey: string): number {
  return getState(identityKey).failureCount;
}

/**
 * Clear rate limit state for an identity (e.g., when identity is deleted)
 */
export function clearRateLimitState(identityKey: string): void {
  rateLimitStates.delete(identityKey);
}

/**
 * Create a rate-limited wrapper for an async function
 * Throws an error if rate limited, otherwise executes the function
 */
export async function withRateLimit<T>(
  identityKey: string,
  fn: () => Promise<T>,
  onSuccess?: () => void
): Promise<T> {
  // Check if currently rate limited
  const waitTime = checkRateLimit(identityKey);
  if (waitTime > 0) {
    const message = getRateLimitMessage(identityKey);
    throw new Error(message || 'Rate limited. Please try again later.');
  }

  try {
    const result = await fn();
    recordSuccess(identityKey);
    onSuccess?.();
    return result;
  } catch (error) {
    recordFailure(identityKey);
    throw error;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * SECURITY: Always iterates over the longer string's length to prevent
 * length-based timing leaks. Length difference is folded into the result
 * via XOR, not via early return.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  // XOR lengths into result so different lengths always fail
  let result = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    // Use charCode 0 as fallback for out-of-bounds index
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    result |= ca ^ cb;
  }
  return result === 0;
}

/**
 * Constant-time Uint8Array comparison.
 * SECURITY: Always iterates over the longer array's length to prevent
 * length-based timing leaks.
 */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  const maxLen = Math.max(a.length, b.length);
  // XOR lengths into result so different lengths always fail
  let result = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ba = i < a.length ? a[i] : 0;
    const bb = i < b.length ? b[i] : 0;
    result |= ba ^ bb;
  }
  return result === 0;
}
