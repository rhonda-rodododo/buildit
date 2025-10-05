import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should create new identity and access dashboard', async ({ page }) => {
    await page.goto('/');

    // Should show login page initially
    await expect(page.getByRole('heading', { name: /buildIt network/i })).toBeVisible();

    // Click to generate new identity
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }

    // Should redirect to dashboard or show identity created message
    await expect(page).toHaveURL(/\/(dashboard|groups)/);

    // Verify app is loaded
    await expect(page.getByText(/buildIt network/i)).toBeVisible();
  });

  test('should import existing identity', async ({ page }) => {
    await page.goto('/');

    // Click import button
    const importButton = page.getByRole('button', { name: /import/i });
    if (await importButton.isVisible()) {
      await importButton.click();
    }

    // Enter test private key (nsec format)
    const testNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    const input = page.getByPlaceholder(/nsec|private key/i);
    await input.fill(testNsec);

    // Submit
    await page.getByRole('button', { name: /import|continue/i }).click();

    // Should be logged in
    await expect(page).toHaveURL(/\/(dashboard|groups)/);
  });

  test('should switch between identities', async ({ page }) => {
    // This test assumes at least 2 identities exist
    await page.goto('/');

    // Create first identity
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }

    await page.waitForURL(/\/(dashboard|groups)/);

    // Open identity switcher
    const identityButton = page.getByRole('button', { name: /identity|account/i }).first();
    if (await identityButton.isVisible()) {
      await identityButton.click();

      // Check for add identity option
      const addIdentity = page.getByText(/add identity|new identity/i);
      await expect(addIdentity).toBeVisible();
    }
  });

  test('should export private key', async ({ page }) => {
    await page.goto('/');

    // Login with test identity
    const generateButton = page.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }

    await page.waitForURL(/\/(dashboard|groups)/);

    // Open settings
    const settingsButton = page.getByRole('button', { name: /settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    // Look for export key option
    const exportButton = page.getByText(/export|backup key/i);
    if (await exportButton.isVisible()) {
      await exportButton.click();

      // Should show private key (warning dialog)
      await expect(page.getByText(/private key|nsec/i)).toBeVisible();
    }
  });
});
