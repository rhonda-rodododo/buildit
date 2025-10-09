/**
 * Bulk Operations E2E Tests (Epic 23)
 *
 * Tests for multi-select, bulk actions, CSV export, and task management
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:5173';
const TIMEOUT = 10000;

/**
 * Helper: Create and login with new identity
 */
async function setupIdentityAndNavigate(page: Page) {
  await page.goto(BASE_URL);

  // Create new identity if needed
  const generateButton = page.getByRole('button', { name: /generate new identity|get started|create identity/i });
  if (await generateButton.isVisible()) {
    await generateButton.click();

    // Wait for identity creation to complete
    await page.waitForTimeout(1000);

    // Check if we're logged in by waiting for app to load
    await page.waitForURL(/\/(dashboard|app|groups|feed)/, { timeout: TIMEOUT });
  }

  await page.waitForTimeout(1500);

  // Navigate to bulk operations page directly
  await page.goto(`${BASE_URL}/app/bulk-operations`);
  await page.waitForTimeout(2000);
}

test.describe('Bulk Operations - Multi-Select & Bulk Actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupIdentityAndNavigate(page);
  });

  test('should display bulk operations page with contacts table', async ({ page }) => {
    // Verify page title and description
    await expect(page.getByRole('heading', { name: /bulk operations/i })).toBeVisible();
    await expect(page.getByText(/scale your organizing/i)).toBeVisible();

    // Verify tabs
    await expect(page.getByRole('tab', { name: /bulk actions/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /task manager/i })).toBeVisible();

    // Verify contacts table headers
    await expect(page.getByText('Name')).toBeVisible();
    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Support Level')).toBeVisible();
    await expect(page.getByText('Tags')).toBeVisible();

    // Verify demo contacts are present
    await expect(page.getByText('Sarah Chen')).toBeVisible();
    await expect(page.getByText('Marcus Johnson')).toBeVisible();
    await expect(page.getByText('Emma Rodriguez')).toBeVisible();
  });

  test('should select individual contacts with checkboxes', async ({ page }) => {
    // Click on first contact checkbox
    const firstCheckbox = page.locator('tbody tr').first().locator('input[type="checkbox"]');
    await firstCheckbox.click();

    // Verify selection count updates
    await expect(page.getByText('1 selected')).toBeVisible();

    // Select second contact
    const secondCheckbox = page.locator('tbody tr').nth(1).locator('input[type="checkbox"]');
    await secondCheckbox.click();

    // Verify count updates to 2
    await expect(page.getByText('2 selected')).toBeVisible();

    // Verify row highlighting for selected contacts
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toHaveClass(/bg-primary\/5/);

    // Deselect first contact
    await firstCheckbox.click();

    // Verify count updates to 1
    await expect(page.getByText('1 selected')).toBeVisible();
  });

  test('should select all contacts with "Select All" button', async ({ page }) => {
    // Click "Select All" button
    const selectAllButton = page.getByRole('button', { name: /select all/i });
    await selectAllButton.click();

    // Verify all 5 contacts are selected
    await expect(page.getByText('5 selected')).toBeVisible();

    // Verify button changes to "Deselect All"
    await expect(page.getByRole('button', { name: /deselect all/i })).toBeVisible();

    // Verify header checkbox is checked
    const headerCheckbox = page.locator('thead input[type="checkbox"]');
    await expect(headerCheckbox).toBeChecked();
  });

  test('should deselect all contacts with clear button', async ({ page }) => {
    // Select all contacts first
    const selectAllButton = page.getByRole('button', { name: /select all/i });
    await selectAllButton.click();

    // Verify selection
    await expect(page.getByText('5 selected')).toBeVisible();

    // Click X button to clear selection
    const clearButton = page.locator('button').filter({ has: page.locator('svg').filter({ hasText: /x/i }) }).first();
    await clearButton.click();

    // Verify selection is cleared
    await expect(page.getByText('selected')).not.toBeVisible();

    // Verify "Select All" button is visible again
    await expect(selectAllButton).toBeVisible();
  });

  test('should show bulk actions toolbar when contacts are selected', async ({ page }) => {
    // Initially bulk actions should not be visible
    await expect(page.getByRole('button', { name: /send message/i })).not.toBeVisible();

    // Select a contact
    const firstCheckbox = page.locator('tbody tr').first().locator('input[type="checkbox"]');
    await firstCheckbox.click();

    // Verify bulk actions appear
    await expect(page.getByRole('button', { name: /send message/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /more actions/i })).toBeVisible();
  });

  test('should trigger bulk send message action', async ({ page }) => {
    // Setup dialog listener
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Sending message to 2 contacts');
      dialog.accept();
    });

    // Select 2 contacts
    await page.locator('tbody tr').first().locator('input[type="checkbox"]').click();
    await page.locator('tbody tr').nth(1).locator('input[type="checkbox"]').click();

    // Click "Send Message" button
    await page.getByRole('button', { name: /send message/i }).click();

    // Dialog should have been triggered (caught by listener above)
  });

  test('should show bulk action dropdown menu with all actions', async ({ page }) => {
    // Select a contact
    await page.locator('tbody tr').first().locator('input[type="checkbox"]').click();

    // Click "More Actions" dropdown
    await page.getByRole('button', { name: /more actions/i }).click();

    // Verify all bulk actions are present
    await expect(page.getByRole('menuitem', { name: /add tag/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /update field/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /assign task/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /export selected/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete selected/i })).toBeVisible();
  });

  test('should trigger bulk add tag action', async ({ page }) => {
    // Setup dialog listener
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Adding tag to 3 contacts');
      dialog.accept();
    });

    // Select 3 contacts
    await page.locator('tbody tr').first().locator('input[type="checkbox"]').click();
    await page.locator('tbody tr').nth(1).locator('input[type="checkbox"]').click();
    await page.locator('tbody tr').nth(2).locator('input[type="checkbox"]').click();

    // Open dropdown and click "Add Tag"
    await page.getByRole('button', { name: /more actions/i }).click();
    await page.getByRole('menuitem', { name: /add tag/i }).click();
  });

  test('should trigger bulk update field action', async ({ page }) => {
    // Setup dialog listener
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Updating field for 2 contacts');
      dialog.accept();
    });

    // Select 2 contacts
    await page.locator('tbody tr').first().locator('input[type="checkbox"]').click();
    await page.locator('tbody tr').nth(1).locator('input[type="checkbox"]').click();

    // Open dropdown and click "Update Field"
    await page.getByRole('button', { name: /more actions/i }).click();
    await page.getByRole('menuitem', { name: /update field/i }).click();
  });

  test('should show confirmation dialog for bulk delete', async ({ page }) => {
    // Setup confirm listener
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Delete 2 contacts');
      expect(dialog.message()).toContain('cannot be undone');
      dialog.dismiss(); // Cancel the deletion
    });

    // Select 2 contacts
    await page.locator('tbody tr').first().locator('input[type="checkbox"]').click();
    await page.locator('tbody tr').nth(1).locator('input[type="checkbox"]').click();

    // Open dropdown and click "Delete Selected"
    await page.getByRole('button', { name: /more actions/i }).click();
    await page.getByRole('menuitem', { name: /delete selected/i }).click();

    // Contacts should still be visible (deletion was cancelled)
    await expect(page.getByText('Sarah Chen')).toBeVisible();
  });
});

test.describe('Bulk Operations - Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await setupIdentityAndNavigate(page);
  });

  test('should export selected contacts to CSV', async ({ page }) => {
    // Setup dialog listener
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Exporting 2 contacts to CSV');
      dialog.accept();
    });

    // Select 2 contacts
    await page.locator('tbody tr').first().locator('input[type="checkbox"]').click();
    await page.locator('tbody tr').nth(1).locator('input[type="checkbox"]').click();

    // Click "Export Selected"
    await page.getByRole('button', { name: /more actions/i }).click();
    await page.getByRole('menuitem', { name: /export selected/i }).click();
  });

  test('should export all contacts when all are selected', async ({ page }) => {
    // Setup dialog listener
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Exporting 5 contacts to CSV');
      dialog.accept();
    });

    // Select all contacts
    await page.getByRole('button', { name: /select all/i }).click();

    // Export selected
    await page.getByRole('button', { name: /more actions/i }).click();
    await page.getByRole('menuitem', { name: /export selected/i }).click();
  });

  test('should show bulk operations features info box', async ({ page }) => {
    // Verify info box is visible
    await expect(page.getByText('Bulk Operations Features')).toBeVisible();

    // Verify feature list
    await expect(page.getByText(/select multiple contacts with checkboxes/i)).toBeVisible();
    await expect(page.getByText(/send bulk messages/i)).toBeVisible();
    await expect(page.getByText(/add tags to multiple contacts/i)).toBeVisible();
    await expect(page.getByText(/export selected contacts to CSV/i)).toBeVisible();
  });
});

test.describe('Bulk Operations - Task Manager', () => {
  test.beforeEach(async ({ page }) => {
    await setupIdentityAndNavigate(page);

    // Switch to Task Manager tab
    await page.getByRole('tab', { name: /task manager/i }).click();
    await page.waitForTimeout(500);
  });

  test('should display task manager with task queue', async ({ page }) => {
    // Verify task manager header
    await expect(page.getByRole('heading', { name: /task queue/i })).toBeVisible();

    // Verify task count
    await expect(page.getByText(/active tasks/i)).toBeVisible();

    // Verify filter dropdown
    await expect(page.getByRole('button', { name: /filter:/i })).toBeVisible();

    // Verify "New Task" button
    await expect(page.getByRole('button', { name: /new task/i })).toBeVisible();

    // Verify at least one demo task is visible
    await expect(page.getByText('Follow up with Sarah Chen')).toBeVisible();
  });

  test('should display task details with all metadata', async ({ page }) => {
    // Find first task card
    const firstTask = page.locator('[class*="Card"]').filter({ hasText: 'Follow up with Sarah Chen' });

    // Verify task title
    await expect(firstTask.getByText('Follow up with Sarah Chen')).toBeVisible();

    // Verify task description
    await expect(firstTask.getByText(/no response to initial outreach/i)).toBeVisible();

    // Verify assignee
    await expect(firstTask.getByText('Marcus Johnson')).toBeVisible();

    // Verify contact name
    await expect(firstTask.getByText(/contact:.*sarah chen/i)).toBeVisible();

    // Verify priority (high/medium/low)
    await expect(firstTask.getByText(/priority/i)).toBeVisible();

    // Verify automated follow-up indicator (bell icon)
    const bellIcon = firstTask.locator('svg').filter({ hasText: /bell/i }).first();
    await expect(bellIcon).toBeVisible();
  });

  test('should filter tasks by status', async ({ page }) => {
    // Click filter dropdown
    await page.getByRole('button', { name: /filter:/i }).click();

    // Verify filter options
    await expect(page.getByRole('menuitem', { name: /all tasks/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /pending/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /in progress/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /completed/i })).toBeVisible();

    // Filter by "Pending"
    await page.getByRole('menuitem', { name: /^pending$/i }).click();
    await page.waitForTimeout(300);

    // Verify filter label updated
    await expect(page.getByText(/filter:.*pending/i)).toBeVisible();

    // Verify only pending tasks shown (should see multiple tasks)
    const taskCards = page.locator('[class*="Card"]').filter({ hasText: /follow up|schedule|send event/i });
    const count = await taskCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should toggle task completion status', async ({ page }) => {
    // Find a pending task
    const pendingTask = page.locator('[class*="Card"]').filter({ hasText: 'Follow up with Sarah Chen' }).first();

    // Find and click the checkbox to complete
    const checkbox = pendingTask.locator('button').first();
    await checkbox.click();
    await page.waitForTimeout(300);

    // Verify task title has strikethrough (completed state)
    const taskTitle = pendingTask.locator('h4');
    await expect(taskTitle).toHaveClass(/line-through/);

    // Click checkbox again to uncomplete
    await checkbox.click();
    await page.waitForTimeout(300);

    // Verify strikethrough is removed
    await expect(taskTitle).not.toHaveClass(/line-through/);
  });

  test('should show task actions menu', async ({ page }) => {
    // Find first task
    const firstTask = page.locator('[class*="Card"]').filter({ hasText: 'Follow up with Sarah Chen' }).first();

    // Click more actions button (three dots)
    const moreButton = firstTask.getByRole('button').filter({ has: page.locator('svg') }).last();
    await moreButton.click();

    // Verify menu options
    await expect(page.getByRole('menuitem', { name: /edit task/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reassign/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete/i })).toBeVisible();
  });

  test('should delete a task', async ({ page }) => {
    // Count tasks before deletion
    const initialCount = await page.locator('[class*="Card"]').filter({ hasText: /follow up|schedule|send event|check in|thank/i }).count();

    // Find a task to delete
    const taskToDelete = page.locator('[class*="Card"]').filter({ hasText: 'Follow up with Sarah Chen' }).first();

    // Open actions menu
    const moreButton = taskToDelete.getByRole('button').filter({ has: page.locator('svg') }).last();
    await moreButton.click();

    // Click delete
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await page.waitForTimeout(300);

    // Verify task count decreased
    const finalCount = await page.locator('[class*="Card"]').filter({ hasText: /follow up|schedule|send event|check in|thank/i }).count();
    expect(finalCount).toBe(initialCount - 1);

    // Verify specific task is gone
    await expect(page.getByText('Follow up with Sarah Chen')).not.toBeVisible();
  });

  test('should show automated follow-up info box', async ({ page }) => {
    // Verify info box about automated follow-ups
    await expect(page.getByText('Automated Follow-Ups')).toBeVisible();

    // Verify explanation text
    await expect(page.getByText(/automatically created when contacts don't respond/i)).toBeVisible();
    await expect(page.getByText(/within 3 days/i)).toBeVisible();

    // Verify bell icon in info box
    const infoBellIcon = page.locator('[class*="bg-blue"]').locator('svg').filter({ hasText: /bell/i }).first();
    await expect(infoBellIcon).toBeVisible();
  });

  test('should display different task priorities with color coding', async ({ page }) => {
    // Find high priority task
    const highPriorityTask = page.locator('[class*="Card"]').filter({ hasText: 'Follow up with Sarah Chen' }).first();
    const highPriorityText = highPriorityTask.getByText(/high priority/i);
    await expect(highPriorityText).toBeVisible();
    await expect(highPriorityText).toHaveClass(/text-red-500/);

    // Find medium priority task
    const mediumPriorityTask = page.locator('[class*="Card"]').filter({ hasText: 'Schedule 1-on-1' }).first();
    const mediumPriorityText = mediumPriorityTask.getByText(/medium priority/i);
    await expect(mediumPriorityText).toBeVisible();
    await expect(mediumPriorityText).toHaveClass(/text-yellow-500/);

    // Filter to show completed tasks
    await page.getByRole('button', { name: /filter:/i }).click();
    await page.getByRole('menuitem', { name: /completed/i }).click();
    await page.waitForTimeout(300);

    // Find low priority task (completed tasks)
    const lowPriorityTask = page.locator('[class*="Card"]').filter({ hasText: 'Thank donors' }).first();
    if (await lowPriorityTask.isVisible()) {
      const lowPriorityText = lowPriorityTask.getByText(/low priority/i);
      await expect(lowPriorityText).toBeVisible();
      await expect(lowPriorityText).toHaveClass(/text-blue-500/);
    }
  });

  test('should show task due dates', async ({ page }) => {
    // Find task with due date
    const taskWithDate = page.locator('[class*="Card"]').filter({ hasText: 'Follow up with Sarah Chen' }).first();

    // Verify due date is displayed (format: "MMM d")
    // Should show something like "Jan 10" or similar
    const dateText = taskWithDate.locator('text=/[A-Z][a-z]{2} \\d{1,2}/');
    await expect(dateText).toBeVisible();

    // Verify calendar icon
    const calendarIcon = taskWithDate.locator('svg').filter({ hasText: /calendar/i }).first();
    await expect(calendarIcon).toBeVisible();
  });

  test('should filter to show only completed tasks', async ({ page }) => {
    // Filter by completed
    await page.getByRole('button', { name: /filter:/i }).click();
    await page.getByRole('menuitem', { name: /completed/i }).click();
    await page.waitForTimeout(300);

    // Verify filter updated
    await expect(page.getByText(/filter:.*completed/i)).toBeVisible();

    // Verify at least one completed task visible
    const completedTask = page.locator('[class*="Card"]').filter({ hasText: 'Thank donors' }).first();
    await expect(completedTask).toBeVisible();

    // Verify task has strikethrough
    const taskTitle = completedTask.locator('h4');
    await expect(taskTitle).toHaveClass(/line-through/);
  });
});
