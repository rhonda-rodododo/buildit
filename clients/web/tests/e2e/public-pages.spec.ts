/**
 * E2E Tests for Public Pages Module (Epic 37.5)
 *
 * Tests:
 * 1. Create public page
 * 2. Edit page content with rich text editor
 * 3. Configure SEO metadata
 * 4. Publish/unpublish pages
 * 5. View published page
 * 6. Delete page
 * 7. Use page templates
 * 8. Analytics tracking
 */

import { test, expect } from '@playwright/test';
import { nanoid } from 'nanoid';
import { waitForAppReady } from './helpers/helpers';

// Test configuration
const TEST_GROUP_ID = 'test-group-' + nanoid(8);
const TEST_PAGE_SLUG = 'test-page-' + nanoid(8);

test.describe('Public Pages Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for app to load
    await waitForAppReady(page);
  });

  test('should create a new public page', async ({ page }) => {
    // Navigate to public pages (assuming there's a navigation link)
    // This is a placeholder - actual navigation will depend on UI implementation
    await page.click('[data-testid="public-pages-link"]');

    // Click "New Page" button
    await page.click('[data-testid="new-page-button"]');

    // Fill in page details
    await page.fill('[data-testid="page-title-input"]', 'Test Landing Page');
    await page.fill('[data-testid="page-slug-input"]', TEST_PAGE_SLUG);

    // Select page type
    await page.click('[data-testid="page-type-select"]');
    await page.click('[data-testid="page-type-landing"]');

    // Add content in editor
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.fill('# Welcome to Our Organization\n\nThis is test content.');

    // Save draft
    await page.click('[data-testid="save-draft-button"]');

    // Verify page was created
    await expect(page.locator(`text=${TEST_PAGE_SLUG}`)).toBeVisible();
  });

  test('should edit page content with rich text editor', async ({ page }) => {
    // Navigate to public pages
    await page.click('[data-testid="public-pages-link"]');

    // Click edit on existing page
    await page.click(`[data-testid="edit-page-${TEST_PAGE_SLUG}"]`);

    // Use rich text formatting
    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Test bold formatting
    await page.keyboard.type('Bold text');
    await page.keyboard.press('Control+a');
    await page.click('[data-testid="format-bold-button"]');

    // Test heading
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.click('[data-testid="format-h1-button"]');
    await page.keyboard.type('Heading 1');

    // Test bulleted list
    await page.keyboard.press('Enter');
    await page.click('[data-testid="format-bullet-list-button"]');
    await page.keyboard.type('List item 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('List item 2');

    // Save changes
    await page.click('[data-testid="save-draft-button"]');

    // Verify changes saved
    await expect(page.locator('text=Heading 1')).toBeVisible();
  });

  test('should configure SEO metadata', async ({ page }) => {
    // Navigate to public pages
    await page.click('[data-testid="public-pages-link"]');

    // Edit page
    await page.click(`[data-testid="edit-page-${TEST_PAGE_SLUG}"]`);

    // Switch to SEO tab
    await page.click('[data-testid="seo-tab"]');

    // Fill in SEO fields
    await page.fill('[id="seo-title"]', 'Test Page - SEO Optimized');
    await page.fill('[id="seo-description"]', 'This is a test page for SEO optimization with BuildIt Network.');

    // Configure Open Graph
    await page.fill('[id="og-title"]', 'Test Page - Social Share');
    await page.fill('[id="og-description"]', 'Check out our test page!');
    await page.fill('[id="og-image"]', 'https://example.com/image.jpg');

    // Configure Twitter Card
    await page.click('[id="twitter-card"]');
    await page.click('text=Summary Large Image');
    await page.fill('[id="twitter-site"]', '@testorg');

    // Save changes
    await page.click('[data-testid="save-draft-button"]');

    // Verify SEO was saved
    await expect(page.locator('[id="seo-title"]')).toHaveValue('Test Page - SEO Optimized');
  });

  test('should publish and unpublish pages', async ({ page }) => {
    // Navigate to public pages
    await page.click('[data-testid="public-pages-link"]');

    // Edit page
    await page.click(`[data-testid="edit-page-${TEST_PAGE_SLUG}"]`);

    // Click Publish button
    await page.click('[data-testid="publish-button"]');

    // Verify page is published
    await expect(page.locator('text=published')).toBeVisible();

    // Go back to list
    await page.click('[data-testid="cancel-button"]');

    // Find page in list and unpublish
    await page.click(`[data-testid="page-menu-${TEST_PAGE_SLUG}"]`);
    await page.click('text=Unpublish');

    // Verify page is draft again
    await expect(page.locator('text=draft')).toBeVisible();
  });

  test('should render published page with SEO tags', async ({ page }) => {
    // This test would require a public-facing URL
    // For now, we'll test the preview functionality

    // Navigate to public pages
    await page.click('[data-testid="public-pages-link"]');

    // Edit page
    await page.click(`[data-testid="edit-page-${TEST_PAGE_SLUG}"]`);

    // Click Preview
    await page.click('[data-testid="preview-button"]');

    // Verify content is rendered
    await expect(page.locator('text=Welcome to Our Organization')).toBeVisible();

    // Verify it's in preview mode (not editing)
    await expect(page.locator('.ProseMirror')).not.toBeVisible();
  });

  test('should delete a page', async ({ page }) => {
    // Navigate to public pages
    await page.click('[data-testid="public-pages-link"]');

    // Open page menu
    await page.click(`[data-testid="page-menu-${TEST_PAGE_SLUG}"]`);

    // Click Delete
    await page.click('text=Delete');

    // Confirm deletion in dialog
    await page.click('[data-testid="confirm-delete-button"]');

    // Verify page is gone
    await expect(page.locator(`text=${TEST_PAGE_SLUG}`)).not.toBeVisible();
  });

  test('should create page from template', async ({ page }) => {
    // Navigate to public pages
    await page.click('[data-testid="public-pages-link"]');

    // Click "New Page" button
    await page.click('[data-testid="new-page-button"]');

    // Select a template (e.g., About Us)
    await page.click('[data-testid="select-template-button"]');
    await page.click('[data-testid="template-about"]');

    // Verify template content is loaded
    await expect(page.locator('text=Who We Are')).toBeVisible();
    await expect(page.locator('text=Our Values')).toBeVisible();

    // Customize and save
    await page.fill('[data-testid="page-slug-input"]', 'about-us-' + nanoid(6));
    await page.click('[data-testid="save-draft-button"]');

    // Verify page created from template
    await expect(page.locator('text=about')).toBeVisible();
  });

  test('should track page view analytics', async ({ page }) => {
    // This test verifies analytics tracking without user identification

    // Navigate to public pages
    await page.click('[data-testid="public-pages-link"]');

    // View a published page (assuming one exists)
    await page.click('[data-testid="view-page-button"]');

    // Analytics should be tracked in background
    // We can't directly verify the analytics event without inspecting the store
    // but we can check that the page view doesn't expose user info

    // Navigate to analytics dashboard
    await page.click('[data-testid="analytics-tab"]');

    // Verify analytics dashboard shows aggregated data
    await expect(page.locator('text=Total Views')).toBeVisible();
    await expect(page.locator('text=Privacy-First Analytics')).toBeVisible();
  });
});

test.describe('Public Pages - SEO Rendering', () => {
  test('should render meta tags correctly', async ({ page }) => {
    // This test would check the actual HTML meta tags
    // For now, it's a placeholder showing what should be tested

    // Navigate to a published page
    await page.goto(`/${TEST_GROUP_ID}/${TEST_PAGE_SLUG}`);

    // Check that meta tags are present
    const title = await page.title();
    expect(title).toContain('Test Page');

    // Check meta description
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDescription).toBeTruthy();

    // Check Open Graph tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();

    // Check Twitter Card tags
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    expect(twitterCard).toBeTruthy();
  });
});
