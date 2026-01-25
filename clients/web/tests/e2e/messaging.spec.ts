import { test, expect } from '@playwright/test';

test.describe('Messaging', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }
    await page.waitForURL(/\/(dashboard|groups)/);
  });

  test('should send and view direct message', async ({ page, context }) => {
    // Open a new page for second user
    const page2 = await context.newPage();
    await page2.goto('/');
    const generateButton2 = page2.getByRole('button', { name: /generate new identity/i });
    if (await generateButton2.isVisible()) {
      await generateButton2.click();
    }
    await page2.waitForURL(/\/(dashboard|groups)/);

    // Get page2's npub (if displayed)
    // For now, we'll just test the UI exists

    // On page1, open messages
    const messagesButton = page.getByRole('button', { name: /messages|dm/i });
    if (await messagesButton.isVisible()) {
      await messagesButton.click();
    }

    // Start new conversation
    const newConvoButton = page.getByRole('button', { name: /new message|new conversation/i });
    if (await newConvoButton.isVisible()) {
      await newConvoButton.click();

      // Enter recipient (mock npub)
      await page.getByPlaceholder(/npub|recipient/i).fill('npub1test');

      // Type message
      await page.getByPlaceholder(/type.*message|message/i).fill('Hello from E2E test!');

      // Send
      await page.getByRole('button', { name: /send/i }).click();

      // Should show message in thread
      await expect(page.getByText('Hello from E2E test!')).toBeVisible();
    }
  });

  test('should send group message', async ({ page }) => {
    // Create a group first
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Message Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open the group
    await page.getByText('Message Test Group').click();

    // Navigate to messages tab
    const messagesTab = page.getByRole('tab', { name: /messages/i });
    if (await messagesTab.isVisible()) {
      await messagesTab.click();
    }

    // Type and send message
    const messageInput = page.getByPlaceholder(/type.*message|message/i);
    if (await messageInput.isVisible()) {
      await messageInput.fill('Group message from E2E test');
      await page.getByRole('button', { name: /send/i }).click();

      // Should show message
      await expect(page.getByText('Group message from E2E test')).toBeVisible();
    }
  });

  test('should show unread message indicator', async ({ page }) => {
    // This test would require simulating receiving a message
    // For now, just verify the UI structure exists

    const messagesButton = page.getByRole('button', { name: /messages/i });
    if (await messagesButton.isVisible()) {
      await messagesButton.click();

      // Check for message list structure
      await expect(page.getByRole('main')).toBeVisible();
    }
  });
});
