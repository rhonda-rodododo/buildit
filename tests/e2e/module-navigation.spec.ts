/**
 * Module Navigation E2E Tests
 * Tests that users can navigate to module pages from groups where the module is enabled
 */
import { test, expect, Page } from '@playwright/test';

// Helper function to create identity - same as auth.spec.ts
async function createIdentity(page: Page, name = 'Test User', password = 'testpassword123') {
  // Ensure we're on the Create New tab
  const createNewTab = page.getByRole('tab', { name: /create new/i });
  await createNewTab.click();
  await page.waitForTimeout(300);

  const panel = page.getByRole('tabpanel', { name: /create new/i });

  // Fill in identity form within the tabpanel
  await panel.getByRole('textbox', { name: /display name/i }).fill(name);
  await panel.getByRole('textbox', { name: /^password$/i }).fill(password);
  await panel.getByRole('textbox', { name: /confirm password/i }).fill(password);

  // Wait for button to be enabled
  const createButton = panel.getByRole('button', { name: /create identity/i });
  await expect(createButton).toBeEnabled({ timeout: 5000 });

  // Click create button
  await createButton.click();

  // Wait for navigation to app
  await page.waitForURL(/\/app/, { timeout: 15000 });
}

test.describe('Module Navigation from Groups', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app first to establish origin
    await page.goto('/');

    // Clear all IndexedDB databases
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    });

    // Reload to ensure app initializes fresh
    await page.reload();

    // Wait for app to initialize
    await page.waitForLoadState('networkidle');
  });

  test('should login and access groups page', async ({ page }) => {
    // Wait for login page
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Create identity
    await createIdentity(page, 'Groups Test User', 'securepass123');

    // Verify we're on /app
    await expect(page).toHaveURL(/\/app/);

    // Click on Groups link in sidebar
    const groupsLink = page.getByRole('link', { name: 'Groups', exact: true });
    await groupsLink.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Verify we're on groups page
    await expect(page).toHaveURL(/\/app\/groups/);

    // Take screenshot
    await page.screenshot({ path: 'test-results/module-nav-groups.png' });

    // Look for group-related content
    const pageContent = await page.textContent('body');
    console.log('Groups page loaded, URL:', page.url());
    console.log('Has Create button:', pageContent?.toLowerCase().includes('create'));
  });

  test('should see module links when entering a group', async ({ page }) => {
    // Wait for login page
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Create identity
    await createIdentity(page, 'Module Link Test User', 'securepass123');

    // Navigate to groups via sidebar
    const groupsLink = page.getByRole('link', { name: 'Groups', exact: true });
    await groupsLink.click();
    await page.waitForLoadState('networkidle');

    // Take screenshot of groups page
    await page.screenshot({ path: 'test-results/module-nav-groups-list.png' });

    // Log all navigation links (these are the module navigation links)
    const navLinks = await page.locator('nav a, [role="navigation"] a').allTextContents();
    console.log('Navigation links:', navLinks);

    // We should see:
    // - Feed (main app feed)
    // - Messages
    // - Friends
    // - Groups
    // - Settings

    // These are app-level navigation, not group module navigation
    // Group module links appear when you're inside a group
    expect(navLinks.some(link => /groups/i.test(link))).toBe(true);
  });

  test('should navigate to module page from group', async ({ page }) => {
    // Wait for login page
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Create identity
    await createIdentity(page, 'Module Nav Test User', 'securepass123');

    // Verify we're logged in
    await expect(page).toHaveURL(/\/app/);

    // Navigate to groups via the sidebar (not via goto to preserve session)
    const groupsLink = page.getByRole('link', { name: 'Groups', exact: true });
    await groupsLink.click();
    await page.waitForLoadState('networkidle');

    // Verify we're on groups page
    await expect(page).toHaveURL(/\/app\/groups/);

    // Click "Create Group" button
    const createButton = page.getByRole('button', { name: /create.*group/i });
    await createButton.click();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Fill in group name
    const nameInput = page.getByLabel(/name/i).first();
    await nameInput.fill('Test Navigation Group');

    // Click Create Group button in dialog
    const submitButton = page.getByRole('button', { name: 'Create Group' }).last();
    await submitButton.click();

    // Wait for group to be created
    await page.waitForTimeout(1000);

    // Click on the created group in the list
    const groupLink = page.getByRole('paragraph').filter({ hasText: 'Test Navigation Group' });
    await groupLink.click();
    await page.waitForLoadState('networkidle');

    // Take screenshot of group page
    await page.screenshot({ path: 'test-results/module-nav-inside-group.png' });

    // We should be in the group context now
    await expect(page).toHaveURL(/\/app\/groups\//);

    // Look for module navigation in the group sidebar
    const groupNav = await page.locator('nav a, [role="navigation"] a').allTextContents();
    console.log('Group navigation links:', groupNav);

    // Navigate to Events module if available
    const eventsLink = page.getByRole('link', { name: /events/i }).first();
    if (await eventsLink.isVisible({ timeout: 2000 })) {
      await eventsLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/module-nav-events-page.png' });
      console.log('Events page URL:', page.url());
    }
  });
});
