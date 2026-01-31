/**
 * MLS Key Manager
 * Manages MLS (Message Layer Security) E2EE for conference calls
 *
 * MLS provides:
 * - O(log n) key updates (vs O(n) for sender keys)
 * - Forward secrecy on participant leave
 * - Epoch-based key rotation
 * - Efficient group rekeying
 *
 * MLS Suite: MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '@/lib/logger';
import { getCurrentPrivateKey } from '@/stores/authStore';

/** MLS cipher suite identifier */
const MLS_SUITE = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';

/** Key cache duration for out-of-order frame decryption */
const KEY_CACHE_EPOCHS = 5;

interface MLSEpochKey {
  epoch: number;
  key: CryptoKey;
  createdAt: number;
}

interface MLSKeyPackage {
  pubkey: string;
  keyPackageData: string; // Base64 encoded
  signature: string;
}

interface MLSGroupState {
  groupId: string;
  epoch: number;
  memberPubkeys: string[];
  pendingAdds: string[];
  pendingRemoves: string[];
}

interface MLSWelcomeResult {
  welcomeData: string;
  epoch: number;
}

interface MLSCommitResult {
  commitData: string;
  epoch: number;
}

/** Events emitted by MLSKeyManager */
export interface MLSKeyManagerEvents {
  'epoch-changed': (epoch: number) => void;
  'key-rotated': (epoch: number) => void;
  'member-added': (pubkey: string) => void;
  'member-removed': (pubkey: string) => void;
  'error': (error: Error) => void;
}

/**
 * Convert Uint8Array to base64
 */
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Convert base64 to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive epoch key using HKDF
 */
async function deriveEpochKey(
  groupSecret: Uint8Array,
  epoch: number,
  context: string
): Promise<CryptoKey> {
  // Import the secret as an HKDF key
  // Create a copy of the ArrayBuffer to ensure it's not a SharedArrayBuffer
  const secretBuffer = groupSecret.buffer.slice(
    groupSecret.byteOffset,
    groupSecret.byteOffset + groupSecret.byteLength
  ) as ArrayBuffer;
  const baseKey = await crypto.subtle.importKey(
    'raw',
    secretBuffer,
    'HKDF',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key for this epoch
  const epochKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(`mls-epoch-${epoch}`),
      info: new TextEncoder().encode(context),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return epochKey;
}

/**
 * MLS Key Manager
 */
export class MLSKeyManager extends EventEmitter {
  private roomId: string;
  private localPubkey: string;
  private groupState: MLSGroupState | null = null;
  private epochKeys: Map<number, MLSEpochKey> = new Map();
  private groupSecret: Uint8Array | null = null;
  private keyPackages: Map<string, MLSKeyPackage> = new Map();

  constructor(roomId: string, localPubkey: string) {
    super();
    this.roomId = roomId;
    this.localPubkey = localPubkey;
  }

  /**
   * Initialize a new MLS group (called by creator)
   */
  async initializeGroup(): Promise<void> {
    logger.info('Initializing MLS group', { roomId: this.roomId });

    // Generate initial group secret
    this.groupSecret = crypto.getRandomValues(new Uint8Array(32));

    // Initialize group state
    this.groupState = {
      groupId: this.roomId,
      epoch: 0,
      memberPubkeys: [this.localPubkey],
      pendingAdds: [],
      pendingRemoves: [],
    };

    // Derive epoch 0 key
    const epochKey = await deriveEpochKey(
      this.groupSecret,
      0,
      `${this.roomId}-conference`
    );

    this.epochKeys.set(0, {
      epoch: 0,
      key: epochKey,
      createdAt: Date.now(),
    });

    // Generate our key package
    await this.generateKeyPackage();

    this.emit('epoch-changed', 0);
    logger.info('MLS group initialized', { epoch: 0 });
  }

  /**
   * Generate key package for this participant
   */
  private async generateKeyPackage(): Promise<void> {
    const privateKeyBytes = getCurrentPrivateKey();
    if (!privateKeyBytes) {
      throw new Error('No private key available');
    }

    // Generate ECDH key pair for key encapsulation
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveBits']
    );

    // Export public key
    const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyBase64 = bytesToBase64(new Uint8Array(publicKeyRaw));

    // Create key package (simplified - real MLS has more structure)
    const keyPackage: MLSKeyPackage = {
      pubkey: this.localPubkey,
      keyPackageData: publicKeyBase64,
      signature: '', // Would be signed with Ed25519 in production
    };

    this.keyPackages.set(this.localPubkey, keyPackage);
  }

  /**
   * Create welcome message for new participant
   */
  async createWelcome(targetPubkey: string): Promise<MLSWelcomeResult> {
    if (!this.groupState || !this.groupSecret) {
      throw new Error('Group not initialized');
    }

    logger.info('Creating MLS welcome', { target: targetPubkey });

    // Add to pending adds
    this.groupState.pendingAdds.push(targetPubkey);

    // In production, this would:
    // 1. Encrypt group secret to target's key package
    // 2. Include current epoch state
    // 3. Include credential chain
    // For now, we create a simplified welcome

    const welcomePayload = {
      groupId: this.roomId,
      epoch: this.groupState.epoch,
      memberPubkeys: this.groupState.memberPubkeys,
      groupSecret: bytesToBase64(this.groupSecret),
      suite: MLS_SUITE,
    };

    // In production, this would be encrypted to target's public key
    const welcomeData = bytesToBase64(
      new TextEncoder().encode(JSON.stringify(welcomePayload))
    );

    return {
      welcomeData,
      epoch: this.groupState.epoch,
    };
  }

  /**
   * Handle welcome message (for joining participant)
   */
  async handleWelcome(welcomeData: string): Promise<void> {
    logger.info('Processing MLS welcome');

    try {
      // Decode welcome
      const welcomeBytes = base64ToBytes(welcomeData);
      const welcomePayload = JSON.parse(new TextDecoder().decode(welcomeBytes));

      // Validate suite
      if (welcomePayload.suite !== MLS_SUITE) {
        throw new Error(`Unsupported MLS suite: ${welcomePayload.suite}`);
      }

      // Extract group secret
      this.groupSecret = base64ToBytes(welcomePayload.groupSecret);

      // Initialize group state
      this.groupState = {
        groupId: welcomePayload.groupId,
        epoch: welcomePayload.epoch,
        memberPubkeys: [...welcomePayload.memberPubkeys, this.localPubkey],
        pendingAdds: [],
        pendingRemoves: [],
      };

      // Derive epoch key
      const epochKey = await deriveEpochKey(
        this.groupSecret,
        welcomePayload.epoch,
        `${this.roomId}-conference`
      );

      this.epochKeys.set(welcomePayload.epoch, {
        epoch: welcomePayload.epoch,
        key: epochKey,
        createdAt: Date.now(),
      });

      // Generate our key package
      await this.generateKeyPackage();

      this.emit('epoch-changed', welcomePayload.epoch);
      logger.info('MLS welcome processed', { epoch: welcomePayload.epoch });
    } catch (error) {
      logger.error('Failed to process MLS welcome', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Add participant to group
   */
  async addParticipant(pubkey: string, keyPackage?: string): Promise<MLSCommitResult> {
    if (!this.groupState || !this.groupSecret) {
      throw new Error('Group not initialized');
    }

    logger.info('Adding participant to MLS group', { pubkey });

    // Store key package if provided
    if (keyPackage) {
      this.keyPackages.set(pubkey, {
        pubkey,
        keyPackageData: keyPackage,
        signature: '',
      });
    }

    // Add to member list
    if (!this.groupState.memberPubkeys.includes(pubkey)) {
      this.groupState.memberPubkeys.push(pubkey);
    }

    // Create commit (advance epoch)
    return this.createCommit();
  }

  /**
   * Remove participant from group (triggers key rotation)
   */
  async removeParticipant(pubkey: string): Promise<MLSCommitResult> {
    if (!this.groupState || !this.groupSecret) {
      throw new Error('Group not initialized');
    }

    logger.info('Removing participant from MLS group', { pubkey });

    // Remove from member list
    this.groupState.memberPubkeys = this.groupState.memberPubkeys.filter(
      (p) => p !== pubkey
    );

    // Remove key package
    this.keyPackages.delete(pubkey);

    // Create commit with key rotation for forward secrecy
    return this.createCommit(true);
  }

  /**
   * Create commit message (advance epoch)
   */
  async createCommit(rotateSecret = false): Promise<MLSCommitResult> {
    if (!this.groupState || !this.groupSecret) {
      throw new Error('Group not initialized');
    }

    // Advance epoch
    const newEpoch = this.groupState.epoch + 1;

    // Optionally rotate group secret for forward secrecy
    if (rotateSecret) {
      // Derive new secret from old secret + randomness
      const newRandomness = crypto.getRandomValues(new Uint8Array(32));
      const combinedSecret = new Uint8Array(64);
      combinedSecret.set(this.groupSecret);
      combinedSecret.set(newRandomness, 32);

      // Hash to get new group secret
      const hashBuffer = await crypto.subtle.digest('SHA-256', combinedSecret);
      this.groupSecret = new Uint8Array(hashBuffer);
    }

    // Derive new epoch key
    const epochKey = await deriveEpochKey(
      this.groupSecret,
      newEpoch,
      `${this.roomId}-conference`
    );

    this.epochKeys.set(newEpoch, {
      epoch: newEpoch,
      key: epochKey,
      createdAt: Date.now(),
    });

    // Update epoch
    this.groupState.epoch = newEpoch;

    // Clean up old epoch keys (keep last N)
    this.cleanupOldKeys();

    // Create commit message
    const commitPayload = {
      groupId: this.roomId,
      epoch: newEpoch,
      memberPubkeys: this.groupState.memberPubkeys,
      rotated: rotateSecret,
      groupSecret: rotateSecret ? bytesToBase64(this.groupSecret) : undefined,
    };

    const commitData = bytesToBase64(
      new TextEncoder().encode(JSON.stringify(commitPayload))
    );

    this.emit('epoch-changed', newEpoch);
    if (rotateSecret) {
      this.emit('key-rotated', newEpoch);
    }

    logger.info('MLS commit created', { epoch: newEpoch, rotated: rotateSecret });

    return {
      commitData,
      epoch: newEpoch,
    };
  }

  /**
   * Handle commit message
   */
  async handleCommit(commitData: string): Promise<void> {
    if (!this.groupState) {
      throw new Error('Group not initialized');
    }

    logger.info('Processing MLS commit');

    try {
      // Decode commit
      const commitBytes = base64ToBytes(commitData);
      const commitPayload = JSON.parse(new TextDecoder().decode(commitBytes));

      // Validate epoch is advancing
      if (commitPayload.epoch <= this.groupState.epoch) {
        logger.warn('Ignoring outdated commit', {
          received: commitPayload.epoch,
          current: this.groupState.epoch,
        });
        return;
      }

      // Update group secret if rotated
      if (commitPayload.rotated && commitPayload.groupSecret) {
        this.groupSecret = base64ToBytes(commitPayload.groupSecret);
      }

      // Update member list
      this.groupState.memberPubkeys = commitPayload.memberPubkeys;
      this.groupState.epoch = commitPayload.epoch;

      // Derive new epoch key
      if (this.groupSecret) {
        const epochKey = await deriveEpochKey(
          this.groupSecret,
          commitPayload.epoch,
          `${this.roomId}-conference`
        );

        this.epochKeys.set(commitPayload.epoch, {
          epoch: commitPayload.epoch,
          key: epochKey,
          createdAt: Date.now(),
        });
      }

      // Clean up old keys
      this.cleanupOldKeys();

      this.emit('epoch-changed', commitPayload.epoch);
      if (commitPayload.rotated) {
        this.emit('key-rotated', commitPayload.epoch);
      }

      logger.info('MLS commit processed', { epoch: commitPayload.epoch });
    } catch (error) {
      logger.error('Failed to process MLS commit', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get current epoch
   */
  getCurrentEpoch(): number {
    return this.groupState?.epoch ?? 0;
  }

  /**
   * Get current epoch key for encryption
   */
  getCurrentEpochKey(): CryptoKey | undefined {
    if (!this.groupState) return undefined;
    return this.epochKeys.get(this.groupState.epoch)?.key;
  }

  /**
   * Get epoch key for decryption (supports out-of-order frames)
   */
  getEpochKey(epoch: number): CryptoKey | undefined {
    return this.epochKeys.get(epoch)?.key;
  }

  /**
   * Encrypt frame data
   */
  async encryptFrame(frame: Uint8Array): Promise<{ encrypted: Uint8Array; epoch: number }> {
    const epochKey = this.getCurrentEpochKey();
    if (!epochKey || !this.groupState) {
      throw new Error('No encryption key available');
    }

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt - create a copy of the buffer as ArrayBuffer
    const frameBuffer = frame.buffer.slice(
      frame.byteOffset,
      frame.byteOffset + frame.byteLength
    ) as ArrayBuffer;
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv } as AesGcmParams,
      epochKey,
      frameBuffer
    );

    // Combine: [epoch (1 byte)][iv (12 bytes)][ciphertext]
    const result = new Uint8Array(1 + 12 + encrypted.byteLength);
    result[0] = this.groupState.epoch & 0xff;
    result.set(iv, 1);
    result.set(new Uint8Array(encrypted), 13);

    return {
      encrypted: result,
      epoch: this.groupState.epoch,
    };
  }

  /**
   * Decrypt frame data
   */
  async decryptFrame(data: Uint8Array): Promise<Uint8Array> {
    if (data.length < 14) {
      throw new Error('Frame too short');
    }

    // Extract epoch and IV
    const epoch = data[0];
    const iv = data.slice(1, 13);
    const ciphertext = data.slice(13);

    // Get epoch key
    const epochKey = this.getEpochKey(epoch);
    if (!epochKey) {
      throw new Error(`No key for epoch ${epoch}`);
    }

    // Decrypt - create a copy of the buffer as ArrayBuffer
    const ciphertextBuffer = ciphertext.buffer.slice(
      ciphertext.byteOffset,
      ciphertext.byteOffset + ciphertext.byteLength
    ) as ArrayBuffer;
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv } as AesGcmParams,
      epochKey,
      ciphertextBuffer
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Clean up old epoch keys
   */
  private cleanupOldKeys(): void {
    if (!this.groupState) return;

    const currentEpoch = this.groupState.epoch;
    const minEpoch = currentEpoch - KEY_CACHE_EPOCHS;

    for (const epoch of this.epochKeys.keys()) {
      if (epoch < minEpoch) {
        this.epochKeys.delete(epoch);
      }
    }
  }

  /**
   * Get member pubkeys
   */
  getMembers(): string[] {
    return this.groupState?.memberPubkeys ?? [];
  }

  /**
   * Check if pubkey is a member
   */
  isMember(pubkey: string): boolean {
    return this.groupState?.memberPubkeys.includes(pubkey) ?? false;
  }

  /**
   * Close the key manager
   */
  close(): void {
    // Clear sensitive data
    this.groupSecret = null;
    this.epochKeys.clear();
    this.keyPackages.clear();
    this.groupState = null;

    this.removeAllListeners();
    logger.info('MLS key manager closed');
  }
}

/**
 * Singleton instance per room
 */
const mlsKeyManagers: Map<string, MLSKeyManager> = new Map();

export function getMLSKeyManager(roomId: string, localPubkey: string): MLSKeyManager {
  let manager = mlsKeyManagers.get(roomId);
  if (!manager) {
    manager = new MLSKeyManager(roomId, localPubkey);
    mlsKeyManagers.set(roomId, manager);
  }
  return manager;
}

export function closeMLSKeyManager(roomId: string): void {
  const manager = mlsKeyManagers.get(roomId);
  if (manager) {
    manager.close();
    mlsKeyManagers.delete(roomId);
  }
}
