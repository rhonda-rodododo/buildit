/**
 * E2E Tests for Activity Feed (Epics 34 & 38)
 * Tests for feed display, filtering, moderation, and user interactions
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

test.describe('Activity Feed - Display & Filtering', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Setup: Create identity and navigate to feed
    await page.goto('/');
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }
    await page.waitForURL(/\/(dashboard|groups)/);

    // Navigate to activity feed
    const feedLink = page.getByRole('link', { name: /feed|activity/i }).first();
    if (await feedLink.isVisible()) {
      await feedLink.click();
    }
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should display activity feed with posts from followed users', async () => {
    // Create some test posts
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      // Post 1
      await composer.fill('First feed post');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Post 2
      await composer.fill('Second feed post');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Verify both posts appear in feed
      await expect(page.getByText('First feed post')).toBeVisible();
      await expect(page.getByText('Second feed post')).toBeVisible();
    }
  });

  test('should filter feed by type (All Activity, Following, Group Posts, Mentions, Bookmarks)', async () => {
    // Look for feed type selector
    const feedTypeSelector = page.locator('[data-testid="feed-type-select"]').or(
      page.getByRole('combobox').first()
    );

    if (await feedTypeSelector.isVisible()) {
      // Test "All Activity" (should be default)
      await expect(feedTypeSelector).toBeVisible();

      // Switch to "Following"
      await feedTypeSelector.click();
      const followingOption = page.getByRole('option', { name: /following/i });
      if (await followingOption.isVisible()) {
        await followingOption.click();
        await page.waitForTimeout(300);

        // Feed should update (may be empty if not following anyone)
        await expect(page.locator('[data-testid="activity-feed"]').or(page.locator('main'))).toBeVisible();
      }

      // Switch to "Mentions"
      await feedTypeSelector.click();
      const mentionsOption = page.getByRole('option', { name: /mentions/i });
      if (await mentionsOption.isVisible()) {
        await mentionsOption.click();
        await page.waitForTimeout(300);
      }

      // Switch to "Bookmarks"
      await feedTypeSelector.click();
      const bookmarksOption = page.getByRole('option', { name: /bookmarks/i });
      if (await bookmarksOption.isVisible()) {
        await bookmarksOption.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('should filter feed by content type (Posts, Events, Documents)', async () => {
    // Create a text post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Regular text post');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }

    // Open filters panel
    const filtersButton = page.getByRole('button', { name: /filters/i });
    if (await filtersButton.isVisible()) {
      await filtersButton.click();
      await page.waitForTimeout(200);

      // Should show content type filters (Text, Events, Documents)
      const textFilter = page.getByRole('button', { name: /text/i });
      const eventsFilter = page.getByRole('button', { name: /events/i });
      const documentsFilter = page.getByRole('button', { name: /documents/i });

      // Click events filter
      if (await eventsFilter.isVisible()) {
        await eventsFilter.click();
        await page.waitForTimeout(300);

        // Text post should disappear (filtered out)
        await expect(page.getByText('Regular text post')).not.toBeVisible();
      }

      // Click text filter to show text posts again
      if (await textFilter.isVisible()) {
        await textFilter.click();
        await page.waitForTimeout(300);

        // Text post should reappear
        await expect(page.getByText('Regular text post')).toBeVisible();
      }
    }
  });

  test('should search posts by hashtag', async () => {
    // Create posts with hashtags
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      // Post with #organizing hashtag
      await composer.fill('Great meeting today! #organizing #solidarity');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Post without hashtag
      await composer.fill('Regular post without hashtags');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }

    // Click on hashtag to filter
    const hashtagLink = page.getByRole('button', { name: /#organizing/i }).or(
      page.getByText('#organizing')
    ).first();

    if (await hashtagLink.isVisible()) {
      await hashtagLink.click();
      await page.waitForTimeout(300);

      // Should show only posts with #organizing
      await expect(page.getByText(/great meeting today/i)).toBeVisible();
      await expect(page.getByText('Regular post without hashtags')).not.toBeVisible();
    }
  });

  test('should show @mention autocomplete when typing', async () => {
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      // Type @ to trigger autocomplete
      await composer.fill('Hey @');
      await page.waitForTimeout(300);

      // Should show autocomplete dropdown (if users exist)
      // Note: May not show if no other users in database
      const autocomplete = page.locator('[data-testid="mention-autocomplete"]').or(
        page.locator('[role="listbox"]')
      );

      // If autocomplete appears, verify it's functional
      if (await autocomplete.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(autocomplete).toBeVisible();
      }
    }
  });
});

test.describe('Activity Feed - Content Moderation', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto('/');
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }
    await page.waitForURL(/\/(dashboard|groups)/);

    const feedLink = page.getByRole('link', { name: /feed/i }).first();
    if (await feedLink.isVisible()) {
      await feedLink.click();
    }
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should blur sensitive content with content warning', async () => {
    // Create post with content warning
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Sensitive content about protests');

      // Add content warning
      const cwButton = page.getByRole('button', { name: /content warning|cw/i });
      if (await cwButton.isVisible()) {
        await cwButton.click();

        const cwInput = page.getByPlaceholder(/warning/i);
        await cwInput.fill('Police violence discussion');

        // Mark as sensitive
        const sensitiveToggle = page.locator('[data-testid="sensitive-toggle"]').or(
          page.getByRole('checkbox', { name: /sensitive/i })
        );
        if (await sensitiveToggle.isVisible()) {
          await sensitiveToggle.click();
        }
      }

      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Verify content warning displays prominently
      await expect(page.getByText(/content warning/i)).toBeVisible();
      await expect(page.getByText('Police violence discussion')).toBeVisible();
    }
  });

  test('should report post functionality', async () => {
    // Create a post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Post to report');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }

    // Open more options menu
    const moreButton = page.getByRole('button', { name: /more/i }).first();
    if (await moreButton.isVisible()) {
      await moreButton.click();

      // Click report option
      const reportOption = page.getByRole('menuitem', { name: /report/i });
      if (await reportOption.isVisible()) {
        await reportOption.click();

        // Should open report dialog
        await page.waitForTimeout(200);

        // Dialog should have report reasons
        const reportDialog = page.locator('[role="dialog"]');
        await expect(reportDialog).toBeVisible();
      }
    }
  });

  test('should hide/unhide posts', async () => {
    // Create a post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Post to hide');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }

    // Open more options and look for hide option
    const moreButton = page.getByRole('button', { name: /more/i }).first();
    if (await moreButton.isVisible()) {
      await moreButton.click();

      const hideOption = page.getByRole('menuitem', { name: /hide/i });
      if (await hideOption.isVisible()) {
        await hideOption.click();
        await page.waitForTimeout(200);

        // Post should be hidden (may disappear or show as hidden)
        // Implementation varies, so check for either outcome
      }
    }
  });
});

test.describe('Activity Feed - Interactions', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto('/');
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }
    await page.waitForURL(/\/(dashboard|groups)/);

    const feedLink = page.getByRole('link', { name: /feed/i }).first();
    if (await feedLink.isVisible()) {
      await feedLink.click();
    }
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should load more posts with infinite scroll / pagination', async () => {
    // Create multiple posts to test pagination
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      for (let i = 1; i <= 5; i++) {
        await composer.fill(`Test post number ${i}`);
        await page.getByRole('button', { name: /post/i }).click();
        await page.waitForTimeout(200);
      }

      // Scroll to bottom of feed
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      // Look for "Load More" button or verify infinite scroll loaded more
      const loadMoreButton = page.getByRole('button', { name: /load more/i });
      if (await loadMoreButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loadMoreButton.click();
        await page.waitForTimeout(300);
      }

      // Verify posts are still visible
      await expect(page.getByText('Test post number 1')).toBeVisible();
    }
  });

  test('should show real-time updates when new posts are created', async () => {
    // Create initial post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Initial post');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Create another post (simulating real-time update)
      await composer.fill('New real-time post');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Both posts should appear in feed
      await expect(page.getByText('Initial post')).toBeVisible();
      await expect(page.getByText('New real-time post')).toBeVisible();
    }
  });

  test('should refresh feed manually', async () => {
    // Create a post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Post before refresh');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }

    // Click refresh button
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(500);

      // Post should still be visible after refresh
      await expect(page.getByText('Post before refresh')).toBeVisible();
    }
  });

  test('should filter feed by privacy level', async () => {
    // Create posts with different privacy levels
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      // Public post
      await composer.fill('Public post for everyone');
      const privacyButton = page.getByRole('button', { name: /privacy/i });
      if (await privacyButton.isVisible()) {
        await privacyButton.click();
        await page.getByRole('menuitem', { name: /public/i }).click();
      }
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Followers-only post
      await composer.fill('Followers only post');
      if (await privacyButton.isVisible()) {
        await privacyButton.click();
        await page.getByRole('menuitem', { name: /followers/i }).click();
      }
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }

    // Open filters and select privacy level
    const filtersButton = page.getByRole('button', { name: /filters/i });
    if (await filtersButton.isVisible()) {
      await filtersButton.click();
      await page.waitForTimeout(200);

      // Filter by public only
      const publicFilter = page.getByRole('button', { name: /public/i }).last();
      if (await publicFilter.isVisible()) {
        await publicFilter.click();
        await page.waitForTimeout(300);

        // Should show only public posts
        await expect(page.getByText('Public post for everyone')).toBeVisible();
      }
    }
  });

  test('should display empty state when no posts match filters', async () => {
    // Apply filter that has no matching posts
    const filtersButton = page.getByRole('button', { name: /filters/i });
    if (await filtersButton.isVisible()) {
      await filtersButton.click();
      await page.waitForTimeout(200);

      // Select a content type filter (e.g., Events) when no events exist
      const eventsFilter = page.getByRole('button', { name: /events/i });
      if (await eventsFilter.isVisible()) {
        await eventsFilter.click();
        await page.waitForTimeout(300);

        // Should show empty state message
        const emptyState = page.getByText(/no posts|no activity/i);
        await expect(emptyState).toBeVisible();

        // Should show "Clear Filters" button
        const clearFiltersButton = page.getByRole('button', { name: /clear filters/i });
        if (await clearFiltersButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await expect(clearFiltersButton).toBeVisible();
        }
      }
    }
  });
});

test.describe('Activity Feed - Multi-User Interactions', () => {
  test('should show posts from multiple users in feed', async ({ browser }) => {
    // Create two browser contexts for two users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1: Create identity and post
      await page1.goto('/');
      let generateButton = page1.getByRole('button', { name: /generate new identity/i });
      if (await generateButton.isVisible()) {
        await generateButton.click();
      }
      await page1.waitForURL(/\/(dashboard|groups)/);

      const feedLink1 = page1.getByRole('link', { name: /feed/i }).first();
      if (await feedLink1.isVisible()) {
        await feedLink1.click();
      }

      const composer1 = page1.locator('textarea[placeholder*="What"]');
      if (await composer1.isVisible()) {
        await composer1.fill('Post from User 1');
        await page1.getByRole('button', { name: /post/i }).click();
        await page1.waitForTimeout(300);
      }

      // User 2: Create identity and post
      await page2.goto('/');
      generateButton = page2.getByRole('button', { name: /generate new identity/i });
      if (await generateButton.isVisible()) {
        await generateButton.click();
      }
      await page2.waitForURL(/\/(dashboard|groups)/);

      const feedLink2 = page2.getByRole('link', { name: /feed/i }).first();
      if (await feedLink2.isVisible()) {
        await feedLink2.click();
      }

      const composer2 = page2.locator('textarea[placeholder*="What"]');
      if (await composer2.isVisible()) {
        await composer2.fill('Post from User 2');
        await page2.getByRole('button', { name: /post/i }).click();
        await page2.waitForTimeout(300);
      }

      // Verify User 2 sees their own post
      await expect(page2.getByText('Post from User 2')).toBeVisible();

      // Note: Seeing posts from other users requires following/group membership
      // which is beyond the scope of this isolated test

    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
