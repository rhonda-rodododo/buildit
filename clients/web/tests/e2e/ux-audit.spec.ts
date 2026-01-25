import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive UX Audit Test Suite
 *
 * This test captures screenshots of all major flows in BuildIt Network
 * for visual UX review. Screenshots are saved to tests/e2e/ux-audit-screenshots/
 */

const SCREENSHOT_DIR = 'tests/e2e/ux-audit-screenshots';

// Ensure screenshot directory exists
test.beforeAll(async () => {
  const dir = path.join(process.cwd(), SCREENSHOT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper to take screenshot with descriptive name
async function takeScreenshot(page: Page, name: string, options?: { fullPage?: boolean }) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: options?.fullPage ?? true
  });
  console.log(`Screenshot saved: ${screenshotPath}`);
}

test.describe('UX Audit - Comprehensive Visual Review', () => {
  test.describe('1. Login/Onboarding', () => {
    test('capture login and onboarding screens', async ({ page }) => {
      // Navigate to app - use localhost:5175 as specified
      await page.goto('http://localhost:5175/');
      await page.waitForLoadState('networkidle');

      // Screenshot 1: Login form (Create New tab - default)
      await page.waitForTimeout(500);
      await takeScreenshot(page, '01-login-create-identity-tab');

      // Screenshot 2: Import Identity tab
      const importTab = page.getByRole('tab', { name: /import/i });
      if (await importTab.isVisible()) {
        await importTab.click();
        await page.waitForTimeout(300);
        await takeScreenshot(page, '02-login-import-identity-tab');
      }

      // Screenshot 3: Back to Create tab
      const createTab = page.getByRole('tab', { name: /create new/i });
      if (await createTab.isVisible()) {
        await createTab.click();
        await page.waitForTimeout(300);
      }

      // Screenshot 4: Mobile viewport login
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      await takeScreenshot(page, '03-login-mobile-375x667');

      // Reset to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe('2. Create Identity and Dashboard', () => {
    test('create identity and capture dashboard', async ({ page }) => {
      await page.goto('http://localhost:5175/');
      await page.waitForLoadState('networkidle');

      // Fill in create identity form
      const nameInput = page.getByLabel(/display name/i).first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('UX Test User');
      }

      const passwordInput = page.getByLabel(/^password$/i).first();
      if (await passwordInput.isVisible()) {
        await passwordInput.fill('TestPassword123!');
      }

      const confirmPasswordInput = page.getByLabel(/confirm password/i).first();
      if (await confirmPasswordInput.isVisible()) {
        await confirmPasswordInput.fill('TestPassword123!');
      }

      // Screenshot: Filled form
      await takeScreenshot(page, '04-login-form-filled');

      // Click create identity
      const createButton = page.getByRole('button', { name: /create identity/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(2000);
      }

      // Screenshot: Main dashboard after login
      await takeScreenshot(page, '05-dashboard-main');

      // Screenshot: Header/navigation bar (focused crop)
      await takeScreenshot(page, '06-header-navigation', { fullPage: false });
    });
  });

  test.describe('3. Feed/Microblogging', () => {
    test('capture feed and post interactions', async ({ page }) => {
      await page.goto('http://localhost:5175/');
      await page.waitForLoadState('networkidle');

      // Login first
      await loginTestUser(page);

      // Ensure we're on Feed tab
      const feedTab = page.getByRole('tab', { name: /feed/i });
      if (await feedTab.isVisible()) {
        await feedTab.click();
        await page.waitForTimeout(500);
      }

      // Screenshot: Main feed with posts
      await takeScreenshot(page, '07-feed-main-view');

      // Screenshot: Post composer
      const composer = page.locator('[data-testid="post-composer"]').first();
      if (await composer.isVisible()) {
        await takeScreenshot(page, '08-feed-post-composer');
      } else {
        // Try to find composer by placeholder text
        const composerInput = page.getByPlaceholder(/what.*happening|share.*update|write.*post/i);
        if (await composerInput.isVisible()) {
          await composerInput.click();
          await page.waitForTimeout(300);
          await takeScreenshot(page, '08-feed-post-composer-focused');
        }
      }

      // Find and click on a post card
      const postCard = page.locator('.post-card, [data-testid="post-card"]').first();
      if (await postCard.isVisible()) {
        await postCard.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '09-feed-post-detail-with-comments');
      }

      // Try to open emoji/reaction picker
      const reactionButton = page.locator('button[aria-label*="react"], button[aria-label*="emoji"], [data-testid="reaction-picker-trigger"]').first();
      if (await reactionButton.isVisible()) {
        await reactionButton.click();
        await page.waitForTimeout(300);
        await takeScreenshot(page, '10-feed-reaction-picker-open');
        // Close it
        await page.keyboard.press('Escape');
      }

      // Screenshot: Post card showing reactions
      await takeScreenshot(page, '11-feed-post-with-reactions');
    });
  });

  test.describe('4. Groups Tab', () => {
    test('capture groups view and create dialog', async ({ page }) => {
      await page.goto('http://localhost:5175/');
      await page.waitForLoadState('networkidle');

      await loginTestUser(page);

      // Click Groups tab
      const groupsTab = page.getByRole('tab', { name: /groups/i });
      await groupsTab.click();
      await page.waitForTimeout(500);

      // Screenshot: Groups list
      await takeScreenshot(page, '12-groups-list');

      // Click Create Group button
      const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
      if (await createGroupButton.isVisible()) {
        await createGroupButton.click();
        await page.waitForTimeout(500);

        // Screenshot: Create Group dialog
        await takeScreenshot(page, '13-groups-create-dialog');

        // Scroll down to module selection section
        const dialog = page.locator('[role="dialog"]');
        if (await dialog.isVisible()) {
          // Look for module selection area
          const moduleSection = page.locator('text=Modules, text=Enable modules, text=Features').first();
          if (await moduleSection.isVisible()) {
            await moduleSection.scrollIntoViewIfNeeded();
          }

          // Screenshot: Module selection section
          await takeScreenshot(page, '14-groups-module-selection');
        }

        // Close dialog
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('5. Events Tab', () => {
    test('capture events view and create form', async ({ page }) => {
      await page.goto('http://localhost:5175/');
      await page.waitForLoadState('networkidle');

      await loginTestUser(page);

      // Click Events tab
      const eventsTab = page.getByRole('tab', { name: /events/i });
      await eventsTab.click();
      await page.waitForTimeout(500);

      // Screenshot: Events view
      await takeScreenshot(page, '15-events-main-view');

      // Click Create Event button if available
      const createEventButton = page.getByRole('button', { name: /create event|new event|add event/i });
      if (await createEventButton.isVisible()) {
        await createEventButton.click();
        await page.waitForTimeout(500);

        // Screenshot: Create event form
        await takeScreenshot(page, '16-events-create-form');

        // Try to open date picker
        const dateInput = page.locator('input[type="date"], [data-testid="date-picker"], button:has-text("Select date")').first();
        if (await dateInput.isVisible()) {
          await dateInput.click();
          await page.waitForTimeout(300);
          await takeScreenshot(page, '17-events-date-picker');
          await page.keyboard.press('Escape');
        }

        // Try to open time picker
        const timeInput = page.locator('input[type="time"], [data-testid="time-picker"]').first();
        if (await timeInput.isVisible()) {
          await timeInput.click();
          await page.waitForTimeout(300);
          await takeScreenshot(page, '18-events-time-picker');
          await page.keyboard.press('Escape');
        }

        // Close the dialog
        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('6. Mutual Aid Tab', () => {
    test('capture mutual aid view', async ({ page }) => {
      await page.goto('http://localhost:5175/');
      await page.waitForLoadState('networkidle');

      await loginTestUser(page);

      // Click Mutual Aid tab
      const mutualAidTab = page.getByRole('tab', { name: /mutual aid/i });
      await mutualAidTab.click();
      await page.waitForTimeout(500);

      // Screenshot: Mutual Aid view
      await takeScreenshot(page, '19-mutual-aid-main-view');

      // Look for request/offer cards
      const aidCards = page.locator('.aid-card, [data-testid="aid-card"], .request-card, .offer-card');
      if (await aidCards.first().isVisible()) {
        await takeScreenshot(page, '20-mutual-aid-cards');
      }

      // Try to open create request form
      const createRequestButton = page.getByRole('button', { name: /create request|new request|request help|offer help/i });
      if (await createRequestButton.isVisible()) {
        await createRequestButton.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '21-mutual-aid-create-form');
        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('7. Security Tab', () => {
    test('capture security page and sub-tabs', async ({ page }) => {
      await page.goto('http://localhost:5175/');
      await page.waitForLoadState('networkidle');

      await loginTestUser(page);

      // Click Security tab
      const securityTab = page.getByRole('tab', { name: /security/i });
      await securityTab.click();
      await page.waitForTimeout(500);

      // Screenshot: Full security page
      await takeScreenshot(page, '22-security-main-page');

      // Find and capture each sub-tab
      const subTabs = ['Encryption', 'Keys', 'Devices', 'Privacy', 'Audit'];

      for (let i = 0; i < subTabs.length; i++) {
        const tabName = subTabs[i];
        const subTab = page.getByRole('tab', { name: new RegExp(tabName, 'i') });
        if (await subTab.isVisible()) {
          await subTab.click();
          await page.waitForTimeout(300);
          await takeScreenshot(page, `23-security-${tabName.toLowerCase()}-tab`);
        }
      }

      // Check for overflow issues on mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      await takeScreenshot(page, '24-security-mobile-overflow-check');

      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe('8. Mobile Responsiveness', () => {
    test('capture mobile views of all tabs', async ({ page }) => {
      await page.goto('http://localhost:5175/');
      await page.waitForLoadState('networkidle');

      await loginTestUser(page);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Screenshot: Feed on mobile
      const feedTab = page.getByRole('tab', { name: /feed/i });
      await feedTab.click();
      await page.waitForTimeout(300);
      await takeScreenshot(page, '25-mobile-feed');

      // Screenshot: Groups on mobile
      const groupsTab = page.getByRole('tab', { name: /groups/i });
      await groupsTab.click();
      await page.waitForTimeout(300);
      await takeScreenshot(page, '26-mobile-groups');

      // Screenshot: Events on mobile
      const eventsTab = page.getByRole('tab', { name: /events/i });
      await eventsTab.click();
      await page.waitForTimeout(300);
      await takeScreenshot(page, '27-mobile-events');

      // Screenshot: Mutual Aid on mobile
      const mutualAidTab = page.getByRole('tab', { name: /mutual aid/i });
      await mutualAidTab.click();
      await page.waitForTimeout(300);
      await takeScreenshot(page, '28-mobile-mutual-aid');

      // Screenshot: Messages on mobile
      const messagesTab = page.getByRole('tab', { name: /messages/i });
      await messagesTab.click();
      await page.waitForTimeout(300);
      await takeScreenshot(page, '29-mobile-messages');

      // Screenshot: Open a dialog on mobile
      const groupsTab2 = page.getByRole('tab', { name: /groups/i });
      await groupsTab2.click();
      await page.waitForTimeout(300);

      const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
      if (await createGroupButton.isVisible()) {
        await createGroupButton.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '30-mobile-dialog');
        await page.keyboard.press('Escape');
      }
    });
  });

  test.describe('9. Dark Mode', () => {
    test('capture dark mode screenshots', async ({ page }) => {
      await page.goto('http://localhost:5175/');
      await page.waitForLoadState('networkidle');

      await loginTestUser(page);

      // Find and click theme toggle
      const themeToggle = page.locator('button[aria-label*="theme"], button[aria-label*="mode"], [data-testid="mode-toggle"]').first();
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(300);

        // Click dark mode option if dropdown appears
        const darkOption = page.getByRole('menuitem', { name: /dark/i });
        if (await darkOption.isVisible()) {
          await darkOption.click();
          await page.waitForTimeout(500);
        }
      } else {
        // Try to set dark mode via localStorage or prefers-color-scheme
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.waitForTimeout(500);
      }

      // Screenshot: Feed in dark mode
      const feedTab = page.getByRole('tab', { name: /feed/i });
      await feedTab.click();
      await page.waitForTimeout(300);
      await takeScreenshot(page, '31-dark-mode-feed');

      // Screenshot: Open a dialog in dark mode
      const groupsTab = page.getByRole('tab', { name: /groups/i });
      await groupsTab.click();
      await page.waitForTimeout(300);

      const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
      if (await createGroupButton.isVisible()) {
        await createGroupButton.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '32-dark-mode-dialog');
        await page.keyboard.press('Escape');
      }

      // Screenshot: Security page in dark mode
      const securityTab = page.getByRole('tab', { name: /security/i });
      await securityTab.click();
      await page.waitForTimeout(300);
      await takeScreenshot(page, '33-dark-mode-security');
    });
  });
});

// Helper function to login with test user
async function loginTestUser(page: Page) {
  // Check if already logged in
  const logoutButton = page.getByRole('button', { name: /logout/i });
  if (await logoutButton.isVisible()) {
    return; // Already logged in
  }

  // Fill in create identity form
  const nameInput = page.getByLabel(/display name/i).first();
  if (await nameInput.isVisible()) {
    await nameInput.fill('UX Test User');

    const passwordInput = page.getByLabel(/^password$/i).first();
    await passwordInput.fill('TestPassword123!');

    const confirmPasswordInput = page.getByLabel(/confirm password/i).first();
    await confirmPasswordInput.fill('TestPassword123!');

    const createButton = page.getByRole('button', { name: /create identity/i });
    await createButton.click();
    await page.waitForTimeout(2000);
  }
}
