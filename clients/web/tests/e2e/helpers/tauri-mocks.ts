/**
 * Tauri IPC Command Mocks for E2E Testing
 *
 * This module provides mock implementations for Tauri commands that can be
 * injected into the browser context during Playwright tests.
 *
 * @see https://tauri.app/develop/tests/mocking/
 */

import type { Page } from '@playwright/test';

// Types for BLE commands
export interface DiscoveredDevice {
  address: string;
  name: string | null;
  rssi: number | null;
  is_buildit_device: boolean;
  last_seen: number;
}

export interface BleStatus {
  is_scanning: boolean;
  connected_devices: string[];
  discovered_count: number;
}

export interface CommandResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// Types for Crypto commands
export interface KeyPairResponse {
  private_key: string;
  public_key: string;
}

export type SecretType =
  | 'nostr_private_key'
  | 'master_key'
  | 'database_key'
  | 'api_token'
  | { custom: string };

// Mock state interface
export interface TauriMockState {
  ble: {
    isScanning: boolean;
    discoveredDevices: DiscoveredDevice[];
    connectedDevices: string[];
  };
  keyring: {
    secrets: Map<string, string>;
  };
  crypto: {
    generatedKeypairs: KeyPairResponse[];
  };
}

/**
 * Initialize Tauri mocks in the browser context
 * This sets up the __TAURI_INTERNALS__ object that Tauri uses for IPC
 */
export async function initializeTauriMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Initialize Tauri internals mock
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
      invoke: async () => {
        throw new Error('Invoke not mocked - call setupTauriMocks first');
      },
      transformCallback: () => 0,
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main' },
      },
    };
  });
}

/**
 * Setup comprehensive Tauri command mocks for testing
 * Call this after page navigation to inject the mock handlers
 */
export async function setupTauriMocks(
  page: Page,
  options: {
    initialDevices?: DiscoveredDevice[];
    mockSecrets?: Record<string, string>;
    mockKeypair?: KeyPairResponse;
  } = {}
): Promise<void> {
  const {
    initialDevices = [],
    mockSecrets = {},
    mockKeypair = {
      private_key: 'a'.repeat(64), // 32 bytes hex-encoded
      public_key: 'b'.repeat(64),
    },
  } = options;

  await page.evaluate(
    ({ initialDevices, mockSecrets, mockKeypair }) => {
      // Mock state
      const mockState = {
        ble: {
          isScanning: false,
          discoveredDevices: initialDevices,
          connectedDevices: [] as string[],
        },
        keyring: {
          secrets: new Map<string, string>(Object.entries(mockSecrets)),
        },
        crypto: {
          generatedKeypairs: [] as typeof mockKeypair[],
        },
      };

      // Helper to create command result
      const ok = <T>(data: T): { success: true; data: T; error: null } => ({
        success: true,
        data,
        error: null,
      });

      const err = (error: string): { success: false; data: null; error: string } => ({
        success: false,
        data: null,
        error,
      });

      // Build key for keyring operations
      const buildSecretKey = (user: string, secretType: string | { custom: string }) => {
        const suffix = typeof secretType === 'string' ? secretType : secretType.custom;
        return `${user}_${suffix}`;
      };

      // Mock invoke handler
      const mockInvoke = async (cmd: string, args?: Record<string, unknown>) => {
        console.log(`[Tauri Mock] Command: ${cmd}`, args);

        switch (cmd) {
          // BLE Commands
          case 'start_ble_scan': {
            if (mockState.ble.isScanning) {
              return ok(undefined);
            }
            mockState.ble.isScanning = true;
            // Simulate device discovery after a delay
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent('tauri://ble-event', {
                  detail: { type: 'scan_started' },
                })
              );
            }, 100);
            return ok(undefined);
          }

          case 'stop_ble_scan': {
            mockState.ble.isScanning = false;
            return ok(undefined);
          }

          case 'get_discovered_devices': {
            return ok(mockState.ble.discoveredDevices);
          }

          case 'connect_device': {
            const address = args?.address as string;
            if (!address) {
              return err('Address required');
            }
            const device = mockState.ble.discoveredDevices.find(
              (d) => d.address === address
            );
            if (!device) {
              return err(`Device not found: ${address}`);
            }
            mockState.ble.connectedDevices.push(address);
            return ok(undefined);
          }

          case 'disconnect_device': {
            const address = args?.address as string;
            mockState.ble.connectedDevices = mockState.ble.connectedDevices.filter(
              (a) => a !== address
            );
            return ok(undefined);
          }

          case 'send_mesh_message': {
            const address = args?.address as string | undefined;
            const data = args?.data as number[];
            if (!data || data.length === 0) {
              return err('Message data required');
            }
            const count = address ? 1 : mockState.ble.connectedDevices.length;
            return ok(count);
          }

          case 'get_ble_status': {
            return ok({
              is_scanning: mockState.ble.isScanning,
              connected_devices: mockState.ble.connectedDevices,
              discovered_count: mockState.ble.discoveredDevices.length,
            });
          }

          // Crypto/Keyring Commands
          case 'store_secret': {
            const user = args?.user as string;
            const secretType = args?.secret_type as string | { custom: string };
            const value = args?.value as string;
            const key = buildSecretKey(user, secretType);
            mockState.keyring.secrets.set(key, value);
            return ok(undefined);
          }

          case 'retrieve_secret': {
            const user = args?.user as string;
            const secretType = args?.secret_type as string | { custom: string };
            const key = buildSecretKey(user, secretType);
            const value = mockState.keyring.secrets.get(key);
            if (!value) {
              return err(`Secret not found: ${key}`);
            }
            return ok(value);
          }

          case 'delete_secret': {
            const user = args?.user as string;
            const secretType = args?.secret_type as string | { custom: string };
            const key = buildSecretKey(user, secretType);
            mockState.keyring.secrets.delete(key);
            return ok(undefined);
          }

          case 'has_secret': {
            const user = args?.user as string;
            const secretType = args?.secret_type as string | { custom: string };
            const key = buildSecretKey(user, secretType);
            return ok(mockState.keyring.secrets.has(key));
          }

          case 'generate_keypair': {
            const keypair = mockKeypair;
            mockState.crypto.generatedKeypairs.push(keypair);
            return ok(keypair);
          }

          case 'encrypt_nip44': {
            const plaintext = args?.plaintext as string;
            // Simple mock encryption - just base64 encode
            const ciphertext = btoa(plaintext);
            return ok(ciphertext);
          }

          case 'decrypt_nip44': {
            const ciphertext = args?.ciphertext as string;
            try {
              // Simple mock decryption - just base64 decode
              const plaintext = atob(ciphertext);
              return ok(plaintext);
            } catch {
              return err('Decryption failed');
            }
          }

          case 'derive_conversation_key': {
            // Return a mock conversation key
            return ok('c'.repeat(64));
          }

          default:
            console.warn(`[Tauri Mock] Unknown command: ${cmd}`);
            return err(`Unknown command: ${cmd}`);
        }
      };

      // Install the mock
      (window as unknown as { __TAURI_INTERNALS__: { invoke: typeof mockInvoke } }).__TAURI_INTERNALS__ = {
        ...(window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__,
        invoke: mockInvoke,
      };

      // Also expose mock state for test assertions
      (window as unknown as { __TAURI_MOCK_STATE__: typeof mockState }).__TAURI_MOCK_STATE__ = mockState;
    },
    { initialDevices, mockSecrets, mockKeypair }
  );
}

/**
 * Clear all Tauri mocks and reset state
 */
export async function clearTauriMocks(page: Page): Promise<void> {
  await page.evaluate(() => {
    delete (window as unknown as { __TAURI_MOCK_STATE__?: unknown }).__TAURI_MOCK_STATE__;
  });
}

/**
 * Get the current mock state from the page
 */
export async function getTauriMockState(page: Page): Promise<TauriMockState | null> {
  return await page.evaluate(() => {
    const state = (window as unknown as { __TAURI_MOCK_STATE__?: TauriMockState }).__TAURI_MOCK_STATE__;
    if (!state) return null;
    return {
      ble: {
        isScanning: state.ble.isScanning,
        discoveredDevices: state.ble.discoveredDevices,
        connectedDevices: state.ble.connectedDevices,
      },
      keyring: {
        secrets: state.keyring.secrets,
      },
      crypto: {
        generatedKeypairs: state.crypto.generatedKeypairs,
      },
    };
  });
}

/**
 * Simulate BLE device discovery
 */
export async function simulateBleDeviceDiscovery(
  page: Page,
  devices: DiscoveredDevice[]
): Promise<void> {
  await page.evaluate((devices) => {
    const state = (window as unknown as { __TAURI_MOCK_STATE__?: TauriMockState }).__TAURI_MOCK_STATE__;
    if (state) {
      state.ble.discoveredDevices = [
        ...state.ble.discoveredDevices,
        ...devices,
      ];
    }
    // Dispatch event to notify the app
    window.dispatchEvent(
      new CustomEvent('tauri://ble-event', {
        detail: { type: 'devices_discovered', devices },
      })
    );
  }, devices);
}

/**
 * Simulate BLE connection status change
 */
export async function simulateBleConnectionChange(
  page: Page,
  address: string,
  connected: boolean
): Promise<void> {
  await page.evaluate(
    ({ address, connected }) => {
      const state = (window as unknown as { __TAURI_MOCK_STATE__?: TauriMockState }).__TAURI_MOCK_STATE__;
      if (state) {
        if (connected) {
          if (!state.ble.connectedDevices.includes(address)) {
            state.ble.connectedDevices.push(address);
          }
        } else {
          state.ble.connectedDevices = state.ble.connectedDevices.filter(
            (a) => a !== address
          );
        }
      }
      window.dispatchEvent(
        new CustomEvent('tauri://ble-event', {
          detail: {
            type: 'connection_changed',
            address,
            status: connected ? 'Connected' : 'Disconnected',
          },
        })
      );
    },
    { address, connected }
  );
}

/**
 * Simulate receiving a BLE mesh message
 */
export async function simulateBleMessage(
  page: Page,
  fromAddress: string,
  data: number[]
): Promise<void> {
  await page.evaluate(
    ({ fromAddress, data }) => {
      window.dispatchEvent(
        new CustomEvent('tauri://ble-event', {
          detail: {
            type: 'message_received',
            from_address: fromAddress,
            data,
          },
        })
      );
    },
    { fromAddress, data }
  );
}
