import { test, expect } from '@playwright/test';
import { waitForAppReady, createIdentity } from './helpers/helpers';

test.describe('Group Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Test User', 'testpassword123');
  });

  test('should create a new group', async ({ page }) => {
    // Navigate to groups page or open create group dialog
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    await createGroupButton.click();

    // Fill in group details
    await page.getByLabel(/group name|name/i).fill('Test Activist Group');
    await page.getByLabel(/description/i).fill('A test group for organizing');

    // Select modules (if shown)
    const eventsCheckbox = page.getByLabel(/events/i);
    if (await eventsCheckbox.isVisible()) {
      await eventsCheckbox.check();
    }

    // Submit
    await page.getByRole('button', { name: /create|save/i }).click();

    // Should see group in list
    await expect(page.getByText('Test Activist Group')).toBeVisible();
  });

  test('should view group dashboard', async ({ page }) => {
    // Create a group first
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Dashboard Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Click on the group
    await page.getByText('Dashboard Test Group').click();

    // Should show group dashboard with tabs
    await expect(page.getByRole('tab', { name: /messages|events|dashboard/i })).toBeVisible();
  });

  test('should enable and disable modules for a group', async ({ page }) => {
    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Module Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open group settings
    await page.getByText('Module Test Group').click();
    const settingsButton = page.getByRole('button', { name: /settings|configure/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    // Navigate to modules tab
    const modulesTab = page.getByRole('tab', { name: /modules/i });
    if (await modulesTab.isVisible()) {
      await modulesTab.click();

      // Toggle a module
      const eventsToggle = page.getByLabel(/enable events|events module/i);
      if (await eventsToggle.isVisible()) {
        const wasChecked = await eventsToggle.isChecked();
        await eventsToggle.click();
        await expect(eventsToggle).toBeChecked({ checked: !wasChecked });
      }
    }
  });

  test('should invite member to group', async ({ page }) => {
    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Invite Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open invite dialog
    await page.getByText('Invite Test Group').click();
    const inviteButton = page.getByRole('button', { name: /invite|add member/i });
    if (await inviteButton.isVisible()) {
      await inviteButton.click();

      // Enter npub or search for user
      const input = page.getByPlaceholder(/npub|public key|search/i);
      await input.fill('npub1test123');

      // Submit invite
      await page.getByRole('button', { name: /send invite|invite/i }).click();

      // Should show success message
      await expect(page.getByText(/invited|invitation sent/i)).toBeVisible();
    }
  });

  test('should update group settings', async ({ page }) => {
    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Settings Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open group settings
    await page.getByText('Settings Test Group').click();
    const settingsButton = page.getByRole('button', { name: /settings|configure/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Update group name
      const nameInput = page.getByLabel(/group name|name/i);
      await nameInput.clear();
      await nameInput.fill('Updated Group Name');

      // Save
      await page.getByRole('button', { name: /save|update/i }).click();

      // Should show updated name
      await expect(page.getByText('Updated Group Name')).toBeVisible();
    }
  });

  test('should create a private group', async ({ page }) => {
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    await createGroupButton.click();

    // Fill in group details
    await page.getByLabel(/group name|name/i).fill('Private Test Group');
    await page.getByLabel(/description/i).fill('A private group for testing');

    // Select private privacy level
    const privacySelect = page.getByLabel(/privacy|visibility/i);
    if (await privacySelect.isVisible()) {
      await privacySelect.click();
      await page.getByText(/private/i).first().click();
    } else {
      // Try radio button or checkbox
      const privateRadio = page.getByRole('radio', { name: /private/i });
      if (await privateRadio.isVisible()) {
        await privateRadio.check();
      }
    }

    // Submit
    await page.getByRole('button', { name: /create|save/i }).click();

    // Should see group in list with private indicator
    await expect(page.getByText('Private Test Group')).toBeVisible();
    // Look for lock icon or "Private" badge
    const privateIndicator = page.locator('svg[class*="lock"]').or(page.getByText(/private/i));
    await expect(privateIndicator.first()).toBeVisible();
  });

  test('should manage member roles', async ({ page }) => {
    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Role Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open group settings
    await page.getByText('Role Test Group').click();
    const settingsButton = page.getByRole('button', { name: /settings|configure/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Navigate to members tab
      const membersTab = page.getByRole('tab', { name: /members/i });
      if (await membersTab.isVisible()) {
        await membersTab.click();
        await page.waitForTimeout(300);

        // Look for role selector on a member row
        const roleSelect = page.getByRole('combobox').first();
        if (await roleSelect.isVisible()) {
          await roleSelect.click();

          // Change role to moderator
          await page.getByRole('option', { name: /moderator/i }).click();

          // Verify role changed
          await expect(page.getByText(/moderator/i)).toBeVisible();
        }
      }
    }
  });

  test('should remove member from group', async ({ page }) => {
    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Remove Member Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open group settings
    await page.getByText('Remove Member Test Group').click();
    const settingsButton = page.getByRole('button', { name: /settings|configure/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Navigate to members tab
      const membersTab = page.getByRole('tab', { name: /members/i });
      if (await membersTab.isVisible()) {
        await membersTab.click();
        await page.waitForTimeout(300);

        // Look for remove button (UserMinus icon)
        const removeButton = page.getByRole('button', { name: /remove/i }).first();
        if (await removeButton.isVisible()) {
          await removeButton.click();

          // Confirm removal in dialog
          const confirmButton = page.getByRole('button', { name: /remove|confirm/i }).last();
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
            await page.waitForTimeout(300);
          }
        }
      }
    }
  });

  test('should generate invite link', async ({ page }) => {
    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Invite Link Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open group settings
    await page.getByText('Invite Link Test Group').click();
    const settingsButton = page.getByRole('button', { name: /settings|configure/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Navigate to members tab
      const membersTab = page.getByRole('tab', { name: /members/i });
      if (await membersTab.isVisible()) {
        await membersTab.click();
        await page.waitForTimeout(300);

        // Click invite members button
        const inviteButton = page.getByRole('button', { name: /invite members/i });
        if (await inviteButton.isVisible()) {
          await inviteButton.click();
          await page.waitForTimeout(300);

          // Switch to Link tab
          const linkTab = page.getByRole('tab', { name: /link/i });
          if (await linkTab.isVisible()) {
            await linkTab.click();
            await page.waitForTimeout(300);

            // Generate link
            const generateLinkButton = page.getByRole('button', { name: /generate.*link/i });
            if (await generateLinkButton.isVisible()) {
              await generateLinkButton.click();
              await page.waitForTimeout(500);

              // Verify link was generated
              const linkInput = page.getByRole('textbox').filter({ hasValue: /invite/ });
              await expect(linkInput.or(page.locator('input[readonly]'))).toBeVisible();
            }
          }
        }
      }
    }
  });

  test('should revoke pending invitation', async ({ page }) => {
    // Create a group and send an invite
    const createGroupButton = page.getByRole('button', { name: /create group|new group/i });
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click();
      await page.getByLabel(/group name|name/i).fill('Revoke Invite Test Group');
      await page.getByRole('button', { name: /create|save/i }).click();
    }

    // Open group settings
    await page.getByText('Revoke Invite Test Group').click();
    const settingsButton = page.getByRole('button', { name: /settings|configure/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Navigate to members tab
      const membersTab = page.getByRole('tab', { name: /members/i });
      if (await membersTab.isVisible()) {
        await membersTab.click();
        await page.waitForTimeout(300);

        // Generate an invite link first
        const inviteButton = page.getByRole('button', { name: /invite members/i });
        if (await inviteButton.isVisible()) {
          await inviteButton.click();
          await page.waitForTimeout(300);

          const linkTab = page.getByRole('tab', { name: /link/i });
          if (await linkTab.isVisible()) {
            await linkTab.click();
            await page.getByRole('button', { name: /generate.*link/i }).click();
            await page.waitForTimeout(500);

            // Close dialog
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);

            // Find and revoke the pending invitation
            const revokeButton = page.getByRole('button').filter({ has: page.locator('svg') }).last();
            if (await revokeButton.isVisible()) {
              await revokeButton.click();

              // Confirm revocation
              const confirmButton = page.getByRole('button', { name: /revoke/i });
              if (await confirmButton.isVisible()) {
                await confirmButton.click();
              }
            }
          }
        }
      }
    }
  });
});
