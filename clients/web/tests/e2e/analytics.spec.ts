/**
 * Analytics & Reporting E2E Tests
 * Epic 22: CRM Analytics and Campaign Analytics Dashboard
 */

import { test, expect } from '@playwright/test';
import { waitForAppReady, createIdentity } from './helpers/helpers';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Test User', 'testpassword123');
  });

  test('should navigate to analytics dashboard', async ({ page }) => {
    // Navigate to analytics page
    await page.goto('/app/analytics', { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded (with longer timeout)
    await expect(page.getByRole('heading', { name: /analytics dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/track organizing metrics/i)).toBeVisible();

    // Verify tabs are present
    await expect(page.getByRole('tab', { name: /crm analytics/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /campaign analytics/i })).toBeVisible();
  });
});

test.describe('CRM Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'CRM Analyst', 'testpassword123');

    // Navigate to analytics page and select CRM tab
    await page.goto('/app/analytics', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');

    // Wait for tabs to be visible
    const crmTab = page.getByRole('tab', { name: /crm analytics/i });
    await expect(crmTab).toBeVisible({ timeout: 10000 });
    await crmTab.click();
  });

  test('should display CRM metrics summary cards', async ({ page }) => {
    // Verify key metric cards are visible
    await expect(page.getByText(/total contacts/i)).toBeVisible();
    await expect(page.getByText(/contact rate/i)).toBeVisible();
    await expect(page.getByText(/pipeline conversions/i)).toBeVisible();
    await expect(page.getByText(/avg days to convert/i)).toBeVisible();

    // Verify metric values are displayed (demo data)
    // Total Contacts: 300 (from DEMO_DATA: 45+120+90+45 = 300)
    await expect(page.getByText('300')).toBeVisible();

    // Contact Rate: 47
    await expect(page.getByText('47')).toBeVisible();

    // Verify trend indicators
    await expect(page.getByText(/\+23\.7%/)).toBeVisible();
  });

  test('should display support level distribution chart with percentages', async ({ page }) => {
    // Verify section heading
    await expect(page.getByText(/support level distribution/i)).toBeVisible();

    // Verify all support levels are shown
    await expect(page.getByText('Neutral')).toBeVisible();
    await expect(page.getByText('Passive Support')).toBeVisible();
    await expect(page.getByText('Active Support')).toBeVisible();
    await expect(page.getByText('Core Organizer')).toBeVisible();

    // Verify percentages are displayed
    await expect(page.getByText(/15%/).first()).toBeVisible(); // Neutral: 15%
    await expect(page.getByText(/40%/)).toBeVisible(); // Passive: 40%
    await expect(page.getByText(/30%/)).toBeVisible(); // Active: 30%

    // Verify progress bars are rendered (check for bg-gray-500, bg-blue-500, etc. classes)
    const progressBars = page.locator('.bg-muted.rounded-full');
    await expect(progressBars).toHaveCount(4); // 4 support levels
  });

  test('should display pipeline movement tracking metrics', async ({ page }) => {
    // Verify pipeline movement section
    await expect(page.getByText(/pipeline movement/i)).toBeVisible();

    // Verify movement counts for each stage transition
    await expect(page.getByText(/neutral → passive/i)).toBeVisible();
    await expect(page.getByText(/passive → active/i)).toBeVisible();
    await expect(page.getByText(/active → core/i)).toBeVisible();

    // Verify numeric values (from DEMO_DATA)
    const neutralToPassive = page.locator('text=Neutral → Passive').locator('..');
    await expect(neutralToPassive).toContainText('12');

    const passiveToActive = page.locator('text=Passive → Active').locator('..');
    await expect(passiveToActive).toContainText('8');

    const activeToCore = page.locator('text=Active → Core').locator('..');
    await expect(activeToCore).toContainText('3');
  });

  test('should display organizer performance metrics table', async ({ page }) => {
    // Verify section heading
    await expect(page.getByText(/organizer performance/i)).toBeVisible();

    // Verify table headers
    await expect(page.getByRole('columnheader', { name: /organizer/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /contacts/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /conversions/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /rate/i })).toBeVisible();

    // Verify organizer names are displayed (from DEMO_DATA)
    await expect(page.getByText('Sarah Chen')).toBeVisible();
    await expect(page.getByText('Marcus Johnson')).toBeVisible();
    await expect(page.getByText('Emma Rodriguez')).toBeVisible();
    await expect(page.getByText('Jordan Kim')).toBeVisible();

    // Verify conversion rates are displayed
    await expect(page.getByText(/26\.7%/)).toBeVisible(); // Sarah Chen
    await expect(page.getByText(/28\.8%/)).toBeVisible(); // Emma Rodriguez
  });

  test('should export CRM analytics to CSV', async ({ page }) => {
    // Start waiting for download before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });

    // Click export button
    const exportButton = page.getByRole('button', { name: /export csv/i });
    await exportButton.click();

    // Wait for download to complete
    const download = await downloadPromise;

    // Verify download filename includes date
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^crm-analytics-\d{4}-\d{2}-\d{2}\.csv$/);

    // Verify file was downloaded
    expect(download).toBeTruthy();
  });

  test('should display department analysis metrics', async ({ page }) => {
    // Verify section heading
    await expect(page.getByText(/department analysis/i)).toBeVisible();

    // Verify departments are shown
    await expect(page.getByText('Outreach')).toBeVisible();
    await expect(page.getByText('Direct Action')).toBeVisible();
    await expect(page.getByText('Legal Support')).toBeVisible();
    await expect(page.getByText('Communications')).toBeVisible();

    // Verify activity rates are displayed
    await expect(page.getByText(/84\.4%/)).toBeVisible(); // Outreach
    await expect(page.getByText(/91\.3%/)).toBeVisible(); // Direct Action

    // Verify member counts
    await expect(page.getByText(/38 \/ 45 active/)).toBeVisible(); // Outreach: 38/45 active
  });
});

test.describe('Campaign Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Campaign Analyst', 'testpassword123');

    // Navigate to analytics page and select Campaign tab
    await page.goto('/app/analytics', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');

    // Wait for tabs to be visible
    const campaignTab = page.getByRole('tab', { name: /campaign analytics/i });
    await expect(campaignTab).toBeVisible({ timeout: 10000 });
    await campaignTab.click();
  });

  test('should display campaign key metrics summary', async ({ page }) => {
    // Verify key metric cards are visible
    await expect(page.getByText(/total members/i)).toBeVisible();
    await expect(page.getByText(/avg event attendance/i)).toBeVisible();
    await expect(page.getByText(/vote turnout/i)).toBeVisible();
    await expect(page.getByText(/engagement rate/i)).toBeVisible();

    // Verify metric values (from DEMO_DATA)
    await expect(page.getByText('342')).toBeVisible(); // Total members
    await expect(page.getByText('45')).toBeVisible(); // Avg event attendance
    await expect(page.getByText(/64%/)).toBeVisible(); // Vote turnout
    await expect(page.getByText(/6\.8%/)).toBeVisible(); // Engagement rate

    // Verify growth indicators
    await expect(page.getByText(/\+28 this month/)).toBeVisible();
  });

  test('should display membership growth chart with trend data', async ({ page }) => {
    // Verify section heading
    await expect(page.getByText(/membership growth/i)).toBeVisible();

    // Verify monthly data is displayed
    await expect(page.getByText('May')).toBeVisible();
    await expect(page.getByText('Jun')).toBeVisible();
    await expect(page.getByText('Jul')).toBeVisible();
    await expect(page.getByText('Aug')).toBeVisible();

    // Verify member counts for each month
    await expect(page.getByText('286')).toBeVisible(); // May
    await expect(page.getByText('293')).toBeVisible(); // Jun
    await expect(page.getByText('314')).toBeVisible(); // Jul
    await expect(page.getByText('342')).toBeVisible(); // Aug

    // Verify chart bars are rendered (simple bar chart implementation)
    const chartBars = page.locator('.bg-primary.rounded-t');
    await expect(chartBars).toHaveCount(4); // 4 months

    // Verify growth trend stats
    await expect(page.getByText(/this month/i)).toBeVisible();
    await expect(page.getByText(/last month/i)).toBeVisible();
    await expect(page.getByText(/\+33\.3%/)).toBeVisible(); // Growth percentage
  });

  test('should display event attendance metrics and show-up rates', async ({ page }) => {
    // Verify section heading
    await expect(page.getByText(/event attendance/i)).toBeVisible();

    // Verify recent events are displayed
    await expect(page.getByText('Climate Rally')).toBeVisible();
    await expect(page.getByText('Organizing Workshop')).toBeVisible();
    await expect(page.getByText('Community Meeting')).toBeVisible();

    // Verify RSVP and actual attendance numbers
    await expect(page.getByText(/rsvp: 67/i)).toBeVisible(); // Climate Rally
    await expect(page.getByText(/actual: 52/i)).toBeVisible(); // Climate Rally

    // Verify show-up rates
    await expect(page.getByText(/77\.6%/)).toBeVisible(); // Climate Rally show-up rate
    await expect(page.getByText(/84\.4%/)).toBeVisible(); // Organizing Workshop
    await expect(page.getByText(/87\.5%/)).toBeVisible(); // Community Meeting

    // Verify summary statistics
    await expect(page.getByText(/rsvp rate/i)).toBeVisible();
    await expect(page.getByText(/78%/)).toBeVisible(); // Overall RSVP rate
    await expect(page.getByText(/show-up rate/i)).toBeVisible();
    await expect(page.getByText(/67%/)).toBeVisible(); // Overall show-up rate
  });

  test('should display governance vote turnout analytics', async ({ page }) => {
    // Verify section heading
    await expect(page.getByText(/governance participation/i)).toBeVisible();

    // Verify recent votes are displayed
    await expect(page.getByText('Rent Strike Resolution')).toBeVisible();
    await expect(page.getByText('Profit Sharing Amendment')).toBeVisible();
    await expect(page.getByText('Community Garden Purchase')).toBeVisible();

    // Verify vote outcomes
    await expect(page.getByText('Passed').first()).toBeVisible(); // Rent Strike
    await expect(page.getByText('Discussion')).toBeVisible(); // Profit Sharing

    // Verify turnout percentages
    await expect(page.getByText(/turnout: 71%/i)).toBeVisible(); // Rent Strike
    await expect(page.getByText(/turnout: 58%/i)).toBeVisible(); // Profit Sharing
    await expect(page.getByText(/turnout: 63%/i)).toBeVisible(); // Community Garden

    // Verify summary statistics
    await expect(page.getByText(/avg turnout/i)).toBeVisible();
    await expect(page.getByText(/consensus rate/i)).toBeVisible();
    await expect(page.getByText(/82%/)).toBeVisible(); // Consensus rate
  });

  test('should display engagement trends and top contributors', async ({ page }) => {
    // Verify section heading
    await expect(page.getByText(/engagement trends/i)).toBeVisible();

    // Verify engagement metrics
    await expect(page.getByText('127')).toBeVisible(); // Total posts
    await expect(page.getByText('842')).toBeVisible(); // Total reactions
    await expect(page.getByText('315')).toBeVisible(); // Total comments

    // Verify metric labels
    const postsLabel = page.locator('text=127').locator('..');
    await expect(postsLabel).toContainText(/posts/i);

    const reactionsLabel = page.locator('text=842').locator('..');
    await expect(reactionsLabel).toContainText(/reactions/i);

    const commentsLabel = page.locator('text=315').locator('..');
    await expect(commentsLabel).toContainText(/comments/i);

    // Verify top contributors section
    await expect(page.getByText(/top contributors/i)).toBeVisible();

    // Verify contributor names and rankings
    await expect(page.getByText(/#1/)).toBeVisible();
    await expect(page.getByText(/#2/)).toBeVisible();
    await expect(page.getByText(/#3/)).toBeVisible();

    // Verify contributor stats (posts and reactions)
    await expect(page.getByText(/23 posts/)).toBeVisible(); // Sarah Chen
    await expect(page.getByText(/156 reactions/)).toBeVisible(); // Sarah Chen reactions
  });

  test('should display campaign wins timeline with impact levels', async ({ page }) => {
    // Verify section heading
    await expect(page.getByText(/campaign wins/i)).toBeVisible();

    // Verify trophy icon is present
    const trophyIcon = page.locator('svg.lucide-trophy, [data-testid="trophy-icon"]');
    await expect(trophyIcon).toBeVisible();

    // Verify wins are displayed
    await expect(page.getByText('City Council Renewable Energy Vote')).toBeVisible();
    await expect(page.getByText('Tenant Union Recognition')).toBeVisible();
    await expect(page.getByText('Community Garden Secured')).toBeVisible();

    // Verify win descriptions
    await expect(page.getByText(/7-2 vote to transition all municipal buildings/)).toBeVisible();
    await expect(page.getByText(/landlord agreed to recognize tenant union/i)).toBeVisible();

    // Verify impact levels are shown
    await expect(page.getByText(/major impact/i)).toBeVisible();
    await expect(page.getByText(/moderate impact/i).first()).toBeVisible();

    // Verify dates are displayed
    await expect(page.getByText('2025-09-28')).toBeVisible(); // City Council vote
    await expect(page.getByText('2025-08-15')).toBeVisible(); // Tenant Union
    await expect(page.getByText('2025-07-10')).toBeVisible(); // Community Garden
  });

  test('should export campaign analytics to CSV', async ({ page }) => {
    // Start waiting for download before clicking
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });

    // Click export button
    const exportButton = page.getByRole('button', { name: /export csv/i });
    await exportButton.click();

    // Wait for download to complete
    const download = await downloadPromise;

    // Verify download filename includes date
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^campaign-analytics-\d{4}-\d{2}-\d{2}\.csv$/);

    // Verify file was downloaded
    expect(download).toBeTruthy();
  });
});

test.describe('Analytics Multi-Dashboard Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await createIdentity(page, 'Dashboard User', 'testpassword123');

    await page.goto('/app/analytics', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');

    // Wait for page to be ready
    await expect(page.getByRole('heading', { name: /analytics dashboard/i })).toBeVisible({ timeout: 10000 });
  });

  test('should switch between CRM and Campaign analytics tabs', async ({ page }) => {
    // Start on CRM tab (default)
    const crmTab = page.getByRole('tab', { name: /crm analytics/i });
    await expect(crmTab).toHaveAttribute('data-state', 'active');

    // Verify CRM-specific content is visible
    await expect(page.getByText(/support level distribution/i)).toBeVisible();

    // Switch to Campaign tab
    const campaignTab = page.getByRole('tab', { name: /campaign analytics/i });
    await campaignTab.click();

    // Verify tab switched
    await expect(campaignTab).toHaveAttribute('data-state', 'active');

    // Verify Campaign-specific content is visible
    await expect(page.getByText(/membership growth/i)).toBeVisible();
    await expect(page.getByText(/campaign wins/i)).toBeVisible();

    // Verify CRM content is no longer visible
    await expect(page.getByText(/support level distribution/i)).not.toBeVisible();

    // Switch back to CRM tab
    await crmTab.click();
    await expect(crmTab).toHaveAttribute('data-state', 'active');
    await expect(page.getByText(/support level distribution/i)).toBeVisible();
  });
});
