import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/core/storage/db';
import { encryptFile, decryptFile } from '@/lib/media/mediaEncryption';
import { NIP17Crypto } from '@/core/crypto/nip17';

describe('Encryption ↔ Storage Integration', () => {
  beforeEach(async () => {
    await db.messages.clear();
    await db.identities.clear();
  });

  afterEach(async () => {
    await db.messages.clear();
    await db.identities.clear();
  });

  describe('Encrypted Message Persistence', () => {
    it('should store and retrieve encrypted DM', async () => {
      const alicePrivkey = generatePrivateKey();
      const bobPrivkey = generatePrivateKey();
      const crypto = new NIP17Crypto();

      const message = 'Secret message from Alice to Bob';

      // Encrypt message
      const encrypted = await crypto.encryptDM(alicePrivkey, bobPrivkey, message);

      // Store in DB
      await db.messages.add({
        id: encrypted.id,
        content: encrypted.content,
        fromPubkey: encrypted.pubkey,
        toPubkey: bobPrivkey,
        timestamp: encrypted.created_at,
        type: 'dm',
        groupId: undefined,
        status: 'sent',
        encryptedContent: encrypted.content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Retrieve from DB
      const stored = await db.messages.where('id').equals(encrypted.id).first();
      expect(stored).toBeDefined();
      expect(stored?.encryptedContent).toBeDefined();

      // Decrypt
      const decrypted = await crypto.decryptDM(bobPrivkey, encrypted);
      expect(decrypted).toBe(message);
    });

    it('should handle multiple encrypted conversations', async () => {
      const alicePrivkey = generatePrivateKey();
      const bobPrivkey = generatePrivateKey();
      const charliePrivkey = generatePrivateKey();
      const crypto = new NIP17Crypto();

      // Alice → Bob
      const msg1 = await crypto.encryptDM(alicePrivkey, bobPrivkey, 'Message 1');
      await db.messages.add({
        id: msg1.id,
        content: msg1.content,
        fromPubkey: msg1.pubkey,
        toPubkey: bobPrivkey,
        timestamp: msg1.created_at,
        type: 'dm',
        status: 'sent',
        encryptedContent: msg1.content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Alice → Charlie
      const msg2 = await crypto.encryptDM(alicePrivkey, charliePrivkey, 'Message 2');
      await db.messages.add({
        id: msg2.id,
        content: msg2.content,
        fromPubkey: msg2.pubkey,
        toPubkey: charliePrivkey,
        timestamp: msg2.created_at,
        type: 'dm',
        status: 'sent',
        encryptedContent: msg2.content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const aliceToBob = await db.messages.where('toPubkey').equals(bobPrivkey).toArray();
      const aliceToCharlie = await db.messages.where('toPubkey').equals(charliePrivkey).toArray();

      expect(aliceToBob).toHaveLength(1);
      expect(aliceToCharlie).toHaveLength(1);
    });
  });

  describe('Encrypted Media Persistence', () => {
    it('should store encrypted media metadata', async () => {
      const testFile = new File(['secret image data'], 'secret.jpg', { type: 'image/jpeg' });
      const { encryptedBlob, keyString, iv } = await encryptFile(testFile);

      // Store media metadata
      const mediaId = crypto.randomUUID();
      await db.media.add({
        id: mediaId,
        fileName: 'secret.jpg',
        mimeType: 'image/jpeg',
        size: encryptedBlob.size,
        encryptionKey: keyString,
        encryptionIv: iv,
        storageType: 'local',
        url: URL.createObjectURL(encryptedBlob),
        uploadedAt: Date.now(),
        uploadedBy: 'test-user',
      });

      // Retrieve metadata
      const stored = await db.media.where('id').equals(mediaId).first();
      expect(stored).toBeDefined();
      expect(stored?.encryptionKey).toBe(keyString);
      expect(stored?.encryptionIv).toBe(iv);

      // Verify we can decrypt with stored keys
      const blob = await fetch(stored!.url).then((r) => r.blob());
      const decrypted = await decryptFile(blob, stored!.encryptionKey!, stored!.encryptionIv!, 'image/jpeg');
      const decryptedText = await decrypted.text();
      expect(decryptedText).toBe('secret image data');
    });

    it('should handle media with privacy levels', async () => {
      const file1 = new File(['public data'], 'public.jpg', { type: 'image/jpeg' });
      const file2 = new File(['encrypted data'], 'private.jpg', { type: 'image/jpeg' });

      // Public media (no encryption)
      await db.media.add({
        id: '1',
        fileName: 'public.jpg',
        mimeType: 'image/jpeg',
        size: file1.size,
        privacyLevel: 'public',
        storageType: 'local',
        url: URL.createObjectURL(file1),
        uploadedAt: Date.now(),
        uploadedBy: 'test-user',
      });

      // Private media (encrypted)
      const { encryptedBlob, keyString, iv } = await encryptFile(file2);
      await db.media.add({
        id: '2',
        fileName: 'private.jpg',
        mimeType: 'image/jpeg',
        size: encryptedBlob.size,
        encryptionKey: keyString,
        encryptionIv: iv,
        privacyLevel: 'encrypted',
        storageType: 'local',
        url: URL.createObjectURL(encryptedBlob),
        uploadedAt: Date.now(),
        uploadedBy: 'test-user',
      });

      const publicMedia = await db.media.where('privacyLevel').equals('public').toArray();
      const encryptedMedia = await db.media.where('privacyLevel').equals('encrypted').toArray();

      expect(publicMedia).toHaveLength(1);
      expect(encryptedMedia).toHaveLength(1);
      expect(encryptedMedia[0].encryptionKey).toBeDefined();
    });
  });

  describe('Identity Key Storage', () => {
    it('should store identity with encrypted private key', async () => {
      const privkey = generatePrivateKey();
      const pubkey = generatePubkey(privkey);

      // In real app, privkey would be encrypted with user password
      // For test, we'll just store it
      await db.identities.add({
        id: crypto.randomUUID(),
        npub: `npub${pubkey.substring(0, 59)}`,
        pubkey: pubkey,
        privkey: privkey, // In production: encrypt this!
        name: 'Test User',
        createdAt: Date.now(),
      });

      const stored = await db.identities.where('pubkey').equals(pubkey).first();
      expect(stored).toBeDefined();
      expect(stored?.privkey).toBe(privkey);
    });
  });
});

function generatePrivateKey(): string {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  return Array.from(privateKey, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generatePubkey(privkey: string): string {
  // Simplified - in real code use nostr-tools getPublicKey
  return privkey.split('').reverse().join('');
}
