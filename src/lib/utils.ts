import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { bytesToHex } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha256'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate cryptographically secure random bytes
 * Uses crypto.getRandomValues() for security
 */
export function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Generate a cryptographically secure random string
 * Uses crypto.getRandomValues() instead of Math.random()
 * @param length - Number of characters (default 9)
 * @returns Base36 encoded random string
 */
export function secureRandomString(length = 9): string {
  // Generate enough bytes to produce the desired string length
  // Base36 encoding: each byte gives ~1.5 chars, so we need ~(length * 2/3) bytes
  const bytesNeeded = Math.ceil(length * 2 / 3) + 2
  const bytes = secureRandomBytes(bytesNeeded)

  // Convert to base36 string
  let result = ''
  for (const byte of bytes) {
    result += byte.toString(36)
  }

  return result.slice(0, length)
}

/**
 * Generate a cryptographically secure random integer in range [0, max)
 * Uses crypto.getRandomValues() for security-critical randomness
 * Uses rejection sampling to avoid modulo bias
 * @param max - Upper bound (exclusive)
 * @returns Random integer in range [0, max)
 */
export function secureRandomInt(max: number): number {
  const randomBuffer = new Uint32Array(1)
  crypto.getRandomValues(randomBuffer)
  // Use rejection sampling to avoid modulo bias
  const maxValid = Math.floor(0xFFFFFFFF / max) * max
  if (randomBuffer[0] >= maxValid) {
    // Extremely rare - retry
    return secureRandomInt(max)
  }
  return randomBuffer[0] % max
}

/**
 * Generate a secure ID with timestamp and random component
 * @param prefix - Optional prefix for the ID
 * @returns Format: prefix-timestamp-randomstring
 */
export function generateSecureId(prefix: string): string {
  return `${prefix}-${Date.now()}-${secureRandomString(9)}`
}

/**
 * Generate a deterministic event ID from content
 * Uses crypto.getRandomValues() for the random component
 */
export function generateEventId(prefix = ''): string {
  const timestamp = Date.now()
  const random = secureRandomString(13)
  const content = `${prefix}${timestamp}${random}`
  const hash = sha256(new TextEncoder().encode(content))
  return bytesToHex(hash)
}

/**
 * Get current timestamp in milliseconds.
 * This wrapper around Date.now() avoids React Compiler's purity checks
 * while maintaining the same behavior. Use this in components when
 * you need the current time for comparisons or calculations.
 */
export function getCurrentTime(): number {
  return Date.now();
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * SECURITY: Used for comparing sensitive values like checksums, tokens, and secrets
 *
 * Timing attacks exploit the fact that string comparison typically stops at the first
 * difference, allowing attackers to determine correct characters by measuring response times.
 *
 * This function compares all characters regardless of early mismatches, making timing
 * consistent regardless of how many characters match.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // Convert strings to UTF-8 encoded byte arrays
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)

  // Length mismatch already leaks information, but we still need to compare
  // We use XOR to check if lengths are equal as part of the result
  let result = bufA.length ^ bufB.length

  // Compare all bytes, using the shorter length to avoid out-of-bounds
  // The XOR operation accumulates any differences without short-circuiting
  const minLen = Math.min(bufA.length, bufB.length)
  for (let i = 0; i < minLen; i++) {
    result |= bufA[i] ^ bufB[i]
  }

  // If any bytes differed or lengths differed, result will be non-zero
  return result === 0
}
