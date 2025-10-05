/**
 * Database Module E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Database Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Setup: Create identity and group if needed
  });

  test('should create a new database table', async ({ page }) => {
    // Navigate to database module
    await page.click('[data-testid="module-database"]');

    // Click create table button
    await page.click('button:has-text("New Table")');

    // Fill in table details
    await page.fill('input[placeholder="Table name:"]', 'Test Contacts');

    // Confirm creation
    await page.press('input[placeholder="Table name:"]', 'Enter');

    // Verify table was created
    await expect(page.locator('text=Test Contacts')).toBeVisible();
  });

  test('should add custom fields to a table', async ({ page }) => {
    // Assuming a table exists
    await page.click('[data-testid="module-database"]');

    // Click on field management
    await page.click('button:has-text("Add Field")');

    // Add a text field
    await page.fill('input[name="fieldName"]', 'full_name');
    await page.fill('input[name="fieldLabel"]', 'Full Name');
    await page.selectOption('select[name="fieldType"]', 'text');
    await page.click('button:has-text("Save Field")');

    // Verify field was added
    await expect(page.locator('text=Full Name')).toBeVisible();
  });

  test('should create a record in table view', async ({ page }) => {
    await page.click('[data-testid="module-database"]');

    // Click new record button
    await page.click('button:has-text("New Record")');

    // Fill in record data (this would depend on fields)
    // For this test, we assume basic text fields exist

    // Save record
    await page.click('button:has-text("Save")');

    // Verify record appears in table
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('should switch between different view types', async ({ page }) => {
    await page.click('[data-testid="module-database"]');

    // Switch to board view
    await page.click('[role="tab"]:has-text("Board")');
    await expect(page.locator('[data-testid="board-view"]')).toBeVisible();

    // Switch to calendar view
    await page.click('[role="tab"]:has-text("Calendar")');
    await expect(page.locator('[data-testid="calendar-view"]')).toBeVisible();

    // Switch to gallery view
    await page.click('[role="tab"]:has-text("Gallery")');
    await expect(page.locator('[data-testid="gallery-view"]')).toBeVisible();

    // Switch back to table view
    await page.click('[role="tab"]:has-text("All Records")');
    await expect(page.locator('table')).toBeVisible();
  });

  test('should filter and sort records in table view', async ({ page }) => {
    await page.click('[data-testid="module-database"]');

    // Type in filter input
    await page.fill('input[placeholder*="Filter"]', 'John');

    // Verify filtered results
    await expect(page.locator('tbody tr')).toHaveCount(1); // Assuming one match

    // Click sort button on a column
    await page.click('button:has-text("Full Name")');

    // Verify sorting (ascending)
    await expect(page.locator('button:has-text("Full Name") svg')).toBeVisible();
  });

  test('should paginate through records', async ({ page }) => {
    await page.click('[data-testid="module-database"]');

    // Verify pagination controls are visible
    await expect(page.locator('text=Page')).toBeVisible();

    // Click next page
    await page.click('button[aria-label="Next page"]');

    // Verify page number changed
    await expect(page.locator('text=Page 2')).toBeVisible();

    // Click previous page
    await page.click('button[aria-label="Previous page"]');

    // Verify back to page 1
    await expect(page.locator('text=Page 1')).toBeVisible();
  });
});
