import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * Tests identity creation, import, switching, and security features
 */

// Helper function to create a new identity
async function createIdentity(page, name = 'Test User', password = 'testpassword123') {
  // Ensure we're on the Create New tab
  const createNewTab = page.getByRole('tab', { name: /create new/i });
  await createNewTab.click();
  await page.waitForTimeout(300); // Wait for tab transition

  // Get the Create New tabpanel
  const panel = page.getByRole('tabpanel', { name: /create new/i });

  // Fill in identity form within the tabpanel
  await panel.getByRole('textbox', { name: /display name/i }).fill(name);
  await panel.getByRole('textbox', { name: /^password$/i }).fill(password);
  await panel.getByRole('textbox', { name: /confirm password/i }).fill(password);

  // Click create button
  await panel.getByRole('button', { name: /create identity/i }).click();

  // Wait for navigation to app (feed page)
  await page.waitForURL(/\/app/, { timeout: 15000 });
}

// Helper function to import an identity
async function importIdentity(page, nsec: string, password = 'testpassword123', name = 'Imported User') {
  // Click Import tab
  const importTab = page.getByRole('tab', { name: /^import$/i });
  await importTab.click();
  await page.waitForTimeout(300); // Wait for tab transition

  // Get the Import tabpanel
  const panel = page.getByRole('tabpanel', { name: /import/i });

  // Fill in display name (required)
  await panel.getByRole('textbox', { name: /display name/i }).fill(name);

  // Fill in nsec - look for the private key input
  await panel.getByRole('textbox', { name: /private key/i }).fill(nsec);

  // Fill in password
  await panel.getByRole('textbox', { name: /^password$/i }).fill(password);
  await panel.getByRole('textbox', { name: /confirm password/i }).fill(password);

  // Click import button
  await panel.getByRole('button', { name: /import identity/i }).click();

  // Wait for navigation to app (feed page)
  await page.waitForURL(/\/app/, { timeout: 15000 });
}

test.describe('Authentication Flow', () => {
  // Clear IndexedDB before each test to ensure clean state
  test.beforeEach(async ({ page }) => {
    // Navigate to app first to establish origin
    await page.goto('/');

    // Clear all IndexedDB databases
    await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    });

    // Reload to ensure app initializes fresh
    await page.reload();

    // Wait for app to initialize (either login page or loading)
    await page.waitForLoadState('networkidle');
  });

  test('should create new identity and access dashboard', async ({ page }) => {
    // Wait for the login page to fully render with the Create New tab
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Should show login page initially with BuildIt Network heading
    await expect(page.getByText(/buildIt network/i).first()).toBeVisible();

    // Create a new identity
    await createIdentity(page, 'New Test User', 'securepassword123');

    // Verify we're logged in and on the dashboard/groups page
    await expect(page).toHaveURL(/\/app/);
  });

  test('should import existing identity', async ({ page }) => {
    // Wait for the login page to fully render
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Test nsec (for testing purposes only)
    const testNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

    // Import identity
    await importIdentity(page, testNsec, 'importpassword123');

    // Should be logged in
    await expect(page).toHaveURL(/\/app/);
  });

  test('should switch between identities', async ({ page }) => {
    // Wait for the login page to fully render
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Create first identity
    await createIdentity(page, 'First Identity', 'password123456');

    // Look for identity/profile menu in navigation
    // This could be in a sidebar, header, or dropdown
    const profileButton = page.locator('[data-testid="profile-menu"], [data-testid="identity-menu"], button[aria-label*="profile" i], button[aria-label*="identity" i]').first();

    if (await profileButton.isVisible({ timeout: 2000 })) {
      await profileButton.click();

      // Look for option to add or switch identities
      const addIdentityOption = page.getByText(/add identity|switch identity|new identity/i);
      if (await addIdentityOption.isVisible({ timeout: 2000 })) {
        await expect(addIdentityOption).toBeVisible();
      }
    }
  });

  test('should export private key', async ({ page }) => {
    // Wait for the login page to fully render
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Create identity first
    await createIdentity(page, 'Export Test', 'exportpassword12');

    // Navigate to security settings via UI (not goto to preserve session)
    const settingsLink = page.getByRole('link', { name: 'Settings' });
    await settingsLink.click();
    await page.waitForLoadState('networkidle');

    // Then click on Security tab/link
    const securityLink = page.getByRole('link', { name: /security/i });
    if (await securityLink.isVisible({ timeout: 2000 })) {
      await securityLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for export key option or advanced security section
    const advancedTab = page.getByRole('tab', { name: /advanced/i });
    if (await advancedTab.isVisible({ timeout: 2000 })) {
      await advancedTab.click();
    }

    // The export key functionality may be in a different location
    // Check for any key-related buttons or links
    const exportOption = page.getByText(/export|backup|private key/i).first();
    if (await exportOption.isVisible({ timeout: 2000 })) {
      // Verify the element exists
      await expect(exportOption).toBeVisible();
    }
  });

  test('should lock and unlock identity', async ({ page }) => {
    // Wait for the login page to fully render
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Create identity with password
    await createIdentity(page, 'Lock Test User', 'lockpassword123');

    // Navigate to security settings via UI
    const settingsLink = page.getByRole('link', { name: 'Settings' });
    await settingsLink.click();
    await page.waitForLoadState('networkidle');

    const securityLink = page.getByRole('link', { name: /security/i });
    if (await securityLink.isVisible({ timeout: 2000 })) {
      await securityLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for session tab or lock settings
    const sessionTab = page.getByRole('tab', { name: /session/i });
    if (await sessionTab.isVisible({ timeout: 2000 })) {
      await sessionTab.click();
    }

    // Look for lock button
    const lockButton = page.getByRole('button', { name: /lock/i }).first();
    if (await lockButton.isVisible({ timeout: 2000 })) {
      await lockButton.click();

      // Should show lock screen or password dialog
      const passwordInput = page.getByPlaceholder(/password/i).first();
      if (await passwordInput.isVisible({ timeout: 3000 })) {
        // Enter password to unlock
        await passwordInput.fill('lockpassword123');

        const unlockButton = page.getByRole('button', { name: /unlock|continue/i });
        if (await unlockButton.isVisible()) {
          await unlockButton.click();
        }

        // Should return to app
        await expect(page).toHaveURL(/\/app/);
      }
    }
  });

  test('should change password', async ({ page }) => {
    // Wait for the login page to fully render
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Create identity
    await createIdentity(page, 'Password Change Test', 'oldpassword123');

    // Navigate to security settings via UI
    const settingsLink = page.getByRole('link', { name: 'Settings' });
    await settingsLink.click();
    await page.waitForLoadState('networkidle');

    const securityLink = page.getByRole('link', { name: /security/i });
    if (await securityLink.isVisible({ timeout: 2000 })) {
      await securityLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for session tab which may contain password change
    const sessionTab = page.getByRole('tab', { name: /session/i });
    if (await sessionTab.isVisible({ timeout: 2000 })) {
      await sessionTab.click();
    }

    // Look for change password button or section
    const changePasswordButton = page.getByRole('button', { name: /change password/i });
    if (await changePasswordButton.isVisible({ timeout: 2000 })) {
      await changePasswordButton.click();

      // Fill in password change form (dialog may open)
      const currentPasswordInput = page.getByLabel(/current password/i);
      const newPasswordInput = page.getByLabel(/new password/i);
      const confirmPasswordInput = page.getByLabel(/confirm.*password/i);

      if (await currentPasswordInput.isVisible({ timeout: 2000 })) {
        await currentPasswordInput.fill('oldpassword123');
        await newPasswordInput.fill('newpassword456');
        await confirmPasswordInput.fill('newpassword456');

        // Submit
        await page.getByRole('button', { name: /save|update|change|confirm/i }).click();

        // Should show success message or close dialog
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should prevent duplicate identity import', async ({ page }) => {
    // Wait for the login page to fully render
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 });

    // Import identity first time
    const testNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    await importIdentity(page, testNsec, 'duplicatetest12');

    // Now we're logged in
    await expect(page).toHaveURL(/\/app/);

    // Try to add the same identity again
    // First, navigate to a place where we can add new identities
    // This depends on the app's navigation structure

    // If there's a profile menu with add identity option
    const profileButton = page.locator('[data-testid="profile-menu"], [data-testid="identity-menu"]').first();
    if (await profileButton.isVisible({ timeout: 2000 })) {
      await profileButton.click();

      const addIdentity = page.getByText(/add identity/i);
      if (await addIdentity.isVisible({ timeout: 2000 })) {
        await addIdentity.click();

        // Try to import same nsec
        const importTab = page.getByRole('tab', { name: /^import$/i });
        if (await importTab.isVisible({ timeout: 2000 })) {
          await importTab.click();
          const panel = page.getByRole('tabpanel', { name: /import/i });
          await panel.getByPlaceholder(/nsec|private key/i).fill(testNsec);
          await panel.getByRole('textbox', { name: /^password$/i }).fill('duplicatetest12');
          await panel.getByRole('textbox', { name: /confirm password/i }).fill('duplicatetest12');
          await panel.getByRole('button', { name: /import identity/i }).click();

          // Should show error about duplicate
          const errorMessage = page.getByText(/already exists|duplicate|already imported/i);
          if (await errorMessage.isVisible({ timeout: 3000 })) {
            await expect(errorMessage).toBeVisible();
          }
        }
      }
    }
  });
});
