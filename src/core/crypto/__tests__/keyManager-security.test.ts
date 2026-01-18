import { describe, it, expect, vi } from 'vitest'
import { generatePassphrase, secureRandomInt } from '../keyManager'

describe('KeyManager Security Functions', () => {
  describe('generatePassphrase (BIP-39)', () => {
    it('should generate a 12-word passphrase by default', () => {
      const passphrase = generatePassphrase()
      const words = passphrase.split(' ')

      expect(words).toHaveLength(12)
    })

    it('should generate passphrases with correct word counts', () => {
      const wordCounts = [12, 15, 18, 24] as const

      for (const count of wordCounts) {
        const passphrase = generatePassphrase(count)
        const words = passphrase.split(' ')

        expect(words).toHaveLength(count)
      }
    })

    it('should generate valid BIP-39 mnemonic words', () => {
      // BIP-39 English wordlist has 2048 words
      // Each word should be lowercase alphabetic
      const passphrase = generatePassphrase(24)
      const words = passphrase.split(' ')

      for (const word of words) {
        expect(word).toMatch(/^[a-z]+$/)
        expect(word.length).toBeGreaterThan(0)
        expect(word.length).toBeLessThanOrEqual(8) // BIP-39 words are max 8 chars
      }
    })

    it('should generate unique passphrases on each call', () => {
      const passphrases = new Set<string>()

      for (let i = 0; i < 100; i++) {
        passphrases.add(generatePassphrase())
      }

      // All 100 passphrases should be unique
      // Probability of collision with 128 bits of entropy is negligible
      expect(passphrases.size).toBe(100)
    })

    it('should use crypto.getRandomValues internally', () => {
      const spy = vi.spyOn(crypto, 'getRandomValues')

      generatePassphrase()

      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should not use Math.random', () => {
      const spy = vi.spyOn(Math, 'random')

      generatePassphrase()

      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should throw error for invalid word counts', () => {
      // @ts-expect-error Testing invalid input
      expect(() => generatePassphrase(10)).toThrow('Invalid word count')
      // @ts-expect-error Testing invalid input
      expect(() => generatePassphrase(20)).toThrow('Invalid word count')
    })

    it('should provide sufficient entropy for each word count', () => {
      // 12 words = 128 bits, 15 = 160 bits, 18 = 192 bits, 24 = 256 bits
      // We verify this indirectly by checking unique words appear
      const passphrase24 = generatePassphrase(24)
      const words = passphrase24.split(' ')
      const uniqueWords = new Set(words)

      // With 24 words from 2048 options, we should see mostly unique words
      // Occasional duplicates are statistically possible but rare
      expect(uniqueWords.size).toBeGreaterThan(15)
    })

    it('should work with different word counts for different security levels', () => {
      // 12 words (128 bits) - standard security
      const standard = generatePassphrase(12)
      expect(standard.split(' ')).toHaveLength(12)

      // 24 words (256 bits) - high security
      const high = generatePassphrase(24)
      expect(high.split(' ')).toHaveLength(24)
    })
  })

  describe('secureRandomInt (keyManager version)', () => {
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

    it('should produce uniform distribution without modulo bias', () => {
      const max = 10
      const iterations = 10000
      const counts: Record<number, number> = {}

      for (let i = 0; i < iterations; i++) {
        const result = secureRandomInt(max)
        counts[result] = (counts[result] || 0) + 1
      }

      // Each value should appear roughly iterations/max times
      const expectedCount = iterations / max
      const tolerance = expectedCount * 0.3

      for (let i = 0; i < max; i++) {
        expect(counts[i]).toBeGreaterThan(expectedCount - tolerance)
        expect(counts[i]).toBeLessThan(expectedCount + tolerance)
      }
    })
  })

  describe('BIP-39 word distribution', () => {
    it('should sample from all 2048 BIP-39 words with sufficient runs', () => {
      const wordSet = new Set<string>()
      const iterations = 500

      for (let i = 0; i < iterations; i++) {
        const passphrase = generatePassphrase(24)
        passphrase.split(' ').forEach(word => wordSet.add(word))
      }

      // With 500 * 24 = 12000 random word selections from 2048,
      // we should see a significant portion of the wordlist
      // Statistical expectation: ~1800-1900 unique words
      expect(wordSet.size).toBeGreaterThan(1500)
    })
  })
})
