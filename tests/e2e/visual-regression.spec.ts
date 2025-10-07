import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 *
 * These tests capture screenshots of key pages and components
 * for visual regression testing. Screenshots are compared against
 * baseline images to detect unintended UI changes.
 *
 * To update baselines: bun run test:e2e --update-snapshots
 */

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login for authenticated pages
    await page.goto('/');
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }
    await page.waitForURL(/\/(dashboard|groups)/);
  });

  test('homepage visual snapshot', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('dashboard visual snapshot', async ({ page }) => {
    // Should already be on dashboard from beforeEach
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('groups list visual snapshot', async ({ page }) => {
    // Navigate to groups
    const groupsLink = page.getByRole('link', { name: /groups/i });
    if (await groupsLink.isVisible()) {
      await groupsLink.click();
    }

    await page.waitForTimeout(500); // Wait for animations
    await expect(page).toHaveScreenshot('groups-list.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('create group dialog visual snapshot', async ({ page }) => {
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    await createGroupButton.click();

    // Wait for dialog to open
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('create-group-dialog.png', {
      maxDiffPixels: 100,
    });
  });

  test('group dashboard visual snapshot', async ({ page }) => {
    // Create a test group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Visual Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Navigate to group
    await page.getByText('Visual Test Group').click();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('group-dashboard.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('events module visual snapshot', async ({ page }) => {
    // Create group with events
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Events Visual Test');
      const eventsCheckbox = page.getByLabel(/events/i);
      if (await eventsCheckbox.isVisible()) {
        await eventsCheckbox.check();
      }
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Navigate to events
    await page.getByText('Events Visual Test').click();
    const eventsTab = page.getByRole('tab', { name: /events/i });
    if (await eventsTab.isVisible()) {
      await eventsTab.click();
    }

    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('events-module.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('governance module visual snapshot', async ({ page }) => {
    // Create group with governance
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Governance Visual Test');
      const governanceCheckbox = page.getByLabel(/governance/i);
      if (await governanceCheckbox.isVisible()) {
        await governanceCheckbox.check();
      }
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Navigate to governance
    await page.getByText('Governance Visual Test').click();
    const governanceTab = page.getByRole('tab', { name: /governance/i });
    if (await governanceTab.isVisible()) {
      await governanceTab.click();
    }

    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('governance-module.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('mobile viewport - dashboard', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('mobile-dashboard.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('dark mode visual snapshot', async ({ page }) => {
    // Toggle dark mode if available
    const themeToggle = page.getByRole('button', { name: /theme|dark.*mode|light.*mode/i });
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot('dashboard-dark-mode.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    }
  });
});
