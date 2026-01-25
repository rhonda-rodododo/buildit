/**
 * Multi-Device Backup Types
 * Types for encrypted backup, recovery phrases, and device transfer
 */

/**
 * Encrypted backup file format
 * This is the portable format for backup files
 */
export interface EncryptedBackup {
  version: 2;
  type: 'buildit-backup';
  createdAt: number;
  identityHint: string; // First 8 chars of npub for identification
  encryptedData: string; // AES-256-GCM encrypted (base64)
  salt: string; // PBKDF2 salt (base64)
  iv: string; // AES-GCM IV (base64)
  checksum: string; // SHA-256 of plaintext data (hex)
  metadata: BackupMetadata;
}

/**
 * Metadata included in backup (not encrypted)
 */
export interface BackupMetadata {
  appVersion: string;
  backupVersion: number;
  createdAt: number;
  deviceName?: string;
  npubPrefix: string; // First 12 chars of npub
}

/**
 * Decrypted backup contents
 */
export interface BackupContents {
  identity: {
    publicKey: string;
    privateKey: string; // hex-encoded
    name: string;
    displayName?: string;
    nip05?: string;
    created: number;
  };
  securitySettings?: {
    authMethod: string;
    inactivityTimeout: number;
    lockOnHide: boolean;
    lockOnClose: boolean;
  };
  // Optional: Include contacts and groups
  contacts?: BackupContact[];
  groups?: BackupGroup[];
}

/**
 * Contact info in backup
 */
export interface BackupContact {
  pubkey: string;
  name?: string;
  nip05?: string;
}

/**
 * Group info in backup
 */
export interface BackupGroup {
  id: string;
  name: string;
  description?: string;
  role: string;
}

/**
 * Recovery phrase validation result
 */
export interface RecoveryPhraseValidation {
  isValid: boolean;
  wordCount: number;
  invalidWords?: string[];
  checksum?: boolean;
}

/**
 * Device transfer QR code format
 */
export interface DeviceTransferQR {
  version: 1;
  type: 'buildit-device-transfer';
  sessionId: string; // Random 32-byte hex
  publicKey: string; // Ephemeral ECDH key (hex)
  relays: string[]; // For message exchange
  npub?: string; // Identity hint
  expiresAt: number;
  deviceName?: string;
}

/**
 * Device transfer session state
 */
export interface DeviceTransferSession {
  id: string;
  role: 'initiator' | 'receiver';
  status: 'awaiting_scan' | 'connected' | 'authenticating' | 'transferring' | 'completed' | 'failed' | 'expired';
  ephemeralPrivateKey: string; // hex
  ephemeralPublicKey: string; // hex
  remotePubkey?: string;
  sharedSecret?: string; // ECDH shared secret (hex)
  relays: string[];
  identityPubkey?: string;
  expiresAt: number;
  createdAt: number;
  errorMessage?: string;
}

/**
 * Transfer message types
 */
export type TransferMessageType =
  | 'handshake'
  | 'handshake_response'
  | 'auth_challenge'
  | 'auth_response'
  | 'key_payload'
  | 'key_ack'
  | 'error'
  | 'abort';

/**
 * Transfer message payload
 */
export interface TransferMessage {
  type: TransferMessageType;
  sessionId: string;
  timestamp: number;
  payload: Record<string, unknown>;
  signature?: string; // For verification
}

/**
 * NIP-46 permission types
 */
export type Nip46Permission =
  | 'sign_event'
  | 'encrypt'
  | 'decrypt'
  | 'get_public_key'
  | 'nip04_encrypt'
  | 'nip04_decrypt'
  | 'nip44_encrypt'
  | 'nip44_decrypt';

/**
 * NIP-46 bunker connection config
 */
export interface BunkerConnectionConfig {
  id: string;
  name: string;
  remotePubkey: string;
  relays: string[];
  permissions: Nip46Permission[];
  autoApprove: boolean;
  expiresAt?: number;
}

/**
 * NIP-46 request from remote signer
 */
export interface Nip46Request {
  id: string;
  method: string;
  params: unknown[];
  remotePubkey: string;
  connectionId: string;
  timestamp: number;
}

/**
 * Linked device info
 */
export interface LinkedDevice {
  id: string;
  name: string;
  type: 'primary' | 'linked' | 'bunker';
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser?: string;
  os?: string;
  lastSeen: number;
  isCurrent: boolean;
  createdAt: number;
}
