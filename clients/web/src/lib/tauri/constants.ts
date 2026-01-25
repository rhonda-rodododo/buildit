/**
 * Constants for Tauri integration layer
 */

import type { TauriCapabilities } from './types';

/**
 * Default Tauri capabilities based on capabilities/default.json
 * These are the permissions configured in the Tauri app
 */
export const TAURI_CAPABILITIES: TauriCapabilities = {
  shell: true,      // shell:allow-open
  dialog: true,     // dialog:allow-open, save, message, ask, confirm
  fs: true,         // fs:allow-read-text-file, write-text-file, exists, mkdir
  notification: true, // notification:allow-is-permission-granted, request-permission, notify
  deepLink: true,   // deep-link:allow-get-current, on-open-url
  tray: true,       // Tray icon configured in tauri.conf.json
  ble: true,        // btleplug in Cargo.toml
  keyring: true,    // keyring crate in Cargo.toml
};

/**
 * Deep link scheme for the app
 */
export const DEEP_LINK_SCHEME = 'buildit';

/**
 * Default window dimensions
 */
export const DEFAULT_WINDOW_DIMENSIONS = {
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
} as const;

/**
 * File preview window dimensions
 */
export const FILE_PREVIEW_WINDOW_DIMENSIONS = {
  width: 900,
  height: 700,
  minWidth: 600,
  minHeight: 400,
} as const;

/**
 * Keyboard shortcut modifier by platform
 */
export const MODIFIER_BY_PLATFORM = {
  macos: { key: 'Cmd', symbol: '⌘' },
  windows: { key: 'Ctrl', symbol: 'Ctrl' },
  linux: { key: 'Ctrl', symbol: 'Ctrl' },
  browser: { key: 'Ctrl', symbol: 'Ctrl' },
} as const;

/**
 * Tauri event names used for frontend-backend communication
 */
export const TAURI_EVENTS = {
  NAVIGATE: 'navigate',
  TRAY_ACTION: 'tray-action',
  STATUS_CHANGE: 'status-change',
  DEEP_LINK: 'deep-link',
  BLE_SCAN_RESULT: 'ble-scan-result',
  WINDOW_STATE: 'window-state',
} as const;

/**
 * Storage keys for persisting Tauri-related state
 */
export const TAURI_STORAGE_KEYS = {
  WINDOW_STATE: 'tauri:window-state',
  NOTIFICATION_PERMISSION: 'tauri:notification-permission',
  USER_STATUS: 'tauri:user-status',
} as const;

/**
 * Tauri command names exposed from Rust backend
 */
export const TAURI_COMMANDS = {
  // BLE commands
  BLE_START_SCAN: 'ble_start_scan',
  BLE_STOP_SCAN: 'ble_stop_scan',
  BLE_CONNECT: 'ble_connect',
  BLE_DISCONNECT: 'ble_disconnect',
  BLE_SEND: 'ble_send',

  // Keyring commands
  KEYRING_GET: 'keyring_get',
  KEYRING_SET: 'keyring_set',
  KEYRING_DELETE: 'keyring_delete',

  // Crypto commands
  CRYPTO_GENERATE_KEYPAIR: 'crypto_generate_keypair',
  CRYPTO_SIGN: 'crypto_sign',
  CRYPTO_VERIFY: 'crypto_verify',
  CRYPTO_ENCRYPT: 'crypto_encrypt',
  CRYPTO_DECRYPT: 'crypto_decrypt',
} as const;
