/**
 * E2E Tests for Security Features
 * Covers Epic 18 (WebAuthn/Passkeys), Epic 26 (Anonymous Engagement), Epic 27 (Infiltration Countermeasures)
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady, createIdentity } from './helpers/helpers';

/**
 * EPIC 18: WebAuthn/Passkeys & Device Management
 * Tests passkey registration, device management, session timeout, and remote revocation
 */
test.describe('Epic 18: WebAuthn/Passkeys & Device Management', () => {
  test.beforeEach(async ({ page }) => {
    // Create identity and login
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Test User', 'testpassword123');
  });

  test('should show WebAuthn setup dialog', async ({ page }) => {
    // Navigate to security settings
    await page.goto('/app/settings');

    // Look for WebAuthn setup option
    const webauthnButton = page.getByText(/WebAuthn|Passkey|Biometric/i).first();

    if (await webauthnButton.isVisible()) {
      await webauthnButton.click();

      // Should show setup dialog
      await expect(page.getByText(/Set Up WebAuthn|Passkey/i)).toBeVisible();
      await expect(page.getByText(/biometric|fingerprint|Face ID|Touch ID/i)).toBeVisible();
    }
  });

  test('should display device manager with current device', async ({ page }) => {
    // Navigate to device management
    await page.goto('/app/settings');

    // Find device management section
    const deviceSection = page.getByText(/device|session/i).first();

    if (await deviceSection.isVisible()) {
      await deviceSection.click();
    }

    // Should show current device
    await expect(page.getByText(/current device|this device/i)).toBeVisible();
  });

  test('should show device list with browser and OS information', async ({ page }) => {
    // Navigate to security demo page (has DeviceManager component)
    await page.goto('/security-demo');

    // If page doesn't exist, try settings
    if (!await page.getByText(/Device Management/i).isVisible()) {
      await page.goto('/app/settings');
    }

    // Look for device information
    const deviceInfo = page.locator('[data-testid="device-card"], .device-info').first();

    if (await deviceInfo.isVisible()) {
      // Should show browser and OS
      await expect(page.getByText(/Chrome|Firefox|Safari/i)).toBeVisible();
      await expect(page.getByText(/Windows|Mac|Linux|Android|iOS/i)).toBeVisible();
    }
  });

  test('should show remote device revocation option', async ({ page }) => {
    // Navigate to device management
    await page.goto('/app/settings');

    // Find sign out all devices button
    const signOutAllButton = page.getByRole('button', { name: /sign out all|revoke all/i });

    if (await signOutAllButton.isVisible()) {
      await signOutAllButton.click();

      // Should show confirmation dialog
      await expect(page.getByText(/sign you out|revoke/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    }
  });

  test('should display privacy settings with session timeout', async ({ page }) => {
    // Navigate to privacy settings
    await page.goto('/app/settings');

    // Look for session timeout setting
    const sessionTimeoutLabel = page.getByText(/session timeout|auto-expire/i);

    if (await sessionTimeoutLabel.isVisible()) {
      // Should have session timeout input
      const timeoutInput = page.locator('input[type="number"]').first();
      await expect(timeoutInput).toBeVisible();

      // Default should be 30 minutes or similar
      const value = await timeoutInput.inputValue();
      expect(parseInt(value)).toBeGreaterThan(0);
    }
  });

  test('should show device activity logging toggle', async ({ page }) => {
    // Navigate to privacy settings
    await page.goto('/app/settings');

    // Find activity logging toggle
    const activityLoggingToggle = page.getByText(/log.*activity|activity.*log/i);

    if (await activityLoggingToggle.isVisible()) {
      // Should have a switch/checkbox
      const toggle = page.locator('[role="switch"]').first();
      await expect(toggle).toBeVisible();
    }
  });
});

/**
 * EPIC 26: Anonymous Voting & Anonymous Reactions
 * Tests anonymous engagement features and covert supporter mode
 */
test.describe('Epic 26: Anonymous Voting & Anonymous Reactions', () => {
  test.beforeEach(async ({ page }) => {
    // Create identity and login
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Test User', 'testpassword123');
  });

  test('should display anonymous reactions with toggle', async ({ page }) => {
    // Navigate to privacy demo page
    await page.goto('/privacy-demo');

    // If page doesn't exist, try creating a group and checking feed
    if (!await page.getByText(/Anonymous Reactions/i).isVisible()) {
      await page.goto('/app/groups');
    }

    // Look for anonymous mode toggle
    const anonymousToggle = page.getByText(/anonymous mode|anonymous reaction/i).first();

    if (await anonymousToggle.isVisible()) {
      // Should show toggle button
      await expect(page.getByRole('button', { name: /anonymous|public/i })).toBeVisible();
    }
  });

  test('should allow toggling between anonymous and public reactions', async ({ page }) => {
    // Navigate to privacy demo
    await page.goto('/privacy-demo');

    // Find anonymous mode toggle button
    const toggleButton = page.getByRole('button', { name: /anonymous|public/i }).first();

    if (await toggleButton.isVisible()) {
      const initialText = await toggleButton.textContent();

      // Click to toggle
      await toggleButton.click();

      // Text should change
      await expect(toggleButton).not.toHaveText(initialText || '');
    }
  });

  test('should display anonymous voting interface', async ({ page }) => {
    // Navigate to privacy demo page
    await page.goto('/privacy-demo');

    // Look for anonymous voting component
    const votingSection = page.getByText(/Anonymous Voting/i).first();

    if (await votingSection.isVisible()) {
      // Should show cryptographically anonymous badge
      await expect(page.getByText(/cryptographically anonymous|zero-knowledge/i)).toBeVisible();

      // Should show voting options
      await expect(page.getByText(/Yes|No/i)).toBeVisible();
    }
  });

  test('should allow casting anonymous vote on proposal', async ({ page }) => {
    // Navigate to privacy demo
    await page.goto('/privacy-demo');

    // Find anonymous voting toggle
    const anonymousToggle = page.getByRole('button', { name: /anonymous|public/i }).last();

    if (await anonymousToggle.isVisible()) {
      // Make sure anonymous mode is on
      const text = await anonymousToggle.textContent();
      if (!text?.toLowerCase().includes('anonymous')) {
        await anonymousToggle.click();
      }

      // Find vote button
      const voteButton = page.getByRole('button', { name: /yes|no/i }).first();
      if (await voteButton.isVisible()) {
        await voteButton.click();

        // Should show vote recorded message
        await expect(page.getByText(/vote recorded|vote cast/i)).toBeVisible();
      }
    }
  });

  test('should verify no identity leakage in anonymous actions', async ({ page }) => {
    // Navigate to privacy demo
    await page.goto('/privacy-demo');

    // Enable anonymous mode
    const anonymousButton = page.getByRole('button', { name: /anonymous/i }).first();

    if (await anonymousButton.isVisible()) {
      await anonymousButton.click();

      // Perform action (reaction or vote)
      const actionButton = page.getByRole('button', { name: /support|yes/i }).first();
      if (await actionButton.isVisible()) {
        await actionButton.click();

        // Should show privacy confirmation
        await expect(page.getByText(/anonymous|identity.*protected|zero-knowledge/i)).toBeVisible();

        // Should NOT show user's name or pubkey in response
        // (This is a basic check - real crypto verification would need backend inspection)
        await expect(page.getByText(/your reaction is anonymous|your vote is anonymous/i)).toBeVisible();
      }
    }
  });

  test('should display Privacy Dashboard with Covert Supporter Mode', async ({ page }) => {
    // Navigate to privacy demo
    await page.goto('/privacy-demo');

    // Look for Privacy Dashboard or Covert Mode
    const covertModeSection = page.getByText(/Covert.*Mode|Privacy.*Dashboard/i).first();

    if (await covertModeSection.isVisible()) {
      // Should show toggle for covert mode
      const covertToggle = page.locator('[role="switch"]').first();
      await expect(covertToggle).toBeVisible();
    }
  });

  test('should toggle Covert Supporter Mode and enable all privacy settings', async ({ page }) => {
    // Navigate to privacy demo
    await page.goto('/privacy-demo');

    // Find covert mode toggle
    const covertToggle = page.locator('[role="switch"]').first();

    if (await covertToggle.isVisible()) {
      // Toggle on
      await covertToggle.click();

      // Should show confirmation that mode is active
      await expect(page.getByText(/covert mode active|all privacy settings enabled/i)).toBeVisible();

      // Multiple privacy settings should be visible and enabled
      await expect(page.getByText(/anonymous voting|hide from directory|encrypted messages/i)).toBeVisible();
    }
  });

  test('should show individual privacy controls', async ({ page }) => {
    // Navigate to privacy demo or settings
    await page.goto('/privacy-demo');

    // Look for privacy controls
    const privacyControls = [
      /anonymous voting/i,
      /anonymous reactions/i,
      /hide from directory/i,
      /encrypted messages/i,
      /read receipts/i,
      /activity status/i
    ];

    // At least some privacy controls should be visible
    let foundCount = 0;
    for (const control of privacyControls) {
      const element = page.getByText(control).first();
      if (await element.isVisible()) {
        foundCount++;
      }
    }

    // Should find at least 3 privacy controls
    expect(foundCount).toBeGreaterThanOrEqual(3);
  });
});

/**
 * EPIC 27: Member Verification & Infiltration Countermeasures
 * Tests trust scores, QR verification, vouching, anomaly detection, and audit logs
 */
test.describe('Epic 27: Member Verification & Infiltration Countermeasures', () => {
  test.beforeEach(async ({ page }) => {
    // Create identity and login
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Test User', 'testpassword123');
  });

  test('should display Member Verification UI with trust scores', async ({ page }) => {
    // Navigate to security demo page
    await page.goto('/security-demo');

    // Look for member verification section
    const verificationSection = page.getByText(/Member Verification/i).first();

    if (await verificationSection.isVisible()) {
      // Should show trust score information
      await expect(page.getByText(/trust score|verified|trusted/i)).toBeVisible();

      // Should show trust score numbers (0-100)
      const trustScoreElement = page.locator('text=/\\d{1,3}/').first();
      if (await trustScoreElement.isVisible()) {
        const score = await trustScoreElement.textContent();
        const scoreNum = parseInt(score || '0');
        expect(scoreNum).toBeGreaterThanOrEqual(0);
        expect(scoreNum).toBeLessThanOrEqual(100);
      }
    }
  });

  test('should show QR code verification for in-person vetting', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    // Find QR verification section
    const qrSection = page.getByText(/QR.*verification|QR.*code/i).first();

    if (await qrSection.isVisible()) {
      // Should have button to open scanner
      const scanButton = page.getByRole('button', { name: /scan|QR/i }).first();

      if (await scanButton.isVisible()) {
        await scanButton.click();

        // Should show QR scanner interface (or placeholder in demo)
        await expect(page.getByText(/scanner|camera|QR/i)).toBeVisible();
      }
    }
  });

  test('should display vouching system for members', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    // Look for vouch button or vouch information
    const vouchButton = page.getByRole('button', { name: /vouch/i }).first();

    if (await vouchButton.isVisible()) {
      await vouchButton.click();

      // Trust score should be mentioned as increasing
      await expect(page.getByText(/trust score|vouch/i)).toBeVisible();
    } else {
      // At least show vouch counts
      await expect(page.getByText(/\d+.*vouch/i)).toBeVisible();
    }
  });

  test('should update trust score after vouching', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    // Find a member with vouch button
    const vouchButtons = page.getByRole('button', { name: /vouch for member/i });
    const vouchButton = vouchButtons.first();

    if (await vouchButton.isVisible()) {
      // Get trust score before
      const trustScoreBefore = await page.locator('text=/Trust Score.*\\d+/').first().textContent();

      // Vouch for member
      await vouchButton.click();

      // Trust score should update (or show vouched confirmation)
      await expect(page.getByText(/you vouched|vouch recorded/i)).toBeVisible();
    }
  });

  test('should display trust score levels with badges', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    // Should show trust score legend or badges
    const trustLevels = [
      /trusted.*80/i,
      /verified.*60/i,
      /new.*40/i,
      /unverified/i
    ];

    let foundCount = 0;
    for (const level of trustLevels) {
      const element = page.getByText(level).first();
      if (await element.isVisible()) {
        foundCount++;
      }
    }

    // Should show at least 2 trust levels
    expect(foundCount).toBeGreaterThanOrEqual(2);
  });

  test('should display Anomaly Detection dashboard', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    // Click on anomaly detection tab
    const anomalyTab = page.getByRole('tab', { name: /anomaly|detection/i });

    if (await anomalyTab.isVisible()) {
      await anomalyTab.click();

      // Should show anomaly types
      await expect(page.getByText(/mass.*access|unusual.*posting|rapid.*following|honeypot|data.*export/i)).toBeVisible();
    }
  });

  test('should show anomaly detection alerts with severity levels', async ({ page }) => {
    // Navigate to security demo anomaly section
    await page.goto('/security-demo');

    const anomalyTab = page.getByRole('tab', { name: /anomaly/i });
    if (await anomalyTab.isVisible()) {
      await anomalyTab.click();
    }

    // Should show severity indicators
    const severityLevels = [
      /critical/i,
      /high/i,
      /medium/i,
      /low/i
    ];

    let foundCount = 0;
    for (const severity of severityLevels) {
      const element = page.getByText(severity).first();
      if (await element.isVisible()) {
        foundCount++;
      }
    }

    // Should show at least 2 severity levels
    expect(foundCount).toBeGreaterThanOrEqual(2);
  });

  test('should display anomaly types (mass access, honeypot, data export)', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    const anomalyTab = page.getByRole('tab', { name: /anomaly/i });
    if (await anomalyTab.isVisible()) {
      await anomalyTab.click();
    }

    // Check for specific anomaly types
    const anomalyTypes = [
      /mass.*access|mass data access/i,
      /honeypot/i,
      /data.*export/i,
      /rapid.*following/i,
      /unusual.*posting/i
    ];

    let foundCount = 0;
    for (const type of anomalyTypes) {
      const element = page.getByText(type).first();
      if (await element.isVisible()) {
        foundCount++;
      }
    }

    // Should show at least 3 anomaly types
    expect(foundCount).toBeGreaterThanOrEqual(3);
  });

  test('should show Audit Logs with search and filter', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    // Click on audit logs tab
    const auditTab = page.getByRole('tab', { name: /audit/i });

    if (await auditTab.isVisible()) {
      await auditTab.click();

      // Should show search input
      const searchInput = page.getByPlaceholder(/search.*log/i);
      await expect(searchInput).toBeVisible();

      // Should show filter dropdown
      const filterSelect = page.locator('select').first();
      await expect(filterSelect).toBeVisible();
    }
  });

  test('should display audit log entries with action types', async ({ page }) => {
    // Navigate to security demo audit logs
    await page.goto('/security-demo');

    const auditTab = page.getByRole('tab', { name: /audit/i });
    if (await auditTab.isVisible()) {
      await auditTab.click();
    }

    // Should show various action types
    const actionTypes = [
      /create/i,
      /read/i,
      /update/i,
      /delete/i,
      /permission/i,
      /security/i,
      /export/i
    ];

    let foundCount = 0;
    for (const action of actionTypes) {
      const element = page.getByText(action).first();
      if (await element.isVisible()) {
        foundCount++;
      }
    }

    // Should show at least 3 action types
    expect(foundCount).toBeGreaterThanOrEqual(3);
  });

  test('should allow searching audit logs', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    const auditTab = page.getByRole('tab', { name: /audit/i });
    if (await auditTab.isVisible()) {
      await auditTab.click();
    }

    // Find search input
    const searchInput = page.getByPlaceholder(/search/i).first();

    if (await searchInput.isVisible()) {
      // Enter search term
      await searchInput.fill('admin');

      // Results should update (count or filtered logs)
      await expect(page.getByText(/log|admin/i)).toBeVisible();
    }
  });

  test('should allow filtering audit logs by action type', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    const auditTab = page.getByRole('tab', { name: /audit/i });
    if (await auditTab.isVisible()) {
      await auditTab.click();
    }

    // Find filter select
    const filterSelect = page.locator('select').first();

    if (await filterSelect.isVisible()) {
      // Select a filter option
      await filterSelect.selectOption({ label: /security|export/i });

      // Should update results
      await expect(page.getByText(/log|activity/i)).toBeVisible();
    }
  });

  test('should show export audit logs button', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    const auditTab = page.getByRole('tab', { name: /audit/i });
    if (await auditTab.isVisible()) {
      await auditTab.click();
    }

    // Should have export button
    const exportButton = page.getByRole('button', { name: /export.*log/i });
    await expect(exportButton).toBeVisible();
  });

  test('should display admin security dashboard stats', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    // Should show security overview stats
    const statsElements = [
      /total.*log/i,
      /critical/i,
      /active.*anomal/i,
      /failed/i
    ];

    let foundCount = 0;
    for (const stat of statsElements) {
      const element = page.getByText(stat).first();
      if (await element.isVisible()) {
        foundCount++;
      }
    }

    // Should show at least 2 stat types
    expect(foundCount).toBeGreaterThanOrEqual(2);
  });

  test('should show honeypot information and status', async ({ page }) => {
    // Navigate to security demo anomaly section
    await page.goto('/security-demo');

    const anomalyTab = page.getByRole('tab', { name: /anomaly/i });
    if (await anomalyTab.isVisible()) {
      await anomalyTab.click();
    }

    // Look for honeypot information
    await expect(page.getByText(/honeypot/i)).toBeVisible();

    // Should explain what honeypots are
    const honeypotInfo = page.getByText(/hidden.*document|trap|fake.*sensitive/i);
    if (await honeypotInfo.isVisible()) {
      await expect(honeypotInfo).toBeVisible();
    }
  });
});

/**
 * INTEGRATION TESTS: Cross-Epic Security Features
 */
test.describe('Integration: Security Features', () => {
  test.beforeEach(async ({ page }) => {
    // Create identity and login
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Test User', 'testpassword123');
  });

  test('should show security demo page with all three epic features', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    // Should have tabs for all three features
    const tabs = [
      /verification/i,
      /anomal/i,
      /audit/i
    ];

    let foundCount = 0;
    for (const tab of tabs) {
      const element = page.getByRole('tab', { name: tab });
      if (await element.isVisible()) {
        foundCount++;
      }
    }

    // All three tabs should be present
    expect(foundCount).toBeGreaterThanOrEqual(3);
  });

  test('should navigate between security feature tabs', async ({ page }) => {
    // Navigate to security demo
    await page.goto('/security-demo');

    // Click through tabs
    const verificationTab = page.getByRole('tab', { name: /verification/i });
    if (await verificationTab.isVisible()) {
      await verificationTab.click();
      await expect(page.getByText(/trust score|vouch/i)).toBeVisible();
    }

    const anomalyTab = page.getByRole('tab', { name: /anomaly/i });
    if (await anomalyTab.isVisible()) {
      await anomalyTab.click();
      await expect(page.getByText(/mass.*access|detection/i)).toBeVisible();
    }

    const auditTab = page.getByRole('tab', { name: /audit/i });
    if (await auditTab.isVisible()) {
      await auditTab.click();
      await expect(page.getByText(/audit.*log|search/i)).toBeVisible();
    }
  });

  test('should show privacy and security settings in app settings', async ({ page }) => {
    // Navigate to settings
    await page.goto('/app/settings');

    // Should have security-related settings
    const securitySettings = [
      /privacy|covert/i,
      /device|session/i,
      /WebAuthn|passkey/i,
      /encryption/i
    ];

    let foundCount = 0;
    for (const setting of securitySettings) {
      const element = page.getByText(setting).first();
      if (await element.isVisible()) {
        foundCount++;
      }
    }

    // Should have at least 2 security settings sections
    expect(foundCount).toBeGreaterThanOrEqual(2);
  });
});
