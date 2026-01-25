/**
 * E2E Tests for Form Builder
 * Tests the complete form builder workflow including drag-and-drop,
 * field configuration, conditional logic, and multi-page forms
 */

import { test, expect, type BrowserContext } from '@playwright/test';
import {
  createAndLoginIdentity,
  createGroup,
  navigateToForms,
  createForm,
  addFieldToForm,
  editFieldProperties,
  addConditionalLogic,
  previewForm,
  publishForm,
  saveFormDraft,
  waitForAndVerify,
} from './helpers/forms-helpers';

const TEST_GROUP_NAME = 'Form Builder Test Group';

test.describe('Form Builder', () => {
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should create a form with drag-and-drop fields', async () => {
    const page = await context.newPage();

    // Setup: Create identity and group
    await createAndLoginIdentity(page, 'Form Builder Test User');
    await createGroup(page, TEST_GROUP_NAME);

    // Navigate to forms module
    await navigateToForms(page);

    // Create a new form
    await createForm(page, {
      title: 'Contact Form',
      description: 'Get in touch with us',
    });

    // Verify form builder is loaded
    await waitForAndVerify(page, '[data-testid="form-builder"]');

    // Add text field
    await addFieldToForm(page, 'text');

    // Edit field properties
    await editFieldProperties(page, 0, {
      label: 'Full Name',
      placeholder: 'Enter your full name',
      required: true,
      helpText: 'Please provide your first and last name',
    });

    // Add email field
    await addFieldToForm(page, 'email');
    await editFieldProperties(page, 1, {
      label: 'Email Address',
      placeholder: 'you@example.com',
      required: true,
    });

    // Add textarea field
    await addFieldToForm(page, 'textarea');
    await editFieldProperties(page, 2, {
      label: 'Message',
      placeholder: 'Tell us what you need...',
      required: true,
    });

    // Preview form
    await previewForm(page);

    // Verify fields appear in preview
    await expect(page.locator('text=Full Name')).toBeVisible();
    await expect(page.locator('text=Email Address')).toBeVisible();
    await expect(page.locator('text=Message')).toBeVisible();

    // Exit preview
    await page.click('button:has-text("Back to Editor")');

    // Save as draft
    await saveFormDraft(page);

    // Verify form appears in forms list
    await navigateToForms(page);
    await expect(page.locator('text=Contact Form')).toBeVisible();
  });

  test('should create form from template', async () => {
    const page = await context.newPage();

    await createAndLoginIdentity(page, 'Template Test User');
    await createGroup(page, TEST_GROUP_NAME);
    await navigateToForms(page);

    // Create form from template
    await page.click('button:has-text("New Form")');
    await page.click('button:has-text("Use Template")');

    // Select Event Registration template
    await page.click('[data-testid="template-event-registration"]');

    // Verify template fields are loaded
    await waitForAndVerify(page, '[data-testid="form-builder"]');

    // Verify template has pre-configured fields
    await expect(page.locator('text=Name')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Dietary Restrictions')).toBeVisible();

    // Customize template: Add phone field
    await addFieldToForm(page, 'phone');
    await editFieldProperties(page, 3, {
      label: 'Phone Number',
      required: false,
    });

    // Update form title
    await page.fill('input[name="title"]', 'Custom Event Registration');

    // Publish form
    await publishForm(page);

    // Verify customized form works
    await navigateToForms(page);
    await expect(page.locator('text=Custom Event Registration')).toBeVisible();
  });

  test('should add conditional logic to form', async () => {
    const page = await context.newPage();

    await createAndLoginIdentity(page, 'Conditional Logic User');
    await createGroup(page, TEST_GROUP_NAME);
    await navigateToForms(page);

    // Create new form
    await createForm(page, {
      title: 'RSVP Form with Conditions',
    });

    // Add checkbox field: "Will you attend?"
    await addFieldToForm(page, 'checkbox');
    await editFieldProperties(page, 0, {
      label: 'Will you attend?',
      required: true,
    });

    // Add text field: "Dietary restrictions"
    await addFieldToForm(page, 'text');
    await editFieldProperties(page, 1, {
      label: 'Dietary restrictions',
      required: false,
    });

    // Add conditional logic: show dietary field only when attending
    await addConditionalLogic(page, 1, {
      watchFieldIndex: 0,
      operator: 'equals',
      value: 'true',
      action: 'show',
    });

    // Preview form to test logic
    await previewForm(page);

    // Initially, dietary field should be hidden
    await expect(page.locator('input[name="dietary-restrictions"]')).not.toBeVisible();

    // Check "Will you attend?"
    await page.check('input[name="will-you-attend"]');

    // Dietary field should now be visible
    await expect(page.locator('input[name="dietary-restrictions"]')).toBeVisible();

    // Uncheck "Will you attend?"
    await page.uncheck('input[name="will-you-attend"]');

    // Dietary field should be hidden again
    await expect(page.locator('input[name="dietary-restrictions"]')).not.toBeVisible();

    // Exit preview and publish
    await page.click('button:has-text("Back to Editor")');
    await publishForm(page);
  });

  test('should validate form fields', async () => {
    const page = await context.newPage();

    await createAndLoginIdentity(page, 'Validation Test User');
    await createGroup(page, TEST_GROUP_NAME);
    await navigateToForms(page);

    // Create form with required email field
    await createForm(page, {
      title: 'Newsletter Signup',
    });

    await addFieldToForm(page, 'email');
    await editFieldProperties(page, 0, {
      label: 'Email',
      required: true,
    });

    // Preview form
    await previewForm(page);

    // Try to submit without filling email
    await page.click('button[type="submit"]');

    // Verify validation error
    await expect(page.locator('text=This field is required')).toBeVisible();

    // Fill invalid email
    await page.fill('input[name="email"]', 'not-an-email');
    await page.click('button[type="submit"]');

    // Verify format error
    await expect(page.locator('text=Please enter a valid email')).toBeVisible();

    // Fill valid email
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Should succeed (we'll verify in submission tests)
    // For now, just check no validation errors
    await expect(page.locator('text=This field is required')).not.toBeVisible();
    await expect(page.locator('text=Please enter a valid email')).not.toBeVisible();
  });

  test('should create multi-page form', async () => {
    const page = await context.newPage();

    await createAndLoginIdentity(page, 'Multi-Page User');
    await createGroup(page, TEST_GROUP_NAME);
    await navigateToForms(page);

    // Create new form
    await createForm(page, {
      title: 'Multi-Page Registration',
    });

    // Enable multi-page
    await page.click('button:has-text("Settings")');
    await page.check('input[name="multiPage"]');
    await page.fill('input[name="pageCount"]', '2');
    await page.click('button:has-text("Save Settings")');

    // Add fields to page 1
    await page.click('button:has-text("Page 1")');
    await addFieldToForm(page, 'text');
    await editFieldProperties(page, 0, {
      label: 'Name',
      required: true,
    });

    await addFieldToForm(page, 'email');
    await editFieldProperties(page, 1, {
      label: 'Email',
      required: true,
    });

    // Switch to page 2
    await page.click('button:has-text("Page 2")');

    // Add fields to page 2
    await addFieldToForm(page, 'textarea');
    await editFieldProperties(page, 0, {
      label: 'About You',
      required: true,
    });

    // Preview multi-page form
    await previewForm(page);

    // Verify we're on page 1
    await expect(page.locator('text=Page 1 of 2')).toBeVisible();
    await expect(page.locator('text=Name')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();

    // Fill page 1
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');

    // Go to page 2
    await page.click('button:has-text("Next")');

    // Verify we're on page 2
    await expect(page.locator('text=Page 2 of 2')).toBeVisible();
    await expect(page.locator('text=About You')).toBeVisible();

    // Go back to page 1
    await page.click('button:has-text("Back")');

    // Verify we're back on page 1
    await expect(page.locator('text=Page 1 of 2')).toBeVisible();

    // Fields should retain values
    await expect(page.locator('input[name="name"]')).toHaveValue('Test User');
    await expect(page.locator('input[name="email"]')).toHaveValue('test@example.com');

    // Navigate to page 2 and complete
    await page.click('button:has-text("Next")');
    await page.fill('textarea[name="about-you"]', 'I am a test user');
    await page.click('button[type="submit"]');

    // Exit preview and publish
    await page.click('button:has-text("Back to Editor")');
    await publishForm(page);
  });

  test('should reorder fields via drag-and-drop', async () => {
    const page = await context.newPage();

    await createAndLoginIdentity(page, 'Reorder Test User');
    await createGroup(page, TEST_GROUP_NAME);
    await navigateToForms(page);

    await createForm(page, {
      title: 'Field Reorder Test',
    });

    // Add three fields
    await addFieldToForm(page, 'text');
    await editFieldProperties(page, 0, { label: 'Field A' });

    await addFieldToForm(page, 'text');
    await editFieldProperties(page, 1, { label: 'Field B' });

    await addFieldToForm(page, 'text');
    await editFieldProperties(page, 2, { label: 'Field C' });

    // Get initial order
    const fieldA = page.locator('[data-testid="form-field-0"]');
    const fieldB = page.locator('[data-testid="form-field-1"]');

    // Drag Field B to position 0
    await fieldB.dragTo(fieldA);

    // Wait for reorder animation
    await page.waitForTimeout(500);

    // Preview to verify order
    await previewForm(page);

    // Verify new order
    const formFields = page.locator('label');
    const firstFieldText = await formFields.first().innerText();
    expect(firstFieldText).toBe('Field B');

    await page.click('button:has-text("Back to Editor")');
    await publishForm(page);
  });

  test('should delete fields from form', async () => {
    const page = await context.newPage();

    await createAndLoginIdentity(page, 'Delete Field User');
    await createGroup(page, TEST_GROUP_NAME);
    await navigateToForms(page);

    await createForm(page, {
      title: 'Delete Field Test',
    });

    // Add two fields
    await addFieldToForm(page, 'text');
    await editFieldProperties(page, 0, { label: 'Keep This Field' });

    await addFieldToForm(page, 'text');
    await editFieldProperties(page, 1, { label: 'Delete This Field' });

    // Select and delete second field
    const field = page.locator('[data-testid="form-field-1"]');
    await field.click();
    await page.click('button:has-text("Delete Field")');

    // Confirm deletion
    await page.click('button:has-text("Confirm")');

    // Preview form
    await previewForm(page);

    // Verify only first field exists
    await expect(page.locator('text=Keep This Field')).toBeVisible();
    await expect(page.locator('text=Delete This Field')).not.toBeVisible();

    await page.click('button:has-text("Back to Editor")');
    await publishForm(page);
  });

  test('should configure form settings (confirmation message, limits)', async () => {
    const page = await context.newPage();

    await createAndLoginIdentity(page, 'Settings Test User');
    await createGroup(page, TEST_GROUP_NAME);
    await navigateToForms(page);

    await createForm(page, {
      title: 'Settings Test Form',
    });

    // Add a simple field
    await addFieldToForm(page, 'text');
    await editFieldProperties(page, 0, { label: 'Name' });

    // Open settings
    await page.click('button:has-text("Settings")');

    // Configure confirmation message
    await page.fill(
      'textarea[name="confirmationMessage"]',
      'Thank you! Your submission has been received.'
    );

    // Set submission limits
    await page.check('input[name="limitSubmissions"]');
    await page.fill('input[name="maxSubmissions"]', '100');

    // Enable per-user limit
    await page.check('input[name="limitPerUser"]');
    await page.fill('input[name="maxPerUser"]', '1');

    // Save settings
    await page.click('button:has-text("Save Settings")');

    // Publish form
    await publishForm(page);

    // Verify settings were saved
    await page.click('button:has-text("Settings")');
    await expect(page.locator('textarea[name="confirmationMessage"]')).toHaveValue(
      'Thank you! Your submission has been received.'
    );
    await expect(page.locator('input[name="maxSubmissions"]')).toHaveValue('100');
    await expect(page.locator('input[name="maxPerUser"]')).toHaveValue('1');
  });
});
