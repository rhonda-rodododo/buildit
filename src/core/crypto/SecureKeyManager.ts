/**
 * Secure Key Manager
 * Manages encrypted key storage with proper at-rest encryption.
 * Keys are only decrypted in memory when the app is unlocked.
 *
 * Key Hierarchy:
 * User Password (or WebAuthn)
 *     │
 *     ▼ (PBKDF2, 600,000 iterations)
 * Master Encryption Key (MEK)
 *     │
 *     ├──▶ Identity Private Key (encrypted with MEK)
 *     │
 *     └──▶ Database Encryption Key (DEK) - derived from MEK for DB encryption
 */

import type { WebAuthnCredential, ProtectedKeyStorage } from '@/types/device';
import { webAuthnService } from '@/lib/webauthn/WebAuthnService';

// OWASP 2023 recommended iterations for PBKDF2-SHA256
const PBKDF2_ITERATIONS = 600_000;

/**
 * Security settings for an identity
 */
export interface SecuritySettings {
  authMethod: 'password-always' | 'webauthn-preferred' | 'webauthn-only';
  inactivityTimeout: number; // minutes, 0 = never auto-lock
  lockOnHide: boolean; // lock when tab hidden
  lockOnClose: boolean; // require re-auth on reopen
  requirePasswordForExport: boolean; // always true for nsec export
}

/**
 * Default security settings
 */
export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  authMethod: 'password-always',
  inactivityTimeout: 15, // 15 minutes
  lockOnHide: false,
  lockOnClose: true,
  requirePasswordForExport: true,
};

/**
 * Encrypted identity storage format
 * This is what gets stored in IndexedDB
 */
export interface EncryptedKeyData {
  publicKey: string; // Primary key (unencrypted for lookup)
  encryptedPrivateKey: string; // AES-GCM encrypted private key (base64)
  salt: string; // Unique PBKDF2 salt for this identity (base64)
  iv: string; // AES-GCM initialization vector (base64)
  webAuthnProtected: boolean; // Whether WebAuthn is enabled for this identity
  credentialId?: string; // WebAuthn credential ID (if webAuthnProtected)
  createdAt: number;
  lastUnlockedAt?: number;
  keyVersion: number; // For key rotation tracking
}

/**
 * Lock state for the secure key manager
 */
export type LockState = 'locked' | 'unlocked' | 'locking';

/**
 * Events emitted by SecureKeyManager
 */
export type SecureKeyManagerEvent =
  | { type: 'locked' }
  | { type: 'unlocked'; publicKey: string }
  | { type: 'lock-timeout-warning'; secondsRemaining: number }
  | { type: 'key-rotation-started'; publicKey: string }
  | { type: 'key-rotation-completed'; publicKey: string };

/**
 * Secure Key Manager Service
 * Handles all cryptographic operations for key storage
 */
export class SecureKeyManager {
  private static instance: SecureKeyManager;

  // Lock state
  private _lockState: LockState = 'locked';

  // Decrypted keys in memory (only when unlocked)
  private decryptedKeys: Map<string, Uint8Array> = new Map();

  // Master Encryption Key (only in memory when unlocked) - used for key rotation
  private masterKey: CryptoKey | null = null;

  // Database Encryption Key (derived from MEK)
  private databaseKey: CryptoKey | null = null;

  // Current unlocked identity
  private currentPublicKey: string | null = null;

  // Inactivity timer
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityTime: number = Date.now();

  // Event listeners
  private eventListeners: Set<(event: SecureKeyManagerEvent) => void> = new Set();

  // Security settings per identity (loaded from DB)
  private securitySettings: Map<string, SecuritySettings> = new Map();

  private constructor() {
    // Setup visibility change listener for lock-on-hide
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    // Setup activity tracking
    if (typeof window !== 'undefined') {
      ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
        window.addEventListener(event, this.recordActivity.bind(this), { passive: true });
      });

      // SECURITY: Clear keys when browser window/tab closes
      // This ensures keys don't remain in memory if the browser crashes or force-closes
      window.addEventListener('beforeunload', () => {
        this.lock();
      });
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SecureKeyManager {
    if (!SecureKeyManager.instance) {
      SecureKeyManager.instance = new SecureKeyManager();
    }
    return SecureKeyManager.instance;
  }

  /**
   * Get current lock state
   */
  public get lockState(): LockState {
    return this._lockState;
  }

  /**
   * Check if unlocked
   */
  public get isUnlocked(): boolean {
    return this._lockState === 'unlocked';
  }

  /**
   * Get current unlocked identity's public key
   */
  public get currentIdentity(): string | null {
    return this.currentPublicKey;
  }

  /**
   * Subscribe to events
   */
  public addEventListener(listener: (event: SecureKeyManagerEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: SecureKeyManagerEvent): void {
    this.eventListeners.forEach(listener => listener(event));
  }

  /**
   * Derive Master Key Bits from password using PBKDF2
   *
   * SECURITY: We derive raw bits first, then create non-extractable CryptoKeys.
   * This prevents the master key material from ever being extractable.
   */
  private async deriveMasterKeyBits(
    password: string,
    salt: Uint8Array
  ): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Derive raw bits using PBKDF2 with 600,000 iterations
    // SECURITY: By deriving bits instead of a key, we control when/how
    // the final non-extractable keys are created
    return crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256 // 256 bits = 32 bytes
    );
  }

  /**
   * Create a non-extractable AES-GCM key from raw key material
   *
   * SECURITY: All final encryption keys are non-extractable, meaning
   * they cannot be exported and are protected by the browser's security boundary.
   */
  private async createNonExtractableKey(
    keyBits: ArrayBuffer,
    keyUsages: KeyUsage[]
  ): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      keyBits,
      { name: 'AES-GCM', length: 256 },
      false, // SECURITY: Non-extractable - key cannot be exported
      keyUsages
    );
  }

  /**
   * Derive a Master Encryption Key from password using PBKDF2
   *
   * SECURITY: Returns a non-extractable CryptoKey for encryption operations.
   */
  private async deriveKeyFromPassword(
    password: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const keyBits = await this.deriveMasterKeyBits(password, salt);
    return this.createNonExtractableKey(keyBits, ['encrypt', 'decrypt']);
  }

  /**
   * Derive Database Encryption Key from Master Key Bits
   *
   * SECURITY: Uses HKDF to derive a separate non-extractable key for database encryption.
   * The derivation happens from raw bits, never from an extractable CryptoKey.
   */
  private async deriveDatabaseKeyFromBits(masterKeyBits: ArrayBuffer): Promise<CryptoKey> {
    // Use HKDF to derive a separate key for database encryption
    const salt = new TextEncoder().encode('BuildItNetwork-DEK-v1');
    const info = new TextEncoder().encode('database-encryption');

    // Import raw bits for HKDF derivation (non-extractable)
    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      masterKeyBits,
      { name: 'HKDF' },
      false, // Non-extractable
      ['deriveKey']
    );

    // Derive database key - SECURITY: Non-extractable
    return crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        salt,
        info,
        hash: 'SHA-256',
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false, // SECURITY: Non-extractable - cannot be exported
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a private key with the master key
   */
  private async encryptPrivateKey(
    privateKey: Uint8Array,
    masterKey: CryptoKey
  ): Promise<{ encrypted: string; iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Cast to BufferSource for TypeScript compatibility
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      masterKey,
      privateKey as BufferSource
    );

    return {
      encrypted: this.bufferToBase64(new Uint8Array(encrypted)),
      iv: this.bufferToBase64(iv),
    };
  }

  /**
   * Decrypt a private key with the master key
   */
  private async decryptPrivateKey(
    encryptedData: string,
    iv: string,
    masterKey: CryptoKey
  ): Promise<Uint8Array> {
    const encryptedBuffer = this.base64ToBuffer(encryptedData);
    const ivBuffer = this.base64ToBuffer(iv);

    // Cast to BufferSource for TypeScript compatibility
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer as BufferSource },
      masterKey,
      encryptedBuffer as BufferSource
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Generate a unique salt for a new identity
   */
  public generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  /**
   * Create encrypted key data for a new identity
   * Called when creating or importing an identity
   */
  public async createEncryptedKeyData(
    publicKey: string,
    privateKey: Uint8Array,
    password: string,
    webAuthnCredential?: WebAuthnCredential
  ): Promise<EncryptedKeyData> {
    const salt = this.generateSalt();
    const masterKey = await this.deriveKeyFromPassword(password, salt);
    const { encrypted, iv } = await this.encryptPrivateKey(privateKey, masterKey);

    return {
      publicKey,
      encryptedPrivateKey: encrypted,
      salt: this.bufferToBase64(salt),
      iv,
      webAuthnProtected: !!webAuthnCredential,
      credentialId: webAuthnCredential?.id,
      createdAt: Date.now(),
      keyVersion: 1,
    };
  }

  /**
   * Unlock an identity with password
   * Decrypts the private key and stores it in memory
   *
   * SECURITY: Uses non-extractable keys throughout. The master key bits
   * are derived once and used to create both the encryption key and
   * the database key, ensuring key material cannot be extracted.
   */
  public async unlockWithPassword(
    encryptedData: EncryptedKeyData,
    password: string
  ): Promise<Uint8Array> {
    const salt = this.base64ToBuffer(encryptedData.salt);

    // SECURITY: Derive raw bits first, then create non-extractable keys
    // This ensures key material is never stored in an extractable form
    const masterKeyBits = await this.deriveMasterKeyBits(password, salt);
    const masterKey = await this.createNonExtractableKey(masterKeyBits, ['encrypt', 'decrypt']);

    try {
      const privateKey = await this.decryptPrivateKey(
        encryptedData.encryptedPrivateKey,
        encryptedData.iv,
        masterKey
      );

      // Store in memory - both keys are non-extractable
      this.masterKey = masterKey;
      this.databaseKey = await this.deriveDatabaseKeyFromBits(masterKeyBits);
      this.decryptedKeys.set(encryptedData.publicKey, privateKey);
      this.currentPublicKey = encryptedData.publicKey;
      this._lockState = 'unlocked';
      this.lastActivityTime = Date.now();

      // Setup inactivity timer
      const settings = this.securitySettings.get(encryptedData.publicKey) || DEFAULT_SECURITY_SETTINGS;
      this.setupInactivityTimer(settings.inactivityTimeout);

      this.emit({ type: 'unlocked', publicKey: encryptedData.publicKey });

      return privateKey;
    } catch {
      throw new Error('Invalid password or corrupted key data');
    }
  }

  /**
   * Unlock with WebAuthn (if enabled)
   * WebAuthn protects the password which is then used to derive the MEK
   */
  public async unlockWithWebAuthn(
    encryptedData: EncryptedKeyData,
    storedCredentials: WebAuthnCredential[],
    _encryptedPassword: ProtectedKeyStorage
  ): Promise<Uint8Array> {
    if (!encryptedData.webAuthnProtected) {
      throw new Error('WebAuthn not enabled for this identity');
    }

    // Authenticate with WebAuthn
    const credentialId = await webAuthnService.authenticateCredential(storedCredentials);

    if (!credentialId) {
      throw new Error('WebAuthn authentication failed');
    }

    // The protected key storage contains the password encrypted with WebAuthn
    // For now, we'll require the password to be provided separately
    // In a full implementation, the password would be stored encrypted with WebAuthn credential
    throw new Error('WebAuthn unlock requires password storage implementation');
  }

  /**
   * Lock the app - clear all decrypted keys from memory
   */
  public lock(): void {
    this._lockState = 'locking';

    // Zero-fill all decrypted keys in memory
    for (const [_key, privateKey] of this.decryptedKeys) {
      privateKey.fill(0);
    }
    this.decryptedKeys.clear();

    // Clear master key reference (will be garbage collected)
    this.masterKey = null;
    this.databaseKey = null;
    this.currentPublicKey = null;

    // Clear inactivity timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    this._lockState = 'locked';
    this.emit({ type: 'locked' });
  }

  /**
   * Get decrypted private key (only if unlocked)
   */
  public getPrivateKey(publicKey: string): Uint8Array | null {
    if (!this.isUnlocked) {
      return null;
    }
    return this.decryptedKeys.get(publicKey) || null;
  }

  /**
   * Get the current unlocked private key
   */
  public getCurrentPrivateKey(): Uint8Array | null {
    if (!this.currentPublicKey) {
      return null;
    }
    return this.getPrivateKey(this.currentPublicKey);
  }

  /**
   * Get the database encryption key (only if unlocked)
   */
  public getDatabaseKey(): CryptoKey | null {
    return this.databaseKey;
  }

  /**
   * Get the master encryption key (only if unlocked)
   * Used for key rotation and re-deriving keys
   */
  public getMasterKey(): CryptoKey | null {
    return this.masterKey;
  }

  /**
   * Change password for an identity
   * Re-encrypts the private key with a new password
   *
   * SECURITY: Uses non-extractable keys for both old and new password operations.
   */
  public async changePassword(
    encryptedData: EncryptedKeyData,
    oldPassword: string,
    newPassword: string
  ): Promise<EncryptedKeyData> {
    // First, decrypt with old password
    const privateKey = await this.unlockWithPassword(encryptedData, oldPassword);

    // Generate new salt for new password
    const newSalt = this.generateSalt();

    // SECURITY: Derive raw bits first, then create non-extractable keys
    const newMasterKeyBits = await this.deriveMasterKeyBits(newPassword, newSalt);
    const newMasterKey = await this.createNonExtractableKey(newMasterKeyBits, ['encrypt', 'decrypt']);
    const { encrypted, iv } = await this.encryptPrivateKey(privateKey, newMasterKey);

    // Update in-memory keys - both non-extractable
    this.masterKey = newMasterKey;
    this.databaseKey = await this.deriveDatabaseKeyFromBits(newMasterKeyBits);

    return {
      ...encryptedData,
      encryptedPrivateKey: encrypted,
      salt: this.bufferToBase64(newSalt),
      iv,
      keyVersion: encryptedData.keyVersion + 1,
    };
  }

  /**
   * Upgrade to WebAuthn protection
   */
  public async enableWebAuthn(
    encryptedData: EncryptedKeyData,
    credential: WebAuthnCredential,
    password: string
  ): Promise<EncryptedKeyData> {
    // Verify password first
    const salt = this.base64ToBuffer(encryptedData.salt);
    const masterKey = await this.deriveKeyFromPassword(password, salt);

    try {
      await this.decryptPrivateKey(
        encryptedData.encryptedPrivateKey,
        encryptedData.iv,
        masterKey
      );
    } catch {
      throw new Error('Invalid password');
    }

    return {
      ...encryptedData,
      webAuthnProtected: true,
      credentialId: credential.id,
      keyVersion: encryptedData.keyVersion + 1,
    };
  }

  /**
   * Disable WebAuthn protection
   */
  public async disableWebAuthn(
    encryptedData: EncryptedKeyData,
    password: string
  ): Promise<EncryptedKeyData> {
    // Verify password first
    const salt = this.base64ToBuffer(encryptedData.salt);
    const masterKey = await this.deriveKeyFromPassword(password, salt);

    try {
      await this.decryptPrivateKey(
        encryptedData.encryptedPrivateKey,
        encryptedData.iv,
        masterKey
      );
    } catch {
      throw new Error('Invalid password');
    }

    return {
      ...encryptedData,
      webAuthnProtected: false,
      credentialId: undefined,
      keyVersion: encryptedData.keyVersion + 1,
    };
  }

  /**
   * Set security settings for an identity
   */
  public setSecuritySettings(publicKey: string, settings: SecuritySettings): void {
    this.securitySettings.set(publicKey, settings);

    // If this is the current identity, update the inactivity timer
    if (this.currentPublicKey === publicKey && this.isUnlocked) {
      this.setupInactivityTimer(settings.inactivityTimeout);
    }
  }

  /**
   * Get security settings for an identity
   */
  public getSecuritySettings(publicKey: string): SecuritySettings {
    return this.securitySettings.get(publicKey) || DEFAULT_SECURITY_SETTINGS;
  }

  /**
   * Setup inactivity timer
   */
  private setupInactivityTimer(timeoutMinutes: number): void {
    // Clear existing timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    // No timer if timeout is 0 (never lock)
    if (timeoutMinutes === 0) {
      return;
    }

    const checkInactivity = () => {
      const now = Date.now();
      const inactiveMs = now - this.lastActivityTime;
      const timeoutMs = timeoutMinutes * 60 * 1000;

      if (inactiveMs >= timeoutMs) {
        // Lock due to inactivity
        this.lock();
      } else {
        // Check again later
        const remaining = timeoutMs - inactiveMs;

        // Emit warning if less than 1 minute remaining
        if (remaining <= 60000) {
          this.emit({ type: 'lock-timeout-warning', secondsRemaining: Math.ceil(remaining / 1000) });
        }

        this.inactivityTimer = setTimeout(checkInactivity, Math.min(remaining, 30000));
      }
    };

    // Start checking
    this.inactivityTimer = setTimeout(checkInactivity, 30000);
  }

  /**
   * Record user activity (resets inactivity timer)
   */
  private recordActivity(): void {
    this.lastActivityTime = Date.now();
  }

  /**
   * Handle visibility change for lock-on-hide
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden' && this.isUnlocked && this.currentPublicKey) {
      const settings = this.securitySettings.get(this.currentPublicKey) || DEFAULT_SECURITY_SETTINGS;
      if (settings.lockOnHide) {
        this.lock();
      }
    }
  }

  /**
   * Verify a password is correct without unlocking
   */
  public async verifyPassword(
    encryptedData: EncryptedKeyData,
    password: string
  ): Promise<boolean> {
    try {
      const salt = this.base64ToBuffer(encryptedData.salt);
      const masterKey = await this.deriveKeyFromPassword(password, salt);
      await this.decryptPrivateKey(
        encryptedData.encryptedPrivateKey,
        encryptedData.iv,
        masterKey
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Export private key as nsec (requires password verification)
   */
  public async exportPrivateKey(
    encryptedData: EncryptedKeyData,
    password: string
  ): Promise<Uint8Array> {
    const salt = this.base64ToBuffer(encryptedData.salt);
    const masterKey = await this.deriveKeyFromPassword(password, salt);

    try {
      return await this.decryptPrivateKey(
        encryptedData.encryptedPrivateKey,
        encryptedData.iv,
        masterKey
      );
    } catch {
      throw new Error('Invalid password');
    }
  }

  // Utility methods

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
export const secureKeyManager = SecureKeyManager.getInstance();
