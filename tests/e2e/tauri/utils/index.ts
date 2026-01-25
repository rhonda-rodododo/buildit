/**
 * Tauri E2E Test Utilities
 *
 * Centralized exports for all Tauri testing utilities.
 */

// Tauri mock functions
export {
  initializeTauriMocks,
  setupTauriMocks,
  clearTauriMocks,
  getTauriMockState,
  simulateBleDeviceDiscovery,
  simulateBleConnectionChange,
  simulateBleMessage,
  type DiscoveredDevice,
  type BleStatus,
  type CommandResult,
  type KeyPairResponse,
  type SecretType,
  type TauriMockState,
} from './tauri-mocks';

// Test fixtures
export {
  TEST_KEYPAIR,
  TEST_KEYPAIR_ALT,
  TEST_NSEC,
  TEST_NPUB,
  MOCK_BUILDIT_DEVICE,
  MOCK_BUILDIT_DEVICE_2,
  MOCK_OTHER_DEVICE,
  MOCK_UNNAMED_DEVICE,
  MOCK_DEVICES_LIST,
  MOCK_TEXT_MESSAGE,
  MOCK_ENCRYPTED_MESSAGE,
  MOCK_MESH_HEADER,
  MOCK_KEYRING_SECRETS,
  TEST_USERS,
  DEFAULT_WINDOW_CONFIG,
  TIMEOUTS,
  SELECTORS,
  type TestUserProfile,
} from './fixtures';

// Test helpers
export {
  initializeTauriPage,
  waitForAppReady,
  clearStorageAndReload,
  createIdentity,
  importIdentity,
  loginAsTestUser,
  logout,
  navigateTo,
  navigateToSettings,
  navigateToSecuritySettings,
  waitForBlePanel,
  startBleScan,
  stopBleScan,
  getDiscoveredDevices,
  connectToDevice,
  sendMessage,
  getMessages,
  assertLoggedIn,
  assertOnLoginPage,
  assertBleScanning,
  assertDeviceConnected,
  takeScreenshot,
  logPageState,
  waitForCondition,
  waitForToast,
} from './helpers';

// Crypto test vectors
export {
  ALICE_KEYPAIR,
  BOB_KEYPAIR,
  CHARLIE_KEYPAIR,
  RANDOM_KEYPAIR_1,
} from './crypto-test-vectors';

// Mock BLE responses
export {
  BUILDIT_NODE_PRIMARY,
  BUILDIT_NODE_SECONDARY,
  BUILDIT_NODE_RELAY,
} from './mock-ble-responses';
