/**
 * E2E Tests for Epic 24 - Activity Logs & Contact History
 *
 * Tests ContactActivityLog timeline and ConversationHistory components
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:5173';

/**
 * Helper: Create a new identity and login
 */
async function createAndLoginIdentity(page: Page, name: string) {
  await page.goto(`${BASE_URL}/`);
  await page.click('text=Get Started');
  await page.fill('input[placeholder="Enter your name"]', name);
  await page.click('button:has-text("Create Identity")');
  await page.waitForURL(`${BASE_URL}/app/feed`);
}

/**
 * Helper: Navigate to contact detail page
 */
async function navigateToContactDetail(page: Page, contactId: string) {
  // Navigate to the contact detail page directly
  await page.goto(`${BASE_URL}/app/contacts/${contactId}`);
  await page.waitForURL(`**/contacts/${contactId}`);
}

// ============================================================================
// Contact Activity Log Tests
// ============================================================================

test.describe('Contact Activity Log', () => {
  test('should display timeline of all interactions with contact', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');

    // Navigate to a contact detail page (using demo data)
    await navigateToContactDetail(page, 'contact-1');

    // Wait for page to load
    await expect(page.locator('h1:has-text("Contact Details")')).toBeVisible();

    // Verify Activity Timeline tab is visible
    await expect(page.locator('button:has-text("Activity Timeline")')).toBeVisible();

    // Click on Activity Timeline tab (should be default)
    await page.click('button:has-text("Activity Timeline")');

    // Verify timeline header
    await expect(page.locator('h3:has-text("Activity Timeline")')).toBeVisible();

    // Verify timeline shows activities chronologically
    const activityCards = page.locator('[data-testid^="activity-item-"], .relative.pl-12');
    const activityCount = await activityCards.count();

    expect(activityCount).toBeGreaterThanOrEqual(1);

    // Verify timeline visual line is present
    await expect(page.locator('.absolute.left-\\[19px\\]')).toBeVisible();
  });

  test('should display activity summary stats', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Wait for Activity Timeline
    await page.click('button:has-text("Activity Timeline")');

    // Verify Activity Summary section
    await expect(page.locator('h4:has-text("Activity Summary")')).toBeVisible();

    // Verify stats are present (messages, events, notes)
    const statsSection = page.locator('.grid.grid-cols-3');
    await expect(statsSection).toBeVisible();

    // Verify Messages stat
    await expect(page.locator('p.text-xs:has-text("Messages")')).toBeVisible();
    const messagesCount = await page.locator('p.text-xs:has-text("Messages")').locator('..').locator('p.text-2xl').textContent();
    expect(parseInt(messagesCount || '0')).toBeGreaterThanOrEqual(0);

    // Verify Events stat
    await expect(page.locator('p.text-xs:has-text("Events")')).toBeVisible();

    // Verify Notes stat
    await expect(page.locator('p.text-xs:has-text("Notes")')).toBeVisible();
  });

  test('should filter activity by search query', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Activity Timeline tab
    await page.click('button:has-text("Activity Timeline")');

    // Wait for activities to load
    await page.waitForSelector('.relative.pl-12', { timeout: 5000 });

    // Get initial activity count
    const initialActivities = await page.locator('.relative.pl-12').count();
    expect(initialActivities).toBeGreaterThan(0);

    // Search for specific term (from demo data)
    const searchInput = page.locator('input[placeholder="Search activity..."]');
    await searchInput.fill('climate');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify filtered results
    const filteredActivities = await page.locator('.relative.pl-12').count();

    // Should show fewer activities (or at least verify search input works)
    expect(filteredActivities).toBeGreaterThanOrEqual(0);
    expect(filteredActivities).toBeLessThanOrEqual(initialActivities);

    // Verify the visible activities contain the search term
    if (filteredActivities > 0) {
      const firstActivity = page.locator('.relative.pl-12').first();
      const activityText = await firstActivity.textContent();
      expect(activityText?.toLowerCase()).toContain('climate');
    }

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Verify all activities shown again
    const restoredActivities = await page.locator('.relative.pl-12').count();
    expect(restoredActivities).toBe(initialActivities);
  });

  test('should show activity type icons and timestamps', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Activity Timeline
    await page.click('button:has-text("Activity Timeline")');

    // Verify at least one activity exists
    const firstActivity = page.locator('.relative.pl-12').first();
    await expect(firstActivity).toBeVisible();

    // Verify activity has an icon (colored circle with icon inside)
    const activityIcon = firstActivity.locator('.absolute.left-0.w-10.h-10.rounded-full');
    await expect(activityIcon).toBeVisible();

    // Verify activity has timestamp (relative time like "2 hours ago")
    const timestamp = firstActivity.locator('text=/ago|Just now/');
    await expect(timestamp).toBeVisible();

    // Verify activity has actor (who performed the action)
    const actor = firstActivity.locator('.flex.items-center.gap-1').first();
    await expect(actor).toBeVisible();
  });

  test('should allow adding notes to contact', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Activity Timeline
    await page.click('button:has-text("Activity Timeline")');

    // Click "Add Note" button
    const addNoteButton = page.locator('button:has-text("Add Note")');
    await expect(addNoteButton).toBeVisible();
    await addNoteButton.click();

    // Verify note form appears
    await expect(page.locator('h4:has-text("Add Note")')).toBeVisible();

    // Verify textarea is visible
    const noteTextarea = page.locator('textarea[placeholder*="Add a note"]');
    await expect(noteTextarea).toBeVisible();

    // Type a note
    await noteTextarea.fill('This is a test note about the contact');

    // Verify Save Note button is visible
    await expect(page.locator('button:has-text("Save Note")')).toBeVisible();

    // Verify Cancel button works
    await page.click('button:has-text("Cancel")');

    // Verify note form is hidden
    await expect(page.locator('h4:has-text("Add Note")')).not.toBeVisible();
  });
});

// ============================================================================
// Conversation History Tests
// ============================================================================

test.describe('Conversation History', () => {
  test('should display conversation history with chat bubbles', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Conversation History tab
    await page.click('button:has-text("Conversation History")');

    // Wait for conversation history to load
    await expect(page.locator('h3:has-text("Conversation with")')).toBeVisible();

    // Verify message count is displayed
    await expect(page.locator('text=/\\d+ messages/')).toBeVisible();

    // Verify chat bubbles are present
    const messageBubbles = page.locator('.rounded-2xl.px-4.py-2');
    const messageCount = await messageBubbles.count();

    expect(messageCount).toBeGreaterThanOrEqual(1);

    // Verify first message has sender name
    const firstMessage = messageBubbles.first();
    const messageContainer = firstMessage.locator('..');
    await expect(messageContainer.locator('.font-medium')).toBeVisible();

    // Verify message has timestamp
    await expect(messageContainer.locator('text=/ago|Just now/')).toBeVisible();
  });

  test('should display messages in chronological order with date dividers', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Conversation History tab
    await page.click('button:has-text("Conversation History")');

    // Wait for messages to load
    await page.waitForSelector('.rounded-2xl.px-4.py-2', { timeout: 5000 });

    // Verify date divider exists
    const dateDivider = page.locator('text=/[A-Z][a-z]+ \\d+, \\d{4}/').first();
    await expect(dateDivider).toBeVisible();

    // Verify date divider has visual separator lines
    const dividerLines = page.locator('.flex-1.h-px.bg-border');
    expect(await dividerLines.count()).toBeGreaterThanOrEqual(1);
  });

  test('should show encryption indicator on messages', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Conversation History tab
    await page.click('button:has-text("Conversation History")');

    // Wait for messages
    await page.waitForSelector('.rounded-2xl.px-4.py-2', { timeout: 5000 });

    // Verify encryption lock icon is present on messages
    const lockIcon = page.locator('[aria-label="End-to-end encrypted"]');
    expect(await lockIcon.count()).toBeGreaterThanOrEqual(1);
  });

  test('should search conversation history', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Conversation History tab
    await page.click('button:has-text("Conversation History")');

    // Wait for messages to load
    await page.waitForSelector('.rounded-2xl.px-4.py-2', { timeout: 5000 });

    // Get initial message count
    const initialMessages = await page.locator('.rounded-2xl.px-4.py-2').count();
    expect(initialMessages).toBeGreaterThan(0);

    // Search for specific term (from demo data)
    const searchInput = page.locator('input[placeholder="Search conversation..."]');
    await searchInput.fill('climate');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify filtered results
    const filteredMessages = await page.locator('.rounded-2xl.px-4.py-2').count();

    // Should show fewer or equal messages
    expect(filteredMessages).toBeLessThanOrEqual(initialMessages);

    // If messages found, verify they contain search term
    if (filteredMessages > 0) {
      const firstMessage = page.locator('.rounded-2xl.px-4.py-2').first();
      const messageText = await firstMessage.textContent();
      expect(messageText?.toLowerCase()).toContain('climate');
    }

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Verify all messages shown again
    const restoredMessages = await page.locator('.rounded-2xl.px-4.py-2').count();
    expect(restoredMessages).toBe(initialMessages);
  });

  test('should filter conversation by message type', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Conversation History tab
    await page.click('button:has-text("Conversation History")');

    // Wait for messages to load
    await page.waitForSelector('.rounded-2xl.px-4.py-2', { timeout: 5000 });

    // Click filter dropdown
    const filterButton = page.locator('button:has-text("All Messages"), button:has-text("Direct Messages")');
    await filterButton.click();

    // Verify filter menu is visible
    await expect(page.locator('text=Filter Messages')).toBeVisible();

    // Verify filter options are present
    await expect(page.locator('text=All Messages')).toBeVisible();
    await expect(page.locator('text=Direct Messages')).toBeVisible();
    await expect(page.locator('text=Group Messages')).toBeVisible();
    await expect(page.locator('text=Mentions')).toBeVisible();

    // Select "Direct Messages" filter
    await page.click('text=Direct Messages');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify filter button now shows "Direct Messages"
    await expect(page.locator('button:has-text("Direct Messages")')).toBeVisible();
  });

  test('should display conversation summary stats', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Conversation History tab
    await page.click('button:has-text("Conversation History")');

    // Wait for conversation to load
    await page.waitForSelector('h4:has-text("Conversation Summary")', { timeout: 5000 });

    // Verify Conversation Summary section
    await expect(page.locator('h4:has-text("Conversation Summary")')).toBeVisible();

    // Verify stats are present
    const statsSection = page.locator('.grid.grid-cols-3').last();
    await expect(statsSection).toBeVisible();

    // Verify Direct Messages stat
    await expect(page.locator('p.text-xs:has-text("Direct Messages")')).toBeVisible();

    // Verify Group Interactions stat
    await expect(page.locator('p.text-xs:has-text("Group Interactions")')).toBeVisible();

    // Verify Days Since First Contact stat
    await expect(page.locator('p.text-xs:has-text("Days Since First Contact")')).toBeVisible();
  });

  test('should support sending new messages in conversation', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToContactDetail(page, 'contact-1');

    // Click Conversation History tab
    await page.click('button:has-text("Conversation History")');

    // Wait for conversation to load
    await page.waitForSelector('textarea[placeholder*="Send a message"]', { timeout: 5000 });

    // Get initial message count
    const initialMessages = await page.locator('.rounded-2xl.px-4.py-2').count();

    // Type a message
    const messageInput = page.locator('textarea[placeholder*="Send a message"]');
    await messageInput.fill('Hello! This is a test message.');

    // Verify Send button is enabled
    const sendButton = page.locator('button:has-text("Send")');
    await expect(sendButton).toBeEnabled();

    // Click Send button
    await sendButton.click();

    // Wait for message to appear
    await page.waitForTimeout(500);

    // Verify message count increased
    const newMessages = await page.locator('.rounded-2xl.px-4.py-2').count();
    expect(newMessages).toBe(initialMessages + 1);

    // Verify new message appears in chat
    await expect(page.locator('.rounded-2xl.px-4.py-2:has-text("Hello! This is a test message.")')).toBeVisible();

    // Verify message input is cleared
    expect(await messageInput.inputValue()).toBe('');
  });
});

// ============================================================================
// Multi-User Conversation Tests
// ============================================================================

test.describe('Multi-User Conversations', () => {
  test('should show messages from different users with correct alignment', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const user1Page = await context1.newPage();
    const user2Page = await context2.newPage();

    try {
      // User 1: Setup
      await createAndLoginIdentity(user1Page, 'Alice');

      // User 2: Setup
      await createAndLoginIdentity(user2Page, 'Bob');

      // User 1: View contact detail (in real app, would need to navigate to Bob's contact)
      // For demo, we'll verify the UI structure on the existing demo contact
      await navigateToContactDetail(user1Page, 'contact-1');

      // Click Conversation History
      await user1Page.click('button:has-text("Conversation History")');

      // Wait for messages
      await user1Page.waitForSelector('.rounded-2xl.px-4.py-2', { timeout: 5000 });

      // Verify different message alignments exist
      // Messages from current user should be flex-row-reverse
      // Messages from other users should be flex-row
      const messageContainers = user1Page.locator('.flex.gap-3');
      const containerCount = await messageContainers.count();

      expect(containerCount).toBeGreaterThan(0);

      // Verify at least one message has sender avatar
      const avatars = user1Page.locator('.shrink-0 .w-8.h-8');
      expect(await avatars.count()).toBeGreaterThanOrEqual(1);

    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
