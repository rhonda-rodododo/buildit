/**
 * Rate Limiting for Sensitive Operations
 *
 * Protects against brute force attacks and abuse by limiting
 * the frequency of sensitive operations.
 */

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  blockDurationMs?: number
}

interface RateLimitEntry {
  attempts: number
  firstAttempt: number
  blockedUntil?: number
}

class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map()
  private configs: Map<string, RateLimitConfig> = new Map()

  constructor() {
    // Define rate limit configurations
    this.configs.set('login', {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 30 * 60 * 1000, // 30 minutes
    })

    this.configs.set('key-export', {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 60 * 60 * 1000, // 1 hour
    })

    this.configs.set('identity-creation', {
      maxAttempts: 5,
      windowMs: 60 * 60 * 1000, // 1 hour
    })

    this.configs.set('group-creation', {
      maxAttempts: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
    })

    this.configs.set('message-send', {
      maxAttempts: 100,
      windowMs: 60 * 1000, // 1 minute
    })

    this.configs.set('password-change', {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 2 * 60 * 60 * 1000, // 2 hours
    })

    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  /**
   * Check if an operation is allowed
   */
  checkLimit(operation: string, identifier: string): { allowed: boolean; retryAfter?: number } {
    const config = this.configs.get(operation)
    if (!config) {
      // No rate limit configured - allow by default
      return { allowed: true }
    }

    const key = `${operation}:${identifier}`
    const now = Date.now()
    const entry = this.attempts.get(key)

    // Check if currently blocked
    if (entry?.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
      }
    }

    // Check if window has expired
    if (entry && now - entry.firstAttempt > config.windowMs) {
      // Reset window
      this.attempts.delete(key)
      return { allowed: true }
    }

    // Check if limit exceeded
    if (entry && entry.attempts >= config.maxAttempts) {
      // Block for configured duration
      const blockedUntil = now + (config.blockDurationMs || config.windowMs)
      this.attempts.set(key, {
        ...entry,
        blockedUntil,
      })

      return {
        allowed: false,
        retryAfter: Math.ceil((blockedUntil - now) / 1000),
      }
    }

    return { allowed: true }
  }

  /**
   * Record an attempt
   */
  recordAttempt(operation: string, identifier: string): void {
    const config = this.configs.get(operation)
    if (!config) return

    const key = `${operation}:${identifier}`
    const now = Date.now()
    const entry = this.attempts.get(key)

    if (!entry || now - entry.firstAttempt > config.windowMs) {
      // New window
      this.attempts.set(key, {
        attempts: 1,
        firstAttempt: now,
      })
    } else {
      // Increment attempts in current window
      this.attempts.set(key, {
        ...entry,
        attempts: entry.attempts + 1,
      })
    }
  }

  /**
   * Reset attempts for an identifier (e.g., after successful operation)
   */
  reset(operation: string, identifier: string): void {
    const key = `${operation}:${identifier}`
    this.attempts.delete(key)
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()

    for (const [key, entry] of this.attempts.entries()) {
      const operation = key.split(':')[0]
      const config = this.configs.get(operation)

      if (config && now - entry.firstAttempt > config.windowMs * 2) {
        // Entry is older than 2x the window - safe to delete
        this.attempts.delete(key)
      }
    }
  }

  /**
   * Get current attempt count for debugging
   */
  getAttempts(operation: string, identifier: string): number {
    const key = `${operation}:${identifier}`
    return this.attempts.get(key)?.attempts || 0
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter()

/**
 * Higher-order function to wrap sensitive operations with rate limiting
 */
export function withRateLimit<T extends (...args: any[]) => any>(
  operation: string,
  identifierFn: (...args: Parameters<T>) => string,
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    const identifier = identifierFn(...args)

    // Check rate limit
    const { allowed, retryAfter } = rateLimiter.checkLimit(operation, identifier)

    if (!allowed) {
      const error: any = new Error(`Rate limit exceeded for ${operation}. Try again in ${retryAfter} seconds.`)
      error.code = 'RATE_LIMIT_EXCEEDED'
      error.retryAfter = retryAfter
      throw error
    }

    // Record attempt
    rateLimiter.recordAttempt(operation, identifier)

    // Execute operation
    try {
      const result = fn(...args)

      // If operation succeeds, reset on next tick (for async operations)
      if (result instanceof Promise) {
        result.then(() => {
          setTimeout(() => rateLimiter.reset(operation, identifier), 0)
        }).catch(() => {
          // Keep attempt recorded on failure
        })
      } else {
        setTimeout(() => rateLimiter.reset(operation, identifier), 0)
      }

      return result
    } catch (error) {
      // Keep attempt recorded on failure
      throw error
    }
  }) as T
}

/**
 * React hook for rate-limited operations
 */
export function useRateLimit(operation: string, identifier: string) {
  const checkLimit = () => rateLimiter.checkLimit(operation, identifier)
  const recordAttempt = () => rateLimiter.recordAttempt(operation, identifier)
  const reset = () => rateLimiter.reset(operation, identifier)
  const getAttempts = () => rateLimiter.getAttempts(operation, identifier)

  return {
    checkLimit,
    recordAttempt,
    reset,
    getAttempts,
  }
}
