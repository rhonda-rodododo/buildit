/**
 * E2E Tests for Form Submissions
 * Tests the public form submission workflow, spam detection,
 * submission management, filtering, and analytics
 */

import { test, expect, type BrowserContext } from '@playwright/test';
import {
  createAndLoginIdentity,
  createGroup,
  navigateToForms,
  createForm,
  addFieldToForm,
  editFieldProperties,
  publishForm,
  navigateToPublicForm,
  submitForm,
  navigateToSubmissions,
  filterSubmissions,
  markAsSpam,
  navigateToFormAnalytics,
  getAnalyticsMetrics,
} from './helpers/forms-helpers';

const TEST_GROUP_NAME = 'Form Submission Test Group';

test.describe('Form Submissions', () => {
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

  test('should submit form publicly and view in admin panel', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    // Admin: Create identity, group, and form
    await createAndLoginIdentity(adminPage, 'Admin User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Public Contact Form',
      description: 'Get in touch',
    });

    // Add fields
    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Name',
      required: true,
    });

    await addFieldToForm(adminPage, 'email');
    await editFieldProperties(adminPage, 1, {
      label: 'Email',
      required: true,
    });

    await addFieldToForm(adminPage, 'textarea');
    await editFieldProperties(adminPage, 2, {
      label: 'Message',
      required: true,
    });

    // Publish form and get form ID
    await publishForm(adminPage);

    // Get form ID from URL or data attribute
    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Public user: Navigate to public form (no login required)
    await navigateToPublicForm(publicPage, formId!);

    // Verify form renders without login
    await expect(publicPage.locator('[data-testid="public-form"]')).toBeVisible();
    await expect(publicPage.locator('text=Public Contact Form')).toBeVisible();

    // Fill out form
    await submitForm(publicPage, {
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello, I would like to get in touch.',
    });

    // Verify thank you message
    await expect(publicPage.locator('text=Thank you')).toBeVisible();

    // Admin: Navigate to submissions
    await navigateToSubmissions(adminPage, formId!);

    // Verify submission appears
    await expect(adminPage.locator('text=John Doe')).toBeVisible();
    await expect(adminPage.locator('text=john@example.com')).toBeVisible();

    // Click to view details
    await adminPage.click('[data-testid^="submission-"]');

    // Verify submission details
    await expect(adminPage.locator('text=Hello, I would like to get in touch.')).toBeVisible();
  });

  test('should trigger anti-spam honeypot', async () => {
    const adminPage = await adminContext.newPage();
    const botPage = await publicContext.newPage();

    // Admin: Create form with honeypot enabled
    await createAndLoginIdentity(adminPage, 'Admin User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Honeypot Test Form',
    });

    await addFieldToForm(adminPage, 'email');
    await editFieldProperties(adminPage, 0, {
      label: 'Email',
      required: true,
    });

    // Enable honeypot
    await adminPage.click('button:has-text("Settings")');
    await adminPage.click('button:has-text("Anti-Spam")');
    await adminPage.check('input[name="enableHoneypot"]');
    await adminPage.click('button:has-text("Save Settings")');

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Bot: Navigate to form and fill honeypot field
    await navigateToPublicForm(botPage, formId!);

    // Fill legitimate field
    await botPage.fill('input[name="email"]', 'bot@example.com');

    // Fill honeypot field (hidden from humans but visible to bots)
    await botPage.fill('input[name="website"]', 'http://spam.com');

    // Submit
    await botPage.click('button[type="submit"]');

    // Bot should see success message (silent rejection)
    await expect(botPage.locator('text=Thank you')).toBeVisible();

    // Admin: Check submissions
    await navigateToSubmissions(adminPage, formId!);

    // Submission should NOT appear (or be flagged as spam)
    const submissions = await adminPage.locator('[data-testid^="submission-"]').count();
    expect(submissions).toBe(0);
  });

  test('should enforce submission limits', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    // Admin: Create form with max 2 submissions
    await createAndLoginIdentity(adminPage, 'Admin User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Limited Submissions Form',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Name',
      required: true,
    });

    // Set submission limit
    await adminPage.click('button:has-text("Settings")');
    await adminPage.check('input[name="limitSubmissions"]');
    await adminPage.fill('input[name="maxSubmissions"]', '2');
    await adminPage.click('button:has-text("Save Settings")');

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Submit form twice
    await navigateToPublicForm(publicPage, formId!);
    await submitForm(publicPage, { name: 'Submission 1' });

    await navigateToPublicForm(publicPage, formId!);
    await submitForm(publicPage, { name: 'Submission 2' });

    // Try to submit third time
    await navigateToPublicForm(publicPage, formId!);

    // Verify limit reached message
    await expect(publicPage.locator('text=This form is no longer accepting submissions')).toBeVisible();

    // Submit button should be disabled
    await expect(publicPage.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should filter and search submissions', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Admin User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Filter Test Form',
    });

    await addFieldToForm(adminPage, 'email');
    await editFieldProperties(adminPage, 0, {
      label: 'Email',
      required: true,
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Submit multiple forms
    for (let i = 1; i <= 3; i++) {
      await navigateToPublicForm(publicPage, formId!);
      await submitForm(publicPage, {
        email: `user${i}@example.com`,
      });
    }

    // Admin: Navigate to submissions
    await navigateToSubmissions(adminPage, formId!);

    // Verify all 3 submissions appear
    const allSubmissions = await adminPage.locator('[data-testid^="submission-"]').count();
    expect(allSubmissions).toBe(3);

    // Filter by unprocessed
    await filterSubmissions(adminPage, 'unprocessed');

    // All should be unprocessed initially
    const unprocessed = await adminPage.locator('[data-testid^="submission-"]').count();
    expect(unprocessed).toBe(3);

    // Mark one as processed
    const firstSubmissionId = await adminPage.getAttribute('[data-testid^="submission-"]', 'data-submission-id');
    await adminPage.click(`[data-testid="submission-${firstSubmissionId}"] button:has-text("Mark as Processed")`);

    // Filter by processed
    await filterSubmissions(adminPage, 'processed');

    const processed = await adminPage.locator('[data-testid^="submission-"]').count();
    expect(processed).toBe(1);

    // Search by email
    await adminPage.fill('input[placeholder="Search submissions"]', 'user2@example.com');
    await adminPage.click('button:has-text("Search")');

    // Should only show user2 submission
    await expect(adminPage.locator('text=user2@example.com')).toBeVisible();
    await expect(adminPage.locator('text=user1@example.com')).not.toBeVisible();
  });

  test('should flag submission as spam and filter spam', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Admin User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Spam Filter Test',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Comment',
      required: true,
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Submit a legitimate entry
    await navigateToPublicForm(publicPage, formId!);
    await submitForm(publicPage, {
      comment: 'This is a legitimate comment.',
    });

    // Submit a spam entry
    await navigateToPublicForm(publicPage, formId!);
    await submitForm(publicPage, {
      comment: 'BUY CHEAP VIAGRA NOW!!!',
    });

    // Admin: Navigate to submissions
    await navigateToSubmissions(adminPage, formId!);

    // Find spam submission
    const spamSubmission = adminPage.locator('text=BUY CHEAP VIAGRA NOW!!!').locator('..').locator('[data-testid^="submission-"]');
    const spamId = await spamSubmission.getAttribute('data-submission-id');

    // Mark as spam
    await markAsSpam(adminPage, spamId!);

    // Filter by spam
    await filterSubmissions(adminPage, 'spam');

    // Should only show spam submission
    await expect(adminPage.locator('text=BUY CHEAP VIAGRA NOW!!!')).toBeVisible();
    await expect(adminPage.locator('text=This is a legitimate comment.')).not.toBeVisible();

    // Filter by all (non-spam)
    await filterSubmissions(adminPage, 'all');

    // Spam should be hidden by default in "all" filter
    await expect(adminPage.locator('text=This is a legitimate comment.')).toBeVisible();
    await expect(adminPage.locator('text=BUY CHEAP VIAGRA NOW!!!')).not.toBeVisible();
  });

  test('should export submissions to CSV', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Admin User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Export Test Form',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Name',
      required: true,
    });

    await addFieldToForm(adminPage, 'email');
    await editFieldProperties(adminPage, 1, {
      label: 'Email',
      required: true,
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Submit some forms
    for (let i = 1; i <= 3; i++) {
      await navigateToPublicForm(publicPage, formId!);
      await submitForm(publicPage, {
        name: `User ${i}`,
        email: `user${i}@example.com`,
      });
    }

    // Admin: Navigate to submissions
    await navigateToSubmissions(adminPage, formId!);

    // Export to CSV
    const downloadPromise = adminPage.waitForEvent('download');
    await adminPage.click('button:has-text("Export")');
    await adminPage.click('text=CSV');

    // Check that download was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');

    // Optionally verify CSV content
    const path = await download.path();
    const fs = require('fs');
    const csvContent = fs.readFileSync(path!, 'utf-8');

    // Verify CSV headers and data
    expect(csvContent).toContain('Name,Email');
    expect(csvContent).toContain('User 1,user1@example.com');
    expect(csvContent).toContain('User 2,user2@example.com');
    expect(csvContent).toContain('User 3,user3@example.com');
  });

  test('should display form analytics', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Admin User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Analytics Test Form',
    });

    await addFieldToForm(adminPage, 'email');
    await editFieldProperties(adminPage, 0, {
      label: 'Email',
      required: true,
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Generate analytics events

    // View 1: Load form without submitting
    await navigateToPublicForm(publicPage, formId!);
    await publicPage.waitForTimeout(1000);
    await publicPage.close();

    // View 2: Load form without submitting
    const publicPage2 = await publicContext.newPage();
    await navigateToPublicForm(publicPage2, formId!);
    await publicPage2.waitForTimeout(1000);

    // View 3: Load and submit
    await submitForm(publicPage2, {
      email: 'analytics@example.com',
    });

    // View 4: Load form without submitting
    const publicPage3 = await publicContext.newPage();
    await navigateToPublicForm(publicPage3, formId!);
    await publicPage3.waitForTimeout(1000);

    // Admin: Navigate to analytics
    await navigateToFormAnalytics(adminPage, formId!);

    // Get metrics
    const metrics = await getAnalyticsMetrics(adminPage);

    // Verify metrics
    expect(metrics.views).toBeGreaterThanOrEqual(4); // At least 4 views
    expect(metrics.submissions).toBe(1); // 1 submission
    expect(metrics.conversionRate).toBeGreaterThan(0); // Some conversion rate

    // Verify charts are displayed
    await expect(adminPage.locator('[data-testid="analytics-chart"]')).toBeVisible();

    // Verify top referrers section
    await expect(adminPage.locator('text=Top Referrers')).toBeVisible();
  });

  test('should handle rate limiting', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    // Admin: Create form with rate limiting
    await createAndLoginIdentity(adminPage, 'Admin User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Rate Limited Form',
    });

    await addFieldToForm(adminPage, 'email');
    await editFieldProperties(adminPage, 0, {
      label: 'Email',
      required: true,
    });

    // Enable rate limiting: max 2 submissions per minute
    await adminPage.click('button:has-text("Settings")');
    await adminPage.click('button:has-text("Anti-Spam")');
    await adminPage.check('input[name="enableRateLimit"]');
    await adminPage.fill('input[name="rateLimitCount"]', '2');
    await adminPage.click('button:has-text("Save Settings")');

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Submit form twice quickly
    await navigateToPublicForm(publicPage, formId!);
    await submitForm(publicPage, { email: 'test1@example.com' });

    await navigateToPublicForm(publicPage, formId!);
    await submitForm(publicPage, { email: 'test2@example.com' });

    // Try to submit a third time (should be rate limited)
    await navigateToPublicForm(publicPage, formId!);
    await publicPage.fill('input[name="email"]', 'test3@example.com');
    await publicPage.click('button[type="submit"]');

    // Verify rate limit message
    await expect(publicPage.locator('text=Too many submissions')).toBeVisible();
    await expect(publicPage.locator('text=Please try again later')).toBeVisible();
  });

  test('should send auto-response email on submission', async () => {
    const adminPage = await adminContext.newPage();
    const publicPage = await publicContext.newPage();

    // Admin: Create form with auto-response enabled
    await createAndLoginIdentity(adminPage, 'Admin User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Auto-Response Form',
    });

    await addFieldToForm(adminPage, 'email');
    await editFieldProperties(adminPage, 0, {
      label: 'Email',
      required: true,
    });

    // Configure auto-response
    await adminPage.click('button:has-text("Settings")');
    await adminPage.click('button:has-text("Notifications")');
    await adminPage.check('input[name="sendAutoResponse"]');
    await adminPage.fill('input[name="autoResponseSubject"]', 'Thank you for your submission');
    await adminPage.fill(
      'textarea[name="autoResponseBody"]',
      'We have received your submission and will get back to you soon.'
    );
    await adminPage.click('button:has-text("Save Settings")');

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Submit form
    await navigateToPublicForm(publicPage, formId!);
    await submitForm(publicPage, { email: 'autoresponse@example.com' });

    // In a real test, we would verify email was sent
    // For now, verify confirmation message mentions email
    await expect(publicPage.locator('text=check your email')).toBeVisible();
  });
});
