/**
 * Transfer Crypto Service
 * Handles cryptographic operations for device-to-device transfers
 *
 * Security:
 * - Uses ECDH for key exchange
 * - Derives shared secret with HKDF
 * - Encrypts key payload with AES-256-GCM
 * - Double encryption: ECDH shared secret + user passphrase
 */

import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';

// PBKDF2 iterations for passphrase derivation
// OWASP 2023 recommends minimum 310,000 for SHA-256
// While transfers are time-sensitive, this is still double-encrypted with ECDH
// and the passphrase layer needs to be brute-force resistant
const PBKDF2_ITERATIONS = 310_000;

/**
 * Transfer Crypto Service
 * Provides cryptographic primitives for device transfer
 */
export class TransferCrypto {
  private static instance: TransferCrypto;

  private constructor() {}

  public static getInstance(): TransferCrypto {
    if (!TransferCrypto.instance) {
      TransferCrypto.instance = new TransferCrypto();
    }
    return TransferCrypto.instance;
  }

  /**
   * Generate an ephemeral keypair for the transfer session
   */
  public generateEphemeralKeypair(): { privateKey: string; publicKey: string } {
    const privateKeyBytes = secp256k1.utils.randomSecretKey();
    const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes);

    return {
      privateKey: this.uint8ToHex(privateKeyBytes),
      publicKey: this.uint8ToHex(publicKeyBytes),
    };
  }

  /**
   * Compute ECDH shared secret
   * Uses secp256k1 curve (same as Nostr)
   */
  public computeSharedSecret(
    ourPrivateKey: string,
    theirPublicKey: string
  ): string {
    const ourPriv = this.hexToUint8(ourPrivateKey);
    const theirPub = this.hexToUint8(theirPublicKey);

    // Compute ECDH shared point
    const sharedPoint = secp256k1.getSharedSecret(ourPriv, theirPub);

    // Hash to get consistent 32-byte secret
    const sharedSecret = sha256(sharedPoint);

    return this.uint8ToHex(sharedSecret);
  }

  /**
   * Derive an encryption key from shared secret using HKDF
   */
  public async deriveTransferKey(
    sharedSecret: string,
    info: string = 'buildit-device-transfer'
  ): Promise<CryptoKey> {
    const secretBytes = this.hexToUint8(sharedSecret);
    const infoBytes = new TextEncoder().encode(info);
    const saltBytes = new TextEncoder().encode('BuildItNetwork-Transfer-v1');

    // Import shared secret as HKDF key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      secretBytes.buffer as ArrayBuffer,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );

    // Derive AES-256-GCM key
    return crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        salt: saltBytes.buffer as ArrayBuffer,
        info: infoBytes.buffer as ArrayBuffer,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Derive an additional encryption key from user passphrase
   * Used for double-encryption of the key payload
   */
  public async derivePassphraseKey(
    passphrase: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const passphraseBytes = new TextEncoder().encode(passphrase);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passphraseBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt the key payload with double encryption
   * Layer 1: ECDH shared secret
   * Layer 2: User passphrase
   */
  public async encryptKeyPayload(
    privateKey: Uint8Array,
    sharedSecret: string,
    passphrase: string
  ): Promise<{
    encryptedData: string;
    iv1: string;
    iv2: string;
    salt: string;
  }> {
    // Generate IVs and salt
    const iv1 = crypto.getRandomValues(new Uint8Array(12));
    const iv2 = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive keys
    const transferKey = await this.deriveTransferKey(sharedSecret);
    const passphraseKey = await this.derivePassphraseKey(passphrase, salt);

    // First layer: Encrypt with passphrase key
    const layer1 = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv1 as BufferSource },
      passphraseKey,
      privateKey as BufferSource
    );

    // Second layer: Encrypt with ECDH transfer key
    const layer2 = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv2 as BufferSource },
      transferKey,
      layer1
    );

    return {
      encryptedData: this.bufferToBase64(new Uint8Array(layer2)),
      iv1: this.bufferToBase64(iv1),
      iv2: this.bufferToBase64(iv2),
      salt: this.bufferToBase64(salt),
    };
  }

  /**
   * Decrypt the key payload with double decryption
   */
  public async decryptKeyPayload(
    encryptedData: string,
    iv1: string,
    iv2: string,
    salt: string,
    sharedSecret: string,
    passphrase: string
  ): Promise<Uint8Array> {
    const encrypted = this.base64ToBuffer(encryptedData);
    const iv1Bytes = this.base64ToBuffer(iv1);
    const iv2Bytes = this.base64ToBuffer(iv2);
    const saltBytes = this.base64ToBuffer(salt);

    // Derive keys
    const transferKey = await this.deriveTransferKey(sharedSecret);
    const passphraseKey = await this.derivePassphraseKey(passphrase, saltBytes);

    // First layer: Decrypt with ECDH transfer key
    const layer1 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv2Bytes as BufferSource },
      transferKey,
      encrypted as BufferSource
    );

    // Second layer: Decrypt with passphrase key
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv1Bytes as BufferSource },
      passphraseKey,
      layer1
    );

    return new Uint8Array(plaintext);
  }

  /**
   * Encrypt a message for transfer (single layer, for metadata)
   */
  public async encryptMessage(
    message: string,
    sharedSecret: string
  ): Promise<{ encrypted: string; iv: string }> {
    const messageBytes = new TextEncoder().encode(message);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveTransferKey(sharedSecret, 'buildit-transfer-message');

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      messageBytes as BufferSource
    );

    return {
      encrypted: this.bufferToBase64(new Uint8Array(encrypted)),
      iv: this.bufferToBase64(iv),
    };
  }

  /**
   * Decrypt a message from transfer
   */
  public async decryptMessage(
    encrypted: string,
    iv: string,
    sharedSecret: string
  ): Promise<string> {
    const encryptedBytes = this.base64ToBuffer(encrypted);
    const ivBytes = this.base64ToBuffer(iv);
    const key = await this.deriveTransferKey(sharedSecret, 'buildit-transfer-message');

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes as BufferSource },
      key,
      encryptedBytes as BufferSource
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Generate a device fingerprint for visual verification
   * Returns a short hash that users can compare
   */
  public generateDeviceFingerprint(
    sessionId: string,
    publicKey1: string,
    publicKey2: string
  ): string {
    // Sort public keys to ensure consistent ordering
    const sortedKeys = [publicKey1, publicKey2].sort();
    const input = `${sessionId}:${sortedKeys[0]}:${sortedKeys[1]}`;
    const hash = sha256(new TextEncoder().encode(input));

    // Take first 8 bytes and format as emoji sequence for easy comparison
    const emojis = this.hashToEmojis(hash.slice(0, 8));
    return emojis;
  }

  /**
   * Convert bytes to emoji sequence for visual verification
   */
  private hashToEmojis(bytes: Uint8Array): string {
    // Using a simple set of distinguishable emojis
    const emojiSet = [
      '\u{1F34E}', '\u{1F34A}', '\u{1F34B}', '\u{1F34C}', // apple, orange, lemon, banana
      '\u{1F347}', '\u{1F349}', '\u{1F34D}', '\u{1F352}', // grapes, watermelon, pineapple, cherry
      '\u{1F36D}', '\u{1F370}', '\u{1F369}', '\u{1F382}', // lollipop, cake, donut, birthday cake
      '\u{2B50}', '\u{1F31F}', '\u{1F319}', '\u{1F308}',  // star, glowing star, crescent moon, rainbow
    ];

    let result = '';
    for (const byte of bytes) {
      result += emojiSet[byte % emojiSet.length];
    }
    return result;
  }

  /**
   * Generate a random session ID
   */
  public generateSessionId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return this.uint8ToHex(bytes);
  }

  // Utility methods

  private uint8ToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToUint8(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  private bufferToBase64(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer));
  }

  private base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
  }
}

// Export singleton instance
export const transferCrypto = TransferCrypto.getInstance();
