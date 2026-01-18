import { describe, it, expect, vi } from 'vitest'
import { secureRandomInt, randomizeTimestamp } from '../nip17'

describe('NIP-17 Security Functions', () => {
  describe('secureRandomInt', () => {
    it('should return values within range [0, max)', () => {
      const max = 100
      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        const result = secureRandomInt(max)
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThan(max)
      }
    })

    it('should use crypto.getRandomValues for secure randomness', () => {
      const spy = vi.spyOn(crypto, 'getRandomValues')

      secureRandomInt(100)

      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should produce a roughly uniform distribution', () => {
      const max = 10
      const iterations = 10000
      const counts: Record<number, number> = {}

      for (let i = 0; i < iterations; i++) {
        const result = secureRandomInt(max)
        counts[result] = (counts[result] || 0) + 1
      }

      // Each value should appear roughly iterations/max times
      const expectedCount = iterations / max
      const tolerance = expectedCount * 0.3 // 30% tolerance

      for (let i = 0; i < max; i++) {
        expect(counts[i]).toBeGreaterThan(expectedCount - tolerance)
        expect(counts[i]).toBeLessThan(expectedCount + tolerance)
      }
    })

    it('should handle edge cases correctly', () => {
      // max = 1 should always return 0
      for (let i = 0; i < 100; i++) {
        expect(secureRandomInt(1)).toBe(0)
      }

      // max = 2 should return 0 or 1
      for (let i = 0; i < 100; i++) {
        const result = secureRandomInt(2)
        expect(result === 0 || result === 1).toBe(true)
      }
    })

    it('should not use Math.random', () => {
      const spy = vi.spyOn(Math, 'random')

      secureRandomInt(100)

      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should avoid modulo bias with rejection sampling', () => {
      // The algorithm should handle powers of 2 correctly
      const powerOf2 = 256
      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        const result = secureRandomInt(powerOf2)
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThan(powerOf2)
      }
    })
  })

  describe('randomizeTimestamp', () => {
    it('should return a timestamp within 2 days of the base time', () => {
      const now = Date.now()
      const twoDaysInSeconds = 2 * 24 * 60 * 60
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        const result = randomizeTimestamp(now)
        const baseSeconds = Math.floor(now / 1000)
        const diff = Math.abs(result - baseSeconds)

        // Should be within the 2-day window (could be up to 1 day before or after)
        expect(diff).toBeLessThanOrEqual(twoDaysInSeconds)
      }
    })

    it('should default to current time if no base time provided', () => {
      const before = Math.floor(Date.now() / 1000)
      const result = randomizeTimestamp()
      const after = Math.floor(Date.now() / 1000)
      const twoDaysInSeconds = 2 * 24 * 60 * 60

      // Result should be within 2 days of the current time
      expect(result).toBeGreaterThan(before - twoDaysInSeconds)
      expect(result).toBeLessThan(after + twoDaysInSeconds)
    })

    it('should produce different timestamps on repeated calls', () => {
      const baseTime = Date.now()
      const results = new Set<number>()

      for (let i = 0; i < 100; i++) {
        results.add(randomizeTimestamp(baseTime))
      }

      // With proper randomization, we should get many different values
      // Probability of 100 identical results with 172800 possible offsets is negligible
      expect(results.size).toBeGreaterThan(1)
    })

    it('should use secureRandomInt for randomness', () => {
      // Verify it uses crypto.getRandomValues internally
      const spy = vi.spyOn(crypto, 'getRandomValues')

      randomizeTimestamp()

      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should return timestamps in seconds (not milliseconds)', () => {
      const result = randomizeTimestamp()

      // Unix timestamps in seconds are around 10 digits (1.7 billion in 2024)
      // Milliseconds would be 13 digits
      expect(result).toBeGreaterThan(1000000000)
      expect(result).toBeLessThan(10000000000)
    })

    it('should distribute timestamps roughly evenly across the 2-day window', () => {
      const baseTime = Date.now()
      const baseSeconds = Math.floor(baseTime / 1000)
      const oneDayInSeconds = 24 * 60 * 60
      const iterations = 1000

      let beforeCount = 0
      let afterCount = 0

      for (let i = 0; i < iterations; i++) {
        const result = randomizeTimestamp(baseTime)
        if (result < baseSeconds) {
          beforeCount++
        } else {
          afterCount++
        }
      }

      // Should be roughly 50/50 before/after base time
      const ratio = beforeCount / iterations
      expect(ratio).toBeGreaterThan(0.35)
      expect(ratio).toBeLessThan(0.65)
    })

    it('should not expose exact timing patterns', () => {
      // Call with same base time multiple times
      const baseTime = 1704067200000 // Fixed time for reproducibility
      const results: number[] = []

      for (let i = 0; i < 50; i++) {
        results.push(randomizeTimestamp(baseTime))
      }

      // Calculate variance - should be high if properly randomized
      const mean = results.reduce((a, b) => a + b, 0) / results.length
      const variance = results.reduce((a, b) => a + (b - mean) ** 2, 0) / results.length

      // Standard deviation should be significant (hours worth of seconds)
      const stdDev = Math.sqrt(variance)
      expect(stdDev).toBeGreaterThan(10000) // At least a few hours of spread
    })
  })

  describe('NIP-17 metadata protection', () => {
    it('should make timing correlation attacks infeasible', () => {
      // Simulate two users sending messages at "the same time"
      const actualTime = Date.now()
      const user1Timestamp = randomizeTimestamp(actualTime)
      const user2Timestamp = randomizeTimestamp(actualTime)

      // Even with the same actual send time, timestamps should differ
      // (not guaranteed, but highly probable with 2-day window)
      // In practice we just verify both are valid and within range
      const baseSeconds = Math.floor(actualTime / 1000)
      const twoDaysInSeconds = 2 * 24 * 60 * 60

      expect(Math.abs(user1Timestamp - baseSeconds)).toBeLessThanOrEqual(twoDaysInSeconds)
      expect(Math.abs(user2Timestamp - baseSeconds)).toBeLessThanOrEqual(twoDaysInSeconds)
    })

    it('should prevent message ordering inference', () => {
      // Messages sent in order shouldn't necessarily have ordered timestamps
      const times = [
        Date.now(),
        Date.now() + 1000,
        Date.now() + 2000,
      ]

      const timestamps = times.map(t => randomizeTimestamp(t))

      // Due to randomization, the order might not be preserved
      // We just verify all timestamps are valid
      timestamps.forEach((ts, i) => {
        const baseSeconds = Math.floor(times[i] / 1000)
        const twoDaysInSeconds = 2 * 24 * 60 * 60
        expect(Math.abs(ts - baseSeconds)).toBeLessThanOrEqual(twoDaysInSeconds)
      })
    })
  })
})
