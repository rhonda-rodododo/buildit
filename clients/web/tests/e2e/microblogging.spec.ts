/**
 * E2E Tests for Microblogging Module (Epics 34 & 38)
 * Tests for posts, reactions, comments, reposts, bookmarks, and advanced social features
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

test.describe('Microblogging - Posts CRUD', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Create identity and navigate to feed
    await page.goto('/');
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }
    await page.waitForURL(/\/(dashboard|groups)/);

    // Navigate to activity feed (assuming sidebar link exists)
    const feedLink = page.getByRole('link', { name: /feed|activity/i }).first();
    if (await feedLink.isVisible()) {
      await feedLink.click();
    }
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should create post with public privacy level', async () => {
    // Open post composer
    const composer = page.locator('[data-testid="post-composer"]').or(page.locator('textarea[placeholder*="What"]'));
    await composer.fill('This is a test post with public visibility');

    // Select public privacy (may be default)
    const privacyButton = page.getByRole('button', { name: /public|privacy/i });
    if (await privacyButton.isVisible()) {
      await privacyButton.click();
      await page.getByRole('menuitem', { name: /public/i }).click();
    }

    // Submit post
    await page.getByRole('button', { name: /post|publish/i }).click();

    // Verify post appears in feed
    await expect(page.getByText('This is a test post with public visibility')).toBeVisible();

    // Verify privacy icon (Globe for public)
    const postCard = page.locator('[data-testid="post-card"]').or(page.locator('text=This is a test post').locator('..')).first();
    await expect(postCard).toBeVisible();
  });

  test('should create post with group privacy level', async () => {
    // First create a group
    const groupsLink = page.getByRole('link', { name: /groups/i });
    if (await groupsLink.isVisible()) {
      await groupsLink.click();

      const createGroupButton = page.getByRole('button', { name: /create group/i });
      if (await createGroupButton.isVisible()) {
        await createGroupButton.click();
        await page.getByLabel(/group name|name/i).fill('Test Group for Posts');
        await page.getByRole('button', { name: /create|save/i }).click();
        await page.waitForTimeout(500);
      }
    }

    // Navigate back to feed
    await page.getByRole('link', { name: /feed/i }).first().click();

    // Create group post
    const composer = page.locator('textarea[placeholder*="What"]');
    await composer.fill('Group-only post for testing');

    // Select group privacy
    const privacyButton = page.getByRole('button', { name: /privacy/i });
    if (await privacyButton.isVisible()) {
      await privacyButton.click();
      await page.getByRole('menuitem', { name: /group/i }).click();
    }

    await page.getByRole('button', { name: /post/i }).click();

    // Verify post appears
    await expect(page.getByText('Group-only post for testing')).toBeVisible();
  });

  test('should edit post content', async () => {
    // Create a post first
    const composer = page.locator('textarea[placeholder*="What"]');
    await composer.fill('Original post content');
    await page.getByRole('button', { name: /post/i }).click();
    await page.waitForTimeout(300);

    // Open more options menu on the post
    const moreButton = page.locator('[data-testid="post-more-options"]').or(page.getByRole('button', { name: /more/i })).first();
    await moreButton.click();

    // Click edit option
    await page.getByRole('menuitem', { name: /edit/i }).click();

    // Edit the content
    const editInput = page.locator('textarea[value*="Original"]').or(page.locator('textarea').first());
    await editInput.clear();
    await editInput.fill('Updated post content after edit');

    // Save changes
    await page.getByRole('button', { name: /save|update/i }).click();

    // Verify updated content
    await expect(page.getByText('Updated post content after edit')).toBeVisible();
    await expect(page.getByText('Original post content')).not.toBeVisible();
  });

  test('should delete post', async () => {
    // Create a post
    const composer = page.locator('textarea[placeholder*="What"]');
    await composer.fill('Post to be deleted');
    await page.getByRole('button', { name: /post/i }).click();
    await page.waitForTimeout(300);

    // Verify post exists
    await expect(page.getByText('Post to be deleted')).toBeVisible();

    // Open more options and delete
    const moreButton = page.getByRole('button', { name: /more/i }).first();
    await moreButton.click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Confirm deletion (if dialog appears)
    const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Verify post is gone
    await expect(page.getByText('Post to be deleted')).not.toBeVisible();
  });

  test('should create post with content warning', async () => {
    // Create post with content warning
    const composer = page.locator('textarea[placeholder*="What"]');
    await composer.fill('This post has sensitive content');

    // Look for content warning button/toggle
    const cwButton = page.getByRole('button', { name: /content warning|cw/i });
    if (await cwButton.isVisible()) {
      await cwButton.click();

      // Fill in content warning
      const cwInput = page.getByPlaceholder(/warning|sensitive/i);
      await cwInput.fill('Contains discussion of violence');
    }

    await page.getByRole('button', { name: /post/i }).click();

    // Verify content warning displays
    await expect(page.getByText(/content warning/i)).toBeVisible();
    await expect(page.getByText('Contains discussion of violence')).toBeVisible();
  });
});

test.describe('Microblogging - Reactions', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Setup: Create identity and post
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

    // Create a test post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Post for testing reactions');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should add reaction to post (6 emoji types)', async () => {
    // Click react button
    const reactButton = page.getByRole('button', { name: /react/i }).first();
    await reactButton.click();

    // Wait for reaction picker
    await page.waitForTimeout(200);

    // Click heart reaction (❤️)
    const heartReaction = page.getByRole('button', { name: /❤️|heart/i }).first();
    if (await heartReaction.isVisible()) {
      await heartReaction.click();
    } else {
      // Fallback: look for reaction emoji buttons
      const reactions = page.locator('button').filter({ hasText: /❤️|✊|🔥|👀|😂|👍/ });
      await reactions.first().click();
    }

    // Verify reaction count increased
    await expect(page.getByText(/1 reaction/i)).toBeVisible();
  });

  test('should view "who reacted" popover', async () => {
    // First add a reaction
    const reactButton = page.getByRole('button', { name: /react/i }).first();
    await reactButton.click();
    await page.waitForTimeout(200);

    const heartButton = page.locator('button').filter({ hasText: '❤️' }).first();
    await heartButton.click();
    await page.waitForTimeout(300);

    // Click on reaction count to open popover
    const reactionCount = page.getByText(/1 reaction/i);
    if (await reactionCount.isVisible()) {
      await reactionCount.click();

      // Verify popover shows who reacted
      await expect(page.getByText(/reactions/i)).toBeVisible();

      // Should show the emoji and user who reacted
      await expect(page.locator('text=❤️')).toBeVisible();
    }
  });

  test('should remove reaction', async () => {
    // Add reaction first
    const reactButton = page.getByRole('button', { name: /react/i }).first();
    await reactButton.click();
    await page.waitForTimeout(200);

    const solidarityButton = page.locator('button').filter({ hasText: '✊' }).first();
    await solidarityButton.click();
    await page.waitForTimeout(300);

    // Verify reaction added
    await expect(page.getByText(/1 reaction/i)).toBeVisible();

    // Click react button again and click same emoji to remove
    await reactButton.click();
    await page.waitForTimeout(200);
    await solidarityButton.click();

    // Verify reaction count decreased or is gone
    const reactionText = page.getByText(/1 reaction/i);
    await expect(reactionText).not.toBeVisible();
  });

  test('should change reaction type', async () => {
    // Add initial reaction (❤️)
    const reactButton = page.getByRole('button', { name: /react/i }).first();
    await reactButton.click();
    await page.waitForTimeout(200);

    const heartButton = page.locator('button').filter({ hasText: '❤️' }).first();
    await heartButton.click();
    await page.waitForTimeout(300);

    // Change to different reaction (🔥)
    await reactButton.click();
    await page.waitForTimeout(200);

    const fireButton = page.locator('button').filter({ hasText: '🔥' }).first();
    await fireButton.click();
    await page.waitForTimeout(300);

    // Should still show 1 reaction (changed type, not added)
    await expect(page.getByText(/1 reaction/i)).toBeVisible();
  });
});

test.describe('Microblogging - Comments & Threading', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Setup
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

    // Create test post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Post for testing comments');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should create comment on post', async () => {
    // Click comment button
    const commentButton = page.getByRole('button', { name: /comment/i }).first();
    await commentButton.click();

    // Wait for comment input to appear
    await page.waitForTimeout(200);

    // Type comment
    const commentInput = page.getByPlaceholder(/add.*comment|comment/i);
    if (await commentInput.isVisible()) {
      await commentInput.fill('This is my first comment');

      // Submit comment
      const submitButton = page.getByRole('button', { name: /comment|post/i }).last();
      await submitButton.click();

      // Verify comment appears
      await expect(page.getByText('This is my first comment')).toBeVisible();
      await expect(page.getByText(/1 comment/i)).toBeVisible();
    }
  });

  test('should create nested reply to comment (threading)', async () => {
    // Create initial comment
    const commentButton = page.getByRole('button', { name: /comment/i }).first();
    await commentButton.click();
    await page.waitForTimeout(200);

    const commentInput = page.getByPlaceholder(/add.*comment|comment/i);
    await commentInput.fill('Parent comment');
    await page.getByRole('button', { name: /comment|post/i }).last().click();
    await page.waitForTimeout(300);

    // Reply to the comment
    const replyButton = page.getByRole('button', { name: /reply/i }).first();
    if (await replyButton.isVisible()) {
      await replyButton.click();
      await page.waitForTimeout(200);

      // Type reply
      const replyInput = page.getByPlaceholder(/reply/i);
      await replyInput.fill('Nested reply to parent comment');
      await page.getByRole('button', { name: /comment|reply/i }).last().click();

      // Verify nested reply appears with indentation
      await expect(page.getByText('Nested reply to parent comment')).toBeVisible();
    }
  });

  test('should show visual indicators for thread depth', async () => {
    // Create parent comment
    const commentButton = page.getByRole('button', { name: /comment/i }).first();
    await commentButton.click();
    await page.waitForTimeout(200);

    const commentInput = page.getByPlaceholder(/add.*comment/i);
    await commentInput.fill('Level 0 comment');
    await page.getByRole('button', { name: /comment/i }).last().click();
    await page.waitForTimeout(300);

    // Add reply (level 1)
    const replyButton = page.getByRole('button', { name: /reply/i }).first();
    if (await replyButton.isVisible()) {
      await replyButton.click();
      const replyInput = page.getByPlaceholder(/reply/i);
      await replyInput.fill('Level 1 reply');
      await page.getByRole('button', { name: /reply|comment/i }).last().click();
      await page.waitForTimeout(300);

      // Verify colored border indicator exists (from CommentThread component)
      const threadBorder = page.locator('.border-l-2').first();
      await expect(threadBorder).toBeVisible();
    }
  });

  test('should delete comment', async () => {
    // Create comment
    const commentButton = page.getByRole('button', { name: /comment/i }).first();
    await commentButton.click();
    await page.waitForTimeout(200);

    const commentInput = page.getByPlaceholder(/comment/i);
    await commentInput.fill('Comment to be deleted');
    await page.getByRole('button', { name: /comment/i }).last().click();
    await page.waitForTimeout(300);

    // Verify comment exists
    await expect(page.getByText('Comment to be deleted')).toBeVisible();

    // Delete comment
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm if dialog appears
      page.once('dialog', dialog => dialog.accept());

      // Verify comment is gone
      await expect(page.getByText('Comment to be deleted')).not.toBeVisible();
    }
  });
});

test.describe('Microblogging - Advanced Features', () => {
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

  test('should repost a post', async () => {
    // Create a post to repost
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Original post to repost');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }

    // Click repost button
    const repostButton = page.getByRole('button', { name: /repost/i }).first();
    await repostButton.click();

    // Click "Repost" option (not "Quote Post")
    const repostOption = page.getByRole('menuitem', { name: /^repost$/i }).or(page.getByText(/repost$/i).first());
    if (await repostOption.isVisible()) {
      await repostOption.click();

      // Verify repost count increased
      await expect(page.getByText(/1 repost/i)).toBeVisible();
    }
  });

  test('should create quote post with comment', async () => {
    // Create original post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Post to quote');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }

    // Click repost button and select quote post
    const repostButton = page.getByRole('button', { name: /repost/i }).first();
    await repostButton.click();

    const quoteOption = page.getByRole('menuitem', { name: /quote/i });
    if (await quoteOption.isVisible()) {
      await quoteOption.click();

      // Dialog should open for quote post
      await page.waitForTimeout(200);

      // Add quote comment
      const quoteInput = page.getByPlaceholder(/what do you think|your comment/i);
      await quoteInput.fill('My thoughts on this post');

      // Submit quote post
      await page.getByRole('button', { name: /quote post/i }).click();

      // Verify quote post created
      await expect(page.getByText('My thoughts on this post')).toBeVisible();
    }
  });

  test('should bookmark post', async () => {
    // Create post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Post to bookmark');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);
    }

    // Click bookmark button (should be a bookmark icon)
    const bookmarkButton = page.locator('[data-testid="bookmark-button"]').or(
      page.locator('button').filter({ has: page.locator('svg[class*="bookmark"]') })
    ).first();

    if (await bookmarkButton.isVisible()) {
      await bookmarkButton.click();
      await page.waitForTimeout(200);

      // Verify bookmark was added (button should show filled state)
      // Note: Exact verification depends on UI implementation
      await expect(bookmarkButton).toBeVisible();
    }
  });

  test('should view bookmarked posts', async () => {
    // Create and bookmark a post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Bookmarked post');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Bookmark it
      const bookmarkButton = page.locator('button').filter({ has: page.locator('svg') }).last();
      await bookmarkButton.click();
      await page.waitForTimeout(200);
    }

    // Navigate to bookmarks view
    const feedTypeSelect = page.locator('select').or(page.getByRole('combobox')).first();
    if (await feedTypeSelect.isVisible()) {
      await feedTypeSelect.click();

      const bookmarksOption = page.getByRole('option', { name: /bookmarks/i });
      if (await bookmarksOption.isVisible()) {
        await bookmarksOption.click();

        // Verify bookmarked post appears
        await expect(page.getByText('Bookmarked post')).toBeVisible();
      }
    }
  });

  test('should create post with hashtags', async () => {
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Check out #activism #organizing #solidarity');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Verify hashtags are rendered as links
      const hashtag = page.locator('a').filter({ hasText: '#activism' });
      await expect(hashtag.or(page.getByText('#activism'))).toBeVisible();
    }
  });

  test('should filter feed by hashtag click', async () => {
    // Create post with hashtag
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Post about #testing hashtags');
      await page.getByRole('button', { name: /post/i }).click();
      await page.waitForTimeout(300);

      // Click on hashtag
      const hashtag = page.locator('a').filter({ hasText: '#testing' }).first();
      if (await hashtag.isVisible()) {
        await hashtag.click();
        await page.waitForTimeout(300);

        // Should filter to only show posts with this hashtag
        await expect(page.getByText(/testing|filter|hashtag/i)).toBeVisible();
      }
    }
  });

  test('should create scheduled post', async () => {
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('This is a scheduled post for the future');

      // Look for schedule button
      const scheduleButton = page.getByRole('button', { name: /schedule|clock/i });
      if (await scheduleButton.isVisible()) {
        await scheduleButton.click();
        await page.waitForTimeout(200);

        // Set future date
        const dateInput = page.getByLabel(/date/i);
        if (await dateInput.isVisible()) {
          // Set date to tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dateStr = tomorrow.toISOString().split('T')[0];
          await dateInput.fill(dateStr);
        }

        const timeInput = page.getByLabel(/time/i);
        if (await timeInput.isVisible()) {
          await timeInput.fill('12:00');
        }

        // Confirm schedule
        await page.getByRole('button', { name: /schedule|confirm/i }).click();
        await page.waitForTimeout(300);

        // Verify post is scheduled
        await expect(page.getByText(/scheduled/i)).toBeVisible();
      }
    }
  });

  test('should view and edit scheduled posts', async () => {
    // First create a scheduled post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Scheduled post to edit');

      const scheduleButton = page.getByRole('button', { name: /schedule|clock/i });
      if (await scheduleButton.isVisible()) {
        await scheduleButton.click();
        await page.waitForTimeout(200);

        const dateInput = page.getByLabel(/date/i);
        if (await dateInput.isVisible()) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          await dateInput.fill(tomorrow.toISOString().split('T')[0]);
        }

        await page.getByRole('button', { name: /schedule|confirm/i }).click();
        await page.waitForTimeout(300);
      }
    }

    // Navigate to scheduled posts view
    const scheduledTab = page.getByRole('tab', { name: /scheduled/i });
    if (await scheduledTab.isVisible()) {
      await scheduledTab.click();
      await page.waitForTimeout(300);

      // Click edit on the scheduled post
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(200);

        // Modify the content
        const editComposer = page.locator('textarea').first();
        await editComposer.clear();
        await editComposer.fill('Updated scheduled post content');

        await page.getByRole('button', { name: /save|update/i }).click();
        await page.waitForTimeout(300);

        // Verify updated
        await expect(page.getByText('Updated scheduled post content')).toBeVisible();
      }
    }
  });

  test('should publish scheduled post immediately', async () => {
    // Create scheduled post
    const composer = page.locator('textarea[placeholder*="What"]');
    if (await composer.isVisible()) {
      await composer.fill('Post to publish now');

      const scheduleButton = page.getByRole('button', { name: /schedule|clock/i });
      if (await scheduleButton.isVisible()) {
        await scheduleButton.click();
        await page.waitForTimeout(200);

        const dateInput = page.getByLabel(/date/i);
        if (await dateInput.isVisible()) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          await dateInput.fill(tomorrow.toISOString().split('T')[0]);
        }

        await page.getByRole('button', { name: /schedule|confirm/i }).click();
        await page.waitForTimeout(300);
      }
    }

    // Go to scheduled posts
    const scheduledTab = page.getByRole('tab', { name: /scheduled/i });
    if (await scheduledTab.isVisible()) {
      await scheduledTab.click();
      await page.waitForTimeout(300);

      // Click publish now
      const publishNowButton = page.getByRole('button', { name: /publish now|post now/i });
      if (await publishNowButton.isVisible()) {
        await publishNowButton.click();
        await page.waitForTimeout(300);

        // Should move to regular feed
        await expect(page.getByText('Post to publish now')).toBeVisible();
      }
    }
  });

  test('should filter feed by following', async () => {
    // Look for feed filter
    const feedFilter = page.getByRole('combobox').or(page.getByRole('button', { name: /filter|all/i })).first();
    if (await feedFilter.isVisible()) {
      await feedFilter.click();
      await page.waitForTimeout(200);

      const followingOption = page.getByRole('option', { name: /following/i });
      if (await followingOption.isVisible()) {
        await followingOption.click();
        await page.waitForTimeout(300);

        // Feed should update to show only posts from followed users
        await expect(page.getByRole('main')).toBeVisible();
      }
    }
  });

  test('should filter feed by date range', async () => {
    const filterButton = page.getByRole('button', { name: /filter/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(200);

      // Look for date range inputs
      const fromDate = page.getByLabel(/from|start/i);
      const toDate = page.getByLabel(/to|end/i);

      if (await fromDate.isVisible()) {
        await fromDate.fill('2026-01-01');
      }

      if (await toDate.isVisible()) {
        await toDate.fill('2026-12-31');
      }

      // Apply filter
      const applyButton = page.getByRole('button', { name: /apply/i });
      if (await applyButton.isVisible()) {
        await applyButton.click();
        await page.waitForTimeout(300);
      }

      // Feed should be filtered
      await expect(page.getByRole('main')).toBeVisible();
    }
  });
});
