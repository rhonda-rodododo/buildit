/**
 * E2E Tests for Public Pages
 * Tests public page creation, SEO controls, publishing,
 * and meta tag verification
 */

import { test, expect, type BrowserContext } from '@playwright/test';
import {
  createAndLoginIdentity,
  createGroup,
  navigateToPublicPages,
  createPublicPage,
  configureSEO,
  publishPublicPage,
  navigateToPublishedPage,
} from './helpers/forms-helpers';

const TEST_GROUP_NAME = 'Public Pages Test Group';

test.describe('Public Pages', () => {
  let adminContext: BrowserContext;
  let publicContext: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    adminContext = await browser.newContext();
    publicContext = await browser.newContext();
  });

  test.afterEach(async () => {
    await adminContext.close();
    await publicContext.close();
  });

  test('should create public page with SEO', async () => {
    const adminPage = await adminContext.newPage();

    // Setup
    await createAndLoginIdentity(adminPage, 'Public Page Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);

    // Navigate to public pages
    await navigateToPublicPages(adminPage);

    // Create new page
    await createPublicPage(adminPage, {
      title: 'About Us',
      slug: 'about-us',
      content: '# About Our Organization\n\nWe fight for justice and equality.',
      type: 'about',
    });

    // Configure SEO
    await configureSEO(adminPage, {
      title: 'About Us - Workers United',
      description: 'Learn about our mission to fight for justice and worker rights.',
      ogImage: '/images/about-og.jpg',
      twitterCard: 'summary_large_image',
    });

    // Publish page
    await publishPublicPage(adminPage);

    // Navigate to public URL
    const publicPage = await publicContext.newPage();
    await navigateToPublishedPage(publicPage, 'about-us');

    // Verify page renders
    await expect(publicPage.locator('text=About Our Organization')).toBeVisible();
    await expect(publicPage.locator('text=We fight for justice and equality.')).toBeVisible();

    // Check meta tags in page source
    const htmlContent = await publicPage.content();

    // SEO title
    expect(htmlContent).toContain('<title>About Us - Workers United</title>');

    // Meta description
    expect(htmlContent).toContain(
      '<meta name="description" content="Learn about our mission to fight for justice and worker rights."'
    );

    // Open Graph tags
    expect(htmlContent).toContain('<meta property="og:title" content="About Us - Workers United"');
    expect(htmlContent).toContain('<meta property="og:image" content="/images/about-og.jpg"');
    expect(htmlContent).toContain('<meta property="og:type" content="website"');

    // Twitter Card tags
    expect(htmlContent).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(htmlContent).toContain('<meta name="twitter:title" content="About Us - Workers United"');
  });

  test('should validate SEO controls', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'SEO Test Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    await createPublicPage(adminPage, {
      title: 'SEO Validation Test',
      slug: 'seo-test',
      content: 'Testing SEO controls',
      type: 'custom',
    });

    // Configure SEO with character count validation
    await adminPage.click('button:has-text("SEO Settings")');

    // Enter SEO title and verify character count
    const titleInput = adminPage.locator('input[name="seoTitle"]');
    await titleInput.fill('This is a very long SEO title that exceeds the recommended character limit for search engines');

    // Verify character count warning
    await expect(adminPage.locator('text=70 characters recommended')).toBeVisible();
    const charCount = await adminPage.locator('[data-testid="title-char-count"]').innerText();
    expect(parseInt(charCount)).toBeGreaterThan(70);

    // Enter description with character limit
    const descInput = adminPage.locator('textarea[name="seoDescription"]');
    await descInput.fill(
      'This is a meta description that should be within the recommended character limit of 160 characters for optimal SEO performance in search results.'
    );

    // Verify description character count
    const descCharCount = await adminPage.locator('[data-testid="description-char-count"]').innerText();
    expect(parseInt(descCharCount)).toBeLessThanOrEqual(160);

    // Upload OG image
    await adminPage.fill('input[name="ogImage"]', '/images/test-og.jpg');

    // Preview Twitter Card
    await adminPage.click('button:has-text("Preview Twitter Card")');
    await expect(adminPage.locator('[data-testid="twitter-card-preview"]')).toBeVisible();

    // Set robots.txt (noindex/nofollow)
    await adminPage.selectOption('select[name="robots"]', 'noindex, nofollow');

    // Save SEO settings
    await adminPage.click('button:has-text("Save SEO")');

    // Publish and verify
    await publishPublicPage(adminPage);

    // Check robots meta tag
    const publicPage = await publicContext.newPage();
    await navigateToPublishedPage(publicPage, 'seo-test');

    const htmlContent = await publicPage.content();
    expect(htmlContent).toContain('<meta name="robots" content="noindex, nofollow"');
  });

  test('should create landing page with rich content', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'Landing Page Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    // Create landing page
    await createPublicPage(adminPage, {
      title: 'Join the Movement',
      slug: 'join',
      content: '# Join the Movement\n\n## Why Join Us?\n\n- **Fight for Justice**\n- **Build Community**\n- **Make Change**',
      type: 'landing',
    });

    // Add Schema.org JSON-LD
    await adminPage.click('button:has-text("SEO Settings")');
    await adminPage.click('button:has-text("Advanced")');

    const schemaJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Workers United',
      description: 'Fighting for justice and worker rights',
      url: 'https://workersunited.org',
    });

    await adminPage.fill('textarea[name="schemaOrgJson"]', schemaJson);
    await adminPage.click('button:has-text("Save SEO")');

    await publishPublicPage(adminPage);

    // Verify on public page
    const publicPage = await publicContext.newPage();
    await navigateToPublishedPage(publicPage, 'join');

    // Verify rich content renders
    await expect(publicPage.locator('h1:has-text("Join the Movement")')).toBeVisible();
    await expect(publicPage.locator('h2:has-text("Why Join Us?")')).toBeVisible();
    await expect(publicPage.locator('text=Fight for Justice')).toBeVisible();
    await expect(publicPage.locator('text=Build Community')).toBeVisible();
    await expect(publicPage.locator('text=Make Change')).toBeVisible();

    // Verify Schema.org JSON-LD in page source
    const htmlContent = await publicPage.content();
    expect(htmlContent).toContain('"@type":"Organization"');
    expect(htmlContent).toContain('"name":"Workers United"');
  });

  test('should create events calendar public view', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'Events Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    // Create events page
    await createPublicPage(adminPage, {
      title: 'Upcoming Events',
      slug: 'events',
      content: '# Upcoming Events\n\nJoin us at our next organizing meeting!',
      type: 'events',
    });

    // Configure to show events module
    await adminPage.click('button:has-text("Page Settings")');
    await adminPage.check('input[name="showEventsCalendar"]');
    await adminPage.click('button:has-text("Save Settings")');

    await publishPublicPage(adminPage);

    // Verify on public page
    const publicPage = await publicContext.newPage();
    await navigateToPublishedPage(publicPage, 'events');

    await expect(publicPage.locator('text=Upcoming Events')).toBeVisible();
    await expect(publicPage.locator('[data-testid="events-calendar"]')).toBeVisible();
  });

  test('should create contact page with embedded form', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'Contact Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    // Create contact page
    await createPublicPage(adminPage, {
      title: 'Contact Us',
      slug: 'contact',
      content: '# Get in Touch\n\nWe\'d love to hear from you.',
      type: 'contact',
    });

    // Embed a form (assumes form already exists or create one)
    await adminPage.click('button:has-text("Embed Form")');
    await adminPage.selectOption('select[name="formId"]', { index: 0 }); // Select first form
    await adminPage.click('button:has-text("Embed")');

    await publishPublicPage(adminPage);

    // Verify on public page
    const publicPage = await publicContext.newPage();
    await navigateToPublishedPage(publicPage, 'contact');

    await expect(publicPage.locator('text=Get in Touch')).toBeVisible();
    await expect(publicPage.locator('[data-testid="embedded-form"]')).toBeVisible();
  });

  test('should support custom domain configuration', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'Domain Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    // Navigate to domain settings
    await adminPage.click('button:has-text("Settings")');
    await adminPage.click('text=Custom Domain');

    // Enter custom domain
    await adminPage.fill('input[name="customDomain"]', 'www.workersunited.org');

    // Verify CNAME instructions shown
    await expect(adminPage.locator('text=CNAME Record')).toBeVisible();
    await expect(adminPage.locator('text=Point your domain to:')).toBeVisible();

    // Save domain settings
    await adminPage.click('button:has-text("Save Domain")');

    // Verify domain saved
    await expect(adminPage.locator('text=Custom domain configured')).toBeVisible();
  });

  test('should generate sitemap.xml', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'Sitemap Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    // Create multiple public pages
    await createPublicPage(adminPage, {
      title: 'Home',
      slug: 'home',
      content: 'Welcome home',
      type: 'landing',
    });
    await publishPublicPage(adminPage);

    await navigateToPublicPages(adminPage);

    await createPublicPage(adminPage, {
      title: 'About',
      slug: 'about',
      content: 'About us',
      type: 'about',
    });
    await publishPublicPage(adminPage);

    // Generate sitemap
    await navigateToPublicPages(adminPage);
    await adminPage.click('button:has-text("Generate Sitemap")');

    // Verify sitemap generated
    await expect(adminPage.locator('text=Sitemap generated')).toBeVisible();

    // Navigate to sitemap URL
    const publicPage = await publicContext.newPage();
    await publicPage.goto('/sitemap.xml');

    // Verify sitemap contains pages
    const sitemapContent = await publicPage.content();
    expect(sitemapContent).toContain('<urlset');
    expect(sitemapContent).toContain('/public/pages/home');
    expect(sitemapContent).toContain('/public/pages/about');
  });

  test('should support privacy-respecting analytics', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    await createAndLoginIdentity(adminPage, 'Analytics Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    await createPublicPage(adminPage, {
      title: 'Analytics Test Page',
      slug: 'analytics-test',
      content: 'Testing analytics',
      type: 'custom',
    });

    // Enable analytics
    await adminPage.click('button:has-text("Settings")');
    await adminPage.check('input[name="enableAnalytics"]');
    await adminPage.click('button:has-text("Save Settings")');

    await publishPublicPage(adminPage);

    // Visit page as public user
    await navigateToPublishedPage(publicPage, 'analytics-test');

    // Wait for analytics event
    await publicPage.waitForTimeout(2000);

    // Admin: Check analytics
    await navigateToPublicPages(adminPage);
    await adminPage.click('[data-testid="page-analytics-test"]');
    await adminPage.click('text=Analytics');

    // Verify page view was tracked
    await expect(adminPage.locator('text=1 view')).toBeVisible();

    // Verify NO personal data tracked
    await expect(adminPage.locator('text=IP Address')).not.toBeVisible();
    await expect(adminPage.locator('text=User ID')).not.toBeVisible();
  });

  test('should preview page before publishing', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'Preview Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    await createPublicPage(adminPage, {
      title: 'Preview Test',
      slug: 'preview-test',
      content: '# Draft Content\n\nThis is still in draft.',
      type: 'custom',
    });

    // Don't publish yet, just preview
    await adminPage.click('button:has-text("Preview")');

    // Verify preview modal/page opens
    await expect(adminPage.locator('[data-testid="page-preview"]')).toBeVisible();
    await expect(adminPage.locator('text=Draft Content')).toBeVisible();

    // Close preview
    await adminPage.click('button:has-text("Close Preview")');

    // Verify page is still in draft status
    await navigateToPublicPages(adminPage);
    await expect(adminPage.locator('[data-testid="page-preview-test"] [data-status="draft"]')).toBeVisible();
  });

  test('should unpublish and archive pages', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    await createAndLoginIdentity(adminPage, 'Unpublish Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    await createPublicPage(adminPage, {
      title: 'Temporary Page',
      slug: 'temporary',
      content: 'This will be unpublished',
      type: 'custom',
    });

    await publishPublicPage(adminPage);

    // Verify page is accessible
    await navigateToPublishedPage(publicPage, 'temporary');
    await expect(publicPage.locator('text=This will be unpublished')).toBeVisible();

    // Unpublish page
    await navigateToPublicPages(adminPage);
    await adminPage.click('[data-testid="page-temporary"]');
    await adminPage.click('button:has-text("Unpublish")');
    await adminPage.click('button:has-text("Confirm")');

    // Verify page is no longer accessible
    await navigateToPublishedPage(publicPage, 'temporary');
    await expect(publicPage.locator('text=Page not found')).toBeVisible();

    // Verify page still exists in admin (as draft)
    await navigateToPublicPages(adminPage);
    await expect(adminPage.locator('[data-testid="page-temporary"] [data-status="draft"]')).toBeVisible();
  });

  test('should validate slug uniqueness', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'Slug Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToPublicPages(adminPage);

    // Create first page
    await createPublicPage(adminPage, {
      title: 'First Page',
      slug: 'unique-slug',
      content: 'First page content',
      type: 'custom',
    });
    await publishPublicPage(adminPage);

    // Try to create second page with same slug
    await navigateToPublicPages(adminPage);
    await adminPage.click('button:has-text("New Page")');
    await adminPage.fill('input[name="title"]', 'Second Page');
    await adminPage.fill('input[name="slug"]', 'unique-slug');

    // Verify slug validation error
    await expect(adminPage.locator('text=This slug is already in use')).toBeVisible();

    // Submit button should be disabled
    await expect(adminPage.locator('button:has-text("Create")')).toBeDisabled();

    // Change to unique slug
    await adminPage.fill('input[name="slug"]', 'unique-slug-2');

    // Error should disappear
    await expect(adminPage.locator('text=This slug is already in use')).not.toBeVisible();

    // Submit button should be enabled
    await expect(adminPage.locator('button:has-text("Create")')).toBeEnabled();
  });
});
