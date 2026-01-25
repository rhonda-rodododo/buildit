/**
 * Recovery Phrase Service
 * Handles BIP-39 mnemonic generation and validation for identity backup
 *
 * Security: Recovery phrases are generated from private keys and can be used
 * to deterministically derive encryption keys for backup files.
 */

import * as bip39 from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english';
import type { RecoveryPhraseValidation } from './types';

// Cast to mutable array for bip39 functions (they don't mutate but expect mutable type)
const wordlist = englishWordlist as string[];

// PBKDF2 iterations for recovery phrase to key derivation
const PBKDF2_ITERATIONS = 600_000;

/**
 * Recovery Phrase Service
 * Manages BIP-39 mnemonic phrases for backup/recovery
 */
export class RecoveryPhraseService {
  private static instance: RecoveryPhraseService;

  private constructor() {}

  public static getInstance(): RecoveryPhraseService {
    if (!RecoveryPhraseService.instance) {
      RecoveryPhraseService.instance = new RecoveryPhraseService();
    }
    return RecoveryPhraseService.instance;
  }

  /**
   * Generate a new 24-word recovery phrase (256 bits of entropy)
   * Used for creating a new backup recovery phrase
   */
  public generateRecoveryPhrase(): string {
    // Generate 256 bits (32 bytes) of entropy for 24-word mnemonic
    const entropy = crypto.getRandomValues(new Uint8Array(32));
    return bip39.entropyToMnemonic(entropy, wordlist);
  }

  /**
   * Convert a private key to a recovery phrase
   * The private key is used as entropy to generate a deterministic mnemonic
   *
   * NOTE: This is NOT the same as generating a mnemonic for the key itself.
   * Instead, we use the private key to derive a recovery phrase that can
   * be used to encrypt/decrypt backup files.
   */
  public privateKeyToRecoveryPhrase(privateKey: Uint8Array): string {
    if (privateKey.length !== 32) {
      throw new Error('Private key must be 32 bytes');
    }
    // Use the private key as entropy for the mnemonic
    return bip39.entropyToMnemonic(privateKey, wordlist);
  }

  /**
   * Convert a recovery phrase back to entropy (32 bytes)
   */
  public recoveryPhraseToEntropy(mnemonic: string): Uint8Array {
    const normalized = this.normalizePhrase(mnemonic);
    if (!this.validatePhrase(normalized).isValid) {
      throw new Error('Invalid recovery phrase');
    }
    return bip39.mnemonicToEntropy(normalized, wordlist);
  }

  /**
   * Derive an encryption key from a recovery phrase
   * Uses PBKDF2 with high iteration count for security
   */
  public async deriveEncryptionKey(
    mnemonic: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const normalized = this.normalizePhrase(mnemonic);
    if (!this.validatePhrase(normalized).isValid) {
      throw new Error('Invalid recovery phrase');
    }

    // Convert mnemonic to bytes for key derivation
    const encoder = new TextEncoder();
    const mnemonicBytes = encoder.encode(normalized);

    // Import as key material for PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      mnemonicBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive AES-256-GCM key using PBKDF2
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // Non-extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Validate a recovery phrase
   * Checks word count, word validity, and checksum
   */
  public validatePhrase(mnemonic: string): RecoveryPhraseValidation {
    const normalized = this.normalizePhrase(mnemonic);
    const words = normalized.split(' ').filter(w => w.length > 0);

    // Check word count (12, 15, 18, 21, or 24 words)
    const validWordCounts = [12, 15, 18, 21, 24];
    if (!validWordCounts.includes(words.length)) {
      return {
        isValid: false,
        wordCount: words.length,
        invalidWords: [],
        checksum: false,
      };
    }

    // Check each word is in the wordlist
    const invalidWords: string[] = [];
    for (const word of words) {
      if (!wordlist.includes(word)) {
        invalidWords.push(word);
      }
    }

    if (invalidWords.length > 0) {
      return {
        isValid: false,
        wordCount: words.length,
        invalidWords,
        checksum: false,
      };
    }

    // Validate checksum
    try {
      const isValidMnemonic = bip39.validateMnemonic(normalized, wordlist);
      return {
        isValid: isValidMnemonic,
        wordCount: words.length,
        invalidWords: [],
        checksum: isValidMnemonic,
      };
    } catch {
      return {
        isValid: false,
        wordCount: words.length,
        invalidWords: [],
        checksum: false,
      };
    }
  }

  /**
   * Normalize a recovery phrase
   * - Lowercase all words
   * - Trim whitespace
   * - Normalize spacing
   */
  public normalizePhrase(mnemonic: string): string {
    return mnemonic
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .join(' ');
  }

  /**
   * Get word suggestions for autocomplete
   * Returns words from the BIP-39 wordlist that start with the given prefix
   */
  public getSuggestions(prefix: string, limit: number = 5): string[] {
    const normalizedPrefix = prefix.toLowerCase().trim();
    if (normalizedPrefix.length === 0) {
      return [];
    }

    return wordlist
      .filter(word => word.startsWith(normalizedPrefix))
      .slice(0, limit);
  }

  /**
   * Check if a single word is valid
   */
  public isValidWord(word: string): boolean {
    return wordlist.includes(word.toLowerCase().trim());
  }

  /**
   * Get the complete BIP-39 wordlist
   */
  public getWordlist(): string[] {
    return wordlist;
  }

  /**
   * Format recovery phrase for display (groups of 4 words)
   */
  public formatForDisplay(mnemonic: string): string[][] {
    const words = this.normalizePhrase(mnemonic).split(' ');
    const groups: string[][] = [];

    for (let i = 0; i < words.length; i += 4) {
      groups.push(words.slice(i, i + 4));
    }

    return groups;
  }

  /**
   * Generate a random passphrase for additional backup encryption
   * This is separate from the recovery phrase and adds an extra layer of security
   */
  public generatePassphrase(length: number = 6): string {
    const words: string[] = [];
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % wordlist.length;
      words.push(wordlist[randomIndex] as string);
    }
    return words.join('-');
  }
}

// Export singleton instance
export const recoveryPhraseService = RecoveryPhraseService.getInstance();
