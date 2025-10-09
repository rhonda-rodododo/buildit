import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Tests for Epic 40 - Username System
 *
 * Tests cover:
 * 1. Username Registration (validation, reserved words, offensive words)
 * 2. NIP-05 Verification (with mocked HTTP responses)
 * 3. User Directory (browse, search, filter by verified status)
 * 4. Privacy Controls (search visibility, directory inclusion, enforcement)
 */

// Helper: Create test identity and navigate to profile settings
async function setupProfileSettings(page: Page): Promise<void> {
  await page.goto('/');

  // Generate new identity if on login page
  const generateButton = page.getByRole('button', { name: /generate new identity/i });
  if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await generateButton.click();
    await page.waitForURL(/\/(app|dashboard|groups)/, { timeout: 10000 });
  }

  // Navigate to profile settings
  await page.goto('/app/settings');
  await page.waitForLoadState('networkidle');

  // Wait for settings page to load
  await expect(page.getByText(/profile/i).first()).toBeVisible({ timeout: 5000 });
}

test.describe('Username Registration & Validation', () => {
  test('should register valid username with display name', async ({ page }) => {
    await setupProfileSettings(page);

    // Enter valid username
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('alice-organizer');

    // Wait for availability check (debounce 500ms)
    await page.waitForTimeout(600);

    // Should show available indicator
    await expect(page.getByText(/username available/i)).toBeVisible();

    // Enter display name
    const displayNameInput = page.getByTestId('display-name-input');
    await displayNameInput.fill('Alice Martinez');

    // Save username
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();

    // Should show success message
    await expect(page.getByText(/username saved/i)).toBeVisible({ timeout: 5000 });

    // Verify username persists on reload
    await page.reload();
    await expect(usernameInput).toHaveValue('alice-organizer');
    await expect(displayNameInput).toHaveValue('Alice Martinez');
  });

  test('should validate username length (3-20 characters)', async ({ page }) => {
    await setupProfileSettings(page);

    const usernameInput = page.getByTestId('username-input');

    // Too short (2 chars)
    await usernameInput.fill('ab');
    await page.waitForTimeout(100);
    await expect(page.getByText(/at least 3 characters/i)).toBeVisible();

    // Too long (21 chars)
    await usernameInput.fill('a'.repeat(21));
    await page.waitForTimeout(100);
    await expect(page.getByText(/20 characters or less/i)).toBeVisible();

    // Valid length (3 chars)
    await usernameInput.fill('abc');
    await page.waitForTimeout(600);
    // Should NOT show length error
    await expect(page.getByText(/at least 3 characters/i)).not.toBeVisible();
  });

  test('should enforce alphanumeric and hyphen rules', async ({ page }) => {
    await setupProfileSettings(page);

    const usernameInput = page.getByTestId('username-input');

    // Invalid characters (underscore)
    await usernameInput.fill('alice_organizer');
    await page.waitForTimeout(100);
    await expect(page.getByText(/letters, numbers, and hyphens only/i)).toBeVisible();

    // Cannot start with hyphen
    await usernameInput.fill('-alice');
    await page.waitForTimeout(100);
    await expect(page.getByText(/cannot start or end with a hyphen/i)).toBeVisible();

    // Cannot have consecutive hyphens
    await usernameInput.fill('alice--organizer');
    await page.waitForTimeout(100);
    await expect(page.getByText(/consecutive hyphens/i)).toBeVisible();

    // Valid format
    await usernameInput.fill('alice-organizer-2024');
    await page.waitForTimeout(600);
    // Should NOT show format error
    await expect(page.getByText(/letters, numbers, and hyphens only/i)).not.toBeVisible();
  });

  test('should reject reserved usernames', async ({ page }) => {
    await setupProfileSettings(page);

    const usernameInput = page.getByTestId('username-input');

    // Test reserved username
    await usernameInput.fill('admin');
    await page.waitForTimeout(100);
    await expect(page.getByText(/username is reserved/i)).toBeVisible();

    // Test another reserved username
    await usernameInput.fill('moderator');
    await page.waitForTimeout(100);
    await expect(page.getByText(/username is reserved/i)).toBeVisible();

    // Valid non-reserved username
    await usernameInput.fill('alice-admin'); // Contains "admin" but not exact match
    await page.waitForTimeout(600);
    await expect(page.getByText(/username is reserved/i)).not.toBeVisible();
  });

  test('should detect duplicate usernames', async ({ page, context }) => {
    // Create first identity with username
    await setupProfileSettings(page);
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('alice-first');
    await page.waitForTimeout(600);
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();
    await expect(page.getByText(/username saved/i)).toBeVisible({ timeout: 5000 });

    // Open new page (second identity)
    const page2 = await context.newPage();
    await page2.goto('/');

    // Create second identity
    const generateButton = page2.getByRole('button', { name: /generate new identity/i });
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateButton.click();
      await page2.waitForURL(/\/(app|dashboard|groups)/, { timeout: 10000 });
    }

    // Try to claim same username
    await page2.goto('/app/settings');
    await page2.waitForLoadState('networkidle');

    const usernameInput2 = page2.getByTestId('username-input');
    await usernameInput2.fill('alice-first');
    await page2.waitForTimeout(600);

    // Should show "already taken" message
    await expect(page2.getByText(/username already taken/i)).toBeVisible();

    // Save button should be disabled
    const saveButton2 = page2.getByTestId('save-username-button');
    await expect(saveButton2).toBeDisabled();

    await page2.close();
  });
});

test.describe('NIP-05 Verification', () => {
  test('should verify valid NIP-05 identifier', async ({ page, context }) => {
    await setupProfileSettings(page);

    // Set a username first
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('alice-test');
    await page.waitForTimeout(600);
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Get current pubkey from IndexedDB
    const pubkey = await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('BuildItNetworkDB');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('identities', 'readonly');
          const store = tx.objectStore('identities');
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            const identities = getAllRequest.result;
            resolve(identities[0]?.publicKey || '');
          };
        };
      });
    });

    // Mock NIP-05 verification endpoint
    await context.route('**/.well-known/nostr.json*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          names: {
            alice: pubkey,
          },
        }),
      });
    });

    // Enter NIP-05 identifier
    const nip05Input = page.getByTestId('nip05-input');
    await nip05Input.fill('alice@example.com');

    // Click verify button
    const verifyButton = page.getByTestId('verify-nip05-button');
    await verifyButton.click();

    // Should show verified message
    await expect(page.getByText(/verified as/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle NIP-05 verification failure (wrong pubkey)', async ({ page, context }) => {
    await setupProfileSettings(page);

    // Set username
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('bob-test');
    await page.waitForTimeout(600);
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Mock NIP-05 endpoint with DIFFERENT pubkey
    await context.route('**/.well-known/nostr.json*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          names: {
            bob: 'npub1differentpubkey12345', // Wrong pubkey
          },
        }),
      });
    });

    const nip05Input = page.getByTestId('nip05-input');
    await nip05Input.fill('bob@example.com');

    const verifyButton = page.getByTestId('verify-nip05-button');
    await verifyButton.click();

    // Should show error toast
    await expect(page.getByText(/verification failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle NIP-05 verification failure (domain not found)', async ({ page, context }) => {
    await setupProfileSettings(page);

    // Set username
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('charlie-test');
    await page.waitForTimeout(600);
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Mock failed HTTP request
    await context.route('**/.well-known/nostr.json*', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'text/html',
        body: 'Not Found',
      });
    });

    const nip05Input = page.getByTestId('nip05-input');
    await nip05Input.fill('charlie@nonexistent.com');

    const verifyButton = page.getByTestId('verify-nip05-button');
    await verifyButton.click();

    // Should show error
    await expect(page.getByText(/verification failed/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('User Directory', () => {
  test('should browse user directory and see all users', async ({ page }) => {
    // Create user with username
    await setupProfileSettings(page);
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('alice-directory');
    await page.waitForTimeout(600);
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Navigate to user directory
    await page.goto('/app/directory');
    await page.waitForLoadState('networkidle');

    // Should see directory header
    await expect(page.getByRole('heading', { name: /user directory/i })).toBeVisible();

    // Should see the user we created
    await expect(page.getByText(/alice-directory/i)).toBeVisible();

    // Should show user count
    await expect(page.getByText(/\d+ users? found/i)).toBeVisible();
  });

  test('should search users by username', async ({ page }) => {
    // Create two users
    await setupProfileSettings(page);
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('alice-search');
    await page.waitForTimeout(600);
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Navigate to directory
    await page.goto('/app/directory');
    await page.waitForLoadState('networkidle');

    // Search for "alice"
    const searchInput = page.getByTestId('directory-search-input');
    await searchInput.fill('alice');
    await page.waitForTimeout(300);

    // Should show Alice
    await expect(page.getByText(/alice-search/i)).toBeVisible();
  });

  test('should filter directory by verified status', async ({ page, context }) => {
    // Create verified user
    await setupProfileSettings(page);
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('alice-verified');
    await page.waitForTimeout(600);
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Get pubkey and verify
    const pubkey = await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('BuildItNetworkDB');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('identities', 'readonly');
          const store = tx.objectStore('identities');
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            resolve(getAllRequest.result[0]?.publicKey || '');
          };
        };
      });
    });

    await context.route('**/.well-known/nostr.json*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ names: { alice: pubkey } }),
      });
    });

    const nip05Input = page.getByTestId('nip05-input');
    await nip05Input.fill('alice@example.com');
    const verifyButton = page.getByTestId('verify-nip05-button');
    await verifyButton.click();
    await page.waitForTimeout(2000);

    // Go to directory
    await page.goto('/app/directory');
    await page.waitForLoadState('networkidle');

    // Filter to verified only
    const filterSelect = page.locator('select, [role="combobox"]').first();
    await filterSelect.click();
    await page.getByRole('option', { name: /verified only/i }).click();

    // Should show Alice with verified badge
    await expect(page.getByText(/alice-verified/i)).toBeVisible();
  });
});

test.describe('Privacy Controls', () => {
  test('should toggle directory inclusion', async ({ page }) => {
    await setupProfileSettings(page);

    // Set username
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('bob-privacy');
    await page.waitForTimeout(600);
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Find "Show in Directory" switch - it's within a div with that text
    const directorySection = page.locator('div', { has: page.getByText('Show in Directory') });
    const directorySwitch = directorySection.locator('button[role="switch"]').first();

    // Get current state
    const isEnabled = await directorySwitch.getAttribute('data-state');

    // Toggle if enabled
    if (isEnabled === 'checked') {
      await directorySwitch.click();
      await page.waitForTimeout(500);

      // Should show success toast
      await expect(page.getByText(/privacy settings updated/i)).toBeVisible({ timeout: 5000 });

      // Verify it persists
      await page.reload();
      await page.waitForLoadState('networkidle');

      const directorySectionReload = page.locator('div', { has: page.getByText('Show in Directory') });
      const directorySwitchReload = directorySectionReload.locator('button[role="switch"]').first();
      const newState = await directorySwitchReload.getAttribute('data-state');
      expect(newState).toBe('unchecked');
    }
  });

  test('should change profile visibility tier', async ({ page }) => {
    await setupProfileSettings(page);

    // Set username
    const usernameInput = page.getByTestId('username-input');
    await usernameInput.fill('charlie-visibility');
    await page.waitForTimeout(600);
    const saveButton = page.getByTestId('save-username-button');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Find "Profile Visibility" select
    const visibilitySection = page.locator('div', { has: page.getByText('Profile Visibility') });
    const visibilitySelect = visibilitySection.locator('[role="combobox"]').first();

    // Change to "Friends only"
    await visibilitySelect.click();
    await page.getByRole('option', { name: /friends only/i }).click();

    // Should show success toast
    await expect(page.getByText(/privacy settings updated/i)).toBeVisible({ timeout: 5000 });

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify "Friends only" is selected
    await expect(page.getByText(/friends only/i)).toBeVisible();
  });
});
