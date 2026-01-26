/**
 * TypeScript types for Tauri integration layer
 * Provides type-safe interfaces for Tauri APIs with graceful browser fallbacks
 */

/**
 * Platform detection result
 */
export interface PlatformInfo {
  /** Whether running in Tauri desktop app */
  isTauri: boolean;
  /** Operating system: 'macos' | 'windows' | 'linux' | 'browser' */
  os: 'macos' | 'windows' | 'linux' | 'browser';
  /** Platform-specific modifier key name */
  modifierKey: 'Cmd' | 'Ctrl';
  /** Platform-specific modifier symbol */
  modifierSymbol: '⌘' | 'Ctrl';
}

/**
 * Tauri event payload types
 */
export interface TauriEventPayloads {
  /** Navigation event from tray or deep link */
  navigate: string;
  /** Tray action event */
  'tray-action': TrayAction;
  /** Status change event */
  'status-change': UserStatus;
  /** Deep link event */
  'deep-link': string;
  /** BLE scan result */
  'ble-scan-result': BLEScanResult;
  /** Window state change */
  'window-state': WindowState;
}

/**
 * Tray menu actions
 */
export type TrayAction =
  | 'show-window'
  | 'hide-window'
  | 'toggle-window'
  | 'open-settings'
  | 'start-ble-scan'
  | 'stop-ble-scan'
  | 'quit';

/**
 * User online status
 */
export type UserStatus = 'online' | 'away' | 'busy' | 'invisible';

/**
 * BLE scan result from Tauri backend
 */
export interface BLEScanResult {
  deviceId: string;
  name: string | null;
  rssi: number;
  services: string[];
}

/**
 * Window state information
 */
export interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  isFocused: boolean;
  isVisible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * Window creation options for multi-window support
 */
export interface WindowOptions {
  /** Window label (unique identifier) */
  label: string;
  /** URL to load in the window */
  url: string;
  /** Window title */
  title?: string;
  /** Window width in pixels */
  width?: number;
  /** Window height in pixels */
  height?: number;
  /** Minimum width */
  minWidth?: number;
  /** Minimum height */
  minHeight?: number;
  /** Whether window is resizable */
  resizable?: boolean;
  /** Whether to center window on screen */
  center?: boolean;
  /** X position */
  x?: number;
  /** Y position */
  y?: number;
  /** Whether window should be always on top */
  alwaysOnTop?: boolean;
  /** Whether to focus window on creation */
  focus?: boolean;
}

/**
 * Notification options
 */
export interface NotificationOptions {
  /** Notification title */
  title: string;
  /** Notification body text */
  body?: string;
  /** Icon path or name */
  icon?: string;
  /** Sound to play */
  sound?: string;
  /** Action identifier for click handling */
  actionId?: string;
}

/**
 * Notification permission state
 */
export type NotificationPermission = 'granted' | 'denied' | 'default';

/**
 * Result of opening external URL
 */
export interface OpenResult {
  success: boolean;
  error?: string;
}

/**
 * Tauri capability flags
 */
export interface TauriCapabilities {
  shell: boolean;
  dialog: boolean;
  fs: boolean;
  notification: boolean;
  deepLink: boolean;
  tray: boolean;
  ble: boolean;
  keyring: boolean;
}

/**
 * Event unsubscribe function
 */
export type UnlistenFn = () => void;

/**
 * Event listener callback
 */
export type EventCallback<T> = (payload: T) => void;

// =============================================================================
// Crypto Command Types
// =============================================================================

/**
 * Generic command result from Tauri backend
 */
export interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Keypair response from generate_keypair
 */
export interface KeyPairResponse {
  private_key: string; // hex-encoded
  public_key: string; // hex-encoded (64 chars, x-only)
}

/**
 * Secret types for keyring storage
 */
export type SecretType =
  | 'nostr_private_key'
  | 'master_key'
  | 'database_key'
  | 'api_token'
  | { custom: string };

/**
 * AES encryption response
 */
export interface AesEncryptResponse {
  ciphertext_hex: string;
  nonce_hex: string;
}

/**
 * Duress password check result
 */
export interface DuressCheckResponse {
  is_duress: boolean;
  password_valid: boolean;
}

/**
 * Decoy identity for duress mode
 */
export interface DecoyIdentityResponse {
  private_key: string; // hex-encoded
  public_key: string; // hex-encoded
  display_name: string;
  about: string;
  created_at: number;
}

/**
 * Decoy contact for duress mode
 */
export interface DecoyContactResponse {
  pubkey: string;
  display_name: string;
}

/**
 * Duress alert configuration
 */
export interface DuressAlertConfig {
  trusted_contact_pubkeys: string[];
  include_location: boolean;
  custom_message?: string;
}

/**
 * Unsigned Nostr event (for signing)
 */
export interface UnsignedNostrEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

/**
 * Signed Nostr event
 */
export interface NostrEvent extends UnsignedNostrEvent {
  id: string;
  sig: string;
}

/**
 * NIP-17 unwrap result
 */
export interface UnwrapResponse {
  rumor: NostrEvent;
  sender_pubkey: string;
  seal_verified: boolean;
}

// =============================================================================
// Crypto Command Signatures (for invoke())
// =============================================================================

/**
 * All Tauri crypto commands available via invoke()
 *
 * @example
 * ```typescript
 * import { invoke } from '@tauri-apps/api/core';
 *
 * // Generate keypair
 * const result = await invoke<CommandResult<KeyPairResponse>>('generate_keypair');
 *
 * // Derive master key from password
 * const masterKey = await invoke<CommandResult<string>>('derive_master_key', {
 *   password: 'user_password',
 *   salt_hex: saltHex,
 * });
 *
 * // Encrypt with NIP-44
 * const ciphertext = await invoke<CommandResult<string>>('encrypt_nip44', {
 *   conversation_key_hex: keyHex,
 *   plaintext: 'Hello, World!',
 * });
 * ```
 */
export interface TauriCryptoCommands {
  // Keyring
  store_secret: (args: {
    user: string;
    secret_type: SecretType;
    value: string;
    label?: string;
  }) => Promise<CommandResult<void>>;
  retrieve_secret: (args: { user: string; secret_type: SecretType }) => Promise<CommandResult<string>>;
  delete_secret: (args: { user: string; secret_type: SecretType }) => Promise<CommandResult<void>>;
  has_secret: (args: { user: string; secret_type: SecretType }) => Promise<CommandResult<boolean>>;

  // Key generation
  generate_keypair: () => Promise<CommandResult<KeyPairResponse>>;
  get_public_key_from_private: (args: { private_key_hex: string }) => Promise<CommandResult<string>>;

  // NIP-44 encryption
  encrypt_nip44: (args: { conversation_key_hex: string; plaintext: string }) => Promise<CommandResult<string>>;
  decrypt_nip44: (args: { conversation_key_hex: string; ciphertext: string }) => Promise<CommandResult<string>>;
  derive_conversation_key: (args: {
    private_key_hex: string;
    recipient_pubkey_hex: string;
  }) => Promise<CommandResult<string>>;

  // Key derivation (Argon2id)
  derive_master_key: (args: { password: string; salt_hex: string }) => Promise<CommandResult<string>>;
  derive_database_key: (args: { master_key_hex: string }) => Promise<CommandResult<string>>;

  // AES-256-GCM
  aes_encrypt: (args: { key_hex: string; plaintext_hex: string }) => Promise<CommandResult<AesEncryptResponse>>;
  aes_decrypt: (args: {
    key_hex: string;
    ciphertext_hex: string;
    nonce_hex: string;
  }) => Promise<CommandResult<string>>;

  // Schnorr signatures
  schnorr_sign: (args: { message_hex: string; private_key_hex: string }) => Promise<CommandResult<string>>;
  schnorr_verify: (args: {
    message_hex: string;
    signature_hex: string;
    public_key_hex: string;
  }) => Promise<CommandResult<boolean>>;
  compute_event_id: (args: { event: UnsignedNostrEvent }) => Promise<CommandResult<string>>;

  // Duress system
  hash_duress_password: (args: { password: string; salt_hex: string }) => Promise<CommandResult<string>>;
  check_duress_password: (args: {
    entered_password: string;
    salt_hex: string;
    stored_duress_hash_hex: string;
    stored_normal_hash_hex: string;
  }) => Promise<CommandResult<DuressCheckResponse>>;
  validate_duress_password: (args: {
    duress_password: string;
    normal_password: string;
  }) => Promise<CommandResult<boolean>>;
  generate_decoy_identity: () => Promise<CommandResult<DecoyIdentityResponse>>;
  generate_decoy_contacts: (args: { count: number }) => Promise<CommandResult<DecoyContactResponse[]>>;
  generate_decoy_messages: () => Promise<CommandResult<string[]>>;
  create_duress_alert: (args: {
    sender_private_key_hex: string;
    recipient_pubkey: string;
    custom_message?: string;
  }) => Promise<CommandResult<NostrEvent>>;
  create_duress_alerts: (args: {
    sender_private_key_hex: string;
    config: DuressAlertConfig;
  }) => Promise<CommandResult<NostrEvent[]>>;
  secure_destroy_key: (args: { key_hex: string }) => Promise<CommandResult<void>>;

  // Utilities
  generate_salt: (args: { length: number }) => Promise<CommandResult<string>>;
  randomize_timestamp: (args: { timestamp: number; range_seconds: number }) => Promise<CommandResult<number>>;

  // Nostr events
  sign_nostr_event: (args: {
    private_key_hex: string;
    event: UnsignedNostrEvent;
  }) => Promise<CommandResult<NostrEvent>>;
  verify_nostr_event: (args: { event: NostrEvent }) => Promise<CommandResult<boolean>>;
  gift_wrap_message: (args: {
    sender_private_key_hex: string;
    recipient_pubkey: string;
    content: string;
  }) => Promise<CommandResult<NostrEvent>>;
  unwrap_gift_message: (args: {
    recipient_private_key_hex: string;
    gift_wrap: NostrEvent;
  }) => Promise<CommandResult<UnwrapResponse>>;
}
