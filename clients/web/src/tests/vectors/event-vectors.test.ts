/**
 * Event Signing Test Vector Runner
 *
 * Loads test vectors from protocol/test-vectors/events/ and validates:
 * - Event signing with Schnorr signatures
 * - Event ID computation (SHA256 of serialized event)
 * - Signature verification and tamper detection
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { hexToBytes, bytesToHex } from 'nostr-tools/utils'
import { getPublicKey, finalizeEvent, verifyEvent, getEventHash, serializeEvent } from 'nostr-tools'
import type { EventTemplate } from 'nostr-tools'

const VECTORS_DIR = join(__dirname, '../../../../../protocol/test-vectors/events')

interface SigningVector {
  id: string
  description: string
  input: {
    privkey: string
    event: {
      pubkey: string
      created_at: number
      kind: number
      tags: string[][]
      content?: string
      content_length?: number
      content_pattern?: string
    }
  }
  expected: {
    id_length?: number
    id_is_hex?: boolean
    sig_length?: number
    sig_is_hex?: boolean
    signature_verifies?: boolean
    serialization?: string
    tags_preserved_in_id?: boolean
    tags_order_matters?: boolean
    error?: boolean
    error_type?: string
    note?: string
  }
}

interface IdComputationVector {
  id: string
  description: string
  input:
    | {
        pubkey: string
        created_at: number
        kind: number
        tags: string[][]
        content: string
      }
    | {
        event1: {
          pubkey: string
          created_at: number
          kind: number
          tags: string[][]
          content: string
        }
        event2: {
          pubkey: string
          created_at: number
          kind: number
          tags: string[][]
          content: string
        }
      }
  serialization?: string
  expected: {
    id?: string
    id_length?: number
    id_is_lowercase_hex?: boolean
    id_deterministic?: boolean
    compute_twice_same_result?: boolean
    ids_different?: boolean
  }
}

interface VerificationVector {
  id: string
  description: string
  input: {
    privkey?: string
    event?: {
      pubkey: string
      created_at: number
      kind: number
      tags: string[][]
      content: string
    }
    use_wrong_id?: string
    original_content?: string
    tampered_content?: string
    original_timestamp?: number
    tampered_timestamp?: number
    note?: string
  }
  expected: {
    signature_valid: boolean
    note?: string
  }
}

interface VectorFile<T> {
  version: string
  description: string
  vectors: T[]
}

function loadVectorFile<T>(filename: string): VectorFile<T> {
  const content = readFileSync(join(VECTORS_DIR, filename), 'utf-8')
  return JSON.parse(content) as VectorFile<T>
}

/** Sign an event template with a private key */
function signTestEvent(
  privkeyHex: string,
  template: { pubkey: string; created_at: number; kind: number; tags: string[][]; content: string }
) {
  const privkey = hexToBytes(privkeyHex)
  const eventTemplate: EventTemplate = {
    kind: template.kind,
    created_at: template.created_at,
    tags: template.tags,
    content: template.content,
  }
  return finalizeEvent(eventTemplate, privkey)
}

describe('Event Test Vectors', () => {
  describe('signing.json — event signing', () => {
    const vectors = loadVectorFile<SigningVector>('signing.json')

    for (const vector of vectors.vectors) {
      it(`${vector.id}: ${vector.description}`, () => {
        const { input, expected } = vector

        // Resolve content from pattern if needed
        const eventInput = { ...input.event }
        if (!eventInput.content && eventInput.content_length && eventInput.content_pattern) {
          eventInput.content = eventInput.content_pattern.repeat(eventInput.content_length)
        }

        // Error case — signing should throw
        if (expected.error) {
          expect(() => signTestEvent(input.privkey, eventInput as {
            pubkey: string; created_at: number; kind: number; tags: string[][]; content: string
          })).toThrow()
          return
        }

        const signedEvent = signTestEvent(input.privkey, eventInput as {
          pubkey: string; created_at: number; kind: number; tags: string[][]; content: string
        })

        // Event ID checks
        if (expected.id_length) {
          expect(signedEvent.id.length).toBe(expected.id_length)
        }
        if (expected.id_is_hex) {
          expect(signedEvent.id).toMatch(/^[0-9a-f]+$/)
        }

        // Signature checks
        if (expected.sig_length) {
          expect(signedEvent.sig.length).toBe(expected.sig_length)
        }
        if (expected.sig_is_hex) {
          expect(signedEvent.sig).toMatch(/^[0-9a-f]+$/)
        }

        // Signature verification
        if (expected.signature_verifies) {
          expect(verifyEvent(signedEvent)).toBe(true)
        }

        // Serialization format check
        if (expected.serialization) {
          const serialized = JSON.stringify([
            0,
            signedEvent.pubkey,
            signedEvent.created_at,
            signedEvent.kind,
            signedEvent.tags,
            signedEvent.content,
          ])
          expect(serialized).toBe(expected.serialization)
        }

        // Tags preserved
        if (expected.tags_preserved_in_id) {
          expect(signedEvent.tags).toEqual(input.event.tags)
        }

        // Pubkey matches derived from privkey
        const derivedPubkey = getPublicKey(hexToBytes(input.privkey))
        expect(signedEvent.pubkey).toBe(derivedPubkey)
      })
    }
  })

  describe('id-computation.json — event ID computation', () => {
    const vectors = loadVectorFile<IdComputationVector>('id-computation.json')

    for (const vector of vectors.vectors) {
      it(`${vector.id}: ${vector.description}`, () => {
        const { input, expected } = vector

        // Single event case
        if ('pubkey' in input) {
          const privkey = '0000000000000000000000000000000000000000000000000000000000000001'
          const signed = signTestEvent(privkey, input)

          if (expected.id_length) {
            expect(signed.id.length).toBe(expected.id_length)
          }
          if (expected.id_is_lowercase_hex) {
            expect(signed.id).toMatch(/^[0-9a-f]+$/)
            expect(signed.id).toBe(signed.id.toLowerCase())
          }
          if (expected.compute_twice_same_result || expected.id_deterministic) {
            const signed2 = signTestEvent(privkey, input)
            expect(signed2.id).toBe(signed.id)
          }
          return
        }

        // Two event comparison case
        if ('event1' in input && 'event2' in input) {
          const privkey = '0000000000000000000000000000000000000000000000000000000000000001'
          const signed1 = signTestEvent(privkey, input.event1)
          const signed2 = signTestEvent(privkey, input.event2)

          if (expected.ids_different) {
            expect(signed1.id).not.toBe(signed2.id)
          }
        }
      })
    }
  })

  describe('verification.json — signature verification', () => {
    const vectors = loadVectorFile<VerificationVector>('verification.json')

    for (const vector of vectors.vectors) {
      it(`${vector.id}: ${vector.description}`, () => {
        const { input, expected } = vector

        if (!input.privkey) return

        // Wrong ID case
        if (input.use_wrong_id && input.event) {
          const signed = signTestEvent(input.privkey, input.event)
          // Verify the recomputed hash doesn't match the wrong ID
          const wrongId = input.use_wrong_id
          const correctHash = getEventHash(signed)
          expect(wrongId).not.toBe(correctHash)
          // Create a tampered event with the wrong ID (bypass verifiedSymbol cache)
          const tampered = JSON.parse(JSON.stringify({ ...signed, id: wrongId }))
          expect(verifyEvent(tampered)).toBe(false)
          return
        }

        // Valid signature case
        if (input.event) {
          const signed = signTestEvent(input.privkey, input.event)
          expect(verifyEvent(signed)).toBe(expected.signature_valid)
          return
        }

        // Tampered content case
        if (input.original_content && input.tampered_content) {
          const pubkey = getPublicKey(hexToBytes(input.privkey))
          const template = {
            pubkey,
            created_at: 1704067200,
            kind: 1,
            tags: [] as string[][],
            content: input.original_content,
          }
          const signed = signTestEvent(input.privkey, template)

          // Tamper with content — use JSON round-trip to avoid verifiedSymbol cache
          const tampered = JSON.parse(JSON.stringify(signed))
          tampered.content = input.tampered_content
          expect(verifyEvent(tampered)).toBe(expected.signature_valid)
          return
        }

        // Tampered timestamp case
        if (input.original_timestamp !== undefined && input.tampered_timestamp !== undefined) {
          const pubkey = getPublicKey(hexToBytes(input.privkey))
          const template = {
            pubkey,
            created_at: input.original_timestamp,
            kind: 1,
            tags: [] as string[][],
            content: 'Test message',
          }
          const signed = signTestEvent(input.privkey, template)

          // Tamper with timestamp — use JSON round-trip to avoid verifiedSymbol cache
          const tampered = JSON.parse(JSON.stringify(signed))
          tampered.created_at = input.tampered_timestamp
          expect(verifyEvent(tampered)).toBe(expected.signature_valid)
        }
      })
    }
  })
})
