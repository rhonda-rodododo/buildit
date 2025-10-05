import { test, expect } from '@playwright/test';

test.describe('Group Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }
    await page.waitForURL(/\/(dashboard|groups)/);
  });

  test('should create a new group', async ({ page }) => {
    // Navigate to groups page or open create group dialog
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    await createGroupButton.click();

    // Fill in group details
    await page.getByLabel(/group name|name/i).fill('Test Activist Group');
    await page.getByLabel(/description/i).fill('A test group for organizing');

    // Select modules (if shown)
    const eventsCheckbox = page.getByLabel(/events/i);
    if (await eventsCheckbox.isVisible()) {
      await eventsCheckbox.check();
    }

    // Submit
    await page.getByRole('button', { name: /create|save/i }).click();

    // Should see group in list
    await expect(page.getByText('Test Activist Group')).toBeVisible();
  });

  test('should view group dashboard', async ({ page }) => {
    // Create a group first
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Dashboard Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Click on the group
    await page.getByText('Dashboard Test Group').click();

    // Should show group dashboard with tabs
    await expect(page.getByRole('tab', { name: /messages|events|dashboard/i })).toBeVisible();
  });

  test('should enable and disable modules for a group', async ({ page }) => {
    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Module Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open group settings
    await page.getByText('Module Test Group').click();
    const settingsButton = page.getByRole('button', { name: /settings|configure/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    // Navigate to modules tab
    const modulesTab = page.getByRole('tab', { name: /modules/i });
    if (await modulesTab.isVisible()) {
      await modulesTab.click();

      // Toggle a module
      const eventsToggle = page.getByLabel(/enable events|events module/i);
      if (await eventsToggle.isVisible()) {
        const wasChecked = await eventsToggle.isChecked();
        await eventsToggle.click();
        await expect(eventsToggle).toBeChecked({ checked: !wasChecked });
      }
    }
  });

  test('should invite member to group', async ({ page }) => {
    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Invite Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open invite dialog
    await page.getByText('Invite Test Group').click();
    const inviteButton = page.getByRole('button', { name: /invite|add member/i });
    if (await inviteButton.isVisible()) {
      await inviteButton.click();

      // Enter npub or search for user
      const input = page.getByPlaceholder(/npub|public key|search/i);
      await input.fill('npub1test123');

      // Submit invite
      await page.getByRole('button', { name: /send invite|invite/i }).click();

      // Should show success message
      await expect(page.getByText(/invited|invitation sent/i)).toBeVisible();
    }
  });

  test('should update group settings', async ({ page }) => {
    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Settings Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open group settings
    await page.getByText('Settings Test Group').click();
    const settingsButton = page.getByRole('button', { name: /settings|configure/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Update group name
      const nameInput = page.getByLabel(/group name|name/i);
      await nameInput.clear();
      await nameInput.fill('Updated Group Name');

      // Save
      await page.getByRole('button', { name: /save|update/i }).click();

      // Should show updated name
      await expect(page.getByText('Updated Group Name')).toBeVisible();
    }
  });
});
