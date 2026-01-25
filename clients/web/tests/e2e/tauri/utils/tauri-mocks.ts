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
            if (!mockState.ble.isScanning) {
              return err('Scan not in progress');
            }
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
            if (!address) {
              return err('Address required');
            }
            // Check if device is actually connected
            if (!mockState.ble.connectedDevices.includes(address)) {
              return err(`Device not found: ${address}`);
            }
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
            // If targeting a specific address, verify it's connected
            if (address) {
              if (!mockState.ble.connectedDevices.includes(address)) {
                return err(`Device not connected: ${address}`);
              }
              return ok(1);
            }
            // Broadcast to all connected devices
            return ok(mockState.ble.connectedDevices.length);
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
            // Check for undefined specifically, not falsy (empty string is valid)
            if (value === undefined) {
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
            // Generate unique random keypairs each time
            const randomHex = (len: number) => {
              const chars = '0123456789abcdef';
              let result = '';
              for (let i = 0; i < len; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
              }
              return result;
            };
            const keypair = {
              private_key: randomHex(64),
              public_key: randomHex(64),
            };
            mockState.crypto.generatedKeypairs.push(keypair);
            return ok(keypair);
          }

          case 'encrypt_nip44': {
            // Support both naming conventions: conversation_key and conversation_key_hex
            const conversationKey = (args?.conversation_key ?? args?.conversation_key_hex) as string;
            const plaintext = args?.plaintext as string;

            // Validate conversation key
            if (!conversationKey || conversationKey.length !== 64) {
              return err('Invalid conversation key length');
            }
            if (!/^[0-9a-fA-F]+$/.test(conversationKey)) {
              return err('Invalid conversation key format');
            }

            // Simulate nonce randomization - prefix with random bytes
            // Include a simple key hash so decryption with wrong key fails
            const randomNonce = Math.random().toString(36).substring(2, 10);
            const keyHash = conversationKey.slice(0, 8); // Simple key fingerprint
            const ciphertext = randomNonce + ':' + keyHash + ':' + btoa(plaintext);
            return ok(ciphertext);
          }

          case 'decrypt_nip44': {
            // Support both naming conventions: conversation_key and conversation_key_hex
            const conversationKey = (args?.conversation_key ?? args?.conversation_key_hex) as string;
            const ciphertext = args?.ciphertext as string;

            // Validate conversation key
            if (!conversationKey || conversationKey.length !== 64) {
              return err('Invalid conversation key length');
            }
            if (!/^[0-9a-fA-F]+$/.test(conversationKey)) {
              return err('Invalid conversation key format');
            }

            // Validate ciphertext
            if (!ciphertext || ciphertext.length === 0) {
              return err('Decryption failed: empty ciphertext');
            }

            try {
              // Handle our mock ciphertext format (nonce:keyHash:base64)
              const parts = ciphertext.split(':');
              if (parts.length !== 3) {
                return err('Decryption failed: invalid ciphertext format');
              }

              const [, keyHash, b64Content] = parts;

              // Verify key hash matches (simulates key verification)
              const expectedKeyHash = conversationKey.slice(0, 8);
              if (keyHash !== expectedKeyHash) {
                return err('Decryption failed: wrong key');
              }

              const plaintext = atob(b64Content);
              return ok(plaintext);
            } catch {
              return err('Decryption failed: invalid base64');
            }
          }

          case 'derive_conversation_key': {
            // Support both naming conventions
            const privateKey = (args?.private_key ?? args?.private_key_hex) as string;
            const publicKey = (args?.public_key ?? args?.recipient_pubkey_hex) as string;

            // Validate inputs
            if (!privateKey || privateKey.length !== 64) {
              return err('Invalid private key length');
            }
            if (!/^[0-9a-fA-F]+$/.test(privateKey)) {
              return err('Invalid private key format');
            }
            if (!publicKey || publicKey.length !== 64) {
              return err('Invalid public key length');
            }
            if (!/^[0-9a-fA-F]+$/.test(publicKey)) {
              return err('Invalid public key format');
            }

            // Known keypair mapping for test vectors (simulates ECDH symmetry)
            // Maps private key -> corresponding public key
            const knownKeypairs: Record<string, string> = {
              '67dde7da0c07cb67af5045bf4f5d7d3537aaaf8405b0b6cf965d272d6c934ff4':
                '9c87e5c0c6b7f4e5c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4', // RANDOM_KEYPAIR_1
              'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2':
                '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b', // RANDOM_KEYPAIR_2
              '0000000000000000000000000000000000000000000000000000000000000001':
                '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', // ALICE
              '0000000000000000000000000000000000000000000000000000000000000002':
                'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5', // BOB
              '0000000000000000000000000000000000000000000000000000000000000003':
                'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9', // CHARLIE
            };

            // Get sender's public key (either from known mapping or use private key as proxy)
            const senderPubKey = knownKeypairs[privateKey] || privateKey;

            // Sort both public keys and XOR them to simulate ECDH (commutative)
            const keys = [senderPubKey, publicKey].sort();
            let result = '';
            for (let i = 0; i < 64; i++) {
              const a = parseInt(keys[0][i], 16);
              const b = parseInt(keys[1][i], 16);
              result += (a ^ b).toString(16);
            }
            return ok(result);
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
