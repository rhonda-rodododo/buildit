import { describe, it, expect } from 'vitest';
import { createPrivateDM, unwrapGiftWrap } from '@/core/crypto/nip17';
import { generateTestKeypair } from '@/test/test-utils';
import { hexToBytes } from 'nostr-tools/utils';

describe('NIP-17 Encryption', () => {
    it('should create encrypted DM with correct structure', () => {
      const alice = generateTestKeypair();
      const bob = generateTestKeypair();

      const message = 'Secret message from Alice to Bob';

      // Create encrypted DM using NIP-17
      const giftWrap = createPrivateDM(
        message,
        hexToBytes(alice.privateKey),
        bob.publicKey
      );

      // Verify gift wrap structure
      expect(giftWrap.kind).toBe(1059);
      expect(giftWrap.pubkey).toBeDefined(); // Ephemeral key
      expect(giftWrap.pubkey).not.toBe(alice.publicKey); // Should be ephemeral, not Alice's
      expect(giftWrap.content).toBeDefined(); // Encrypted content
      expect(giftWrap.tags).toContainEqual(['p', bob.publicKey]); // Recipient tag
    });

    it('should unwrap and decrypt received DM', () => {
      const alice = generateTestKeypair();
      const bob = generateTestKeypair();

      const message = 'Secret message for Bob';

      // Alice creates encrypted DM for Bob
      const giftWrap = createPrivateDM(
        message,
        hexToBytes(alice.privateKey),
        bob.publicKey
      );

      // Bob unwraps the gift wrap
      const result = unwrapGiftWrap(giftWrap, hexToBytes(bob.privateKey));

      expect(result).toBeDefined();
      expect(result.rumor.content).toBe(message);
      expect(result.rumor.kind).toBe(14); // Private DM kind
      expect(result.senderPubkey).toBe(alice.publicKey); // Verify sender identity
      expect(result.sealVerified).toBe(true); // Verify seal signature
      // Check that the rumor has the recipient tag
      expect(result.rumor.tags.some(t => t[0] === 'p' && t[1] === bob.publicKey)).toBe(true);
    });

    it('should handle multiple recipients independently', () => {
      const alice = generateTestKeypair();
      const bob = generateTestKeypair();
      const charlie = generateTestKeypair();

      // Alice → Bob
      const msg1 = createPrivateDM(
        'Message for Bob',
        hexToBytes(alice.privateKey),
        bob.publicKey
      );

      // Alice → Charlie
      const msg2 = createPrivateDM(
        'Message for Charlie',
        hexToBytes(alice.privateKey),
        charlie.publicKey
      );

      // Bob can decrypt his message
      const bobResult = unwrapGiftWrap(msg1, hexToBytes(bob.privateKey));
      expect(bobResult.rumor.content).toBe('Message for Bob');
      expect(bobResult.senderPubkey).toBe(alice.publicKey);

      // Charlie can decrypt his message
      const charlieResult = unwrapGiftWrap(msg2, hexToBytes(charlie.privateKey));
      expect(charlieResult.rumor.content).toBe('Message for Charlie');
      expect(charlieResult.senderPubkey).toBe(alice.publicKey);

      // Bob cannot decrypt Charlie's message (should throw)
      expect(() => unwrapGiftWrap(msg2, hexToBytes(bob.privateKey))).toThrow();

      // Charlie cannot decrypt Bob's message (should throw)
      expect(() => unwrapGiftWrap(msg1, hexToBytes(charlie.privateKey))).toThrow();
    });
});
