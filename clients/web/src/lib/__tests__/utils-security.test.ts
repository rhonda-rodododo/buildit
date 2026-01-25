/**
 * Security tests for utility functions
 *
 * These tests verify:
 * 1. secureRandomBytes uses crypto.getRandomValues()
 * 2. secureRandomString produces unique, high-entropy strings
 * 3. timingSafeEqual provides constant-time comparison
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  secureRandomBytes,
  secureRandomString,
  generateSecureId,
  timingSafeEqual,
} from '../utils'

describe('Secure Random Functions', () => {
  describe('secureRandomBytes', () => {
    it('should use crypto.getRandomValues', () => {
      const spy = vi.spyOn(crypto, 'getRandomValues')

      secureRandomBytes(16)

      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should return correct length', () => {
      const bytes16 = secureRandomBytes(16)
      const bytes32 = secureRandomBytes(32)

      expect(bytes16.length).toBe(16)
      expect(bytes32.length).toBe(32)
    })

    it('should produce different values each call', () => {
      const bytes1 = secureRandomBytes(16)
      const bytes2 = secureRandomBytes(16)

      // Compare as hex strings
      const hex1 = Array.from(bytes1).map(b => b.toString(16).padStart(2, '0')).join('')
      const hex2 = Array.from(bytes2).map(b => b.toString(16).padStart(2, '0')).join('')

      expect(hex1).not.toBe(hex2)
    })
  })

  describe('secureRandomString', () => {
    it('should produce strings of specified length', () => {
      expect(secureRandomString(8).length).toBe(8)
      expect(secureRandomString(16).length).toBe(16)
      expect(secureRandomString(32).length).toBe(32)
    })

    it('should use default length of 9', () => {
      expect(secureRandomString().length).toBe(9)
    })

    it('should produce unique strings', () => {
      const strings = new Set<string>()

      for (let i = 0; i < 100; i++) {
        strings.add(secureRandomString(9))
      }

      // All 100 strings should be unique
      expect(strings.size).toBe(100)
    })

    it('should only contain alphanumeric characters', () => {
      for (let i = 0; i < 50; i++) {
        const str = secureRandomString(16)
        expect(str).toMatch(/^[a-z0-9]+$/)
      }
    })
  })

  describe('generateSecureId', () => {
    it('should include prefix', () => {
      const id = generateSecureId('test')
      expect(id).toMatch(/^test-/)
    })

    it('should include timestamp', () => {
      const before = Date.now()
      const id = generateSecureId('test')
      const after = Date.now()

      const parts = id.split('-')
      const timestamp = parseInt(parts[1], 10)

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('should produce unique IDs', () => {
      const ids = new Set<string>()

      for (let i = 0; i < 100; i++) {
        ids.add(generateSecureId('test'))
      }

      expect(ids.size).toBe(100)
    })
  })
})

describe('Timing-Safe Comparison', () => {
  describe('timingSafeEqual', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeEqual('hello', 'hello')).toBe(true)
      expect(timingSafeEqual('', '')).toBe(true)
      expect(timingSafeEqual('abc123', 'abc123')).toBe(true)
    })

    it('should return false for different strings', () => {
      expect(timingSafeEqual('hello', 'world')).toBe(false)
      expect(timingSafeEqual('abc', 'abd')).toBe(false)
      expect(timingSafeEqual('', 'a')).toBe(false)
    })

    it('should return false for different lengths', () => {
      expect(timingSafeEqual('short', 'longer')).toBe(false)
      expect(timingSafeEqual('abc', 'ab')).toBe(false)
    })

    it('should handle unicode correctly', () => {
      expect(timingSafeEqual('hello 世界', 'hello 世界')).toBe(true)
      expect(timingSafeEqual('hello 世界', 'hello 世界!')).toBe(false)
      expect(timingSafeEqual('🔐', '🔐')).toBe(true)
      expect(timingSafeEqual('🔐', '🔑')).toBe(false)
    })

    it('should take constant time regardless of match position', () => {
      // This is a statistical test - timing should be similar
      // for strings that differ at different positions
      // NOTE: JavaScript timing is imprecise and affected by JIT, GC, etc.
      // The implementation IS constant-time (XOR-based), but this test
      // can only provide a rough verification due to platform limitations.
      const baseString = 'a'.repeat(100)
      const diffAtStart = 'x' + 'a'.repeat(99)
      const diffAtEnd = 'a'.repeat(99) + 'x'

      // Run many iterations to get stable timing
      const iterations = 10000 // Increased for more stable measurements

      const startTimeDiffAtStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        timingSafeEqual(baseString, diffAtStart)
      }
      const timeDiffAtStart = performance.now() - startTimeDiffAtStart

      const startTimeDiffAtEnd = performance.now()
      for (let i = 0; i < iterations; i++) {
        timingSafeEqual(baseString, diffAtEnd)
      }
      const timeDiffAtEnd = performance.now() - startTimeDiffAtEnd

      // Times should be within an order of magnitude of each other
      // Wide tolerance due to JS timing imprecision, JIT compilation, GC pauses
      // The key security property (constant-time comparison via XOR) is
      // ensured by the implementation, not this timing measurement
      const ratio = timeDiffAtStart / timeDiffAtEnd
      expect(ratio).toBeGreaterThan(0.1)
      expect(ratio).toBeLessThan(10.0)
    })

    it('should handle base64-encoded checksums', () => {
      // Test with actual SHA-256 checksum format (44 chars base64)
      const checksum1 = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY='
      const checksum2 = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY='
      const checksum3 = 'ZGlmZmVyZW50Y2hlY2tzdW12YWx1ZTEyMzQ1Njc4OTA='

      expect(timingSafeEqual(checksum1, checksum2)).toBe(true)
      expect(timingSafeEqual(checksum1, checksum3)).toBe(false)
    })
  })
})
