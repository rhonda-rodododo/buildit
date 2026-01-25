/**
 * Device Management Types
 * Defines interfaces for device tracking, session management, and WebAuthn integration
 */

/**
 * Device information and fingerprinting data
 */
export interface DeviceInfo {
  id: string; // Unique device identifier
  name: string; // User-friendly device name (e.g., "John's iPhone")
  type: DeviceType;
  browser: string; // Browser name and version
  os: string; // Operating system
  platform: string; // Platform (web, mobile, desktop)
  screenResolution?: string; // Screen resolution (optional for privacy)
  userAgent: string; // Full user agent string
  lastSeen: number; // Unix timestamp of last activity
  firstSeen: number; // Unix timestamp of first registration
  isCurrent: boolean; // Is this the current device?
  isTrusted: boolean; // Has user marked this device as trusted?
  webAuthnEnabled: boolean; // Does this device support WebAuthn?
  icon: string; // Icon name for display (desktop, mobile, tablet, etc.)
}

/**
 * Device type classification
 */
export type DeviceType =
  | 'desktop'
  | 'mobile'
  | 'tablet'
  | 'unknown';

/**
 * Active session information
 */
export interface DeviceSession {
  id: string; // Unique session identifier
  deviceId: string; // Associated device ID
  ipAddress?: string; // IP address (optional, can be anonymized)
  location?: string; // Approximate location (city/country)
  createdAt: number; // Unix timestamp when session started
  lastActive: number; // Unix timestamp of last activity
  expiresAt?: number; // Optional session expiration
  isActive: boolean; // Is this session currently active?
}

/**
 * Device activity log entry
 */
export interface DeviceActivity {
  id: string;
  deviceId: string;
  type: DeviceActivityType;
  timestamp: number; // Unix timestamp
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Device activity types
 */
export type DeviceActivityType =
  | 'login'
  | 'logout'
  | 'key_access'
  | 'key_rotation'
  | 'device_added'
  | 'device_removed'
  | 'device_trusted'
  | 'device_untrusted'
  | 'session_revoked'
  | 'webauthn_registered'
  | 'webauthn_authenticated'
  | 'suspicious_activity';

/**
 * WebAuthn credential information
 */
export interface WebAuthnCredential {
  id: string; // Credential ID (base64url encoded)
  publicKey: string; // Public key (base64url encoded)
  deviceId: string; // Associated device
  counter: number; // Signature counter for replay protection
  createdAt: number; // Unix timestamp
  lastUsed?: number; // Unix timestamp of last use
  aaguid?: string; // Authenticator AAGUID
  transports?: AuthenticatorTransport[]; // Supported transports
  userHandle: string; // User handle (npub)
}

/**
 * Authenticator transport types
 */
export type AuthenticatorTransport =
  | 'usb'
  | 'nfc'
  | 'ble'
  | 'internal'
  | 'hybrid';

/**
 * WebAuthn registration options
 */
export interface WebAuthnRegistrationOptions {
  challenge: string; // Random challenge (base64url encoded)
  rp: {
    name: string; // Relying party name
    id?: string; // Relying party ID (domain)
  };
  user: {
    id: string; // User ID (base64url encoded npub)
    name: string; // User display name
    displayName: string; // User friendly name
  };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey?: 'required' | 'preferred' | 'discouraged';
    requireResidentKey?: boolean;
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  timeout?: number; // Timeout in milliseconds
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise';
}

/**
 * Public key credential parameters
 */
export interface PublicKeyCredentialParameters {
  type: 'public-key';
  alg: number; // COSE algorithm identifier
}

/**
 * WebAuthn authentication options
 */
export interface WebAuthnAuthenticationOptions {
  challenge: string; // Random challenge (base64url encoded)
  rpId?: string; // Relying party ID
  allowCredentials?: {
    type: 'public-key';
    id: string; // Credential ID (base64url encoded)
    transports?: AuthenticatorTransport[];
  }[];
  timeout?: number; // Timeout in milliseconds
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

/**
 * Device authorization request
 */
export interface DeviceAuthorizationRequest {
  id: string;
  deviceInfo: DeviceInfo;
  requestedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
  status: 'pending' | 'approved' | 'denied' | 'expired';
  notificationSent: boolean;
}

/**
 * Privacy settings for device tracking
 */
export interface DevicePrivacySettings {
  anonymizeIpAddresses: boolean; // Strip or hash IP addresses
  limitFingerprinting: boolean; // Reduce device fingerprint detail
  autoExpireSessions: boolean; // Auto-expire inactive sessions
  sessionTimeoutMinutes: number; // Session timeout duration
  requireAuthOnNewDevice: boolean; // Require approval for new devices
  enableLocationTracking: boolean; // Allow approximate location tracking
  logActivityHistory: boolean; // Keep device activity logs
}

/**
 * Encrypted key storage with WebAuthn protection
 */
export interface ProtectedKeyStorage {
  id: string; // Storage entry ID
  encryptedKey: string; // Encrypted private key (base64)
  salt: string; // Encryption salt (base64)
  iv: string; // Initialization vector (base64)
  webAuthnProtected: boolean; // Is this protected by WebAuthn?
  credentialId?: string; // Associated WebAuthn credential
  deviceId: string; // Device that created this storage
  createdAt: number; // Unix timestamp
  lastAccessed?: number; // Unix timestamp
  accessCount: number; // Number of times accessed
  rotatedAt?: number; // Key rotation timestamp
  rotatedFrom?: string; // Previous storage ID (if rotated)
  upgradedAt?: number; // WebAuthn upgrade timestamp
  upgradedFrom?: string; // Previous storage ID (if upgraded)
}

/**
 * Key backup with WebAuthn verification
 */
export interface KeyBackup {
  id: string;
  encryptedBackup: string; // Encrypted backup data (base64)
  backupType: 'recovery' | 'export' | 'migration';
  createdAt: number; // Unix timestamp
  createdBy: string; // Device ID that created backup
  requiresWebAuthn: boolean; // Requires WebAuthn to restore
  credentialId?: string; // Required credential for restoration
  metadata?: {
    version: number;
    format: string;
    checksum: string; // Backup integrity checksum
  };
}

/**
 * Key rotation request
 */
export interface KeyRotationRequest {
  id: string;
  oldKeyId: string; // Previous key identifier
  newKeyId: string; // New key identifier
  initiatedAt: number; // Unix timestamp
  completedAt?: number; // Unix timestamp when completed
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reEncryptionProgress?: {
    total: number; // Total items to re-encrypt
    completed: number; // Items re-encrypted
    failed: number; // Items that failed
  };
  error?: string; // Error message if failed
}

/**
 * Device manager state
 */
export interface DeviceManagerState {
  devices: Map<string, DeviceInfo>;
  sessions: Map<string, DeviceSession>;
  activities: DeviceActivity[];
  credentials: Map<string, WebAuthnCredential>;
  authorizationRequests: Map<string, DeviceAuthorizationRequest>;
  currentDeviceId: string | null;
  privacySettings: DevicePrivacySettings;
  isWebAuthnSupported: boolean;
}

/**
 * Device fingerprint parameters
 */
export interface DeviceFingerprintParams {
  includeScreen?: boolean;
  includeTimezone?: boolean;
  includeLanguage?: boolean;
  includeCanvas?: boolean; // Canvas fingerprinting (privacy concern)
  includeWebGL?: boolean; // WebGL fingerprinting (privacy concern)
}

/**
 * Device fingerprint result
 */
export interface DeviceFingerprint {
  hash: string; // Fingerprint hash
  confidence: number; // Confidence score (0-1)
  components: Record<string, string | number | boolean>;
}
