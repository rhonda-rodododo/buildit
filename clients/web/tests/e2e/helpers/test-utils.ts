import { Page, expect } from '@playwright/test';

/**
 * Wait for the app to finish initialization.
 * The app shows "Initializing..." while loading modules and database.
 * This helper waits for that to complete before proceeding.
 */
export async function waitForAppInitialized(page: Page, timeout = 30000): Promise<void> {
  // Wait for either:
  // 1. The login page (Create New tab) to appear, OR
  // 2. The app dashboard to appear (if already logged in)
  // Both indicate initialization is complete

  const loginTab = page.getByRole('tab', { name: /create new/i });
  const appContent = page.locator('[data-testid="app-content"], main').first();

  await expect(loginTab.or(appContent)).toBeVisible({ timeout });
}

/**
 * Navigate to the app and wait for initialization to complete.
 * Use this instead of page.goto('/') + manual waits.
 */
export async function gotoAndWaitForInit(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await waitForAppInitialized(page);
}

/**
 * Clear IndexedDB and reload the page, waiting for reinitialization.
 * This is needed for tests that require a fresh state.
 */
export async function clearStorageAndReload(page: Page): Promise<void> {
  // Clear all IndexedDB databases
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
    // Also clear localStorage
    localStorage.clear();
    sessionStorage.clear();
  });

  // Reload to ensure app initializes fresh
  await page.reload();

  // Wait for app to finish reinitializing (this can take 15-20s with 18 modules)
  await waitForAppInitialized(page, 45000);
}
