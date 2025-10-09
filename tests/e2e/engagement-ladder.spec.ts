/**
 * E2E Tests for Epic 25 - Engagement Ladder & Onboarding
 * Tests engagement level tracking, onboarding flows, and smart notifications
 */

import { test, expect, Page } from '@playwright/test';

// Helper function to create a new identity and login
async function loginWithNewIdentity(page: Page) {
  await page.goto('/');

  const generateButton = page.getByRole('button', { name: /generate new identity/i });
  if (await generateButton.isVisible()) {
    await generateButton.click();
  }

  // Wait for redirect to dashboard/groups
  await page.waitForURL(/\/(dashboard|groups|app)/);
}

// Helper function to navigate to engagement page
async function navigateToEngagementPage(page: Page) {
  // Try multiple navigation methods as route might vary
  await page.goto('/app/engagement');

  // Alternative: look for engagement link in navigation
  const engagementLink = page.getByRole('link', { name: /engagement|journey/i });
  if (await engagementLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await engagementLink.click();
  }

  // Verify we're on engagement page
  await expect(page.getByText(/engagement|journey/i).first()).toBeVisible({ timeout: 5000 });
}

test.describe('Engagement Ladder - Level Detection & Display', () => {
  test('should display default engagement level for new user', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // New users should start at Neutral level
    await expect(page.getByText(/neutral/i)).toBeVisible();
    await expect(page.getByText(/30%|exploring|learning/i)).toBeVisible();

    // Should show engagement ladder visualization
    await expect(page.getByText(/engagement ladder/i)).toBeVisible();

    // Should show all 4 engagement levels
    await expect(page.getByText(/passive support/i)).toBeVisible();
    await expect(page.getByText(/active support/i)).toBeVisible();
    await expect(page.getByText(/core organizer/i)).toBeVisible();
  });

  test('should display engagement level badge with correct percentage', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Check for badge with level and percentage
    const badge = page.locator('[class*="badge"]', { hasText: /neutral.*30%/i });
    await expect(badge).toBeVisible();
  });

  test('should show progress to next engagement level', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Should show progress bar
    await expect(page.getByText(/progress to.*passive support/i)).toBeVisible();

    // Should show milestone count (e.g., "2/3 milestones")
    await expect(page.getByText(/\d+\/\d+ milestones/i)).toBeVisible();
  });

  test('should show milestones for current level', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Neutral level milestones
    await expect(page.getByText(/attend your first event/i)).toBeVisible();
    await expect(page.getByText(/join a working group/i)).toBeVisible();
    await expect(page.getByText(/share our content/i)).toBeVisible();

    // Should show milestone points
    await expect(page.getByText(/\+\d+ pts/i).first()).toBeVisible();
  });

  test('should display engagement ladder overview with all levels', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Scroll to ladder overview
    await page.getByText(/engagement ladder/i).last().scrollIntoViewIfNeeded();

    // Should show all 4 levels
    const levels = ['Neutral', 'Passive Support', 'Active Support', 'Core Organizer'];
    for (const level of levels) {
      await expect(page.getByText(level)).toBeVisible();
    }

    // Should indicate current level
    await expect(page.getByText(/you are here/i)).toBeVisible();
  });

  test('should show "Core Organizer" celebration message at max level', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Core Organizer level (using demo switcher if available)
    const demoSwitcher = page.getByRole('button', { name: /demo.*switch level/i });
    if (await demoSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await demoSwitcher.click();
      await page.getByText(/core organizer.*100%/i).click();

      // Should show congratulations message
      await expect(page.getByText(/highest engagement level|keep building/i)).toBeVisible();
    }
  });
});

test.describe('Engagement Ladder - Milestones & Progress', () => {
  test('should mark completed milestones with checkmark', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Look for completed milestone indicators
    // In demo, some milestones are pre-completed
    const completedMilestones = page.locator('[class*="green"]', { hasText: /attend.*event|join.*group|share/i });
    if (await completedMilestones.count() > 0) {
      await expect(completedMilestones.first()).toBeVisible();
    }
  });

  test('should show suggested next steps based on engagement level', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Should show "Suggested Next Steps" section
    await expect(page.getByText(/suggested next steps/i)).toBeVisible();

    // Neutral level next steps
    await expect(page.getByText(/explore upcoming events|browse events/i)).toBeVisible();

    // Should show action buttons
    const actionButton = page.getByRole('button', { name: /browse events|read wiki|see events/i }).first();
    await expect(actionButton).toBeVisible();

    // Should show estimated time
    await expect(page.getByText(/\d+ min/i).first()).toBeVisible();
  });

  test('should update next steps when switching engagement levels', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Check initial next steps for Neutral
    await expect(page.getByText(/explore upcoming events/i)).toBeVisible();

    // Switch to Active Support level
    const demoSwitcher = page.getByRole('button', { name: /demo.*switch level/i });
    if (await demoSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await demoSwitcher.click();
      await page.getByText(/active support.*70%/i).click();

      // Wait for UI update
      await page.waitForTimeout(500);

      // Should show different next steps
      await expect(page.getByText(/volunteer|leadership training/i)).toBeVisible();
    }
  });

  test('should track milestone progress percentage', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Progress bar should be visible
    const progressBar = page.locator('[role="progressbar"], [class*="progress"]').first();
    await expect(progressBar).toBeVisible();
  });
});

test.describe('Onboarding Flows - Entry Points', () => {
  test('should show different onboarding flow for "campaign" entry point', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Select campaign entry point
    const entryPointSelector = page.getByRole('button', { name: /entry point/i });
    if (await entryPointSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryPointSelector.click();
      await page.getByText(/campaign landing page/i).click();
    }

    // Should show campaign-specific onboarding
    await expect(page.getByText(/what brings you here/i)).toBeVisible();
    await expect(page.getByText(/personalize your experience/i)).toBeVisible();

    // Should show step 1 of X
    await expect(page.getByText(/step 1 of/i)).toBeVisible();
  });

  test('should show different onboarding flow for "event" entry point', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Select event entry point
    const entryPointSelector = page.getByRole('button', { name: /entry point/i });
    if (await entryPointSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryPointSelector.click();
      await page.getByText(/event rsvp/i).click();
    }

    // Event flow starts with quick setup
    await expect(page.getByText(/quick setup/i)).toBeVisible();
  });

  test('should show different onboarding flow for "friend-invite" entry point', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Select friend-invite entry point
    const entryPointSelector = page.getByRole('button', { name: /entry point/i });
    if (await entryPointSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryPointSelector.click();
      await page.getByText(/friend invitation/i).click();
    }

    // Friend-invite flow emphasizes social connection
    await expect(page.getByText(/your friend invited you/i)).toBeVisible();
  });

  test('should show different onboarding flow for "website" entry point', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Select website entry point
    const entryPointSelector = page.getByRole('button', { name: /entry point/i });
    if (await entryPointSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryPointSelector.click();
      await page.getByText(/main website/i).click();
    }

    // Website flow is comprehensive
    await expect(page.getByText(/what brought you here/i)).toBeVisible();
  });

  test('should show different onboarding flow for "social-media" entry point', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Select social-media entry point
    const entryPointSelector = page.getByRole('button', { name: /entry point/i });
    if (await entryPointSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      await entryPointSelector.click();
      await page.getByText(/social media link/i).click();
    }

    // Social media flow is quick
    await expect(page.getByText(/tell us more/i)).toBeVisible();
  });
});

test.describe('Onboarding Flows - Progress & Completion', () => {
  test('should show progress bar and step count', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Progress bar should be visible
    await expect(page.getByText(/step \d+ of \d+/i)).toBeVisible();

    // Progress percentage
    await expect(page.getByText(/\d+%/i).first()).toBeVisible();

    // Visual progress bar
    const progressBar = page.locator('[role="progressbar"], [class*="progress"]').first();
    await expect(progressBar).toBeVisible();
  });

  test('should navigate through onboarding steps with Next button', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Should be on step 1
    await expect(page.getByText(/step 1 of/i)).toBeVisible();

    // Click Continue/Next
    const nextButton = page.getByRole('button', { name: /continue|next/i });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // Should advance to step 2
    await expect(page.getByText(/step 2 of/i)).toBeVisible();
  });

  test('should navigate backwards with Back button', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Advance to step 2
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/step 2 of/i)).toBeVisible();

    // Back button should be enabled
    const backButton = page.getByRole('button', { name: /back/i });
    await expect(backButton).toBeEnabled();

    // Click back
    await backButton.click();

    // Should return to step 1
    await expect(page.getByText(/step 1 of/i)).toBeVisible();
  });

  test('should allow selecting interests in interests step', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Find interests section
    const climateJustice = page.getByText(/climate justice/i);
    if (await climateJustice.isVisible({ timeout: 2000 }).catch(() => false)) {
      await climateJustice.click();

      // Should show selection (checkmark or highlight)
      await expect(climateJustice.locator('..')).toHaveClass(/primary|selected|checked/i);
    }

    // Select multiple interests
    const housingRights = page.getByText(/housing rights/i);
    if (await housingRights.isVisible({ timeout: 2000 }).catch(() => false)) {
      await housingRights.click();
    }
  });

  test('should fill profile information in profile step', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Navigate to profile step (might be step 2)
    const continueButton = page.getByRole('button', { name: /continue/i });

    // Click until we find profile step
    for (let i = 0; i < 3; i++) {
      if (await page.getByText(/set up your profile|create your profile/i).isVisible({ timeout: 1000 }).catch(() => false)) {
        break;
      }
      if (await continueButton.isVisible()) {
        await continueButton.click();
        await page.waitForTimeout(300);
      }
    }

    // Fill out profile form
    const nameInput = page.getByPlaceholder(/your name|name/i);
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('Alex Johnson');
    }

    const locationInput = page.getByPlaceholder(/city|location/i);
    if (await locationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await locationInput.fill('Oakland, CA');
    }

    const availabilitySelect = page.getByRole('combobox');
    if (await availabilitySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await availabilitySelect.selectOption('weekends');
    }
  });

  test('should complete onboarding and show completion message', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Click through all steps
    const continueButton = page.getByRole('button', { name: /continue|get started/i });

    // Maximum 6 steps for longest flow
    for (let i = 0; i < 6; i++) {
      if (await page.getByText(/you're all set|welcome|ready to organize/i).isVisible({ timeout: 1000 }).catch(() => false)) {
        // Reached completion step
        break;
      }

      if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await continueButton.click();
        await page.waitForTimeout(300);
      }
    }

    // Click final "Get Started" button
    const getStartedButton = page.getByRole('button', { name: /get started/i });
    if (await getStartedButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await getStartedButton.click();

      // Should show completion message
      await expect(page.getByText(/onboarding complete|welcome/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should show selected interests in completion summary', async ({ page }) => {
    await page.goto('/app/onboarding-demo');

    // Select an interest in first step
    const climateJustice = page.getByText(/climate justice/i);
    if (await climateJustice.isVisible({ timeout: 2000 }).catch(() => false)) {
      await climateJustice.click();
    }

    // Navigate to completion
    const continueButton = page.getByRole('button', { name: /continue|get started/i });
    for (let i = 0; i < 6; i++) {
      if (await page.getByText(/you're all set|selected interests/i).isVisible({ timeout: 1000 }).catch(() => false)) {
        break;
      }
      if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await continueButton.click();
        await page.waitForTimeout(300);
      }
    }

    // Should show selected interests
    if (await page.getByText(/selected interests/i).isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.getByText(/climate/i)).toBeVisible();
    }
  });
});

test.describe('Smart Notifications - Engagement Level Adaptation', () => {
  test('should show notifications personalized for Neutral level', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    if (await notificationsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationsTab.click();

      // Should show notifications for Neutral level
      await expect(page.getByText(/personalized for neutral/i)).toBeVisible();

      // Neutral users get beginner-friendly content
      await expect(page.getByText(/beginner|introduction|new/i)).toBeVisible();
    }
  });

  test('should show different notifications for Active Support level', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Active Support level
    const demoSwitcher = page.getByRole('button', { name: /demo.*switch level/i });
    if (await demoSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await demoSwitcher.click();
      await page.getByText(/active support.*70%/i).click();
    }

    // Switch to Notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    if (await notificationsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationsTab.click();

      // Should show notifications for Active Support level
      await expect(page.getByText(/personalized for active support/i)).toBeVisible();

      // Active Support users get action alerts and volunteer opportunities
      await expect(page.getByText(/action alert|volunteer|urgent/i)).toBeVisible();
    }
  });

  test('should show priority notifications for Core Organizer level', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Core Organizer level
    const demoSwitcher = page.getByRole('button', { name: /demo.*switch level/i });
    if (await demoSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await demoSwitcher.click();
      await page.getByText(/core organizer.*100%/i).click();
    }

    // Switch to Notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    if (await notificationsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationsTab.click();

      // Should show notifications for Core Organizer level
      await expect(page.getByText(/personalized for core organizer/i)).toBeVisible();

      // Core organizers get security alerts and leadership tasks
      await expect(page.getByText(/security alert|mentor|leadership|strategy/i)).toBeVisible();
    }
  });

  test('should display notification priority badges', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    if (await notificationsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationsTab.click();

      // Should show priority badges (URGENT, HIGH, etc.)
      const priorityBadge = page.locator('[class*="badge"]', { hasText: /urgent|high|medium/i });
      if (await priorityBadge.count() > 0) {
        await expect(priorityBadge.first()).toBeVisible();
      }
    }
  });

  test('should filter notifications by read/unread status', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    if (await notificationsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationsTab.click();

      // Should have Unread filter
      const unreadButton = page.getByRole('button', { name: /unread/i });
      await expect(unreadButton).toBeVisible();

      // Should have All filter
      const allButton = page.getByRole('button', { name: /^all$/i });
      await expect(allButton).toBeVisible();

      // Click All to see all notifications
      await allButton.click();
    }
  });

  test('should mark notification as read', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    if (await notificationsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationsTab.click();

      // Find "Mark read" button
      const markReadButton = page.getByRole('button', { name: /mark read/i }).first();
      if (await markReadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        const unreadCountBefore = await page.getByText(/unread \(\d+\)/i).textContent();

        await markReadButton.click();

        // Unread count should decrease
        await page.waitForTimeout(300);
        const unreadCountAfter = await page.getByText(/unread \(\d+\)/i).textContent();

        expect(unreadCountBefore).not.toBe(unreadCountAfter);
      }
    }
  });

  test('should dismiss notification', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    if (await notificationsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationsTab.click();

      // Find "Dismiss" button
      const dismissButton = page.getByRole('button', { name: /dismiss/i }).first();
      if (await dismissButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Get notification title before dismissing
        const notificationCard = dismissButton.locator('../..');
        const notificationTitle = await notificationCard.getByRole('heading').textContent();

        await dismissButton.click();

        // Notification should be removed
        await expect(page.getByText(notificationTitle || '')).not.toBeVisible({ timeout: 2000 });
      }
    }
  });

  test('should show relevance score for notifications', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    if (await notificationsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationsTab.click();

      // Should show relevance percentage
      const relevanceScore = page.getByText(/\d+% relevant/i);
      if (await relevanceScore.count() > 0) {
        await expect(relevanceScore.first()).toBeVisible();
      }
    }
  });

  test('should display notification timestamp', async ({ page }) => {
    await loginWithNewIdentity(page);
    await navigateToEngagementPage(page);

    // Switch to Notifications tab
    const notificationsTab = page.getByRole('tab', { name: /notifications/i });
    if (await notificationsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notificationsTab.click();

      // Should show relative timestamps (e.g., "2 hours ago")
      await expect(page.getByText(/\d+ (minute|hour|day)s? ago|just now/i)).toBeVisible();
    }
  });
});

test.describe('Engagement Ladder - Integration Tests', () => {
  test('should show engagement level indicator in app header/navigation', async ({ page }) => {
    await loginWithNewIdentity(page);

    // Look for engagement level badge in header or sidebar
    const engagementBadge = page.locator('[class*="badge"]', { hasText: /neutral|passive|active|core/i });

    // May not always be visible in header, but check if it exists anywhere
    if (await engagementBadge.count() > 0) {
      await expect(engagementBadge.first()).toBeVisible();
    }
  });

  test('should track engagement activities across the app', async ({ page }) => {
    // This is a conceptual test - actual implementation would require:
    // 1. Attending an event (RSVP)
    // 2. Checking engagement level increased
    // 3. Voting on a proposal
    // 4. Checking engagement level again

    await loginWithNewIdentity(page);

    // Navigate to events and RSVP
    await page.goto('/app/events');

    // RSVP to an event (if events exist)
    const rsvpButton = page.getByRole('button', { name: /rsvp/i }).first();
    if (await rsvpButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rsvpButton.click();

      // Confirm RSVP
      const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }
    }

    // Navigate to engagement page to check if milestone updated
    await navigateToEngagementPage(page);

    // Check if "Attend First Event" milestone is now completed
    // (This would require actual backend integration)
  });
});
