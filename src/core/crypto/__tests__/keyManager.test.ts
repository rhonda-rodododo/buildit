import { describe, it, expect } from 'vitest'
import {
  generateKeyPair,
  createIdentity,
  importFromNsec,
  exportToNsec,
  exportToNpub,
  decodeNpub,
  isValidPubkey,
  isValidNsec,
  isValidNpub,
  KeyManager,
} from '../keyManager'

describe('KeyManager', () => {
  describe('generateKeyPair', () => {
    it('should generate a valid key pair', () => {
      const { privateKey, publicKey } = generateKeyPair()

      expect(privateKey).toBeInstanceOf(Uint8Array)
      expect(privateKey.length).toBe(32)
      expect(publicKey).toMatch(/^[0-9a-f]{64}$/i)
    })

    it('should generate unique key pairs', () => {
      const pair1 = generateKeyPair()
      const pair2 = generateKeyPair()

      expect(pair1.publicKey).not.toBe(pair2.publicKey)
    })
  })

  describe('createIdentity', () => {
    it('should create a valid identity', () => {
      const identity = createIdentity('Test User')

      expect(identity.name).toBe('Test User')
      expect(identity.publicKey).toMatch(/^[0-9a-f]{64}$/i)
      expect(identity.privateKey).toBeInstanceOf(Uint8Array)
      expect(identity.created).toBeGreaterThan(0)
      expect(identity.lastUsed).toBeGreaterThan(0)
    })

    it('should use default name', () => {
      const identity = createIdentity()

      expect(identity.name).toBe('Anonymous')
    })
  })

  describe('importFromNsec', () => {
    it('should import identity from valid nsec', () => {
      const original = createIdentity('Original')
      const nsec = exportToNsec(original.privateKey)

      const imported = importFromNsec(nsec, 'Imported')

      expect(imported.publicKey).toBe(original.publicKey)
      expect(imported.name).toBe('Imported')
    })

    it('should throw error for invalid nsec', () => {
      expect(() => importFromNsec('invalid-nsec')).toThrow()
    })
  })

  describe('validation functions', () => {
    it('should validate pubkey', () => {
      const { publicKey } = generateKeyPair()

      expect(isValidPubkey(publicKey)).toBe(true)
      expect(isValidPubkey('invalid')).toBe(false)
      expect(isValidPubkey('1234')).toBe(false)
    })

    it('should validate nsec', () => {
      const { privateKey } = generateKeyPair()
      const nsec = exportToNsec(privateKey)

      expect(isValidNsec(nsec)).toBe(true)
      expect(isValidNsec('invalid')).toBe(false)
    })

    it('should validate npub', () => {
      const { publicKey } = generateKeyPair()
      const npub = exportToNpub(publicKey)

      expect(isValidNpub(npub)).toBe(true)
      expect(isValidNpub('invalid')).toBe(false)
    })
  })

  describe('KeyManager class', () => {
    it('should add and retrieve identities', () => {
      const manager = new KeyManager()
      const identity = createIdentity('Test')

      manager.addIdentity(identity)

      const retrieved = manager.getIdentity(identity.publicKey)

      expect(retrieved).toBeDefined()
      expect(retrieved?.publicKey).toBe(identity.publicKey)
      expect(retrieved?.name).toBe('Test')
    })

    it('should remove identities', () => {
      const manager = new KeyManager()
      const identity = createIdentity('Test')

      manager.addIdentity(identity)
      expect(manager.hasIdentity(identity.publicKey)).toBe(true)

      manager.removeIdentity(identity.publicKey)
      expect(manager.hasIdentity(identity.publicKey)).toBe(false)
    })

    it('should get all identities', () => {
      const manager = new KeyManager()
      const id1 = createIdentity('User 1')
      const id2 = createIdentity('User 2')

      manager.addIdentity(id1)
      manager.addIdentity(id2)

      const all = manager.getAllIdentities()

      expect(all).toHaveLength(2)
    })

    it('should clear all identities', () => {
      const manager = new KeyManager()
      manager.addIdentity(createIdentity('User 1'))
      manager.addIdentity(createIdentity('User 2'))

      manager.clear()

      expect(manager.getAllIdentities()).toHaveLength(0)
    })
  })
})
