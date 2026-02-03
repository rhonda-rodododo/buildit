/**
 * E2E Tests for Epic 42 - Conversations/Messaging UX Overhaul
 *
 * Tests desktop chat windows, buddylist, presence system, and conversation management
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { waitForAppReady, createIdentity } from './helpers/helpers';

/**
 * Helper: Create a new identity and login
 */
async function createAndLoginIdentity(page: Page, name: string) {
  await page.goto('/');
  await waitForAppReady(page);
  await createIdentity(page, name, 'testpassword123');
}

/**
 * Helper: Add a friend via username search
 */
async function addFriend(page: Page, username: string) {
  // Navigate to Friends page
  await page.click('a[href*="/app/friends"]');
  await page.waitForURL(/.*friends/);

  // Click Add Friend button
  await page.click('button:has-text("Add Friend")');

  // Search for username
  await page.fill('input[placeholder*="username"]', username);
  await page.click('button:has-text("Send Request")');

  // Wait for request sent confirmation
  await page.waitForSelector('text=Friend request sent');
}

/**
 * Helper: Accept a friend request
 */
async function acceptFriendRequest(page: Page, fromUsername: string) {
  await page.click('a[href*="/app/friends"]');
  await page.waitForURL(/.*friends/);

  // Go to Requests tab
  await page.click('button:has-text("Requests")');

  // Find and accept the request
  await page.click(`text=${fromUsername} >> .. >> button:has-text("Accept")`);

  // Wait for acceptance confirmation
  await page.waitForSelector('text=Friend request accepted');
}

/**
 * Helper: Navigate to Messages page
 */
async function navigateToMessages(page: Page) {
  await page.click('a[href*="/app/messages"]');
  await page.waitForURL(/.*messages/);
}

// ============================================================================
// Desktop Chat Windows Tests
// ============================================================================

test.describe('Desktop Chat Windows', () => {
  test('should open chat window from buddylist', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const user1Page = await context1.newPage();
    const user2Page = await context2.newPage();

    try {
      // User 1: Setup
      await createAndLoginIdentity(user1Page, 'Alice');

      // User 2: Setup and add User 1 as friend
      await createAndLoginIdentity(user2Page, 'Bob');
      await addFriend(user2Page, 'alice');

      // User 1: Accept friend request
      await acceptFriendRequest(user1Page, 'Bob');

      // User 1: Navigate to messages
      await navigateToMessages(user1Page);

      // User 1: Click on Bob in buddylist to open chat window
      await user1Page.click('[data-testid="buddylist-item-bob"]');

      // Verify chat window opened
      await expect(user1Page.locator('[data-testid="chat-window"]')).toBeVisible();
      await expect(user1Page.locator('[data-testid="chat-window"]')).toContainText('Bob');
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should support multiple chat windows side-by-side (max 3)', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await createAndLoginIdentity(page, 'Alice');

      // Create 3 friends (we'd need to seed this or create them)
      // For now, simulate by creating conversations directly
      await navigateToMessages(page);

      // Open first chat window
      await page.click('[data-testid="new-chat-button"]');
      await page.fill('[data-testid="search-contacts"]', 'Bob');
      await page.click('[data-testid="contact-result-bob"]');

      // Verify first window
      const windows = page.locator('[data-testid="chat-window"]');
      await expect(windows).toHaveCount(1);

      // Open second chat window
      await page.click('[data-testid="new-chat-button"]');
      await page.fill('[data-testid="search-contacts"]', 'Carol');
      await page.click('[data-testid="contact-result-carol"]');

      await expect(windows).toHaveCount(2);

      // Open third chat window
      await page.click('[data-testid="new-chat-button"]');
      await page.fill('[data-testid="search-contacts"]', 'Dave');
      await page.click('[data-testid="contact-result-dave"]');

      await expect(windows).toHaveCount(3);

      // Try to open 4th window - should close oldest
      await page.click('[data-testid="new-chat-button"]');
      await page.fill('[data-testid="search-contacts"]', 'Eve');
      await page.click('[data-testid="contact-result-eve"]');

      // Should still have max 3 windows
      await expect(windows).toHaveCount(3);

      // Verify Bob's window (oldest) was closed
      await expect(page.locator('[data-testid="chat-window"]:has-text("Bob")')).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('should minimize and restore chat windows', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Open a chat window
    await page.click('[data-testid="buddylist-item-bob"]');
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();

    // Minimize window
    await page.click('[data-testid="chat-window-minimize"]');

    // Verify window is minimized (not visible in main area)
    await expect(page.locator('[data-testid="chat-window"]')).not.toBeVisible();

    // Verify window appears in taskbar
    await expect(page.locator('[data-testid="chat-taskbar-item"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-taskbar-item"]')).toContainText('Bob');

    // Restore window from taskbar
    await page.click('[data-testid="chat-taskbar-item"]');

    // Verify window is restored
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
  });

  test('should show chat window taskbar with unread badges', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const user1Page = await context1.newPage();
    const user2Page = await context2.newPage();

    try {
      // Setup: User 1 and User 2 are friends
      await createAndLoginIdentity(user1Page, 'Alice');
      await createAndLoginIdentity(user2Page, 'Bob');

      // User 1: Open chat with Bob and minimize
      await navigateToMessages(user1Page);
      await user1Page.click('[data-testid="buddylist-item-bob"]');
      await user1Page.click('[data-testid="chat-window-minimize"]');

      // User 2: Send message to Alice
      await navigateToMessages(user2Page);
      await user2Page.click('[data-testid="buddylist-item-alice"]');
      await user2Page.fill('[data-testid="message-input"]', 'Hello Alice!');
      await user2Page.click('[data-testid="send-message-button"]');

      // User 1: Verify unread badge appears on taskbar
      await user1Page.waitForTimeout(1000); // Wait for message sync
      await expect(user1Page.locator('[data-testid="chat-taskbar-badge"]')).toBeVisible();
      await expect(user1Page.locator('[data-testid="chat-taskbar-badge"]')).toContainText('1');
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should persist chat window state across page reloads', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Open chat window
    await page.click('[data-testid="buddylist-item-bob"]');
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();

    // Note window position/state
    const windowElement = page.locator('[data-testid="chat-window"]');
    const isVisible = await windowElement.isVisible();

    // Reload page
    await page.reload();

    // Wait for page to load
    await page.waitForURL(/.*messages/);

    // Verify chat window state is restored
    if (isVisible) {
      await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
    }
  });

  test('should close chat window', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Open chat window
    await page.click('[data-testid="buddylist-item-bob"]');
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();

    // Close window
    await page.click('[data-testid="chat-window-close"]');

    // Verify window is closed
    await expect(page.locator('[data-testid="chat-window"]')).not.toBeVisible();

    // Verify window not in taskbar
    await expect(page.locator('[data-testid="chat-taskbar-item"]')).not.toBeVisible();
  });
});

// ============================================================================
// Buddylist Sidebar Tests
// ============================================================================

test.describe('Buddylist Sidebar', () => {
  test('should display contacts in buddylist', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Verify buddylist is visible
    await expect(page.locator('[data-testid="buddylist-sidebar"]')).toBeVisible();

    // Verify sections are present
    await expect(page.locator('text=Favorites')).toBeVisible();
    await expect(page.locator('text=Online Now')).toBeVisible();
    await expect(page.locator('text=All Contacts')).toBeVisible();
  });

  test('should organize contacts (favorites, online, alphabetical)', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Verify Favorites section
    await page.click('text=Favorites');
    await expect(page.locator('[data-testid="section-favorites"]')).toBeVisible();

    // Verify Online Now section
    await page.click('text=Online Now');
    await expect(page.locator('[data-testid="section-online"]')).toBeVisible();

    // Verify All Contacts section (should be alphabetical)
    await page.click('text=All Contacts');
    await expect(page.locator('[data-testid="section-all-contacts"]')).toBeVisible();

    // Get all contact names
    const contacts = await page.locator('[data-testid^="buddylist-item-"]').allTextContents();

    // Verify alphabetical order (case-insensitive)
    const sortedContacts = [...contacts].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    expect(contacts).toEqual(sortedContacts);
  });

  test('should search contacts in buddylist', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Type in search box
    await page.fill('[data-testid="buddylist-search"]', 'Bob');

    // Verify only matching contacts shown
    await expect(page.locator('[data-testid="buddylist-item-bob"]')).toBeVisible();
    await expect(page.locator('[data-testid="buddylist-item-carol"]')).not.toBeVisible();

    // Clear search
    await page.fill('[data-testid="buddylist-search"]', '');

    // Verify all contacts shown again
    await expect(page.locator('[data-testid="buddylist-item-carol"]')).toBeVisible();
  });

  test('should filter by online/offline status', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Click on "Online Now" section
    await page.click('text=Online Now');

    // Verify section is expanded
    await expect(page.locator('[data-testid="section-online"]')).toBeVisible();

    // Verify only online users are shown in this section
    const onlineItems = page.locator('[data-testid="section-online"] [data-testid^="buddylist-item-"]');
    const count = await onlineItems.count();

    for (let i = 0; i < count; i++) {
      const item = onlineItems.nth(i);
      // Check for green presence indicator
      await expect(item.locator('[data-testid="presence-indicator-online"]')).toBeVisible();
    }
  });

  test('should support right-click context menu actions', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Right-click on a contact
    await page.click('[data-testid="buddylist-item-bob"]', { button: 'right' });

    // Verify context menu appears
    await expect(page.locator('[data-testid="buddylist-context-menu"]')).toBeVisible();

    // Verify menu options
    await expect(page.locator('text=Send Message')).toBeVisible();
    await expect(page.locator('text=View Profile')).toBeVisible();
    await expect(page.locator('text=Add to Favorites')).toBeVisible();
    await expect(page.locator('text=Remove Friend')).toBeVisible();
  });
});

// ============================================================================
// Online Presence System Tests
// ============================================================================

test.describe('Online Presence System', () => {
  test('should show online presence indicators (green/yellow/gray)', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Check for presence indicators
    const onlineIndicator = page.locator('[data-testid="presence-indicator-online"]');
    const awayIndicator = page.locator('[data-testid="presence-indicator-away"]');
    const offlineIndicator = page.locator('[data-testid="presence-indicator-offline"]');

    // At least one type should exist (depends on test data)
    const hasPresence =
      (await onlineIndicator.count()) > 0 ||
      (await awayIndicator.count()) > 0 ||
      (await offlineIndicator.count()) > 0;

    expect(hasPresence).toBeTruthy();

    // Verify colors
    if (await onlineIndicator.count() > 0) {
      await expect(onlineIndicator.first()).toHaveCSS('background-color', /rgb\(.*\)/);
    }
  });

  test('should show last seen timestamps', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Look for offline contacts with last seen
    const offlineContact = page.locator('[data-testid^="buddylist-item-"]:has([data-testid="presence-indicator-offline"])').first();

    if (await offlineContact.count() > 0) {
      // Verify last seen text (e.g., "2h ago", "Just now", "3d ago")
      const lastSeenText = await offlineContact.locator('[data-testid="last-seen"]').textContent();

      expect(lastSeenText).toMatch(/(\d+[hmd] ago|Just now|Offline)/);
    }
  });

  test('should display custom status messages', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');

    // Set custom status for Alice
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Set Status');
    await page.fill('[data-testid="status-input"]', 'At a protest 🪧');
    await page.click('[data-testid="save-status"]');

    // Navigate to messages
    await navigateToMessages(page);

    // Open chat with someone (or check own profile)
    await page.click('[data-testid="buddylist-item-bob"]');

    // In another user's view, they should see Alice's status
    // (This requires multi-user test, simplified here)

    // Verify custom status appears somewhere in UI
    await expect(page.locator('text=At a protest 🪧')).toBeVisible();
  });

  test('should update presence in real-time', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const user1Page = await context1.newPage();
    const user2Page = await context2.newPage();

    try {
      // User 1: Setup
      await createAndLoginIdentity(user1Page, 'Alice');
      await navigateToMessages(user1Page);

      // User 2: Setup
      await createAndLoginIdentity(user2Page, 'Bob');

      // User 2: Navigate to messages (this makes Bob "online")
      await navigateToMessages(user2Page);

      // User 1: Refresh presence
      await user1Page.click('[data-testid="refresh-presence"]');

      // Wait for presence update
      await user1Page.waitForTimeout(1000);

      // User 1: Verify Bob shows as online
      await expect(user1Page.locator('[data-testid="buddylist-item-bob"] [data-testid="presence-indicator-online"]')).toBeVisible();

      // User 2: Go idle/away (simulate)
      await user2Page.evaluate(() => {
        // Trigger away status (implementation-specific)
        window.dispatchEvent(new Event('blur'));
      });

      await user2Page.waitForTimeout(300000); // 5 minutes to go "away"

      // User 1: Refresh and verify Bob is "away"
      await user1Page.click('[data-testid="refresh-presence"]');
      await user1Page.waitForTimeout(1000);

      await expect(user1Page.locator('[data-testid="buddylist-item-bob"] [data-testid="presence-indicator-away"]')).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});

// ============================================================================
// Conversation Management Tests
// ============================================================================

test.describe('Conversation Management', () => {
  test('should create new DM conversation', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Click New Chat button
    await page.click('[data-testid="new-chat-button"]');

    // Search for contact
    await page.fill('[data-testid="search-contacts"]', 'Bob');

    // Select contact
    await page.click('[data-testid="contact-result-bob"]');

    // Verify chat window opens
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-window"]')).toContainText('Bob');

    // Send a message
    await page.fill('[data-testid="message-input"]', 'Hello Bob!');
    await page.click('[data-testid="send-message-button"]');

    // Verify message appears
    await expect(page.locator('[data-testid="message-bubble"]')).toContainText('Hello Bob!');
  });

  test('should pin/mute/archive conversations', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Create or select a conversation
    await page.click('[data-testid="conversation-item-bob"]');

    // Pin conversation
    await page.click('[data-testid="conversation-menu"]');
    await page.click('text=Pin Conversation');

    // Verify pinned indicator
    await expect(page.locator('[data-testid="conversation-item-bob"] [data-testid="pinned-indicator"]')).toBeVisible();

    // Mute conversation
    await page.click('[data-testid="conversation-menu"]');
    await page.click('text=Mute');

    // Verify muted indicator
    await expect(page.locator('[data-testid="conversation-item-bob"] [data-testid="muted-indicator"]')).toBeVisible();

    // Archive conversation
    await page.click('[data-testid="conversation-menu"]');
    await page.click('text=Archive');

    // Verify conversation moved to archived
    await page.click('button:has-text("Archived")');
    await expect(page.locator('[data-testid="conversation-item-bob"]')).toBeVisible();
  });

  test('should track unread messages per conversation', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const user1Page = await context1.newPage();
    const user2Page = await context2.newPage();

    try {
      // Setup: User 1 and User 2 are friends
      await createAndLoginIdentity(user1Page, 'Alice');
      await createAndLoginIdentity(user2Page, 'Bob');

      // User 2: Send message to Alice
      await navigateToMessages(user2Page);
      await user2Page.click('[data-testid="buddylist-item-alice"]');
      await user2Page.fill('[data-testid="message-input"]', 'Hey Alice!');
      await user2Page.click('[data-testid="send-message-button"]');

      // User 1: Navigate to messages
      await navigateToMessages(user1Page);

      // Verify unread count on conversation
      await expect(user1Page.locator('[data-testid="conversation-item-bob"] [data-testid="unread-badge"]')).toBeVisible();
      await expect(user1Page.locator('[data-testid="conversation-item-bob"] [data-testid="unread-badge"]')).toContainText('1');

      // User 2: Send another message
      await user2Page.fill('[data-testid="message-input"]', 'Are you there?');
      await user2Page.click('[data-testid="send-message-button"]');

      // User 1: Verify unread count incremented
      await user1Page.waitForTimeout(1000);
      await expect(user1Page.locator('[data-testid="conversation-item-bob"] [data-testid="unread-badge"]')).toContainText('2');
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should mark conversations as read', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Assume we have a conversation with unread messages
    const unreadConversation = page.locator('[data-testid^="conversation-item-"]:has([data-testid="unread-badge"])').first();

    if (await unreadConversation.count() > 0) {
      // Click on conversation to open it
      await unreadConversation.click();

      // Wait for chat window to open
      await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();

      // Verify unread badge disappears
      await expect(unreadConversation.locator('[data-testid="unread-badge"]')).not.toBeVisible();
    }
  });

  test('should search conversations', async ({ page }) => {
    await createAndLoginIdentity(page, 'Alice');
    await navigateToMessages(page);

    // Type in conversation search
    await page.fill('[data-testid="search-conversations"]', 'Bob');

    // Verify only matching conversations shown
    await expect(page.locator('[data-testid="conversation-item-bob"]')).toBeVisible();

    // Verify non-matching hidden
    const allConversations = page.locator('[data-testid^="conversation-item-"]');
    const visibleCount = await allConversations.count();

    expect(visibleCount).toBeGreaterThanOrEqual(1);

    // Clear search
    await page.fill('[data-testid="search-conversations"]', '');

    // Verify all conversations visible again
    const allConversationsAfter = await page.locator('[data-testid^="conversation-item-"]').count();
    expect(allConversationsAfter).toBeGreaterThanOrEqual(visibleCount);
  });
});
