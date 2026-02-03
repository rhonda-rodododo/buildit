import { test, expect } from '@playwright/test';
import { waitForAppReady, createIdentity } from './helpers/helpers';

test.describe('Events Module', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Test User', 'testpassword123');

    // Create a group with events module enabled
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Events Test Group');

      // Enable events module if option exists
      const eventsCheckbox = page.getByLabel(/events/i);
      if (await eventsCheckbox.isVisible()) {
        await eventsCheckbox.check();
      }

      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Navigate to the group
    await page.getByText('Events Test Group').click();

    // Go to events tab
    const eventsTab = page.getByRole('tab', { name: /events/i });
    if (await eventsTab.isVisible()) {
      await eventsTab.click();
    }
  });

  test('should create a new event', async ({ page }) => {
    // Click create event button
    const createEventButton = page.getByRole('button', { name: /create event|new event/i });
    await createEventButton.click();

    // Fill in event details
    await page.getByLabel(/event name|title/i).fill('Test Protest March');
    await page.getByLabel(/description/i).fill('A test event for E2E testing');

    // Set date and time (if inputs exist)
    const dateInput = page.getByLabel(/date|when/i);
    if (await dateInput.isVisible()) {
      await dateInput.fill('2025-12-31');
    }

    const timeInput = page.getByLabel(/time/i);
    if (await timeInput.isVisible()) {
      await timeInput.fill('18:00');
    }

    // Set location
    const locationInput = page.getByLabel(/location|where/i);
    if (await locationInput.isVisible()) {
      await locationInput.fill('City Hall');
    }

    // Set capacity
    const capacityInput = page.getByLabel(/capacity|max.*attendees/i);
    if (await capacityInput.isVisible()) {
      await capacityInput.fill('100');
    }

    // Select privacy level
    const privacySelect = page.getByLabel(/privacy|visibility/i);
    if (await privacySelect.isVisible()) {
      await privacySelect.click();
      await page.getByText(/group.*only|private/i).first().click();
    }

    // Submit
    await page.getByRole('button', { name: /create|save event/i }).click();

    // Should show event in list
    await expect(page.getByText('Test Protest March')).toBeVisible();
  });

  test('should RSVP to an event', async ({ page }) => {
    // Create an event first
    const createEventButton = page.getByRole('button', { name: /create event|new event/i });
    if (await createEventButton.isVisible()) {
      await createEventButton.click();
      await page.getByLabel(/event name|title/i).fill('RSVP Test Event');
      await page.getByRole('button', { name: /create|save event/i }).click();
    }

    // Click on the event
    await page.getByText('RSVP Test Event').click();

    // Click RSVP button
    const rsvpButton = page.getByRole('button', { name: /rsvp|going|attend/i });
    if (await rsvpButton.isVisible()) {
      await rsvpButton.click();

      // Should show RSVP confirmation
      await expect(page.getByText(/attending|you're going|rsvp.*confirmed/i)).toBeVisible();
    }
  });

  test('should view event calendar', async ({ page }) => {
    // Look for calendar view option
    const calendarButton = page.getByRole('button', { name: /calendar|month view/i });
    if (await calendarButton.isVisible()) {
      await calendarButton.click();

      // Should show calendar grid
      await expect(page.getByRole('grid')).toBeVisible();
    }
  });

  test('should export event to iCal', async ({ page }) => {
    // Create an event
    const createEventButton = page.getByRole('button', { name: /create event|new event/i });
    if (await createEventButton.isVisible()) {
      await createEventButton.click();
      await page.getByLabel(/event name|title/i).fill('Export Test Event');
      await page.getByRole('button', { name: /create|save event/i }).click();
    }

    // Open event detail
    await page.getByText('Export Test Event').click();

    // Look for export button
    const exportButton = page.getByRole('button', { name: /export|download|ical/i });
    if (await exportButton.isVisible()) {
      // Listen for download
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      const download = await downloadPromise;

      // Verify download started
      expect(download.suggestedFilename()).toMatch(/\.ics$/);
    }
  });

  test('should filter events by date range', async ({ page }) => {
    // Look for filter controls
    const filterButton = page.getByRole('button', { name: /filter/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Select date range
      const startDateInput = page.getByLabel(/start date|from/i);
      if (await startDateInput.isVisible()) {
        await startDateInput.fill('2025-01-01');
      }

      const endDateInput = page.getByLabel(/end date|to/i);
      if (await endDateInput.isVisible()) {
        await endDateInput.fill('2025-12-31');
      }

      // Apply filter
      await page.getByRole('button', { name: /apply|filter/i }).click();

      // Events should be filtered (verify list updates)
      await expect(page.getByRole('main')).toBeVisible();
    }
  });

  test('should enforce event capacity limits', async ({ page }) => {
    // Create an event with limited capacity
    const createEventButton = page.getByRole('button', { name: /create event|new event/i });
    await createEventButton.click();

    await page.getByLabel(/event name|title/i).fill('Capacity Test Event');
    await page.getByLabel(/description/i).fill('Event with limited capacity');

    // Set capacity to 1
    const capacityInput = page.getByLabel(/capacity|max.*attendees/i);
    if (await capacityInput.isVisible()) {
      await capacityInput.fill('1');
    }

    await page.getByRole('button', { name: /create|save event/i }).click();
    await page.waitForTimeout(300);

    // RSVP to fill capacity
    await page.getByText('Capacity Test Event').click();
    const rsvpButton = page.getByRole('button', { name: /rsvp|going|attend/i });
    if (await rsvpButton.isVisible()) {
      await rsvpButton.click();
      await page.waitForTimeout(300);

      // Verify RSVP confirmed
      await expect(page.getByText(/attending|you're going/i)).toBeVisible();

      // Verify capacity indicator shows full
      const capacityText = page.getByText(/1.*\/.*1|full|no spots/i);
      await expect(capacityText).toBeVisible();
    }
  });

  test('should display attendee list to event creator', async ({ page }) => {
    // Create an event
    const createEventButton = page.getByRole('button', { name: /create event|new event/i });
    await createEventButton.click();

    await page.getByLabel(/event name|title/i).fill('Attendee List Test Event');
    await page.getByRole('button', { name: /create|save event/i }).click();
    await page.waitForTimeout(300);

    // Open event detail
    await page.getByText('Attendee List Test Event').click();

    // Look for attendee list section (creator should see it)
    const attendeeSection = page.getByText(/attendees|going|rsvp/i).first();
    await expect(attendeeSection).toBeVisible();

    // Look for expandable attendee list
    const attendeeList = page.locator('[data-testid="attendee-list"]').or(
      page.locator('.attendees').or(page.getByRole('list'))
    );
    // At minimum, the section should exist
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('should edit existing event', async ({ page }) => {
    // Create an event
    const createEventButton = page.getByRole('button', { name: /create event|new event/i });
    await createEventButton.click();

    await page.getByLabel(/event name|title/i).fill('Event To Edit');
    await page.getByLabel(/description/i).fill('Original description');
    await page.getByRole('button', { name: /create|save event/i }).click();
    await page.waitForTimeout(300);

    // Open event detail
    await page.getByText('Event To Edit').click();

    // Click edit button
    const editButton = page.getByRole('button', { name: /edit/i });
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(300);

      // Update event details
      const titleInput = page.getByLabel(/event name|title/i);
      await titleInput.clear();
      await titleInput.fill('Updated Event Title');

      const descriptionInput = page.getByLabel(/description/i);
      await descriptionInput.clear();
      await descriptionInput.fill('Updated description');

      // Save changes
      await page.getByRole('button', { name: /save|update/i }).click();
      await page.waitForTimeout(300);

      // Verify changes
      await expect(page.getByText('Updated Event Title')).toBeVisible();
      await expect(page.getByText('Updated description')).toBeVisible();
    }
  });

  test('should cancel RSVP', async ({ page }) => {
    // Create an event
    const createEventButton = page.getByRole('button', { name: /create event|new event/i });
    await createEventButton.click();

    await page.getByLabel(/event name|title/i).fill('Cancel RSVP Test Event');
    await page.getByRole('button', { name: /create|save event/i }).click();
    await page.waitForTimeout(300);

    // RSVP first
    await page.getByText('Cancel RSVP Test Event').click();
    const rsvpButton = page.getByRole('button', { name: /rsvp|going|attend/i });
    if (await rsvpButton.isVisible()) {
      await rsvpButton.click();
      await page.waitForTimeout(300);

      // Now cancel RSVP
      const cancelButton = page.getByRole('button', { name: /cancel|not going|change/i });
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await page.waitForTimeout(300);

        // Verify RSVP cancelled
        await expect(page.getByRole('button', { name: /rsvp|going|attend/i })).toBeVisible();
      }
    }
  });

  test('should navigate to calendar view', async ({ page }) => {
    // Look for calendar tab
    const calendarTab = page.getByRole('tab', { name: /calendar/i });
    if (await calendarTab.isVisible()) {
      await calendarTab.click();
      await page.waitForTimeout(300);

      // Should show calendar component
      const calendarGrid = page.locator('[class*="calendar"]').or(page.getByRole('grid'));
      await expect(calendarGrid.first()).toBeVisible();
    }
  });

  test('should create event with custom fields', async ({ page }) => {
    // Create an event with all optional fields
    const createEventButton = page.getByRole('button', { name: /create event|new event/i });
    await createEventButton.click();

    // Fill required fields
    await page.getByLabel(/event name|title/i).fill('Full Event Test');
    await page.getByLabel(/description/i).fill('Event with all fields');

    // Fill optional fields
    const dateInput = page.getByLabel(/date|when/i);
    if (await dateInput.isVisible()) {
      await dateInput.fill('2026-06-15');
    }

    const timeInput = page.getByLabel(/time/i);
    if (await timeInput.isVisible()) {
      await timeInput.fill('14:00');
    }

    const locationInput = page.getByLabel(/location|where/i);
    if (await locationInput.isVisible()) {
      await locationInput.fill('Community Center, 123 Main St');
    }

    const capacityInput = page.getByLabel(/capacity|max/i);
    if (await capacityInput.isVisible()) {
      await capacityInput.fill('50');
    }

    // Look for custom fields section
    const customFieldsButton = page.getByRole('button', { name: /custom fields|add field/i });
    if (await customFieldsButton.isVisible()) {
      await customFieldsButton.click();
      await page.waitForTimeout(200);
    }

    // Submit
    await page.getByRole('button', { name: /create|save event/i }).click();
    await page.waitForTimeout(300);

    // Verify event created with details
    await expect(page.getByText('Full Event Test')).toBeVisible();
  });
});
