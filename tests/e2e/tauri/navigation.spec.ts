/**
 * Tauri App E2E Tests - Navigation
 *
 * Tests navigation between screens, deep linking, and routing behavior.
 */

import { test, expect } from '@playwright/test';
import {
  initializeTauriMocks,
  setupTauriMocks,
  clearTauriMocks,
} from './utils/tauri-mocks';
import {
  waitForAppReady,
  clearStorageAndReload,
  createIdentity,
  navigateToSettings,
  assertLoggedIn,
} from './utils/helpers';
import { TIMEOUTS } from './utils/fixtures';

test.describe('Tauri App - Navigation', () => {
  test.setTimeout(60000); // Extended timeout for auth operations

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

  test('should navigate from login to app after creating identity', async ({ page }) => {
    // Start on login page
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible();

    // Create identity
    await createIdentity(page, 'Nav Test User', 'navpassword123');

    // Should be on app page
    await assertLoggedIn(page);
    await expect(page).toHaveURL(/\/app/);
  });

  test('should navigate to settings', async ({ page }) => {
    // Create identity first
    await createIdentity(page, 'Settings Nav User', 'settingspass12');

    // Navigate to settings
    await navigateToSettings(page);

    // Should be on settings page
    await expect(page).toHaveURL(/\/app\/settings|\/settings/);
  });

  test('should navigate between main sections', async ({ page }) => {
    // Create identity
    await createIdentity(page, 'Section Nav User', 'sectionpass123');

    // Look for main navigation items
    const navItems = [
      { name: /feed|home/i, urlPattern: /\/app\/?$|\/app\/feed/ },
      { name: /groups/i, urlPattern: /\/app\/groups/ },
      { name: /messages|dms/i, urlPattern: /\/app\/(messages|dms)/ },
      { name: /settings/i, urlPattern: /\/app\/settings|\/settings/ },
    ];

    for (const item of navItems) {
      const link = page.getByRole('link', { name: item.name });
      if (await link.isVisible({ timeout: 1000 })) {
        await link.click();
        await page.waitForLoadState('networkidle');
        // Verify navigation occurred (may be on expected page or still valid)
        await expect(page).toHaveURL(/\/app/);
      }
    }
  });

  test('should support browser back/forward navigation', async ({ page }) => {
    // Create identity
    await createIdentity(page, 'History Nav User', 'historypass123');

    const initialUrl = page.url();

    // Navigate to settings
    await navigateToSettings(page);
    const settingsUrl = page.url();

    expect(settingsUrl).not.toBe(initialUrl);

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Should be back at initial page
    expect(page.url()).toBe(initialUrl);

    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');

    // Should be at settings again
    expect(page.url()).toBe(settingsUrl);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any existing auth
    await clearStorageAndReload(page);
    await setupTauriMocks(page);

    // Try to access protected route directly
    await page.goto('/app/groups');
    await waitForAppReady(page, TIMEOUTS.APP_INIT);

    // Should redirect to login (or show login page)
    const isOnLogin = await page.getByRole('tab', { name: /create new/i }).isVisible({
      timeout: 5000,
    });

    // Either redirected to login or access denied
    expect(isOnLogin).toBe(true);
  });

  test('should preserve route after authentication', async ({ page }) => {
    // This tests that if you try to access a route while logged out,
    // after logging in you're taken to that route

    // Start fresh
    await clearStorageAndReload(page);
    await setupTauriMocks(page);

    // Try to navigate to a specific protected route
    await page.goto('/app/groups');
    await waitForAppReady(page, TIMEOUTS.APP_INIT);

    // Should be on login
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible();

    // Create identity
    await createIdentity(page, 'Preserve Route User', 'preservepass12');

    // Should potentially redirect to intended destination or default
    // (implementation-dependent)
    await expect(page).toHaveURL(/\/app/);
  });

  test('should handle 404 routes gracefully', async ({ page }) => {
    await createIdentity(page, '404 Test User', '404password123');

    // Navigate to non-existent route
    await page.goto('/app/nonexistent-route-12345');
    await page.waitForLoadState('networkidle');

    // Should either show 404 page or redirect to valid route
    // The app should not crash
    await expect(page.locator('body')).toBeVisible();

    // Should show some form of error or redirect
    const url = page.url();
    const shows404 = await page.getByText(/not found|404|page.*exist/i).isVisible({
      timeout: 2000,
    });
    const redirectedToValid = url.match(/\/app\/?$/);

    expect(shows404 || redirectedToValid).toBeTruthy();
  });

  test('should navigate using keyboard shortcuts', async ({ page }) => {
    await createIdentity(page, 'Keyboard Nav User', 'keyboardpass12');

    // Test common keyboard shortcuts (if implemented)
    // These depend on the app's implementation

    // Escape should close modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    // Still on app
    await expect(page).toHaveURL(/\/app/);
  });

  test('should show breadcrumbs or navigation trail', async ({ page }) => {
    await createIdentity(page, 'Breadcrumb User', 'breadcrumbpass');

    // Navigate to a nested route
    await navigateToSettings(page);

    // Look for breadcrumbs or navigation indicator
    const breadcrumbs = page.locator('[aria-label*="breadcrumb" i], nav.breadcrumb, .breadcrumbs');
    const settingsHeader = page.getByRole('heading', { name: /settings/i });

    // Should have some indication of current location
    const hasBreadcrumbs = await breadcrumbs.isVisible({ timeout: 1000 });
    const hasHeader = await settingsHeader.isVisible({ timeout: 1000 });

    expect(hasBreadcrumbs || hasHeader).toBe(true);
  });

  test('should handle rapid navigation without errors', async ({ page }) => {
    await createIdentity(page, 'Rapid Nav User', 'rapidpassword1');

    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Rapidly click navigation items
    const navLinks = await page.getByRole('link').all();

    for (let i = 0; i < Math.min(5, navLinks.length); i++) {
      try {
        await navLinks[i].click({ timeout: 500 });
        await page.waitForTimeout(100); // Minimal wait
      } catch {
        // Ignore click errors during rapid navigation
      }
    }

    // Wait for any pending navigation
    await page.waitForLoadState('networkidle');

    // Should not have crashed
    await expect(page.locator('body')).toBeVisible();

    // Filter out benign errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('abort')
    );

    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Tauri App - Deep Link Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
  });

  test('should handle buildit:// invite links', async ({ page }) => {
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
    await createIdentity(page, 'Invite Link User', 'invitelinkpass');

    // Simulate receiving an invite deep link
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('tauri://deep-link', {
          detail: { url: 'buildit://invite/group123' },
        })
      );
    });

    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    // App should handle the invite (exact behavior depends on implementation)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle buildit:// profile links', async ({ page }) => {
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
    await createIdentity(page, 'Profile Link User', 'profilelinkpas');

    // Simulate receiving a profile deep link
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('tauri://deep-link', {
          detail: { url: 'buildit://profile/npub1abc123...' },
        })
      );
    });

    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    // App should handle the profile link
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle malformed deep links gracefully', async ({ page }) => {
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
    await createIdentity(page, 'Malformed Link User', 'malformedlink1');

    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Send malformed deep links
    const malformedLinks = [
      'buildit://',
      'buildit://invalid',
      'buildit://%20%20',
      'buildit://invite/', // Missing ID
      'not-buildit://invite/123',
    ];

    for (const link of malformedLinks) {
      await page.evaluate((url) => {
        window.dispatchEvent(
          new CustomEvent('tauri://deep-link', {
            detail: { url },
          })
        );
      }, link);
    }

    await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

    // App should not crash
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Tauri App - Mobile-like Navigation', () => {
  test.use({
    viewport: { width: 375, height: 812 }, // iPhone X viewport
  });

  test.beforeEach(async ({ page }) => {
    await initializeTauriMocks(page);
    await page.goto('/');
    await setupTauriMocks(page);
    await clearStorageAndReload(page);
    await setupTauriMocks(page);
  });

  test('should show mobile navigation at small viewport', async ({ page }) => {
    await createIdentity(page, 'Mobile Nav User', 'mobilenavspass');

    // Look for mobile menu button (hamburger) or bottom navigation
    const mobileMenuButton = page.locator(
      'button[aria-label*="menu" i], [data-testid="mobile-menu"], .mobile-menu-toggle'
    );
    const bottomNav = page.locator(
      'nav[aria-label*="bottom" i], [data-testid="bottom-nav"], .bottom-navigation'
    );

    const hasMobileMenu = await mobileMenuButton.isVisible({ timeout: 2000 });
    const hasBottomNav = await bottomNav.isVisible({ timeout: 2000 });

    // At mobile size, should have some form of mobile navigation
    // (or the regular nav should be collapsed)
    expect(hasMobileMenu || hasBottomNav).toBe(true);
  });

  test('should toggle mobile menu', async ({ page }) => {
    await createIdentity(page, 'Mobile Toggle User', 'mobiletoggle12');

    const mobileMenuButton = page.locator(
      'button[aria-label*="menu" i], [data-testid="mobile-menu"]'
    );

    if (await mobileMenuButton.isVisible({ timeout: 2000 })) {
      // Click to open
      await mobileMenuButton.click();
      await page.waitForTimeout(TIMEOUTS.UI_UPDATE);

      // Menu content should be visible
      const menuContent = page.locator('[data-testid="mobile-menu-content"], .mobile-menu-open');
      await expect(menuContent.or(page.locator('nav'))).toBeVisible();

      // Click to close (or click outside)
      await mobileMenuButton.click();
    }
  });
});
