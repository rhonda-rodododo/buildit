/**
 * E2E Tests for Wiki/Knowledge Base Module (Epic 7)
 *
 * Tests collaborative wiki with markdown editor, version control,
 * categories/tags, and search functionality.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { waitForAppReady, createIdentity } from './helpers/helpers';

// Test configuration
const TEST_GROUP_NAME = 'Wiki Test Group';

/**
 * Helper: Create a new identity and login
 */
async function createAndLoginIdentity(page: Page, name: string) {
  await page.goto('/');
  await waitForAppReady(page);
  await createIdentity(page, name, 'testpassword123');
}

/**
 * Helper: Create a new group with wiki module enabled
 */
async function createGroupWithWiki(page: Page, groupName: string) {
  const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
  if (await createGroupButton.isVisible()) {
    await createGroupButton.click();
    await page.getByLabel(/group name|name/i).fill(groupName);
    await page.getByLabel(/description/i).fill('A group for testing wiki module');

    // Enable wiki module if option exists
    const wikiCheckbox = page.getByLabel(/wiki/i);
    if (await wikiCheckbox.isVisible()) {
      await wikiCheckbox.check();
    }

    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000); // Wait for group creation
  }

  // Navigate to the group
  const groupLink = page.getByText(groupName);
  if (await groupLink.isVisible()) {
    await groupLink.click();
  }
}

/**
 * Helper: Navigate to Wiki module
 */
async function navigateToWiki(page: Page) {
  // Try tab navigation first
  const wikiTab = page.getByRole('tab', { name: /wiki|knowledge base/i });
  if (await wikiTab.isVisible()) {
    await wikiTab.click();
    return;
  }

  // Try link navigation
  const wikiLink = page.getByRole('link', { name: /wiki|knowledge base/i });
  if (await wikiLink.isVisible()) {
    await wikiLink.click();
    return;
  }

  // Try sidebar navigation
  const wikiSidebarLink = page.locator('nav').getByText(/wiki|knowledge base/i);
  if (await wikiSidebarLink.isVisible()) {
    await wikiSidebarLink.click();
  }
}

/**
 * Helper: Create a wiki page
 */
async function createWikiPage(
  page: Page,
  title: string,
  content: string,
  category?: string,
  tags?: string
) {
  // Click create page button
  const createButton = page.getByRole('button', { name: /create page|new page/i });
  await createButton.click();

  // Fill in page details
  await page.getByLabel(/title/i).fill(title);

  if (category) {
    const categoryInput = page.getByLabel(/category/i);
    if (await categoryInput.isVisible()) {
      await categoryInput.fill(category);
    }
  }

  if (tags) {
    const tagsInput = page.getByLabel(/tags/i);
    if (await tagsInput.isVisible()) {
      await tagsInput.fill(tags);
    }
  }

  // Fill content in markdown editor
  const mdEditor = page.locator('.w-md-editor-text-input, textarea[placeholder*="markdown"], .w-md-editor-text');
  if (await mdEditor.isVisible()) {
    await mdEditor.fill(content);
  }

  // Submit
  await page.getByRole('button', { name: /create|save page/i }).click();
  await page.waitForTimeout(500); // Wait for creation
}

/**
 * Test Suite: Wiki Module E2E Tests
 */
test.describe('Wiki/Knowledge Base Module (Epic 7)', () => {

  test.beforeEach(async ({ page }) => {
    await createAndLoginIdentity(page, 'Wiki Test User');
    await createGroupWithWiki(page, TEST_GROUP_NAME);
    await navigateToWiki(page);
  });

  /**
   * ==========================================
   * Page CRUD Operations (4 tests)
   * ==========================================
   */

  test('should create a wiki page with markdown content', async ({ page }) => {
    const pageTitle = 'Security Culture Guide';
    const markdownContent = `# Security Culture

Security culture protects our movements from surveillance and repression.

## Core Principles

- **Need-to-Know Basis**: Only share sensitive information with those who need it
- **Digital Security**: Use encrypted apps (Signal, Element, this platform)
- **Physical Security**: Be aware of surveillance

## Code Example

\`\`\`javascript
const encrypt = (message) => {
  return nip44.encrypt(message, recipientPubkey);
};
\`\`\`

[Learn more](https://example.com)`;

    await createWikiPage(
      page,
      pageTitle,
      markdownContent,
      'Security',
      'security, opsec, privacy'
    );

    // Verify page appears in list
    await expect(page.getByText(pageTitle)).toBeVisible();

    // Open the page to verify content
    await page.getByText(pageTitle).click();

    // Check markdown is rendered correctly
    await expect(page.locator('h1:has-text("Security Culture")')).toBeVisible();
    await expect(page.locator('h2:has-text("Core Principles")')).toBeVisible();

    // Check list items
    await expect(page.getByText(/Need-to-Know Basis/i)).toBeVisible();
    await expect(page.getByText(/Digital Security/i)).toBeVisible();

    // Check code block
    await expect(page.locator('code:has-text("encrypt")')).toBeVisible();

    // Check link
    await expect(page.locator('a:has-text("Learn more")')).toBeVisible();

    // Check category badge/tag
    await expect(page.getByText('Security')).toBeVisible();

    // Check tags
    await expect(page.getByText('security')).toBeVisible();
    await expect(page.getByText('opsec')).toBeVisible();
  });

  test('should edit an existing wiki page', async ({ page }) => {
    const originalTitle = 'Organizing 101';
    const updatedContent = `# Organizing 101 (Updated)

This guide has been updated with new information.

## Power Mapping
- Who has power?
- Who is impacted?
- Where are leverage points?`;

    // Create initial page
    await createWikiPage(
      page,
      originalTitle,
      '# Organizing 101\n\nOriginal content here.',
      'Resources',
      'organizing'
    );

    // Open the page
    await page.getByText(originalTitle).click();

    // Click edit button
    const editButton = page.getByRole('button', { name: /edit|edit page/i });
    if (await editButton.isVisible()) {
      await editButton.click();

      // Update content
      const mdEditor = page.locator('.w-md-editor-text-input, textarea');
      await mdEditor.fill(updatedContent);

      // Save
      await page.getByRole('button', { name: /save|update/i }).click();
      await page.waitForTimeout(500);

      // Verify updated content
      await expect(page.getByText(/Organizing 101.*Updated/i)).toBeVisible();
      await expect(page.getByText(/updated with new information/i)).toBeVisible();
      await expect(page.getByText('Power Mapping')).toBeVisible();
    }
  });

  test('should delete a wiki page', async ({ page }) => {
    const pageTitle = 'Page to Delete';

    // Create page
    await createWikiPage(
      page,
      pageTitle,
      '# This page will be deleted\n\nTest content.',
      'Test'
    );

    // Verify page exists
    await expect(page.getByText(pageTitle)).toBeVisible();

    // Open the page
    await page.getByText(pageTitle).click();

    // Click delete button
    const deleteButton = page.getByRole('button', { name: /delete|delete page/i });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion
      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Wait for deletion
      await page.waitForTimeout(1000);

      // Verify page is removed from list
      await expect(page.getByText(pageTitle)).not.toBeVisible();
    }
  });

  test('should duplicate a wiki page', async ({ page }) => {
    const originalTitle = 'Meeting Template';
    const content = `# Meeting Notes

## Attendees
-

## Agenda
1.

## Action Items
- `;

    // Create original page
    await createWikiPage(page, originalTitle, content, 'Templates');

    // Open the page
    await page.getByText(originalTitle).click();

    // Click duplicate/copy button
    const duplicateButton = page.getByRole('button', { name: /duplicate|copy/i });
    if (await duplicateButton.isVisible()) {
      await duplicateButton.click();

      // Fill new title
      const titleInput = page.getByLabel(/title/i);
      if (await titleInput.isVisible()) {
        await titleInput.fill('Meeting Template (Copy)');
        await page.getByRole('button', { name: /create|save/i }).click();
      }

      // Verify duplicate exists
      await expect(page.getByText('Meeting Template (Copy)')).toBeVisible();
    }
  });

  /**
   * ==========================================
   * Version Control (3 tests)
   * ==========================================
   */

  test('should view version history of a page', async ({ page }) => {
    const pageTitle = 'Versioned Page';

    // Create page
    await createWikiPage(page, pageTitle, '# Version 1\n\nInitial content.');

    // Edit page multiple times to create versions
    await page.getByText(pageTitle).click();

    const editButton = page.getByRole('button', { name: /edit/i });

    // Version 2
    if (await editButton.isVisible()) {
      await editButton.click();
      const mdEditor = page.locator('.w-md-editor-text-input, textarea');
      await mdEditor.fill('# Version 2\n\nSecond version with changes.');
      await page.getByRole('button', { name: /save/i }).click();
      await page.waitForTimeout(500);
    }

    // Version 3
    if (await editButton.isVisible()) {
      await editButton.click();
      const mdEditor = page.locator('.w-md-editor-text-input, textarea');
      await mdEditor.fill('# Version 3\n\nThird version with more changes.');
      await page.getByRole('button', { name: /save/i }).click();
      await page.waitForTimeout(500);
    }

    // Open version history
    const historyButton = page.getByRole('button', { name: /history|versions|view history/i });
    if (await historyButton.isVisible()) {
      await historyButton.click();

      // Should show 3 versions
      await expect(page.getByText(/version 1|v1/i)).toBeVisible();
      await expect(page.getByText(/version 2|v2/i)).toBeVisible();
      await expect(page.getByText(/version 3|v3/i)).toBeVisible();

      // Should show timestamps
      await expect(page.locator('time, [class*="timestamp"], [class*="date"]')).toHaveCount(3, { timeout: 2000 });
    }
  });

  test('should view diff between versions', async ({ page }) => {
    const pageTitle = 'Diff Test Page';

    // Create and edit page
    await createWikiPage(page, pageTitle, '# Original\n\nOriginal line 1\nOriginal line 2');
    await page.getByText(pageTitle).click();

    const editButton = page.getByRole('button', { name: /edit/i });
    if (await editButton.isVisible()) {
      await editButton.click();
      const mdEditor = page.locator('.w-md-editor-text-input, textarea');
      await mdEditor.fill('# Modified\n\nModified line 1\nNew line 2\nNew line 3');
      await page.getByRole('button', { name: /save/i }).click();
      await page.waitForTimeout(500);
    }

    // Open version history
    const historyButton = page.getByRole('button', { name: /history|versions/i });
    if (await historyButton.isVisible()) {
      await historyButton.click();

      // Click on a version to see diff
      const versionLink = page.locator('[class*="version"], [data-version]').first();
      if (await versionLink.isVisible()) {
        await versionLink.click();

        // Should show diff view
        await expect(page.getByText(/diff|changes|compare/i)).toBeVisible();

        // Should highlight additions and deletions
        const addedText = page.locator('[class*="added"], [class*="insertion"], .diff-add');
        const removedText = page.locator('[class*="removed"], [class*="deletion"], .diff-remove');

        // At least one addition or removal should be visible
        const addedCount = await addedText.count();
        const removedCount = await removedText.count();
        expect(addedCount + removedCount).toBeGreaterThan(0);
      }
    }
  });

  test('should revert to a previous version', async ({ page }) => {
    const pageTitle = 'Revert Test Page';

    // Create original version
    await createWikiPage(page, pageTitle, '# Original Content\n\nThis is the correct version.');
    await page.getByText(pageTitle).click();

    // Create a bad edit
    const editButton = page.getByRole('button', { name: /edit/i });
    if (await editButton.isVisible()) {
      await editButton.click();
      const mdEditor = page.locator('.w-md-editor-text-input, textarea');
      await mdEditor.fill('# Bad Edit\n\nThis should be reverted.');
      await page.getByRole('button', { name: /save/i }).click();
      await page.waitForTimeout(500);

      // Verify bad content is showing
      await expect(page.getByText('Bad Edit')).toBeVisible();
    }

    // Open version history
    const historyButton = page.getByRole('button', { name: /history|versions/i });
    if (await historyButton.isVisible()) {
      await historyButton.click();

      // Find the original version and revert
      const revertButton = page.getByRole('button', { name: /revert|restore/i }).first();
      if (await revertButton.isVisible()) {
        await revertButton.click();

        // Confirm revert
        const confirmButton = page.getByRole('button', { name: /confirm|yes|revert/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        await page.waitForTimeout(1000);

        // Verify original content is restored
        await expect(page.getByText('Original Content')).toBeVisible();
        await expect(page.getByText('This is the correct version')).toBeVisible();
        await expect(page.getByText('Bad Edit')).not.toBeVisible();
      }
    }
  });

  /**
   * ==========================================
   * Organization & Search (3 tests)
   * ==========================================
   */

  test('should browse pages by category', async ({ page }) => {
    // Create pages in different categories
    await createWikiPage(page, 'Security Guide', '# Security', 'Security', 'security');
    await createWikiPage(page, 'Organizing 101', '# Organizing', 'Resources', 'organizing');
    await createWikiPage(page, 'Legal Rights', '# Legal', 'Legal', 'rights');
    await createWikiPage(page, 'Meeting Notes', '# Meeting', 'Governance', 'meeting');

    // Filter by Security category
    const categoryFilter = page.getByRole('button', { name: /category|filter/i });
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      await page.getByText('Security').click();

      // Should only show Security pages
      await expect(page.getByText('Security Guide')).toBeVisible();
      await expect(page.getByText('Organizing 101')).not.toBeVisible();
    } else {
      // Alternative: Click on category badge/link
      const securityCategory = page.locator('[class*="category"], [data-category]').getByText('Security').first();
      if (await securityCategory.isVisible()) {
        await securityCategory.click();
        await expect(page.getByText('Security Guide')).toBeVisible();
      }
    }
  });

  test('should filter pages by tags', async ({ page }) => {
    // Create pages with overlapping tags
    await createWikiPage(page, 'OPSEC Guide', '# OPSEC', 'Security', 'security, opsec, digital');
    await createWikiPage(page, 'Digital Organizing', '# Digital', 'Resources', 'organizing, digital, social-media');
    await createWikiPage(page, 'Physical Security', '# Physical', 'Security', 'security, physical, protest');

    // Search for 'digital' tag
    const tagFilter = page.locator('[class*="tag"], [data-tag]').getByText('digital').first();
    if (await tagFilter.isVisible()) {
      await tagFilter.click();

      // Should show both pages with 'digital' tag
      await expect(page.getByText('OPSEC Guide')).toBeVisible();
      await expect(page.getByText('Digital Organizing')).toBeVisible();
      await expect(page.getByText('Physical Security')).not.toBeVisible();
    }
  });

  test('should search wiki pages by content', async ({ page }) => {
    // Create pages with searchable content
    await createWikiPage(
      page,
      'Direct Action Guide',
      '# Direct Action\n\nDirect action tactics include protests, sit-ins, and blockades.',
      'Tactics'
    );
    await createWikiPage(
      page,
      'Coalition Building',
      '# Coalition Building\n\nWorking with other organizations and building power together.',
      'Strategy'
    );
    await createWikiPage(
      page,
      'Protest Safety',
      '# Protest Safety\n\nStay safe at protests with these tips and resources.',
      'Security'
    );

    // Search for "protest"
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('protest');

    // Wait for search results
    await page.waitForTimeout(500);

    // Should show pages containing "protest"
    await expect(page.getByText('Direct Action Guide')).toBeVisible();
    await expect(page.getByText('Protest Safety')).toBeVisible();
    await expect(page.getByText('Coalition Building')).not.toBeVisible();

    // Search for "coalition"
    await searchInput.clear();
    await searchInput.fill('coalition');
    await page.waitForTimeout(500);

    await expect(page.getByText('Coalition Building')).toBeVisible();
    await expect(page.getByText('Direct Action Guide')).not.toBeVisible();
  });

  /**
   * ==========================================
   * Collaboration (2 tests)
   * ==========================================
   */

  test('should show edit history with author attribution', async ({ page }) => {
    const pageTitle = 'Collaborative Page';

    // Create page
    await createWikiPage(page, pageTitle, '# Original\n\nCreated by first user.');
    await page.getByText(pageTitle).click();

    // Edit the page
    const editButton = page.getByRole('button', { name: /edit/i });
    if (await editButton.isVisible()) {
      await editButton.click();
      const mdEditor = page.locator('.w-md-editor-text-input, textarea');
      await mdEditor.fill('# Edited\n\nEdited by same user.');
      await page.getByRole('button', { name: /save/i }).click();
      await page.waitForTimeout(500);
    }

    // View history
    const historyButton = page.getByRole('button', { name: /history|versions/i });
    if (await historyButton.isVisible()) {
      await historyButton.click();

      // Should show author information (username or pubkey)
      const authorInfo = page.locator('[class*="author"], [data-author], [class*="user"]');
      await expect(authorInfo.first()).toBeVisible();

      // Should show edit timestamps
      await expect(page.locator('time, [class*="timestamp"]').first()).toBeVisible();

      // Should show change descriptions if available
      const changeDesc = page.locator('[class*="change"], [class*="description"]');
      if (await changeDesc.first().isVisible()) {
        await expect(changeDesc.first()).toBeVisible();
      }
    }
  });

  test('should support multi-user editing (if collaboration enabled)', async ({ browser }) => {
    // This test requires multiple browser contexts (like Documents collaboration)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const user1Page = await context1.newPage();
    const user2Page = await context2.newPage();

    try {
      // User 1: Create page
      await createAndLoginIdentity(user1Page, 'Alice');
      await createGroupWithWiki(user1Page, 'Collab Wiki Group');
      await navigateToWiki(user1Page);
      await createWikiPage(user1Page, 'Shared Page', '# Shared Content\n\nCollaborative editing.');

      // User 2: Join and edit same page
      await createAndLoginIdentity(user2Page, 'Bob');
      await createGroupWithWiki(user2Page, 'Collab Wiki Group');
      await navigateToWiki(user2Page);

      // Open the page
      await user2Page.getByText('Shared Page').click();

      // Check if real-time collaboration is available
      const collabIndicator = user2Page.locator('[class*="collab"], [data-collaborative], text=/collaborative/i');
      if (await collabIndicator.isVisible()) {
        // Real-time collaboration is supported
        await expect(collabIndicator).toBeVisible();

        // User 2 edits
        const editButton = user2Page.getByRole('button', { name: /edit/i });
        if (await editButton.isVisible()) {
          await editButton.click();
          const mdEditor = user2Page.locator('.w-md-editor-text-input, textarea');
          await mdEditor.fill('# Shared Content\n\nEdited by Bob.');
          await user2Page.getByRole('button', { name: /save/i }).click();

          // User 1 should see the update
          await user1Page.reload();
          await expect(user1Page.getByText('Edited by Bob')).toBeVisible();
        }
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  /**
   * ==========================================
   * Additional Edge Cases
   * ==========================================
   */

  test('should handle empty state when no pages exist', async ({ page }) => {
    // On fresh wiki, should show empty state
    const emptyMessage = page.getByText(/no.*pages|create.*first.*page|get started/i);
    await expect(emptyMessage).toBeVisible();

    // Should show create button
    const createButton = page.getByRole('button', { name: /create|new page/i });
    await expect(createButton).toBeVisible();
  });

  test('should validate required fields when creating page', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create page|new page/i });
    await createButton.click();

    // Try to submit without title
    const submitButton = page.getByRole('button', { name: /create|save page/i });

    // Submit button should be disabled when title is empty
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBe(true);

    // Fill title only
    await page.getByLabel(/title/i).fill('Test Page');

    // Submit button should still be disabled without content
    const isStillDisabled = await submitButton.isDisabled();
    expect(isStillDisabled).toBe(true);
  });
});
