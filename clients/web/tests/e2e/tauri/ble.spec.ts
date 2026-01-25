/**
 * Tauri App E2E Tests - BLE Mock Tests
 *
 * Tests Bluetooth Low Energy functionality using mocked Tauri commands.
 * No actual BLE hardware is required.
 */

import { test, expect } from '@playwright/test';
import {
  initializeTauriMocks,
  setupTauriMocks,
  clearTauriMocks,
  getTauriMockState,
  simulateBleDeviceDiscovery,
  simulateBleConnectionChange,
  simulateBleMessage,
  type DiscoveredDevice,
} from './utils/tauri-mocks';
import {
  waitForAppReady,
  clearStorageAndReload,
  createIdentity,
  assertBleScanning,
  assertDeviceConnected,
} from './utils/helpers';
import {
  MOCK_BUILDIT_DEVICE,
  MOCK_BUILDIT_DEVICE_2,
  MOCK_OTHER_DEVICE,
  MOCK_UNNAMED_DEVICE,
  MOCK_DEVICES_LIST,
  MOCK_TEXT_MESSAGE,
  TIMEOUTS,
} from './utils/fixtures';

test.describe('Tauri BLE - Scanning', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
    await createIdentity(page, 'BLE Scan User', 'blescanpasswd1');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should start BLE scan via Tauri command', async ({ page }) => {
    // Start scan through mock
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('start_ble_scan', {
        timeout_seconds: 30,
      });
    });

    expect(result.success).toBe(true);

    // Verify scanning state
    await assertBleScanning(page, true);
  });

  test('should stop BLE scan', async ({ page }) => {
    // Start scan first
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('start_ble_scan', {});
    });

    await assertBleScanning(page, true);

    // Stop scan
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('stop_ble_scan');
    });

    expect(result.success).toBe(true);
    await assertBleScanning(page, false);
  });

  test('should prevent duplicate scan start', async ({ page }) => {
    // Start scan
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('start_ble_scan', {});
    });

    // Try to start again - should succeed (idempotent)
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('start_ble_scan', {});
    });

    // Mock returns success for duplicate start (idempotent)
    expect(result.success).toBe(true);
  });

  test('should handle scan timeout', async ({ page }) => {
    // Start scan with short timeout
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('start_ble_scan', {
        timeout_seconds: 1,
      });
    });

    // Wait for timeout
    await page.waitForTimeout(1500);

    // App should handle timeout gracefully
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Tauri BLE - Device Discovery', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, {
      initialDevices: MOCK_DEVICES_LIST,
    });
    await clearStorageAndReload(page);
    await setupTauriMocks(page, {
      initialDevices: MOCK_DEVICES_LIST,
    });
    await createIdentity(page, 'BLE Discovery User', 'blediscoverpass');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should retrieve discovered devices', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: DiscoveredDevice[] }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_discovered_devices');
    });

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(4); // All mock devices
  });

  test('should identify BuildIt devices', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: DiscoveredDevice[] }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_discovered_devices');
    });

    const builditDevices = result.data?.filter((d: DiscoveredDevice) => d.is_buildit_device);
    expect(builditDevices?.length).toBe(2); // Two BuildIt devices
  });

  test('should simulate device discovery event', async ({ page }) => {
    // Start with empty devices
    await setupTauriMocks(page, { initialDevices: [] });

    // Get initial count
    const initialResult = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: DiscoveredDevice[] }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_discovered_devices');
    });

    expect(initialResult.data?.length).toBe(0);

    // Simulate discovery
    await simulateBleDeviceDiscovery(page, [MOCK_BUILDIT_DEVICE]);

    // Check updated list
    const afterResult = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: DiscoveredDevice[] }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_discovered_devices');
    });

    expect(afterResult.data?.length).toBe(1);
  });

  test('should handle device with no name', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: DiscoveredDevice[] }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_discovered_devices');
    });

    const unnamedDevice = result.data?.find((d: DiscoveredDevice) => d.name === null);
    expect(unnamedDevice).toBeDefined();
    expect(unnamedDevice?.address).toBe(MOCK_UNNAMED_DEVICE.address);
  });

  test('should include RSSI signal strength', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: DiscoveredDevice[] }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_discovered_devices');
    });

    const deviceWithRssi = result.data?.find(
      (d: DiscoveredDevice) => d.address === MOCK_BUILDIT_DEVICE.address
    );
    expect(deviceWithRssi?.rssi).toBe(-45);
  });
});

test.describe('Tauri BLE - Connection', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, {
      initialDevices: [MOCK_BUILDIT_DEVICE],
    });
    await clearStorageAndReload(page);
    await setupTauriMocks(page, {
      initialDevices: [MOCK_BUILDIT_DEVICE],
    });
    await createIdentity(page, 'BLE Connect User', 'bleconnectpass');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should connect to device', async ({ page }) => {
    const result = await page.evaluate(
      async (address) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('connect_device', { address });
      },
      MOCK_BUILDIT_DEVICE.address
    );

    expect(result.success).toBe(true);
    await assertDeviceConnected(page, MOCK_BUILDIT_DEVICE.address);
  });

  test('should disconnect from device', async ({ page }) => {
    // Connect first
    await page.evaluate(
      async (address) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
        await internals.invoke('connect_device', { address });
      },
      MOCK_BUILDIT_DEVICE.address
    );

    await assertDeviceConnected(page, MOCK_BUILDIT_DEVICE.address);

    // Disconnect
    const result = await page.evaluate(
      async (address) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('disconnect_device', { address });
      },
      MOCK_BUILDIT_DEVICE.address
    );

    expect(result.success).toBe(true);

    // Verify disconnected
    const mockState = await getTauriMockState(page);
    expect(mockState?.ble.connectedDevices).not.toContain(
      MOCK_BUILDIT_DEVICE.address
    );
  });

  test('should handle connection to unknown device', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; error: string | null }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('connect_device', {
        address: 'XX:XX:XX:XX:XX:XX',
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('should simulate connection change event', async ({ page }) => {
    // Set up event listener
    await page.evaluate(() => {
      (window as unknown as { __CONNECTION_EVENTS__: unknown[] }).__CONNECTION_EVENTS__ = [];
      window.addEventListener('tauri://ble-event', (event) => {
        const detail = (event as CustomEvent).detail;
        if (detail.type === 'connection_changed') {
          (window as unknown as { __CONNECTION_EVENTS__: unknown[] }).__CONNECTION_EVENTS__.push(detail);
        }
      });
    });

    // Simulate connection
    await simulateBleConnectionChange(page, MOCK_BUILDIT_DEVICE.address, true);

    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    const events = await page.evaluate(() => {
      return (window as unknown as { __CONNECTION_EVENTS__: unknown[] }).__CONNECTION_EVENTS__;
    });

    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
      type: 'connection_changed',
      address: MOCK_BUILDIT_DEVICE.address,
      status: 'Connected',
    });
  });

  test('should manage multiple connections', async ({ page }) => {
    // Set up both devices
    await setupTauriMocks(page, {
      initialDevices: [MOCK_BUILDIT_DEVICE, MOCK_BUILDIT_DEVICE_2],
    });

    // Connect to both
    await page.evaluate(
      async (addresses) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
        for (const address of addresses) {
          await internals.invoke('connect_device', { address });
        }
      },
      [MOCK_BUILDIT_DEVICE.address, MOCK_BUILDIT_DEVICE_2.address]
    );

    const mockState = await getTauriMockState(page);
    expect(mockState?.ble.connectedDevices.length).toBe(2);
  });
});

test.describe('Tauri BLE - Status', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, {
      initialDevices: [MOCK_BUILDIT_DEVICE],
    });
    await clearStorageAndReload(page);
    await setupTauriMocks(page, {
      initialDevices: [MOCK_BUILDIT_DEVICE],
    });
    await createIdentity(page, 'BLE Status User', 'blestatuspassw');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should get BLE status', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: { is_scanning: boolean; connected_devices: string[]; discovered_count: number } }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_ble_status');
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('is_scanning');
    expect(result.data).toHaveProperty('connected_devices');
    expect(result.data).toHaveProperty('discovered_count');
  });

  test('should reflect scanning state in status', async ({ page }) => {
    // Start scanning
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('start_ble_scan', {});
    });

    const scanningStatus = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: { is_scanning: boolean } }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_ble_status');
    });

    expect(scanningStatus.data.is_scanning).toBe(true);

    // Stop scanning
    await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
      await internals.invoke('stop_ble_scan');
    });

    const notScanningStatus = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: { is_scanning: boolean } }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_ble_status');
    });

    expect(notScanningStatus.data.is_scanning).toBe(false);
  });

  test('should reflect connected devices in status', async ({ page }) => {
    // Connect device
    await page.evaluate(
      async (address) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<void> } }).__TAURI_INTERNALS__;
        await internals.invoke('connect_device', { address });
      },
      MOCK_BUILDIT_DEVICE.address
    );

    const status = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ data: { connected_devices: string[] } }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('get_ble_status');
    });

    expect(status.data.connected_devices).toContain(MOCK_BUILDIT_DEVICE.address);
  });
});

test.describe('Tauri BLE - Message Handling', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, {
      initialDevices: [MOCK_BUILDIT_DEVICE],
    });
    await clearStorageAndReload(page);
    await setupTauriMocks(page, {
      initialDevices: [MOCK_BUILDIT_DEVICE],
    });
    await createIdentity(page, 'BLE Message User', 'blemessagepass1');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should send mesh message to device', async ({ page }) => {
    // Connect first
    await simulateBleConnectionChange(page, MOCK_BUILDIT_DEVICE.address, true);

    const result = await page.evaluate(
      async ({ address, data }) => {
        const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: number }> } }).__TAURI_INTERNALS__;
        return await internals.invoke('send_mesh_message', { address, data });
      },
      { address: MOCK_BUILDIT_DEVICE.address, data: MOCK_TEXT_MESSAGE.bytes }
    );

    expect(result.success).toBe(true);
    expect(result.data).toBe(1);
  });

  test('should receive mesh message event', async ({ page }) => {
    await simulateBleConnectionChange(page, MOCK_BUILDIT_DEVICE.address, true);

    // Set up listener
    await page.evaluate(() => {
      (window as unknown as { __MESSAGES__: unknown[] }).__MESSAGES__ = [];
      window.addEventListener('tauri://ble-event', (event) => {
        const detail = (event as CustomEvent).detail;
        if (detail.type === 'message_received') {
          (window as unknown as { __MESSAGES__: unknown[] }).__MESSAGES__.push(detail);
        }
      });
    });

    // Simulate message
    await simulateBleMessage(page, MOCK_BUILDIT_DEVICE.address, MOCK_TEXT_MESSAGE.bytes);

    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    const messages = await page.evaluate(() => {
      return (window as unknown as { __MESSAGES__: unknown[] }).__MESSAGES__;
    });

    expect(messages.length).toBe(1);
    expect(messages[0]).toMatchObject({
      type: 'message_received',
      from_address: MOCK_BUILDIT_DEVICE.address,
      data: MOCK_TEXT_MESSAGE.bytes,
    });
  });

  test('should broadcast message to all devices', async ({ page }) => {
    // Connect multiple devices
    await setupTauriMocks(page, {
      initialDevices: [MOCK_BUILDIT_DEVICE, MOCK_BUILDIT_DEVICE_2],
    });

    await simulateBleConnectionChange(page, MOCK_BUILDIT_DEVICE.address, true);
    await simulateBleConnectionChange(page, MOCK_BUILDIT_DEVICE_2.address, true);

    const result = await page.evaluate(async (data) => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; data: number }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('send_mesh_message', {
        address: null, // Broadcast
        data,
      });
    }, MOCK_TEXT_MESSAGE.bytes);

    expect(result.success).toBe(true);
    expect(result.data).toBe(2); // Sent to both devices
  });
});

test.describe('Tauri BLE - Error Handling', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
    await createIdentity(page, 'BLE Error User', 'bleerrorpasswd');
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should handle stop scan when not scanning', async ({ page }) => {
    // Try to stop without starting
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; error: string | null }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('stop_ble_scan');
    });

    // Mock returns error for this case
    expect(result.success).toBe(false);
  });

  test('should handle disconnect from non-connected device', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; error: string | null }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('disconnect_device', {
        address: 'not-connected-device',
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('should handle missing address in connect', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<{ success: boolean; error: string | null }> } }).__TAURI_INTERNALS__;
      return await internals.invoke('connect_device', {});
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });
});
