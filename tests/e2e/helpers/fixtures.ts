/**
 * Test Fixtures for Tauri E2E Tests
 *
 * Contains mock data, test keys, and other fixtures used across tests.
 */

import type { DiscoveredDevice, KeyPairResponse } from './tauri-mocks';

// ============================================================================
// Test Keys (for testing purposes only - never use in production!)
// ============================================================================

/**
 * Test Nostr keypair
 * Private key: 67dde7da0c07cb67af5045bf4f5d7d3537aaaf8405b0b6cf965d272d6c934ff4
 * Public key: derived from private
 */
export const TEST_KEYPAIR: KeyPairResponse = {
  private_key: '67dde7da0c07cb67af5045bf4f5d7d3537aaaf8405b0b6cf965d272d6c934ff4',
  public_key: '9c87e5c0c6b7f4e5c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4',
};

/**
 * Alternative test keypair for multi-identity tests
 */
export const TEST_KEYPAIR_ALT: KeyPairResponse = {
  private_key: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  public_key: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
};

/**
 * Test nsec (bech32 encoded private key)
 * This is a known test key - DO NOT use in production
 */
export const TEST_NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

/**
 * Test npub (bech32 encoded public key)
 */
export const TEST_NPUB = 'npub1eywu9ut08fkqzs8gw3qc4e4lrh84pjzxp5cfy7vdv3s5dkrdvfes8zqxes';

// ============================================================================
// Mock BLE Devices
// ============================================================================

/**
 * Sample BuildIt device for testing
 */
export const MOCK_BUILDIT_DEVICE: DiscoveredDevice = {
  address: 'AA:BB:CC:DD:EE:01',
  name: 'BuildIt-Node-001',
  rssi: -45,
  is_buildit_device: true,
  last_seen: Date.now(),
};

/**
 * Another BuildIt device
 */
export const MOCK_BUILDIT_DEVICE_2: DiscoveredDevice = {
  address: 'AA:BB:CC:DD:EE:02',
  name: 'BuildIt-Node-002',
  rssi: -55,
  is_buildit_device: true,
  last_seen: Date.now(),
};

/**
 * Non-BuildIt device (generic BLE device)
 */
export const MOCK_OTHER_DEVICE: DiscoveredDevice = {
  address: '11:22:33:44:55:66',
  name: 'Generic BLE Device',
  rssi: -70,
  is_buildit_device: false,
  last_seen: Date.now(),
};

/**
 * Device without name (common for some BLE peripherals)
 */
export const MOCK_UNNAMED_DEVICE: DiscoveredDevice = {
  address: '77:88:99:AA:BB:CC',
  name: null,
  rssi: -80,
  is_buildit_device: false,
  last_seen: Date.now(),
};

/**
 * Collection of test devices for scan simulation
 */
export const MOCK_DEVICES_LIST: DiscoveredDevice[] = [
  MOCK_BUILDIT_DEVICE,
  MOCK_BUILDIT_DEVICE_2,
  MOCK_OTHER_DEVICE,
  MOCK_UNNAMED_DEVICE,
];

// ============================================================================
// Mock Messages
// ============================================================================

/**
 * Sample text message (UTF-8 encoded as bytes)
 */
export const MOCK_TEXT_MESSAGE = {
  text: 'Hello, mesh network!',
  bytes: Array.from(new TextEncoder().encode('Hello, mesh network!')),
};

/**
 * Sample encrypted message payload
 */
export const MOCK_ENCRYPTED_MESSAGE = {
  bytes: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
  description: 'Encrypted NIP-44 payload',
};

/**
 * Sample mesh routing header (TTL=3, hop count=0)
 */
export const MOCK_MESH_HEADER = {
  bytes: [0x42, 0x4e, 0x03, 0x00], // "BN" magic + TTL + hop count
  ttl: 3,
  hopCount: 0,
};

// ============================================================================
// Mock Keyring Data
// ============================================================================

/**
 * Pre-populated keyring secrets for testing
 */
export const MOCK_KEYRING_SECRETS: Record<string, string> = {
  'testuser_nostr_private_key': TEST_KEYPAIR.private_key,
  'testuser_master_key': 'deadbeef'.repeat(8), // 32 bytes hex
  'testuser_database_key': 'cafebabe'.repeat(8),
};

// ============================================================================
// Test User Profiles
// ============================================================================

export interface TestUserProfile {
  displayName: string;
  password: string;
  keypair: KeyPairResponse;
}

export const TEST_USERS: Record<string, TestUserProfile> = {
  alice: {
    displayName: 'Alice Test',
    password: 'alicepassword123',
    keypair: TEST_KEYPAIR,
  },
  bob: {
    displayName: 'Bob Test',
    password: 'bobpassword456',
    keypair: TEST_KEYPAIR_ALT,
  },
};

// ============================================================================
// Window Configuration
// ============================================================================

/**
 * Default Tauri window configuration
 */
export const DEFAULT_WINDOW_CONFIG = {
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
};

// ============================================================================
// Timeout Constants
// ============================================================================

export const TIMEOUTS = {
  /** Time to wait for app initialization */
  APP_INIT: 30000,
  /** Time to wait for navigation */
  NAVIGATION: 10000,
  /** Time for BLE scan operations */
  BLE_SCAN: 5000,
  /** Time for BLE connection */
  BLE_CONNECT: 10000,
  /** Time for crypto operations */
  CRYPTO: 5000,
  /** Short wait for UI updates */
  UI_UPDATE: 500,
  /** Time for keyring operations */
  KEYRING: 3000,
};

// ============================================================================
// Test Selectors
// ============================================================================

/**
 * Common test selectors for the Tauri app
 */
export const SELECTORS = {
  // App structure
  appContent: '[data-testid="app-content"]',
  mainNav: '[data-testid="main-nav"]',
  sidebar: '[data-testid="sidebar"]',

  // Auth
  loginPage: '[data-testid="login-page"]',
  createNewTab: 'role=tab[name=/create new/i]',
  importTab: 'role=tab[name=/^import$/i]',
  displayNameInput: 'role=textbox[name=/display name/i]',
  passwordInput: 'role=textbox[name=/^password$/i]',
  confirmPasswordInput: 'role=textbox[name=/confirm password/i]',
  privateKeyInput: 'role=textbox[name=/private key/i]',
  createIdentityButton: 'role=button[name=/create identity/i]',
  importIdentityButton: 'role=button[name=/import identity/i]',

  // Navigation
  settingsLink: 'role=link[name=Settings]',
  securityLink: 'role=link[name=/security/i]',
  logoutButton: 'role=button[name=/logout/i]',

  // BLE
  blePanel: '[data-testid="ble-panel"]',
  scanButton: 'role=button[name=/scan/i]',
  deviceList: '[data-testid="device-list"]',
  deviceItem: '[data-testid="device-item"]',
  connectButton: 'role=button[name=/connect/i]',
  disconnectButton: 'role=button[name=/disconnect/i]',

  // Messaging
  messageInput: '[data-testid="message-input"]',
  sendButton: 'role=button[name=/send/i]',
  messageList: '[data-testid="message-list"]',
};
