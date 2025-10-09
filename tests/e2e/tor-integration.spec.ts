/**
 * E2E Tests for Tor Integration
 * Tests Tor detection, configuration, and .onion relay usage
 */

import { test, expect } from '@playwright/test';

test.describe('Tor Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to BuildIt and create/login with test identity
    await page.goto('/');

    // Check if we need to create an identity
    const hasCreateButton = await page.locator('button:has-text("Create Identity")').count();
    if (hasCreateButton > 0) {
      await page.click('button:has-text("Create Identity")');
      await page.fill('[data-testid="name-input"]', 'Tor Test User');
      await page.click('button:has-text("Continue")');
    }
  });

  test('should display Tor tab in security settings', async ({ page }) => {
    // Navigate to security settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');

    // Check for Tor tab
    const torTab = page.locator('button[value="tor"]:has-text("Tor")');
    await expect(torTab).toBeVisible();

    // Click Tor tab
    await torTab.click();

    // Verify Tor settings are displayed
    await expect(page.locator('text=Tor Integration')).toBeVisible();
    await expect(page.locator('text=Enable Tor Routing')).toBeVisible();
  });

  test('should show Tor status indicator', async ({ page }) => {
    // Navigate to security settings → Tor tab
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Check for status indicator
    const statusIndicator = page.locator('[data-testid="tor-status"]');
    await expect(statusIndicator).toBeVisible();

    // Should show "Tor Disabled" initially
    await expect(page.locator('text=Tor Disabled').or(page.locator('text=Tor Active'))).toBeVisible();
  });

  test('should allow toggling Tor routing', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Find the enable/disable toggle
    const torToggle = page.locator('#tor-enabled');

    // Get initial state
    const initialState = await torToggle.isChecked();

    // Toggle Tor
    await torToggle.click();

    // Verify state changed
    const newState = await torToggle.isChecked();
    expect(newState).toBe(!initialState);

    // If we enabled Tor, verify status changed
    if (newState) {
      // Wait for status to update
      await page.waitForTimeout(1000);

      // Should show enabled status
      await expect(
        page.locator('text=Tor Enabled').or(page.locator('text=Tor Active'))
      ).toBeVisible();
    }
  });

  test('should display connection method options', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Find connection method selector
    const methodSelector = page.locator('#connection-method');
    await expect(methodSelector).toBeVisible();

    // Click to open dropdown
    await methodSelector.click();

    // Verify options
    await expect(page.locator('text=Auto-detect (Recommended)')).toBeVisible();
    await expect(page.locator('text=Tor Browser')).toBeVisible();
    await expect(page.locator('text=Manual SOCKS5 Proxy')).toBeVisible();
  });

  test('should show manual proxy configuration when selected', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Enable Tor first
    const torToggle = page.locator('#tor-enabled');
    if (!(await torToggle.isChecked())) {
      await torToggle.click();
    }

    // Select manual proxy method
    await page.click('#connection-method');
    await page.click('text=Manual SOCKS5 Proxy');

    // Verify proxy configuration inputs appear
    await expect(page.locator('#proxy-host')).toBeVisible();
    await expect(page.locator('#proxy-port')).toBeVisible();

    // Check default values
    const hostInput = page.locator('#proxy-host');
    await expect(hostInput).toHaveValue('127.0.0.1');

    const portInput = page.locator('#proxy-port');
    await expect(portInput).toHaveValue('9050');
  });

  test('should allow updating proxy host and port', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Enable Tor
    const torToggle = page.locator('#tor-enabled');
    if (!(await torToggle.isChecked())) {
      await torToggle.click();
    }

    // Select manual proxy
    await page.click('#connection-method');
    await page.click('text=Manual SOCKS5 Proxy');

    // Update host
    const hostInput = page.locator('#proxy-host');
    await hostInput.clear();
    await hostInput.fill('localhost');

    // Update port (Tor Browser port)
    const portInput = page.locator('#proxy-port');
    await portInput.clear();
    await portInput.fill('9150');

    // Verify changes
    await expect(hostInput).toHaveValue('localhost');
    await expect(portInput).toHaveValue('9150');
  });

  test('should display onion relay list', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Scroll to relay list
    await page.locator('text=Onion Relays').scrollIntoViewIfNeeded();

    // Verify relay list table is visible
    await expect(page.locator('table')).toBeVisible();

    // Should show at least one relay (from KNOWN_ONION_RELAYS)
    const relayRows = page.locator('table tbody tr');
    const count = await relayRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should allow adding custom onion relay', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Find "Add Custom Relay" section
    await page.locator('text=Add Custom Relay').scrollIntoViewIfNeeded();

    // Get initial relay count
    const initialCount = await page.locator('table tbody tr').count();

    // Fill in custom relay
    const relayUrlInput = page.locator('input[placeholder=".onion address"]');
    await relayUrlInput.fill('customrelayexample.onion');

    const relayNameInput = page.locator('input[placeholder="Name (optional)"]');
    await relayNameInput.fill('Custom Test Relay');

    // Click Add button
    await page.click('button:has-text("Add")');

    // Wait for relay to be added
    await page.waitForTimeout(500);

    // Verify relay count increased
    const newCount = await page.locator('table tbody tr').count();
    expect(newCount).toBe(initialCount + 1);

    // Verify custom relay appears in table
    await expect(page.locator('text=Custom Test Relay')).toBeVisible();
  });

  test('should allow removing custom relay', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Add a custom relay first
    await page.locator('text=Add Custom Relay').scrollIntoViewIfNeeded();
    await page.fill('input[placeholder=".onion address"]', 'removeme.onion');
    await page.fill('input[placeholder="Name (optional)"]', 'Remove Me Relay');
    await page.click('button:has-text("Add")');
    await page.waitForTimeout(500);

    // Find the relay row
    const relayRow = page.locator('tr:has-text("Remove Me Relay")');
    await expect(relayRow).toBeVisible();

    // Click delete button
    const deleteButton = relayRow.locator('button:has(svg)');
    await deleteButton.click();

    // Wait for deletion
    await page.waitForTimeout(500);

    // Verify relay is removed
    await expect(relayRow).not.toBeVisible();
  });

  test('should allow running relay health check', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Find health check button
    const healthCheckButton = page.locator('button:has-text("Health Check")');
    await expect(healthCheckButton).toBeVisible();

    // Click health check
    await healthCheckButton.click();

    // Button should show loading state
    await expect(page.locator('button:has-text("Health Check") svg.animate-spin')).toBeVisible();

    // Wait for health check to complete
    await page.waitForTimeout(2000);

    // Relay statuses should be updated (healthy/down badges)
    const statusBadges = page.locator('table tbody tr td:has-text("Healthy"), table tbody tr td:has-text("Down"), table tbody tr td:has-text("Unknown")');
    expect(await statusBadges.count()).toBeGreaterThan(0);
  });

  test('should display enhanced security options', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Scroll to Enhanced Security section
    await page.locator('text=Enhanced Security').scrollIntoViewIfNeeded();

    // Verify security options
    await expect(page.locator('text=Block WebRTC')).toBeVisible();
    await expect(page.locator('text=Block Geolocation')).toBeVisible();
    await expect(page.locator('text=Fingerprinting Protection')).toBeVisible();

    // All should have toggle switches
    await expect(page.locator('#block-webrtc')).toBeVisible();
    await expect(page.locator('#block-geolocation')).toBeVisible();
    await expect(page.locator('#fingerprint-protection')).toBeVisible();
  });

  test('should allow toggling onion only mode', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Enable Tor first
    const torToggle = page.locator('#tor-enabled');
    if (!(await torToggle.isChecked())) {
      await torToggle.click();
    }

    // Find onion only toggle
    const onionOnlyToggle = page.locator('#onion-only');
    await expect(onionOnlyToggle).toBeVisible();

    // Toggle it
    const initialState = await onionOnlyToggle.isChecked();
    await onionOnlyToggle.click();

    // Verify state changed
    const newState = await onionOnlyToggle.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should show Tor setup information', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Scroll to bottom to find info alert
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Verify setup info is displayed
    await expect(page.locator('text=How to use Tor with BuildIt Network')).toBeVisible();
    await expect(page.locator('text=Recommended: Use Tor Browser')).toBeVisible();
  });

  test('should persist Tor configuration after reload', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Enable Tor
    const torToggle = page.locator('#tor-enabled');
    if (!(await torToggle.isChecked())) {
      await torToggle.click();
      await page.waitForTimeout(1000);
    }

    // Set to manual proxy
    await page.click('#connection-method');
    await page.click('text=Manual SOCKS5 Proxy');

    // Update port
    await page.locator('#proxy-port').clear();
    await page.locator('#proxy-port').fill('9150');

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate back to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Verify settings persisted
    await expect(page.locator('#tor-enabled')).toBeChecked();

    // Verify port persisted
    await expect(page.locator('#proxy-port')).toHaveValue('9150');
  });

  test('should show warning badges for security issues', async ({ page }) => {
    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Look for security warnings section (if any warnings present)
    const warningsSection = page.locator('text=Security Warnings');

    // If warnings exist, verify they're displayed
    const warningsCount = await warningsSection.count();
    if (warningsCount > 0) {
      await expect(warningsSection).toBeVisible();
      await expect(page.locator('ul li', { has: warningsSection })).toHaveCount({ min: 1 });
    }
  });
});

test.describe('Tor Detection', () => {
  test('should auto-detect Tor Browser environment', async ({ page, context }) => {
    // Note: This test would require actually running in Tor Browser
    // For now, we test that the detection code runs without errors

    await page.goto('/');

    // Create identity if needed
    const hasCreateButton = await page.locator('button:has-text("Create Identity")').count();
    if (hasCreateButton > 0) {
      await page.click('button:has-text("Create Identity")');
      await page.fill('[data-testid="name-input"]', 'Tor Detection Test');
      await page.click('button:has-text("Continue")');
    }

    // Navigate to Tor settings
    await page.click('[data-testid="settings-link"]');
    await page.click('text=Security');
    await page.click('button[value="tor"]');

    // Verify detection ran (status should not be "detecting" after a few seconds)
    await page.waitForTimeout(2000);

    const detectingStatus = await page.locator('text=Detecting').count();
    expect(detectingStatus).toBe(0); // Should have finished detecting
  });
});
