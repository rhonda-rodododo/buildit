/**
 * E2E Tests for Custom Fields Module
 */

import { test, expect } from '@playwright/test';

test.describe('Custom Fields Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // TODO: Set up test identity and group
  });

  test('should create a custom field definition', async ({ page }) => {
    // Navigate to group settings
    await page.click('[data-testid="group-settings"]');

    // Navigate to custom fields tab
    await page.click('[data-testid="custom-fields-tab"]');

    // Click add field button
    await page.click('button:has-text("Add Field")');

    // Fill out field editor
    await page.fill('input[name="name"]', 'dietary_preferences');
    await page.fill('input[name="label"]', 'Dietary Preferences');
    await page.selectOption('select[name="widget"]', 'multi-select');

    // Add options
    await page.fill('input[name="options"]', JSON.stringify([
      { value: 'vegan', label: 'Vegan' },
      { value: 'vegetarian', label: 'Vegetarian' }
    ]));

    // Save field
    await page.click('button[type="submit"]:has-text("Create")');

    // Verify field appears in list
    await expect(page.locator('text=Dietary Preferences')).toBeVisible();
  });

  test('should apply a field template', async ({ page }) => {
    // Navigate to group settings
    await page.click('[data-testid="group-settings"]');
    await page.click('[data-testid="custom-fields-tab"]');

    // Select and apply template
    await page.selectOption('[data-testid="template-selector"]', 'event-dietary');

    // Verify template fields are created
    await expect(page.locator('text=Dietary Restrictions')).toBeVisible();
    await expect(page.locator('text=Other Allergies/Notes')).toBeVisible();
  });

  test('should use custom fields in event creation', async ({ page }) => {
    // First create a custom field
    await page.click('[data-testid="group-settings"]');
    await page.click('[data-testid="custom-fields-tab"]');
    await page.click('button:has-text("Add Field")');
    await page.fill('input[name="name"]', 'skill_level');
    await page.fill('input[name="label"]', 'Skill Level');
    await page.selectOption('select[name="widget"]', 'select');
    await page.fill('input[name="options"]', JSON.stringify([
      { value: 'beginner', label: 'Beginner' },
      { value: 'advanced', label: 'Advanced' }
    ]));
    await page.click('button[type="submit"]:has-text("Create")');

    // Navigate to events
    await page.click('[data-testid="events-tab"]');

    // Open create event dialog
    await page.click('button:has-text("Create Event")');

    // Fill basic event info
    await page.fill('input[id="title"]', 'Workshop: Custom Fields');
    await page.fill('textarea[id="description"]', 'Learn about custom fields');

    // Verify custom field appears
    await expect(page.locator('text=Skill Level')).toBeVisible();

    // Fill custom field
    await page.selectOption('[data-testid="custom-field-skill_level"]', 'beginner');

    // Submit event
    await page.click('button[type="submit"]:has-text("Create Event")');

    // Verify event was created with custom field
    await expect(page.locator('text=Workshop: Custom Fields')).toBeVisible();
  });

  test('should display custom field values', async ({ page }) => {
    // Create event with custom fields (reuse previous test setup)
    // ... setup code ...

    // Open event detail
    await page.click('[data-testid="event-Workshop: Custom Fields"]');

    // Verify custom field value is displayed
    await expect(page.locator('text=Skill Level')).toBeVisible();
    await expect(page.locator('text=Beginner')).toBeVisible();
  });

  test('should edit custom field definition', async ({ page }) => {
    // Create a field first
    await page.click('[data-testid="group-settings"]');
    await page.click('[data-testid="custom-fields-tab"]');
    await page.click('button:has-text("Add Field")');
    await page.fill('input[name="name"]', 'test_field');
    await page.fill('input[name="label"]', 'Test Field');
    await page.click('button[type="submit"]:has-text("Create")');

    // Click edit button
    await page.click('[data-testid="edit-field-test_field"]');

    // Modify label
    await page.fill('input[name="label"]', 'Updated Test Field');
    await page.click('button[type="submit"]:has-text("Update")');

    // Verify updated label
    await expect(page.locator('text=Updated Test Field')).toBeVisible();
  });

  test('should delete custom field definition', async ({ page }) => {
    // Create a field first
    await page.click('[data-testid="group-settings"]');
    await page.click('[data-testid="custom-fields-tab"]');
    await page.click('button:has-text("Add Field")');
    await page.fill('input[name="name"]', 'temp_field');
    await page.fill('input[name="label"]', 'Temporary Field');
    await page.click('button[type="submit"]:has-text("Create")');

    // Click delete button
    await page.click('[data-testid="delete-field-temp_field"]');

    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Verify field is removed
    await expect(page.locator('text=Temporary Field')).not.toBeVisible();
  });

  test('should validate required custom fields', async ({ page }) => {
    // Create required field
    await page.click('[data-testid="group-settings"]');
    await page.click('[data-testid="custom-fields-tab"]');
    await page.click('button:has-text("Add Field")');
    await page.fill('input[name="name"]', 'required_field');
    await page.fill('input[name="label"]', 'Required Field');
    await page.check('input[name="required"]');
    await page.click('button[type="submit"]:has-text("Create")');

    // Try to create event without filling required field
    await page.click('[data-testid="events-tab"]');
    await page.click('button:has-text("Create Event")');
    await page.fill('input[id="title"]', 'Test Event');

    // Submit without required field
    await page.click('button[type="submit"]:has-text("Create Event")');

    // Verify validation error
    await expect(page.locator('text=Required Field is required')).toBeVisible();
  });

  test('should support all field types', async ({ page }) => {
    const fieldTypes = [
      { widget: 'text', name: 'text_field' },
      { widget: 'textarea', name: 'textarea_field' },
      { widget: 'number', name: 'number_field' },
      { widget: 'date', name: 'date_field' },
      { widget: 'select', name: 'select_field' },
      { widget: 'checkbox', name: 'checkbox_field' },
    ];

    for (const fieldType of fieldTypes) {
      await page.click('[data-testid="group-settings"]');
      await page.click('[data-testid="custom-fields-tab"]');
      await page.click('button:has-text("Add Field")');
      await page.fill('input[name="name"]', fieldType.name);
      await page.fill('input[name="label"]', `Test ${fieldType.widget}`);
      await page.selectOption('select[name="widget"]', fieldType.widget);
      await page.click('button[type="submit"]:has-text("Create")');

      // Verify field created
      await expect(page.locator(`text=Test ${fieldType.widget}`)).toBeVisible();
    }
  });
});
