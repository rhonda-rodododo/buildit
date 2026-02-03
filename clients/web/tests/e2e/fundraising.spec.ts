/**
 * E2E Tests for Fundraising Module (Epic 38)
 *
 * Tests:
 * 1. Create fundraising campaign
 * 2. Edit campaign details
 * 3. Add and manage donation tiers
 * 4. Configure campaign settings (donor wall, payment processors)
 * 5. Publish campaign
 * 6. Preview campaign (public view)
 * 7. Make donation (placeholder - payment integration)
 * 8. View and manage donors
 * 9. Export donor CSV
 * 10. View campaign analytics
 * 11. Create campaign from template
 * 12. Delete campaign
 */

import { test, expect } from '@playwright/test';
import { nanoid } from 'nanoid';
import { waitForAppReady } from './helpers/helpers';

// Test configuration
const TEST_GROUP_ID = 'test-group-' + nanoid(8);
const TEST_CAMPAIGN_SLUG = 'test-campaign-' + nanoid(8);

test.describe('Fundraising Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for app to load
    await waitForAppReady(page);
  });

  test('should create a new fundraising campaign', async ({ page }) => {
    // Navigate to fundraising
    await page.click('[data-testid="fundraising-link"]');

    // Click "New Campaign" button
    await page.click('[data-testid="new-campaign-button"]');

    // Should see the campaign builder
    await expect(page.locator('[data-testid="campaign-builder"]')).toBeVisible();

    // Fill in campaign details
    await page.fill('[data-testid="campaign-title-input"]', 'Worker Strike Fund');
    await page.fill('[data-testid="campaign-slug-input"]', TEST_CAMPAIGN_SLUG);
    await page.fill('[data-testid="campaign-description-textarea"]', 'Support our striking workers');
    await page.selectOption('[data-testid="campaign-category-select"]', 'strike');

    // Set fundraising goal
    await page.fill('[data-testid="campaign-goal-input"]', '50000');
    await page.selectOption('[data-testid="campaign-currency-select"]', 'USD');

    // Save campaign
    await page.click('[data-testid="save-campaign-button"]');

    // Verify campaign was created
    await expect(page.locator('text=Worker Strike Fund')).toBeVisible();
  });

  test('should add donation tiers to campaign', async ({ page }) => {
    // Navigate to fundraising
    await page.click('[data-testid="fundraising-link"]');

    // Edit existing campaign
    await page.click('[data-testid="edit-campaign-button"]');

    // Click on tiers tab
    await page.click('[data-testid="campaign-tiers-tab"]');

    // Add tier 1
    await page.click('[data-testid="add-tier-button"]');
    await page.fill('[data-testid="tier-name-input-0"]', 'Solidarity Supporter');
    await page.fill('[data-testid="tier-amount-input-0"]', '25');
    await page.fill('[data-testid="tier-description-input-0"]', 'Helps provide strike pay');

    // Add tier 2
    await page.click('[data-testid="add-tier-button"]');
    await page.fill('[data-testid="tier-name-input-1"]', 'Union Champion');
    await page.fill('[data-testid="tier-amount-input-1"]', '100');
    await page.check('[data-testid="tier-limited-checkbox-1"]');
    await page.fill('[data-testid="tier-maxcount-input-1"]', '50');

    // Save campaign
    await page.click('[data-testid="save-campaign-button"]');

    // Verify tiers were added
    await expect(page.locator('text=Solidarity Supporter')).toBeVisible();
    await expect(page.locator('text=Union Champion')).toBeVisible();
  });

  test('should configure campaign settings', async ({ page }) => {
    // Navigate to fundraising and edit campaign
    await page.click('[data-testid="fundraising-link"]');
    await page.click('[data-testid="edit-campaign-button"]');

    // Go to settings tab
    await page.click('[data-testid="campaign-settings-tab"]');

    // Configure donor wall
    await page.check('[data-testid="show-donor-wall-toggle"]');
    await page.check('[data-testid="show-donor-names-toggle"]');
    await page.uncheck('[data-testid="show-donor-amounts-toggle"]');

    // Configure thank you email
    await page.check('[data-testid="send-thank-you-email-toggle"]');
    await page.fill('[data-testid="thank-you-subject-input"]', 'Thank You for Supporting Our Strike!');
    await page.fill('[data-testid="thank-you-body-textarea"]', 'Your solidarity means everything.');

    // Configure payment processors
    await page.check('[data-testid="enable-stripe-toggle"]');
    await page.check('[data-testid="enable-paypal-toggle"]');
    await page.check('[data-testid="enable-crypto-toggle"]');

    // Save settings
    await page.click('[data-testid="save-campaign-button"]');
  });

  test('should publish campaign', async ({ page }) => {
    // Navigate to fundraising
    await page.click('[data-testid="fundraising-link"]');

    // Open campaign menu
    await page.click('[data-testid="campaign-menu-button"]');

    // Click Publish
    await page.click('text=Publish');

    // Verify campaign is published
    await expect(page.locator('text=active')).toBeVisible();

    // Verify public URL is shown
    await expect(page.locator('[data-testid="public-campaign-url"]')).toBeVisible();
  });

  test('should preview campaign (public view)', async ({ page }) => {
    // Navigate to fundraising
    await page.click('[data-testid="fundraising-link"]');

    // Click preview button
    await page.click('[data-testid="preview-campaign-button"]');

    // Should see the public campaign view
    await expect(page.locator('[data-testid="public-campaign-view"]')).toBeVisible();

    // Verify campaign details are shown
    await expect(page.locator('text=Worker Strike Fund')).toBeVisible();
    await expect(page.locator('[data-testid="campaign-progress-bar"]')).toBeVisible();

    // Verify donation tiers are shown
    await expect(page.locator('text=Solidarity Supporter')).toBeVisible();
    await expect(page.locator('text=$25')).toBeVisible();

    // Go back to campaign list
    await page.click('[data-testid="back-to-campaigns-button"]');
    await expect(page.locator('[data-testid="campaign-list"]')).toBeVisible();
  });

  test('should handle donation flow (placeholder)', async ({ page }) => {
    // Navigate to public campaign page
    await page.goto(`/campaigns/${TEST_CAMPAIGN_SLUG}`);

    // Click on a donation tier
    await page.click('[data-testid="tier-card-0"]');

    // Should see donation modal/form (placeholder)
    await expect(page.locator('[data-testid="donation-form"]')).toBeVisible();

    // Fill in donor info
    await page.fill('[data-testid="donor-name-input"]', 'John Doe');
    await page.fill('[data-testid="donor-email-input"]', 'john@example.com');
    await page.fill('[data-testid="donation-message-textarea"]', 'Solidarity forever!');

    // Select payment method (placeholder)
    await page.click('[data-testid="payment-method-stripe"]');

    // Submit donation (placeholder - no actual payment)
    await page.click('[data-testid="submit-donation-button"]');

    // Verify success message
    await expect(page.locator('text=Thank you for your donation')).toBeVisible();
  });

  test('should view and manage donors', async ({ page }) => {
    // Navigate to fundraising
    await page.click('[data-testid="fundraising-link"]');

    // Click on donors button
    await page.click('[data-testid="view-donors-button"]');

    // Should see donors list
    await expect(page.locator('[data-testid="donors-list"]')).toBeVisible();

    // Verify donor stats are shown
    await expect(page.locator('[data-testid="total-raised-stat"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-donations-stat"]')).toBeVisible();

    // Search for donor
    await page.fill('[data-testid="donor-search-input"]', 'John');
    await expect(page.locator('text=John Doe')).toBeVisible();

    // Filter by status
    await page.click('[data-testid="filter-completed-button"]');
    await expect(page.locator('[data-testid="donation-row"]')).toBeVisible();
  });

  test('should export donor CSV', async ({ page }) => {
    // Navigate to donors list
    await page.click('[data-testid="fundraising-link"]');
    await page.click('[data-testid="view-donors-button"]');

    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;

    // Verify file name
    expect(download.suggestedFilename()).toContain('.csv');
    expect(download.suggestedFilename()).toContain('donors');
  });

  test('should view campaign analytics', async ({ page }) => {
    // Navigate to fundraising
    await page.click('[data-testid="fundraising-link"]');

    // View campaign analytics
    await page.click('[data-testid="campaign-analytics-button"]');

    // Verify analytics dashboard
    await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();

    // Should show key metrics
    await expect(page.locator('text=Total Donations')).toBeVisible();
    await expect(page.locator('text=Total Raised')).toBeVisible();
    await expect(page.locator('text=Conversion Rate')).toBeVisible();
    await expect(page.locator('text=Campaign Views')).toBeVisible();

    // Verify privacy-first approach
    await expect(page.locator('text=Privacy-First Analytics')).toBeVisible();
  });

  test('should create campaign from template', async ({ page }) => {
    // Navigate to fundraising
    await page.click('[data-testid="fundraising-link"]');

    // Click "View Templates" button
    await page.click('[data-testid="view-templates-button"]');

    // Select a template (e.g., Strike Fund)
    await page.click('[data-testid="template-strike-fund"]');

    // Verify template content is loaded
    await expect(page.locator('text=Worker Strike Support Fund')).toBeVisible();

    // Verify tiers from template
    await expect(page.locator('text=Solidarity Supporter')).toBeVisible();
    await expect(page.locator('text=Picket Line Partner')).toBeVisible();

    // Campaign should be in draft status
    await expect(page.locator('text=draft')).toBeVisible();
  });

  test('should delete a campaign', async ({ page }) => {
    // Navigate to fundraising
    await page.click('[data-testid="fundraising-link"]');

    // Open campaign menu
    await page.click('[data-testid="campaign-menu-button"]');

    // Click Delete
    await page.click('text=Delete');

    // Confirm deletion in dialog
    await page.click('[data-testid="confirm-delete-button"]');

    // Verify campaign is gone
    await expect(page.locator('text=Worker Strike Fund')).not.toBeVisible();
  });

  test('should validate campaign form', async ({ page }) => {
    // Navigate to fundraising
    await page.click('[data-testid="fundraising-link"]');
    await page.click('[data-testid="new-campaign-button"]');

    // Try to save without filling required fields
    await page.click('[data-testid="save-campaign-button"]');

    // Save button should be disabled or show validation errors
    const saveButton = page.locator('[data-testid="save-campaign-button"]');
    await expect(saveButton).toBeDisabled();

    // Fill in required fields
    await page.fill('[data-testid="campaign-title-input"]', 'Test Campaign');
    await page.fill('[data-testid="campaign-slug-input"]', 'test-campaign');
    await page.fill('[data-testid="campaign-goal-input"]', '1000');

    // Save button should now be enabled
    await expect(saveButton).toBeEnabled();
  });
});

test.describe('Fundraising Module - Privacy Features', () => {
  test('should support anonymous donations for bail funds', async ({ page }) => {
    // Navigate to fundraising
    await page.goto('/');
    await waitForAppReady(page);
    await page.click('[data-testid="fundraising-link"]');

    // Create bail fund campaign from template
    await page.click('[data-testid="view-templates-button"]');
    await page.click('[data-testid="template-bail-fund"]');

    // Verify privacy settings from template
    await page.click('[data-testid="edit-campaign-button"]');
    await page.click('[data-testid="campaign-settings-tab"]');

    // Donor wall should be disabled for privacy
    await expect(page.locator('[data-testid="show-donor-wall-toggle"]')).not.toBeChecked();

    // Only crypto payment should be enabled
    await expect(page.locator('[data-testid="enable-crypto-toggle"]')).toBeChecked();
    await expect(page.locator('[data-testid="enable-stripe-toggle"]')).not.toBeChecked();
  });
});

test.describe('Fundraising Module - Recurring Donations', () => {
  test('should allow setting up recurring donations', async ({ page }) => {
    // Navigate to fundraising
    await page.goto('/');
    await waitForAppReady(page);
    await page.click('[data-testid="fundraising-link"]');

    // Edit campaign
    await page.click('[data-testid="edit-campaign-button"]');

    // Enable recurring donations
    await page.check('[data-testid="allow-recurring-toggle"]');

    // Save campaign
    await page.click('[data-testid="save-campaign-button"]');

    // Preview campaign and verify recurring option
    await page.click('[data-testid="preview-campaign-button"]');
    await expect(page.locator('text=Monthly')).toBeVisible();
    await expect(page.locator('text=Quarterly')).toBeVisible();
  });
});
