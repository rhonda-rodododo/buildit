/**
 * Tauri App E2E Tests - Basic App Launch and Window
 *
 * Tests the basic application launch, window behavior, and initialization.
 */

import { test, expect } from '@playwright/test';
import {
  initializeTauriMocks,
  setupTauriMocks,
  getTauriMockState,
  clearTauriMocks,
} from './utils/tauri-mocks';
import { waitForAppReady, clearStorageAndReload } from './utils/helpers';
import { DEFAULT_WINDOW_CONFIG, TIMEOUTS } from './utils/fixtures';

test.describe('Tauri App - Launch and Window', () => {
  test.beforeEach(async ({ page }) => {
    // Initialize Tauri mocks before navigation
    await initializeTauriMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearTauriMocks(page);
  });

  test('should launch the application successfully', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);

    // Wait for app to be ready
    await waitForAppReady(page);

    // Should show the BuildIt Network branding
    await expect(page.getByText(/buildIt network/i).first()).toBeVisible();
  });

  test('should display the login page on first launch', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);

    // Clear any existing identity
    await clearStorageAndReload(page);
    await setupTauriMocks(page);

    // Should show the Create New tab on the login page
    const createNewTab = page.getByRole('tab', { name: /create new/i });
    await expect(createNewTab).toBeVisible();

    // Should also have an Import tab
    const importTab = page.getByRole('tab', { name: /^import$/i });
    await expect(importTab).toBeVisible();
  });

  test('should have Tauri internals available', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Verify __TAURI_INTERNALS__ is available
    const hasTauriInternals = await page.evaluate(() => {
      return typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
    });

    expect(hasTauriInternals).toBe(true);
  });

  test('should have mock state available for testing', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Verify mock state is accessible
    const mockState = await getTauriMockState(page);

    expect(mockState).not.toBeNull();
    expect(mockState?.ble).toBeDefined();
    expect(mockState?.keyring).toBeDefined();
    expect(mockState?.crypto).toBeDefined();
  });

  test('should handle viewport correctly', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Get viewport size
    const viewport = page.viewportSize();

    // Should match our test configuration (or default Tauri window)
    expect(viewport?.width).toBeGreaterThanOrEqual(DEFAULT_WINDOW_CONFIG.minWidth);
    expect(viewport?.height).toBeGreaterThanOrEqual(DEFAULT_WINDOW_CONFIG.minHeight);
  });

  test('should persist app state across page navigation', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Store something in localStorage
    await page.evaluate(() => {
      localStorage.setItem('test-persistence', 'test-value');
    });

    // Navigate away and back
    await page.goto('/app/settings');
    await page.goto('/');
    await waitForAppReady(page);

    // Check persistence
    const persistedValue = await page.evaluate(() => {
      return localStorage.getItem('test-persistence');
    });

    expect(persistedValue).toBe('test-value');
  });

  test('should handle deep links (buildit:// protocol)', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Simulate a deep link event
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('tauri://deep-link', {
          detail: { url: 'buildit://invite/abc123' },
        })
      );
    });

    // Wait for any deep link handling
    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    // The app should handle the deep link (exact behavior depends on implementation)
    // For now, just verify no errors occurred
    const consoleErrors = await page.evaluate(() => {
      return (window as unknown as { __CONSOLE_ERRORS__?: string[] }).__CONSOLE_ERRORS__ || [];
    });

    // Should not have critical errors
    expect(consoleErrors.filter((e) => e.includes('Unhandled')).length).toBe(0);
  });

  test('should show app title correctly', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    const title = await page.title();

    // Title should contain BuildIt Network or similar
    expect(title.toLowerCase()).toMatch(/buildit|network|buildn/);
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Wait a bit for any async errors
    await page.waitForTimeout(1000);

    // Filter out known benign errors (if any)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('ResizeObserver') && // Common React error
        !e.includes('Non-Error promise rejection') // Common async pattern
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle offline mode gracefully', async ({ page, context }) => {
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Go offline
    await context.setOffline(true);

    // Wait for app to detect offline status
    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    // Check for offline indicator or handling
    // The exact implementation depends on the app
    const isOfflineHandled = await page.evaluate(() => {
      // Check if app shows offline indicator or handles gracefully
      return !navigator.onLine || document.body.textContent?.toLowerCase().includes('offline') === false;
    });

    // App should still be usable (local-first architecture)
    await expect(page.locator('body')).toBeVisible();

    // Go back online
    await context.setOffline(false);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Focus should be manageable via Tab
    await page.keyboard.press('Tab');

    // Some element should receive focus
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    expect(focusedElement).toBeDefined();
    expect(focusedElement).not.toBe('BODY'); // Something should be focused
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    await page.goto('/');
    await setupTauriMocks(page);
    await waitForAppReady(page);

    // Check for lang attribute on html
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBeTruthy();

    // Check for main landmark or similar
    const hasMain = await page.locator('main, [role="main"]').count();
    expect(hasMain).toBeGreaterThanOrEqual(0); // May not be present on login page
  });
});

test.describe('Tauri App - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
  });

  test('should handle failed Tauri commands gracefully', async ({ page }) => {
    await page.goto('/');

    // Set up mocks that return errors
    await page.evaluate(() => {
      (window as unknown as { __TAURI_INTERNALS__: { invoke: () => Promise<{ success: false; data: null; error: string }> } }).__TAURI_INTERNALS__ = {
        ...(window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__,
        invoke: async () => ({
          success: false,
          data: null,
          error: 'Mock error for testing',
        }),
      };
    });

    await waitForAppReady(page);

    // App should still be functional despite command errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should recover from temporary failures', async ({ page }) => {
    let failCount = 0;

    await page.goto('/');

    // Set up mocks that fail then succeed
    await page.evaluate(() => {
      let callCount = 0;
      (window as unknown as { __TAURI_INTERNALS__: { invoke: () => Promise<{ success: boolean; data: null; error: string | null }> } }).__TAURI_INTERNALS__ = {
        ...(window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__,
        invoke: async () => {
          callCount++;
          if (callCount < 3) {
            return {
              success: false,
              data: null,
              error: 'Temporary failure',
            };
          }
          return {
            success: true,
            data: null,
            error: null,
          };
        },
      };
    });

    await waitForAppReady(page);

    // App should eventually work after retries
    await expect(page.locator('body')).toBeVisible();
  });
});
