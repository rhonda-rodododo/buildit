/**
 * E2E Tests for Fundraising Campaigns
 * Tests campaign creation, donation flow, tiers, donor management,
 * campaign updates, and goal tracking
 */

import { test, expect, type BrowserContext } from '@playwright/test';
import {
  createAndLoginIdentity,
  createGroup,
  navigateToCampaigns,
  createCampaign,
  addDonationTier,
  publishCampaign,
  navigateToPublicCampaign,
  makeDonation,
  postCampaignUpdate,
} from './helpers/forms-helpers';

const TEST_GROUP_NAME = 'Fundraising Test Group';

test.describe('Fundraising Campaigns', () => {
  let adminContext: BrowserContext;
  let donorContext: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    adminContext = await browser.newContext();
    donorContext = await browser.newContext();
  });

  test.afterEach(async () => {
    await adminContext.close();
    await donorContext.close();
  });

  test('should create fundraising campaign', async () => {
    const adminPage = await adminContext.newPage();

    // Setup: Create identity and group
    await createAndLoginIdentity(adminPage, 'Campaign Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);

    // Navigate to campaigns
    await navigateToCampaigns(adminPage);

    // Create campaign
    await createCampaign(adminPage, {
      title: 'Strike Support Fund',
      description: '**Support our striking workers!**\n\nHelp us provide strike pay and legal support.',
      goal: 50000,
    });

    // Verify campaign builder loaded
    await expect(adminPage.locator('[data-testid="campaign-builder"]')).toBeVisible();

    // Add donation tiers
    await addDonationTier(adminPage, {
      name: 'Solidarity Supporter',
      amount: 25,
      description: 'Helps provide a day of strike pay',
    });

    await addDonationTier(adminPage, {
      name: 'Picket Line Partner',
      amount: 100,
      description: 'Covers a week of healthcare',
    });

    await addDonationTier(adminPage, {
      name: 'Union Champion',
      amount: 500,
      description: 'Emergency support for 5 families',
      limited: true,
      maxCount: 50,
    });

    // Configure donor wall settings
    await adminPage.click('button:has-text("Settings")');
    await adminPage.check('input[name="showDonorWall"]');
    await adminPage.check('input[name="showDonorNames"]');
    await adminPage.check('input[name="allowAnonymousDonors"]');
    await adminPage.click('button:has-text("Save Settings")');

    // Publish campaign
    await publishCampaign(adminPage);

    // Navigate to public campaign page
    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');
    await navigateToPublicCampaign(adminPage, campaignSlug!);

    // Verify campaign renders correctly
    await expect(adminPage.locator('text=Strike Support Fund')).toBeVisible();
    await expect(adminPage.locator('text=Support our striking workers!')).toBeVisible();
    await expect(adminPage.locator('text=Goal: $500')).toBeVisible(); // $50,000 formatted
    await expect(adminPage.locator('text=Solidarity Supporter')).toBeVisible();
    await expect(adminPage.locator('text=Picket Line Partner')).toBeVisible();
    await expect(adminPage.locator('text=Union Champion')).toBeVisible();
  });

  test('should make a donation', async () => {
    const adminPage = await adminContext.newPage();
    const donorPage = await donorContext.newPage();

    // Admin: Create and publish campaign
    await createAndLoginIdentity(adminPage, 'Campaign Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'Mutual Aid Fund',
      description: 'Support community members in need',
      goal: 10000,
    });

    await addDonationTier(adminPage, {
      name: 'Basic Support',
      amount: 50,
    });

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Donor: Navigate to campaign
    await navigateToPublicCampaign(donorPage, campaignSlug!);

    // Make donation
    await makeDonation(donorPage, {
      tierId: 'basic-support',
      donorName: 'Jane Supporter',
      donorEmail: 'jane@example.com',
      message: 'Solidarity forever!',
    });

    // Verify thank you page
    await expect(donorPage.locator('[data-testid="donation-complete"]')).toBeVisible();
    await expect(donorPage.locator('text=Thank you')).toBeVisible();

    // Verify donor appears on donor wall
    await donorPage.goto(donorPage.url().replace('/thank-you', ''));
    await expect(donorPage.locator('text=Jane Supporter')).toBeVisible();
    await expect(donorPage.locator('text=Solidarity forever!')).toBeVisible();

    // Admin: Verify donation in admin panel
    await navigateToCampaigns(adminPage);
    await adminPage.click('[data-testid="campaign-mutual-aid-fund"]');
    await adminPage.click('text=Donations');

    // Verify donation appears
    await expect(adminPage.locator('text=Jane Supporter')).toBeVisible();
    await expect(adminPage.locator('text=$50')).toBeVisible();

    // Verify campaign progress updated
    await adminPage.click('text=Overview');
    await expect(adminPage.locator('text=$50 raised')).toBeVisible();
    await expect(adminPage.locator('[data-testid="progress-bar"]')).toHaveAttribute(
      'aria-valuenow',
      '0.5' // 50 / 10000 = 0.5%
    );
  });

  test('should create campaign from template', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'Template User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    // Create from template
    await adminPage.click('button:has-text("New Campaign")');
    await adminPage.click('button:has-text("Use Template")');

    // Select "Strike Fund" template
    await adminPage.click('[data-testid="template-strike-fund"]');

    // Verify template pre-fills correctly
    await expect(adminPage.locator('input[name="title"]')).toHaveValue(/Strike.*Fund/);
    await expect(adminPage.locator('textarea[name="description"]')).not.toBeEmpty();

    // Verify template includes pre-configured tiers
    await expect(adminPage.locator('text=Solidarity Supporter')).toBeVisible();
    await expect(adminPage.locator('text=Picket Line Partner')).toBeVisible();

    // Customize and publish
    await adminPage.fill('input[name="title"]', 'My Custom Strike Fund');
    await adminPage.fill('input[name="goal"]', '25000');

    await publishCampaign(adminPage);

    // Verify customized campaign
    await expect(adminPage.locator('text=My Custom Strike Fund')).toBeVisible();
  });

  test('should post campaign update', async () => {
    const adminPage = await adminContext.newPage();
    const donorPage = await donorContext.newPage();

    // Admin: Create campaign with donations
    await createAndLoginIdentity(adminPage, 'Campaign Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'Legal Defense Fund',
      description: 'Support activists facing charges',
      goal: 20000,
    });

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Navigate to campaign management
    await adminPage.click('text=Manage Campaign');

    // Post update
    await postCampaignUpdate(adminPage, {
      title: 'Major Victory!',
      content: 'All charges dropped! Thank you for your support.',
    });

    // Navigate to public campaign page
    await navigateToPublicCampaign(donorPage, campaignSlug!);

    // Verify update appears
    await expect(donorPage.locator('text=Updates')).toBeVisible();
    await donorPage.click('text=Updates');

    await expect(donorPage.locator('text=Major Victory!')).toBeVisible();
    await expect(donorPage.locator('text=All charges dropped!')).toBeVisible();
  });

  test('should reach fundraising goal', async () => {
    const adminPage = await adminContext.newPage();
    const donorPage = await donorContext.newPage();

    // Admin: Create campaign with $100 goal
    await createAndLoginIdentity(adminPage, 'Goal Test Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'Small Goal Campaign',
      description: 'Testing goal completion',
      goal: 100,
    });

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Donor: Make donation for $100
    await navigateToPublicCampaign(donorPage, campaignSlug!);

    await makeDonation(donorPage, {
      amount: 100,
      donorName: 'Goal Reacher',
      donorEmail: 'goal@example.com',
    });

    // Navigate back to campaign
    await navigateToPublicCampaign(donorPage, campaignSlug!);

    // Verify progress bar at 100%
    await expect(donorPage.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '100');

    // Verify goal reached message
    await expect(donorPage.locator('text=Goal Reached!')).toBeVisible();

    // Test "continue after goal" setting
    await expect(donorPage.locator('button:has-text("Donate")')).toBeVisible(); // Should still allow donations
  });

  test('should handle limited donation tiers', async () => {
    const adminPage = await adminContext.newPage();
    const donor1Page = await donorContext.newPage();

    // Admin: Create campaign with limited tier (max 2)
    await createAndLoginIdentity(adminPage, 'Limited Tier Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'Limited Tier Campaign',
      description: 'Testing limited tiers',
      goal: 10000,
    });

    await addDonationTier(adminPage, {
      name: 'Exclusive Tier',
      amount: 500,
      limited: true,
      maxCount: 2,
    });

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Donor 1: Make first donation
    await navigateToPublicCampaign(donor1Page, campaignSlug!);
    await makeDonation(donor1Page, {
      tierId: 'exclusive-tier',
      donorName: 'Donor 1',
      donorEmail: 'donor1@example.com',
    });

    // Create second donor context
    const donor2Context = await adminPage.context().browser()!.newContext();
    const donor2Page = await donor2Context.newPage();

    // Donor 2: Make second donation
    await navigateToPublicCampaign(donor2Page, campaignSlug!);
    await makeDonation(donor2Page, {
      tierId: 'exclusive-tier',
      donorName: 'Donor 2',
      donorEmail: 'donor2@example.com',
    });

    // Create third donor context
    const donor3Context = await adminPage.context().browser()!.newContext();
    const donor3Page = await donor3Context.newPage();

    // Donor 3: Try to select sold-out tier
    await navigateToPublicCampaign(donor3Page, campaignSlug!);

    // Verify tier shows "Sold Out"
    await expect(donor3Page.locator('[data-testid="tier-exclusive-tier"] text=Sold Out')).toBeVisible();

    // Try to select sold-out tier
    await donor3Page.click('[data-testid="tier-exclusive-tier"]');

    // Verify unable to proceed
    await expect(donor3Page.locator('button:has-text("Donate")')).toBeDisabled();
    await expect(donor3Page.locator('text=This tier is no longer available')).toBeVisible();

    await donor2Context.close();
    await donor3Context.close();
  });

  test('should make anonymous donation', async () => {
    const adminPage = await adminContext.newPage();
    const donorPage = await donorContext.newPage();

    // Admin: Create campaign
    await createAndLoginIdentity(adminPage, 'Anonymous Test Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'Anonymous Donation Test',
      description: 'Testing anonymous donations',
      goal: 5000,
    });

    // Enable anonymous donors
    await adminPage.click('button:has-text("Settings")');
    await adminPage.check('input[name="allowAnonymousDonors"]');
    await adminPage.click('button:has-text("Save Settings")');

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Donor: Make anonymous donation
    await navigateToPublicCampaign(donorPage, campaignSlug!);

    await makeDonation(donorPage, {
      amount: 100,
      anonymous: true,
    });

    // Navigate back to campaign
    await navigateToPublicCampaign(donorPage, campaignSlug!);

    // Verify donor wall shows "Anonymous"
    await expect(donorPage.locator('text=Anonymous')).toBeVisible();

    // Verify donor name/email NOT shown
    await expect(donorPage.locator('[data-testid="donor-email"]')).not.toBeVisible();
  });

  test('should handle recurring donations', async () => {
    const adminPage = await adminContext.newPage();
    const donorPage = await donorContext.newPage();

    // Admin: Create campaign with recurring enabled
    await createAndLoginIdentity(adminPage, 'Recurring Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'Recurring Donation Test',
      description: 'Testing recurring donations',
      goal: 10000,
    });

    // Enable recurring donations
    await adminPage.click('button:has-text("Settings")');
    await adminPage.check('input[name="allowRecurring"]');
    await adminPage.check('input[name="recurringMonthly"]');
    await adminPage.check('input[name="recurringQuarterly"]');
    await adminPage.click('button:has-text("Save Settings")');

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Donor: Make recurring donation
    await navigateToPublicCampaign(donorPage, campaignSlug!);

    await donorPage.click('button:has-text("Custom Amount")');
    await donorPage.fill('input[name="customAmount"]', '50');

    // Select recurring
    await donorPage.check('input[name="recurring"]');
    await donorPage.selectOption('select[name="recurringInterval"]', 'monthly');

    await donorPage.fill('input[name="donorName"]', 'Recurring Donor');
    await donorPage.fill('input[name="donorEmail"]', 'recurring@example.com');

    await donorPage.click('button:has-text("Donate")');

    // Verify confirmation mentions recurring
    await expect(donorPage.locator('text=monthly donation')).toBeVisible();

    // Admin: Verify recurring donation in admin panel
    await navigateToCampaigns(adminPage);
    await adminPage.click('[data-testid^="campaign-"]');
    await adminPage.click('text=Donations');

    await expect(adminPage.locator('text=Recurring Donor')).toBeVisible();
    await expect(adminPage.locator('[data-testid="donation-recurring-badge"]')).toBeVisible();
  });

  test('should configure campaign end date and auto-close', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'End Date Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'Time-Limited Campaign',
      description: 'Ends in 30 days',
      goal: 5000,
    });

    // Set end date
    await adminPage.click('button:has-text("Settings")');

    // Set end date to 30 days from now
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    const dateString = endDate.toISOString().split('T')[0];

    await adminPage.fill('input[name="endsAt"]', dateString);
    await adminPage.click('button:has-text("Save Settings")');

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Navigate to public page
    await navigateToPublicCampaign(adminPage, campaignSlug!);

    // Verify countdown/end date shown
    await expect(adminPage.locator('text=30 days remaining')).toBeVisible();
  });

  test('should show campaign progress with multiple donations', async () => {
    const adminPage = await adminContext.newPage();

    // Admin: Create campaign
    await createAndLoginIdentity(adminPage, 'Progress Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'Progress Test Campaign',
      description: 'Testing progress bar',
      goal: 1000,
    });

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Make multiple donations
    for (let i = 1; i <= 5; i++) {
      const donorContext = await adminPage.context().browser()!.newContext();
      const donorPage = await donorContext.newPage();

      await navigateToPublicCampaign(donorPage, campaignSlug!);

      await makeDonation(donorPage, {
        amount: 100,
        donorName: `Donor ${i}`,
        donorEmail: `donor${i}@example.com`,
      });

      await donorContext.close();
    }

    // Navigate to campaign page
    await navigateToPublicCampaign(adminPage, campaignSlug!);

    // Verify progress: 5 * $100 = $500 out of $1000 = 50%
    await expect(adminPage.locator('text=$500 raised')).toBeVisible();
    await expect(adminPage.locator('text=50%')).toBeVisible();
    await expect(adminPage.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '50');

    // Verify donor count
    await expect(adminPage.locator('text=5 donors')).toBeVisible();
  });
});
