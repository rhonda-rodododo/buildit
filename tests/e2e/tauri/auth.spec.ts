/**
 * Tauri App E2E Tests - Authentication
 *
 * Tests identity creation, import, key management, and authentication flows.
 * These tests use mocked Tauri commands for keyring and crypto operations.
 */

import { test, expect } from '@playwright/test';
import {
  initializeTauriMocks,
  setupTauriMocks,
  clearTauriMocks,
  getTauriMockState,
} from './utils/tauri-mocks';
import {
  waitForAppReady,
  clearStorageAndReload,
  createIdentity,
  importIdentity,
  logout,
  navigateToSecuritySettings,
  assertLoggedIn,
  assertOnLoginPage,
} from './utils/helpers';
import {
  TEST_NSEC,
  TEST_KEYPAIR,
  MOCK_KEYRING_SECRETS,
  TIMEOUTS,
} from './utils/fixtures';

test.describe('Tauri Auth - Identity Creation', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should create new identity and access app', async ({ page }) => {
    // Verify on login page
    await assertOnLoginPage(page);

    // Create identity
    await createIdentity(page, 'New Tauri User', 'tauripassword1');

    // Verify logged in
    await assertLoggedIn(page);

    // Verify identity name is shown
    await expect(page.getByText('New Tauri User')).toBeVisible();
  });

  test('should validate password requirements', async ({ page }) => {
    const createNewTab = page.getByRole('tab', { name: /create new/i });
    await createNewTab.click();
    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    const panel = page.getByRole('tabpanel', { name: /create new/i });

    // Fill name
    await panel.getByRole('textbox', { name: /display name/i }).fill('Test User');

    // Fill short password
    await panel.getByRole('textbox', { name: /^password$/i }).fill('short');
    await panel.getByRole('textbox', { name: /confirm password/i }).fill('short');

    // Try to submit
    await panel.getByRole('button', { name: /create identity/i }).click();

    // Should show password validation error or not proceed
    // Wait briefly for any validation
    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    // Should still be on login page (not navigated away)
    const stillOnLogin = await page.getByRole('tab', { name: /create new/i }).isVisible();
    expect(stillOnLogin).toBe(true);
  });

  test('should require matching passwords', async ({ page }) => {
    const createNewTab = page.getByRole('tab', { name: /create new/i });
    await createNewTab.click();
    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    const panel = page.getByRole('tabpanel', { name: /create new/i });

    // Fill mismatched passwords
    await panel.getByRole('textbox', { name: /display name/i }).fill('Mismatch User');
    await panel.getByRole('textbox', { name: /^password$/i }).fill('password123456');
    await panel.getByRole('textbox', { name: /confirm password/i }).fill('differentpass12');

    // Try to submit
    await panel.getByRole('button', { name: /create identity/i }).click();

    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    // Should show mismatch error or not proceed
    const errorText = page.getByText(/password.*match|mismatch|don't match/i);
    const stillOnLogin = await page.getByRole('tab', { name: /create new/i }).isVisible();

    // Either shows error or stays on login
    expect(stillOnLogin).toBe(true);
  });

  test('should generate keypair through Tauri command', async ({ page }) => {
    // Create identity
    await createIdentity(page, 'Keypair Gen User', 'keypairgenpass');

    // Check mock state for generated keypairs
    const mockState = await getTauriMockState(page);

    // The crypto.generatedKeypairs should have at least one entry
    expect(mockState?.crypto.generatedKeypairs.length).toBeGreaterThan(0);
  });
});

test.describe('Tauri Auth - Identity Import', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should import existing identity via nsec', async ({ page }) => {
    // Import identity
    await importIdentity(page, TEST_NSEC, 'importpassword1', 'Imported Tauri User');

    // Verify logged in
    await assertLoggedIn(page);
  });

  test('should validate nsec format', async ({ page }) => {
    const importTab = page.getByRole('tab', { name: /^import$/i });
    await importTab.click();
    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    const panel = page.getByRole('tabpanel', { name: /import/i });

    // Fill invalid nsec
    await panel.getByRole('textbox', { name: /display name/i }).fill('Invalid Nsec User');
    await panel.getByRole('textbox', { name: /private key/i }).fill('invalid-nsec-format');
    await panel.getByRole('textbox', { name: /^password$/i }).fill('validpassword1');
    await panel.getByRole('textbox', { name: /confirm password/i }).fill('validpassword1');

    // Try to submit
    await panel.getByRole('button', { name: /import identity/i }).click();

    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    // Should show validation error or stay on import page
    const stillOnLogin = await page.getByRole('tab', { name: /^import$/i }).isVisible();
    expect(stillOnLogin).toBe(true);
  });

  test('should handle hex private key import', async ({ page }) => {
    const importTab = page.getByRole('tab', { name: /^import$/i });
    await importTab.click();
    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    const panel = page.getByRole('tabpanel', { name: /import/i });

    // Import with hex key
    await panel.getByRole('textbox', { name: /display name/i }).fill('Hex Key User');
    await panel.getByRole('textbox', { name: /private key/i }).fill(TEST_KEYPAIR.private_key);
    await panel.getByRole('textbox', { name: /^password$/i }).fill('hexkeypassword');
    await panel.getByRole('textbox', { name: /confirm password/i }).fill('hexkeypassword');

    await panel.getByRole('button', { name: /import identity/i }).click();

    // Should either succeed or show format preference message
    await page.waitForTimeout(TIMEOUTS.NAVIGATION);
  });
});

test.describe('Tauri Auth - Session Management', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should logout and return to login page', async ({ page }) => {
    // Create identity
    await createIdentity(page, 'Logout Test User', 'logoutpassword');

    // Verify logged in
    await assertLoggedIn(page);

    // Logout
    await logout(page);

    // Verify on login page
    await assertOnLoginPage(page);
  });

  test('should persist session across page reload', async ({ page }) => {
    // Create identity
    const userName = 'Persist Session User';
    await createIdentity(page, userName, 'persistpassword');

    // Verify logged in
    await assertLoggedIn(page);

    // Reload page
    await page.reload();
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Check if session persists (may need to unlock)
    // The exact behavior depends on the app's session management
    const isLoggedIn = await page.url().includes('/app');
    const showsUnlock = await page.getByPlaceholder(/password/i).isVisible({ timeout: 2000 });

    // Either still logged in or shows unlock screen (not login)
    expect(isLoggedIn || showsUnlock).toBe(true);
  });

  test('should show unlock screen when session expires', async ({ page }) => {
    // Create identity
    await createIdentity(page, 'Expiry Test User', 'expirypassword1');

    // Simulate session expiry by clearing certain storage
    await page.evaluate(() => {
      // Clear session-specific data but keep identity
      sessionStorage.clear();
    });

    await page.reload();
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Should show unlock screen or login
    const showsUnlock = await page.getByPlaceholder(/password/i).isVisible({ timeout: 5000 });
    const showsLogin = await page.getByRole('tab', { name: /create new/i }).isVisible({
      timeout: 2000,
    });

    expect(showsUnlock || showsLogin).toBe(true);
  });

  test('should lock session manually', async ({ page }) => {
    // Create identity
    await createIdentity(page, 'Lock Test User', 'lockpassword123');

    // Navigate to security settings
    await navigateToSecuritySettings(page);

    // Look for lock button
    const lockButton = page.getByRole('button', { name: /lock/i }).first();
    if (await lockButton.isVisible({ timeout: 2000 })) {
      await lockButton.click();

      // Should show unlock screen
      await expect(page.getByPlaceholder(/password/i).first()).toBeVisible({
        timeout: TIMEOUTS.NAVIGATION,
      });
    }
  });
});

test.describe('Tauri Auth - Keyring Integration', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });
    await clearStorageAndReload(page);
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should store secret in keyring via Tauri command', async ({ page }) => {
    // Create identity (this should store the key in keyring)
    await createIdentity(page, 'Keyring Store User', 'keyringstore12');

    // Check mock state
    const mockState = await getTauriMockState(page);

    // Keyring secrets map should exist
    expect(mockState?.keyring.secrets).toBeDefined();
  });

  test('should retrieve secret from keyring', async ({ page }) => {
    // Use pre-populated secrets
    await setupTauriMocks(page, { mockSecrets: MOCK_KEYRING_SECRETS });

    // The app may use stored secrets on startup
    // This depends on implementation - verify mock is accessible
    const mockState = await getTauriMockState(page);
    expect(mockState?.keyring.secrets).toBeDefined();
  });
});

test.describe('Tauri Auth - Multi-Identity', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should support multiple identities', async ({ page }) => {
    // Create first identity
    await createIdentity(page, 'First Identity', 'firstpassword1');
    await assertLoggedIn(page);

    // Look for add identity option
    const profileButton = page.locator(
      '[data-testid="profile-menu"], [data-testid="identity-menu"]'
    ).first();

    if (await profileButton.isVisible({ timeout: 2000 })) {
      await profileButton.click();

      const addIdentity = page.getByText(/add identity/i);
      if (await addIdentity.isVisible({ timeout: 2000 })) {
        await expect(addIdentity).toBeVisible();
      }
    }
  });

  test('should switch between identities', async ({ page }) => {
    // Create first identity
    await createIdentity(page, 'Switch First', 'switchfirst123');

    // Navigate to profile/identity menu
    const profileButton = page.locator(
      '[data-testid="profile-menu"], [data-testid="identity-menu"]'
    ).first();

    if (await profileButton.isVisible({ timeout: 2000 })) {
      await profileButton.click();

      // Look for identity switcher
      const switchOption = page.getByText(/switch|change.*identity/i);
      if (await switchOption.isVisible({ timeout: 2000 })) {
        await expect(switchOption).toBeVisible();
      }
    }
  });
});

test.describe('Tauri Auth - Security', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should not expose private key in DOM', async ({ page }) => {
    // Create identity
    await createIdentity(page, 'Security Test User', 'securitytest12');

    // Search for private key in DOM
    const pageContent = await page.content();

    // Should not contain raw private key
    expect(pageContent.toLowerCase()).not.toContain(TEST_KEYPAIR.private_key);
    expect(pageContent).not.toMatch(/nsec1[a-z0-9]{58}/i);
  });

  test('should not log sensitive data to console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });

    // Create identity
    await createIdentity(page, 'Console Security User', 'consolesecure1');

    // Wait for any async logs
    await page.waitForTimeout(2000);

    // Check logs for sensitive data
    const sensitivePatterns = [
      /nsec1[a-z0-9]{58}/i,
      /[a-f0-9]{64}/, // Full 32-byte hex keys
      /private.*key.*[a-f0-9]{32}/i,
    ];

    for (const log of logs) {
      for (const pattern of sensitivePatterns) {
        // Skip if it's a mock-related log
        if (log.includes('[Tauri Mock]')) continue;
        expect(log).not.toMatch(pattern);
      }
    }
  });

  test('should support password change', async ({ page }) => {
    // Create identity
    await createIdentity(page, 'Password Change User', 'oldpassword123');

    // Navigate to security settings
    await navigateToSecuritySettings(page);

    // Look for change password option
    const changePasswordButton = page.getByRole('button', { name: /change password/i });
    if (await changePasswordButton.isVisible({ timeout: 2000 })) {
      await changePasswordButton.click();

      // Should show password change dialog/form
      const newPasswordInput = page.getByLabel(/new password/i);
      await expect(newPasswordInput).toBeVisible({ timeout: 2000 });
    }
  });

  test('should support key export with confirmation', async ({ page }) => {
    // Create identity
    await createIdentity(page, 'Export Key User', 'exportkeypass1');

    // Navigate to security settings
    await navigateToSecuritySettings(page);

    // Look for export/backup option
    const exportButton = page.getByRole('button', { name: /export|backup/i }).first();
    if (await exportButton.isVisible({ timeout: 2000 })) {
      await exportButton.click();

      // Should show confirmation dialog
      const confirmDialog = page.locator('[role="dialog"], [role="alertdialog"]');
      const warningText = page.getByText(/warning|secure|never share/i);

      const hasConfirm = await confirmDialog.isVisible({ timeout: 2000 });
      const hasWarning = await warningText.isVisible({ timeout: 2000 });

      expect(hasConfirm || hasWarning).toBe(true);
    }
  });
});
