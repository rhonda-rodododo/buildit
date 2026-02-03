/**
 * E2E Tests for Forms Module (Epic 37)
 *
 * Tests:
 * 1. Create form with drag-and-drop builder
 * 2. Configure field properties (types, validation, conditional logic)
 * 3. Preview form before publishing
 * 4. Publish form
 * 5. Submit form (with anti-spam protection)
 * 6. View submissions
 * 7. Create form from template
 * 8. Multi-page forms
 * 9. Form settings (notifications, redirects, webhooks)
 * 10. Delete form
 */

import { test, expect } from '@playwright/test';
import { nanoid } from 'nanoid';
import { waitForAppReady } from './helpers/helpers';

// Test configuration
const TEST_GROUP_ID = 'test-group-' + nanoid(8);
const TEST_FORM_SLUG = 'test-form-' + nanoid(8);

test.describe('Forms Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for app to load
    await waitForAppReady(page);
  });

  test('should create a new form with form builder', async ({ page }) => {
    // Navigate to forms
    await page.click('[data-testid="forms-link"]');

    // Click "New Form" button
    await page.click('[data-testid="new-form-button"]');

    // Should see the form builder
    await expect(page.locator('[data-testid="form-builder"]')).toBeVisible();

    // Fill in form details
    await page.fill('[data-testid="form-title-input"]', 'Volunteer Signup Form');
    await page.fill('[data-testid="form-description-input"]', 'Sign up to volunteer with our organization');

    // Save draft
    await page.click('[data-testid="save-draft-button"]');

    // Verify form was created
    await expect(page.locator('text=Volunteer Signup Form')).toBeVisible();
  });

  test('should add fields using drag-and-drop', async ({ page }) => {
    // Navigate to forms
    await page.click('[data-testid="forms-link"]');

    // Create new form
    await page.click('[data-testid="new-form-button"]');

    // Drag text field from palette to canvas
    const textField = page.locator('[data-testid="field-palette-text"]');
    const canvas = page.locator('[data-testid="form-canvas"]');

    await textField.dragTo(canvas);

    // Verify field was added
    await expect(page.locator('[data-testid="field-item"]')).toBeVisible();

    // Configure field properties
    await page.click('[data-testid="field-item"]');
    await page.fill('[data-testid="field-label-input"]', 'Full Name');
    await page.check('[data-testid="field-required-checkbox"]');

    // Add email field
    const emailField = page.locator('[data-testid="field-palette-email"]');
    await emailField.dragTo(canvas);

    // Add textarea field
    const textareaField = page.locator('[data-testid="field-palette-textarea"]');
    await textareaField.dragTo(canvas);

    // Verify multiple fields
    const fieldItems = page.locator('[data-testid="field-item"]');
    await expect(fieldItems).toHaveCount(3);

    // Save form
    await page.click('[data-testid="save-draft-button"]');
  });

  test('should configure field validation', async ({ page }) => {
    // Navigate to forms and edit existing form
    await page.click('[data-testid="forms-link"]');
    await page.click('[data-testid="edit-form-button"]');

    // Select a field
    await page.click('[data-testid="field-item"]');

    // Configure validation
    await page.click('[data-testid="validation-tab"]');

    // Add min length validation
    await page.check('[data-testid="validation-minlength-enabled"]');
    await page.fill('[data-testid="validation-minlength-value"]', '3');

    // Add max length validation
    await page.check('[data-testid="validation-maxlength-enabled"]');
    await page.fill('[data-testid="validation-maxlength-value"]', '100');

    // Add pattern validation
    await page.check('[data-testid="validation-pattern-enabled"]');
    await page.fill('[data-testid="validation-pattern-value"]', '^[a-zA-Z ]+$');
    await page.fill('[data-testid="validation-pattern-message"]', 'Please enter only letters and spaces');

    // Save changes
    await page.click('[data-testid="save-draft-button"]');
  });

  test('should add conditional logic to fields', async ({ page }) => {
    // Navigate to forms and edit existing form
    await page.click('[data-testid="forms-link"]');
    await page.click('[data-testid="edit-form-button"]');

    // Select a field
    await page.click('[data-testid="field-item"]');

    // Open conditional logic editor
    await page.click('[data-testid="conditional-logic-tab"]');
    await page.click('[data-testid="add-condition-button"]');

    // Configure condition: Show field when another field equals a value
    await page.click('[data-testid="condition-field-select"]');
    await page.click('[data-testid="condition-field-option-volunteer-type"]');

    await page.click('[data-testid="condition-operator-select"]');
    await page.click('[data-testid="condition-operator-equals"]');

    await page.fill('[data-testid="condition-value-input"]', 'Event Organizer');

    // Save changes
    await page.click('[data-testid="save-draft-button"]');
  });

  test('should preview form before publishing', async ({ page }) => {
    // Navigate to forms
    await page.click('[data-testid="forms-link"]');

    // Click preview button
    await page.click('[data-testid="preview-form-button"]');

    // Should see the form preview (not builder)
    await expect(page.locator('[data-testid="form-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="form-builder"]')).not.toBeVisible();

    // Verify form fields are rendered
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Go back to builder
    await page.click('[data-testid="back-to-builder-button"]');
    await expect(page.locator('[data-testid="form-builder"]')).toBeVisible();
  });

  test('should publish form', async ({ page }) => {
    // Navigate to forms
    await page.click('[data-testid="forms-link"]');

    // Edit form
    await page.click('[data-testid="edit-form-button"]');

    // Click Publish button
    await page.click('[data-testid="publish-button"]');

    // Verify form is published
    await expect(page.locator('text=published')).toBeVisible();

    // Verify public URL is shown
    await expect(page.locator('[data-testid="public-form-url"]')).toBeVisible();
  });

  test('should submit form with anti-spam protection', async ({ page }) => {
    // Navigate to a published form (assuming one exists)
    await page.goto(`/forms/${TEST_FORM_SLUG}`);

    // Fill out the form
    await page.fill('input[name="fullName"]', 'John Doe');
    await page.fill('input[name="email"]', 'john@example.com');
    await page.fill('textarea[name="message"]', 'I would like to volunteer!');

    // Honeypot field should NOT be filled (anti-spam)
    const honeypot = page.locator('input[name="website"]');
    if (await honeypot.isVisible()) {
      // If visible, it means the test is checking for bot behavior
      // Real users shouldn't fill this field
      await expect(honeypot).toHaveValue('');
    }

    // Submit form
    await page.click('[data-testid="submit-form-button"]');

    // Verify success message
    await expect(page.locator('text=Thank you for your submission')).toBeVisible();
  });

  test('should view form submissions', async ({ page }) => {
    // Navigate to forms
    await page.click('[data-testid="forms-link"]');

    // Click on a form
    await page.click('[data-testid="form-card"]');

    // View submissions
    await page.click('[data-testid="view-submissions-button"]');

    // Verify submissions list is visible
    await expect(page.locator('[data-testid="submissions-list"]')).toBeVisible();

    // Should show submission count
    await expect(page.locator('[data-testid="submission-count"]')).toBeVisible();

    // Click on a submission to view details
    await page.click('[data-testid="submission-item"]');

    // Verify submission details are shown
    await expect(page.locator('[data-testid="submission-details"]')).toBeVisible();
    await expect(page.locator('text=john@example.com')).toBeVisible();
  });

  test('should export submissions to CSV', async ({ page }) => {
    // Navigate to submissions
    await page.click('[data-testid="forms-link"]');
    await page.click('[data-testid="view-submissions-button"]');

    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;

    // Verify file name
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should create form from template', async ({ page }) => {
    // Navigate to forms
    await page.click('[data-testid="forms-link"]');

    // Click "View Templates" button
    await page.click('[data-testid="view-templates-button"]');

    // Select a template (e.g., Volunteer Signup)
    await page.click('[data-testid="template-volunteer-signup"]');

    // Verify template content is loaded
    await expect(page.locator('[data-testid="field-item"]')).toHaveCount(5); // Template has 5 fields

    // Customize and save
    await page.fill('[data-testid="form-title-input"]', 'My Volunteer Form');
    await page.click('[data-testid="save-draft-button"]');

    // Verify form created from template
    await expect(page.locator('text=My Volunteer Form')).toBeVisible();
  });

  test('should create multi-page form', async ({ page }) => {
    // Navigate to forms
    await page.click('[data-testid="forms-link"]');
    await page.click('[data-testid="new-form-button"]');

    // Enable multi-page mode
    await page.click('[data-testid="form-settings-tab"]');
    await page.check('[data-testid="enable-multi-page-checkbox"]');

    // Add fields to page 1
    await page.click('[data-testid="form-builder-tab"]');
    const textField = page.locator('[data-testid="field-palette-text"]');
    const canvas = page.locator('[data-testid="form-canvas"]');
    await textField.dragTo(canvas);

    // Add page 2
    await page.click('[data-testid="add-page-button"]');
    await expect(page.locator('text=Page 2')).toBeVisible();

    // Add fields to page 2
    const emailField = page.locator('[data-testid="field-palette-email"]');
    await emailField.dragTo(canvas);

    // Save form
    await page.click('[data-testid="save-draft-button"]');

    // Preview to verify multi-page navigation
    await page.click('[data-testid="preview-form-button"]');
    await expect(page.locator('[data-testid="form-page-1"]')).toBeVisible();
    await page.click('[data-testid="next-page-button"]');
    await expect(page.locator('[data-testid="form-page-2"]')).toBeVisible();
  });

  test('should configure form settings', async ({ page }) => {
    // Navigate to forms and edit
    await page.click('[data-testid="forms-link"]');
    await page.click('[data-testid="edit-form-button"]');

    // Go to settings tab
    await page.click('[data-testid="form-settings-tab"]');

    // Configure notification email
    await page.fill('[data-testid="notification-email-input"]', 'admin@example.org');

    // Configure redirect URL
    await page.fill('[data-testid="redirect-url-input"]', 'https://example.org/thank-you');

    // Configure custom confirmation message
    await page.fill(
      '[data-testid="confirmation-message-input"]',
      'Thank you! We will be in touch soon.'
    );

    // Enable CAPTCHA
    await page.check('[data-testid="enable-captcha-checkbox"]');
    await page.click('[data-testid="captcha-provider-select"]');
    await page.click('[data-testid="captcha-provider-hcaptcha"]');
    await page.fill('[data-testid="captcha-site-key-input"]', 'test-site-key');

    // Configure webhook
    await page.check('[data-testid="enable-webhook-checkbox"]');
    await page.fill('[data-testid="webhook-url-input"]', 'https://example.org/webhook');

    // Save settings
    await page.click('[data-testid="save-draft-button"]');
  });

  test('should delete a form', async ({ page }) => {
    // Navigate to forms
    await page.click('[data-testid="forms-link"]');

    // Open form menu
    await page.click('[data-testid="form-menu-button"]');

    // Click Delete
    await page.click('text=Delete');

    // Confirm deletion in dialog
    await page.click('[data-testid="confirm-delete-button"]');

    // Verify form is gone
    await expect(page.locator('text=Volunteer Signup Form')).not.toBeVisible();
  });

  test('should handle form validation on submit', async ({ page }) => {
    // Navigate to a published form
    await page.goto(`/forms/${TEST_FORM_SLUG}`);

    // Try to submit without filling required fields
    await page.click('[data-testid="submit-form-button"]');

    // Verify validation errors are shown
    await expect(page.locator('text=This field is required')).toBeVisible();

    // Fill in required fields
    await page.fill('input[name="fullName"]', 'Jo'); // Too short (min 3 chars)
    await page.click('[data-testid="submit-form-button"]');

    // Verify min length validation error
    await expect(page.locator('text=Must be at least 3 characters')).toBeVisible();

    // Fix validation and submit successfully
    await page.fill('input[name="fullName"]', 'John Doe');
    await page.fill('input[name="email"]', 'john@example.com');
    await page.click('[data-testid="submit-form-button"]');

    // Verify success
    await expect(page.locator('text=Thank you')).toBeVisible();
  });
});

test.describe('Forms Module - Analytics', () => {
  test('should track form analytics', async ({ page }) => {
    // Navigate to forms
    await page.click('[data-testid="forms-link"]');

    // View form analytics
    await page.click('[data-testid="form-analytics-button"]');

    // Verify analytics dashboard
    await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();

    // Should show key metrics
    await expect(page.locator('text=Total Views')).toBeVisible();
    await expect(page.locator('text=Total Submissions')).toBeVisible();
    await expect(page.locator('text=Conversion Rate')).toBeVisible();
    await expect(page.locator('text=Avg. Completion Time')).toBeVisible();

    // Verify privacy-first approach (no user identification)
    await expect(page.locator('text=Privacy-First Analytics')).toBeVisible();
  });
});
