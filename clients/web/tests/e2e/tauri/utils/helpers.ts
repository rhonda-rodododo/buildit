/**
 * Common Test Helpers for Tauri E2E Tests
 *
 * Provides utility functions for common testing operations.
 */

import { Page, expect, BrowserContext } from '@playwright/test';
import { setupTauriMocks, initializeTauriMocks } from './tauri-mocks';
import { TEST_USERS, TIMEOUTS, SELECTORS, MOCK_DEVICES_LIST } from './fixtures';
import type { DiscoveredDevice } from './tauri-mocks';

// ============================================================================
// Page Setup Helpers
// ============================================================================

/**
 * Initialize a fresh page with Tauri mocks
 */
export async function initializeTauriPage(
  page: Page,
  options?: {
    initialDevices?: DiscoveredDevice[];
    mockSecrets?: Record<string, string>;
  }
): Promise<void> {
  // Initialize mocks before navigation
  await initializeTauriMocks(page);

  // Navigate to the app
  await page.goto('/');

  // Setup command mocks
  await setupTauriMocks(page, options);

  // Wait for app to initialize
  await waitForAppReady(page);
}

/**
 * Wait for the app to finish initialization
 */
export async function waitForAppReady(page: Page, timeout = TIMEOUTS.APP_INIT): Promise<void> {
  // Wait for either login page or app content
  const loginTab = page.getByRole('tab', { name: /create new/i });
  const appContent = page.locator('[data-testid="app-content"], main').first();

  await expect(loginTab.or(appContent)).toBeVisible({ timeout });
}

/**
 * Clear all storage and reload with fresh state
 */
export async function clearStorageAndReload(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Clear IndexedDB
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.reload();
  await waitForAppReady(page, TIMEOUTS.APP_INIT + 15000); // Extra time for module reinitialization
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Create a new identity
 */
export async function createIdentity(
  page: Page,
  displayName: string,
  password: string
): Promise<void> {
  // Ensure we're on the Create New tab
  const createNewTab = page.getByRole('tab', { name: /create new/i });
  await createNewTab.click();
  await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

  // Get the tabpanel
  const panel = page.getByRole('tabpanel', { name: /create new/i });

  // Fill in the form
  await panel.getByRole('textbox', { name: /display name/i }).fill(displayName);
  await panel.getByRole('textbox', { name: /^password$/i }).fill(password);
  await panel.getByRole('textbox', { name: /confirm password/i }).fill(password);

  // Submit
  await panel.getByRole('button', { name: /create identity/i }).click();

  // Wait for navigation to app
  await page.waitForURL(/\/app/, { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Import an existing identity
 */
export async function importIdentity(
  page: Page,
  nsec: string,
  password: string,
  displayName = 'Imported User'
): Promise<void> {
  // Click Import tab
  const importTab = page.getByRole('tab', { name: /^import$/i });
  await importTab.click();
  await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

  // Get the tabpanel
  const panel = page.getByRole('tabpanel', { name: /import/i });

  // Fill in the form
  await panel.getByRole('textbox', { name: /display name/i }).fill(displayName);
  await panel.getByRole('textbox', { name: /private key/i }).fill(nsec);
  await panel.getByRole('textbox', { name: /^password$/i }).fill(password);
  await panel.getByRole('textbox', { name: /confirm password/i }).fill(password);

  // Submit
  await panel.getByRole('button', { name: /import identity/i }).click();

  // Wait for navigation
  await page.waitForURL(/\/app/, { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Login with a test user profile
 */
export async function loginAsTestUser(
  page: Page,
  userKey: keyof typeof TEST_USERS
): Promise<void> {
  const user = TEST_USERS[userKey];
  await createIdentity(page, user.displayName, user.password);
}

/**
 * Logout from the app
 */
export async function logout(page: Page): Promise<void> {
  const logoutButton = page.getByRole('button', { name: /logout/i });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();

  // Wait for logout to complete
  await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({
    timeout: TIMEOUTS.NAVIGATION,
  });
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigate to a specific page
 */
export async function navigateTo(
  page: Page,
  path: string
): Promise<void> {
  await page.goto(path);
  await waitForAppReady(page);
}

/**
 * Navigate to settings
 */
export async function navigateToSettings(page: Page): Promise<void> {
  const settingsLink = page.getByRole('link', { name: 'Settings' });
  await settingsLink.click();
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to security settings
 */
export async function navigateToSecuritySettings(page: Page): Promise<void> {
  await navigateToSettings(page);
  const securityLink = page.getByRole('link', { name: /security/i });
  if (await securityLink.isVisible({ timeout: 2000 })) {
    await securityLink.click();
    await page.waitForLoadState('networkidle');
  }
}

// ============================================================================
// BLE Testing Helpers
// ============================================================================

/**
 * Wait for BLE panel to be visible
 */
export async function waitForBlePanel(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="ble-panel"]')).toBeVisible({
    timeout: TIMEOUTS.BLE_SCAN,
  });
}

/**
 * Start BLE scan via UI
 */
export async function startBleScan(page: Page): Promise<void> {
  const scanButton = page.getByRole('button', { name: /scan/i });
  await scanButton.click();
  await page.waitForTimeout(TIMEOUTS.UI_UPDATE);
}

/**
 * Stop BLE scan via UI
 */
export async function stopBleScan(page: Page): Promise<void> {
  const stopButton = page.getByRole('button', { name: /stop/i });
  if (await stopButton.isVisible({ timeout: 1000 })) {
    await stopButton.click();
  }
}

/**
 * Get the list of discovered devices from the UI
 */
export async function getDiscoveredDevices(page: Page): Promise<string[]> {
  const deviceItems = page.locator('[data-testid="device-item"]');
  const count = await deviceItems.count();
  const devices: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = await deviceItems.nth(i).textContent();
    if (text) devices.push(text);
  }

  return devices;
}

/**
 * Connect to a device by address
 */
export async function connectToDevice(page: Page, address: string): Promise<void> {
  const deviceItem = page.locator(`[data-testid="device-item"][data-address="${address}"]`);
  const connectButton = deviceItem.getByRole('button', { name: /connect/i });
  await connectButton.click();
  await page.waitForTimeout(TIMEOUTS.UI_UPDATE);
}

// ============================================================================
// Messaging Helpers
// ============================================================================

/**
 * Send a message via the UI
 */
export async function sendMessage(page: Page, message: string): Promise<void> {
  const messageInput = page.locator('[data-testid="message-input"]');
  await messageInput.fill(message);

  const sendButton = page.getByRole('button', { name: /send/i });
  await sendButton.click();
  await page.waitForTimeout(TIMEOUTS.UI_UPDATE);
}

/**
 * Get messages from the message list
 */
export async function getMessages(page: Page): Promise<string[]> {
  const messageItems = page.locator('[data-testid="message-item"]');
  const count = await messageItems.count();
  const messages: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = await messageItems.nth(i).textContent();
    if (text) messages.push(text);
  }

  return messages;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that the user is logged in
 */
export async function assertLoggedIn(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/app/);
}

/**
 * Assert that the user is on the login page
 */
export async function assertOnLoginPage(page: Page): Promise<void> {
  await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible();
}

/**
 * Assert BLE is scanning
 */
export async function assertBleScanning(page: Page, isScanning: boolean): Promise<void> {
  const state = await page.evaluate(() => {
    const mockState = (window as unknown as { __TAURI_MOCK_STATE__?: { ble: { isScanning: boolean } } }).__TAURI_MOCK_STATE__;
    return mockState?.ble.isScanning ?? false;
  });
  expect(state).toBe(isScanning);
}

/**
 * Assert a device is connected
 */
export async function assertDeviceConnected(page: Page, address: string): Promise<void> {
  const connectedDevices = await page.evaluate(() => {
    const mockState = (window as unknown as { __TAURI_MOCK_STATE__?: { ble: { connectedDevices: string[] } } }).__TAURI_MOCK_STATE__;
    return mockState?.ble.connectedDevices ?? [];
  });
  expect(connectedDevices).toContain(address);
}

// ============================================================================
// Screenshot and Debug Helpers
// ============================================================================

/**
 * Take a named screenshot
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `test-results/tauri/screenshots/${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

/**
 * Log the current page state for debugging
 */
export async function logPageState(page: Page): Promise<void> {
  const url = page.url();
  const title = await page.title();
  const mockState = await page.evaluate(() => {
    return (window as unknown as { __TAURI_MOCK_STATE__?: unknown }).__TAURI_MOCK_STATE__;
  });

  console.log('=== Page State ===');
  console.log('URL:', url);
  console.log('Title:', title);
  console.log('Mock State:', JSON.stringify(mockState, null, 2));
  console.log('==================');
}

// ============================================================================
// Wait Helpers
// ============================================================================

/**
 * Wait for a specific condition with polling
 */
export async function waitForCondition(
  page: Page,
  condition: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await page.waitForTimeout(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, text?: string): Promise<void> {
  const toastLocator = text
    ? page.locator('[data-sonner-toast]').filter({ hasText: text })
    : page.locator('[data-sonner-toast]');

  await expect(toastLocator.first()).toBeVisible({ timeout: TIMEOUTS.UI_UPDATE * 2 });
}
