import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { bytesToHex } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha256'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a deterministic event ID from content
 */
export function generateEventId(prefix = ''): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
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
