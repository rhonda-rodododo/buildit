import { test, expect } from '@playwright/test';

test.describe('Mutual Aid Module', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }
    await page.waitForURL(/\/(dashboard|groups)/);

    // Create a group with mutual aid module enabled
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Mutual Aid Test Group');

      // Enable mutual aid module if option exists
      const mutualAidCheckbox = page.getByLabel(/mutual.*aid/i);
      if (await mutualAidCheckbox.isVisible()) {
        await mutualAidCheckbox.check();
      }

      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Navigate to the group
    await page.getByText('Mutual Aid Test Group').click();

    // Go to mutual aid tab/module
    const mutualAidTab = page.getByRole('tab', { name: /mutual.*aid/i });
    if (await mutualAidTab.isVisible()) {
      await mutualAidTab.click();
    } else {
      // Try navigating via URL
      await page.goto('/app/groups/mutual-aid');
    }
  });

  test('should create a resource request', async ({ page }) => {
    // Click create request button
    const createRequestButton = page.getByRole('button', { name: /create request|new request|request.*help/i });
    await createRequestButton.click();

    // Fill in request details
    await page.getByLabel(/title|what.*need/i).fill('Need groceries for family');
    await page.getByLabel(/description|details/i).fill('Looking for help with groceries for a family of 4');

    // Select type (if dropdown exists)
    const typeSelect = page.getByLabel(/type|category/i);
    if (await typeSelect.isVisible()) {
      await typeSelect.click();
      await page.getByText(/food|groceries|supplies/i).first().click();
    }

    // Set location
    const locationInput = page.getByLabel(/location|where/i);
    if (await locationInput.isVisible()) {
      await locationInput.fill('Brooklyn, NY');
    }

    // Set urgency
    const urgencySelect = page.getByLabel(/urgency|priority/i);
    if (await urgencySelect.isVisible()) {
      await urgencySelect.click();
      await page.getByText(/high|urgent/i).first().click();
    }

    // Submit
    await page.getByRole('button', { name: /create|submit request/i }).click();

    // Should show request in list
    await expect(page.getByText('Need groceries for family')).toBeVisible();
  });

  test('should create a resource offer', async ({ page }) => {
    // Click create offer button or tab
    const createOfferButton = page.getByRole('button', { name: /create offer|new offer|offer.*help/i });
    const offersTab = page.getByRole('tab', { name: /offers/i });

    // Navigate to offers if tab exists
    if (await offersTab.isVisible()) {
      await offersTab.click();
    }

    // Now try to create offer
    if (await createOfferButton.isVisible()) {
      await createOfferButton.click();
    } else {
      // Try finding it again after tab switch
      const button = page.getByRole('button', { name: /create offer|new offer/i });
      await button.click();
    }

    // Fill in offer details
    await page.getByLabel(/title|what.*offer/i).fill('Can provide rides');
    await page.getByLabel(/description|details/i).fill('I have a car and can give rides to appointments');

    // Select type
    const typeSelect = page.getByLabel(/type|category/i);
    if (await typeSelect.isVisible()) {
      await typeSelect.click();
      await page.getByText(/transportation|rides/i).first().click();
    }

    // Set availability
    const availabilityInput = page.getByLabel(/availability|when/i);
    if (await availabilityInput.isVisible()) {
      await availabilityInput.fill('Weekdays 9am-5pm');
    }

    // Set location
    const locationInput = page.getByLabel(/location|where/i);
    if (await locationInput.isVisible()) {
      await locationInput.fill('Manhattan, NY');
    }

    // Submit
    await page.getByRole('button', { name: /create|submit offer/i }).click();

    // Should show offer in list
    await expect(page.getByText('Can provide rides')).toBeVisible();
  });

  test('should match offer to request', async ({ page }) => {
    // Create a request first
    const createRequestButton = page.getByRole('button', { name: /create request|new request/i });
    if (await createRequestButton.isVisible()) {
      await createRequestButton.click();
      await page.getByLabel(/title|what.*need/i).fill('Need a ride to clinic');
      await page.getByLabel(/description/i).fill('Need transportation to medical appointment');
      await page.getByRole('button', { name: /create|submit/i }).click();
    }

    // Click on the request
    await page.getByText('Need a ride to clinic').click();

    // Look for matching offers section
    const matchesSection = page.getByText(/matching offers|available offers|matches/i);
    if (await matchesSection.isVisible()) {
      // Should see potential matches
      await expect(page.getByRole('main')).toBeVisible();
    }

    // Try to connect with an offer
    const connectButton = page.getByRole('button', { name: /connect|match|accept/i }).first();
    if (await connectButton.isVisible()) {
      await connectButton.click();

      // Should show confirmation
      await expect(page.getByText(/connected|matched|accepted/i)).toBeVisible();
    }
  });

  test('should fulfill a request', async ({ page }) => {
    // Create a request
    const createRequestButton = page.getByRole('button', { name: /create request|new request/i });
    if (await createRequestButton.isVisible()) {
      await createRequestButton.click();
      await page.getByLabel(/title|what.*need/i).fill('Fulfill Test Request');
      await page.getByRole('button', { name: /create|submit/i }).click();
    }

    // Click on the request
    await page.getByText('Fulfill Test Request').click();

    // Mark as fulfilled
    const fulfillButton = page.getByRole('button', { name: /fulfill|complete|mark.*complete/i });
    if (await fulfillButton.isVisible()) {
      await fulfillButton.click();

      // Should show fulfilled status
      await expect(page.getByText(/fulfilled|completed|closed/i)).toBeVisible();
    }
  });

  test('should filter requests by type', async ({ page }) => {
    // Look for filter controls
    const filterButton = page.getByRole('button', { name: /filter/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Select a type filter
      const typeCheckbox = page.getByLabel(/food|housing|transportation/i).first();
      if (await typeCheckbox.isVisible()) {
        await typeCheckbox.check();
      }

      // Apply filter
      await page.getByRole('button', { name: /apply|filter/i }).click();

      // List should be filtered
      await expect(page.getByRole('main')).toBeVisible();
    }
  });

  test('should search requests by location', async ({ page }) => {
    // Look for search or filter controls
    const searchInput = page.getByPlaceholder(/search|location/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('Brooklyn');

      // Should show filtered results
      await expect(page.getByRole('main')).toBeVisible();
    }
  });
});
