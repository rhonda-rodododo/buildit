/**
 * CRM Module E2E Tests
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers/helpers';

test.describe('CRM Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await waitForAppReady(page);
  });

  test('should display CRM templates', async ({ page }) => {
    // Navigate to CRM module
    await page.click('[data-testid="module-crm"]');

    // Verify all 5 templates are visible
    await expect(page.locator('text=Union Organizing')).toBeVisible();
    await expect(page.locator('text=Fundraising')).toBeVisible();
    await expect(page.locator('text=Legal/NLG Tracking')).toBeVisible();
    await expect(page.locator('text=Volunteer Management')).toBeVisible();
    await expect(page.locator('text=Civil Defense')).toBeVisible();
  });

  test('should apply Union Organizing template', async ({ page }) => {
    await page.click('[data-testid="module-crm"]');

    // Click on Union Organizing template
    const unionCard = page.locator('text=Union Organizing').locator('..');
    await unionCard.locator('button:has-text("Use Template")').click();

    // Verify table was created with template fields
    await expect(page.locator('text=Full Name')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Support Level')).toBeVisible();
    await expect(page.locator('text=Signed Union Card')).toBeVisible();
  });

  test('should apply Fundraising template and add a donor', async ({ page }) => {
    await page.click('[data-testid="module-crm"]');

    // Apply fundraising template
    const fundraisingCard = page.locator('text=Fundraising').locator('..');
    await fundraisingCard.locator('button:has-text("Use Template")').click();

    // Create a new donor record
    await page.click('button:has-text("New Record")');

    // Fill in donor details
    await page.fill('input[name="donor_name"]', 'Jane Doe');
    await page.fill('input[name="email"]', 'jane@example.com');
    await page.fill('input[name="total_donated"]', '500');
    await page.selectOption('select[name="donor_level"]', 'Regular');

    // Save record
    await page.click('button:has-text("Save")');

    // Verify record appears in table
    await expect(page.locator('text=Jane Doe')).toBeVisible();
    await expect(page.locator('text=$500')).toBeVisible(); // or however currency is formatted
  });

  test('should use Board view with Legal/NLG template', async ({ page }) => {
    await page.click('[data-testid="module-crm"]');

    // Apply Legal/NLG template
    const legalCard = page.locator('text=Legal/NLG Tracking').locator('..');
    await legalCard.locator('button:has-text("Use Template")').click();

    // Switch to "By Status" board view
    await page.click('[role="tab"]:has-text("By Status")');

    // Verify kanban columns for different case statuses
    await expect(page.locator('text=Active')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
    await expect(page.locator('text=Resolved')).toBeVisible();
  });

  test('should use Calendar view with Legal/NLG template', async ({ page }) => {
    await page.click('[data-testid="module-crm"]');

    // Apply Legal/NLG template
    const legalCard = page.locator('text=Legal/NLG Tracking').locator('..');
    await legalCard.locator('button:has-text("Use Template")').click();

    // Switch to Court Calendar view
    await page.click('[role="tab"]:has-text("Court Calendar")');

    // Verify calendar is visible
    await expect(page.locator('text=Sun')).toBeVisible(); // Calendar day headers
    await expect(page.locator('text=Mon')).toBeVisible();

    // Verify navigation controls
    await expect(page.locator('button:has-text("Previous")')).toBeVisible();
    await expect(page.locator('button:has-text("Next")')).toBeVisible();
    await expect(page.locator('button:has-text("Today")')).toBeVisible();
  });

  test('should apply Volunteer Management template and filter by skills', async ({ page }) => {
    await page.click('[data-testid="module-crm"]');

    // Apply volunteer template
    const volunteerCard = page.locator('text=Volunteer Management').locator('..');
    await volunteerCard.locator('button:has-text("Use Template")').click();

    // Add a volunteer
    await page.click('button:has-text("New Record")');
    await page.fill('input[name="volunteer_name"]', 'Alex Smith');
    await page.fill('input[name="email"]', 'alex@example.com');

    // Select multiple skills
    await page.click('text=Skills');
    await page.check('input[value="First Aid"]');
    await page.check('input[value="Medic"]');

    await page.click('button:has-text("Save")');

    // Filter by skill
    await page.fill('input[placeholder*="Filter Skills"]', 'Medic');

    // Verify filtered result
    await expect(page.locator('text=Alex Smith')).toBeVisible();
  });

  test('should apply Civil Defense template and organize by zone', async ({ page }) => {
    await page.click('[data-testid="module-crm"]');

    // Apply civil defense template
    const civilDefenseCard = page.locator('text=Civil Defense').locator('..');
    await civilDefenseCard.locator('button:has-text("Use Template")').click();

    // Add emergency contact
    await page.click('button:has-text("New Record")');
    await page.fill('input[name="contact_name"]', 'Dr. Sarah Johnson');
    await page.fill('input[name="phone"]', '+1 (555) 987-6543');

    // Select emergency skills
    await page.click('text=Emergency Skills');
    await page.check('input[value="Doctor"]');
    await page.check('input[value="Mental Health"]');

    // Add availability zone
    await page.fill('input[name="availability_zone"]', 'Downtown District');

    await page.click('button:has-text("Save")');

    // Verify record
    await expect(page.locator('text=Dr. Sarah Johnson')).toBeVisible();
    await expect(page.locator('text=Downtown District')).toBeVisible();
  });

  test('should customize a template after applying', async ({ page }) => {
    await page.click('[data-testid="module-crm"]');

    // Apply any template
    const unionCard = page.locator('text=Union Organizing').locator('..');
    await unionCard.locator('button:has-text("Use Template")').click();

    // Add a custom field
    await page.click('button:has-text("Add Field")');
    await page.fill('input[name="fieldName"]', 'preferred_contact_time');
    await page.fill('input[name="fieldLabel"]', 'Preferred Contact Time');
    await page.selectOption('select[name="fieldType"]', 'select');

    // Add options
    await page.click('button:has-text("Add Option")');
    await page.fill('input[name="option-0"]', 'Morning');
    await page.click('button:has-text("Add Option")');
    await page.fill('input[name="option-1"]', 'Afternoon');
    await page.click('button:has-text("Add Option")');
    await page.fill('input[name="option-2"]', 'Evening');

    await page.click('button:has-text("Save Field")');

    // Verify new field appears in table
    await expect(page.locator('text=Preferred Contact Time')).toBeVisible();
  });
});
