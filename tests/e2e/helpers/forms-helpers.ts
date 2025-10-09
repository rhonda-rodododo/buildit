/**
 * E2E Test Helpers for Forms & Fundraising Module
 * Reusable functions for common form and campaign operations
 */

import { Page, expect } from '@playwright/test';

// ============================================================================
// Form Builder Helpers
// ============================================================================

/**
 * Navigate to forms page within a group
 */
export async function navigateToForms(page: Page) {
  await page.click('a[href*="forms"]');
  await page.waitForURL(/.*forms/);
}

/**
 * Create a new form
 */
export async function createForm(
  page: Page,
  options: {
    title: string;
    description?: string;
    useTemplate?: string;
  }
) {
  await page.click('button:has-text("New Form")');

  if (options.useTemplate) {
    // Select template
    await page.click(`text=${options.useTemplate}`);
  }

  await page.fill('input[name="title"]', options.title);

  if (options.description) {
    await page.fill('textarea[name="description"]', options.description);
  }

  await page.click('button:has-text("Create")');

  // Wait for form builder to load
  await page.waitForSelector('[data-testid="form-builder"]', { timeout: 5000 });
}

/**
 * Add a field to the form from the palette
 */
export async function addFieldToForm(
  page: Page,
  fieldType: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'radio' | 'date' | 'file' | 'textarea' | 'url' | 'phone'
) {
  // Click on field in palette
  await page.click(`[data-testid="field-palette-${fieldType}"]`);

  // Wait for field to appear on canvas
  await page.waitForSelector('[data-testid^="form-field-"]');
}

/**
 * Edit field properties
 */
export async function editFieldProperties(
  page: Page,
  fieldIndex: number,
  properties: {
    label?: string;
    placeholder?: string;
    required?: boolean;
    helpText?: string;
  }
) {
  // Click on field to edit
  const field = page.locator(`[data-testid="form-field-${fieldIndex}"]`);
  await field.click();

  // Edit properties
  if (properties.label !== undefined) {
    await page.fill('input[name="label"]', properties.label);
  }

  if (properties.placeholder !== undefined) {
    await page.fill('input[name="placeholder"]', properties.placeholder);
  }

  if (properties.required !== undefined) {
    const checkbox = page.locator('input[name="required"]');
    const isChecked = await checkbox.isChecked();
    if (properties.required !== isChecked) {
      await checkbox.click();
    }
  }

  if (properties.helpText !== undefined) {
    await page.fill('textarea[name="helpText"]', properties.helpText);
  }

  // Close editor
  await page.click('button:has-text("Done")');
}

/**
 * Add conditional logic to a field
 */
export async function addConditionalLogic(
  page: Page,
  fieldIndex: number,
  condition: {
    watchFieldIndex: number;
    operator: 'equals' | 'notEquals' | 'contains' | 'isEmpty';
    value?: string;
    action: 'show' | 'hide' | 'require';
  }
) {
  // Select the field
  const field = page.locator(`[data-testid="form-field-${fieldIndex}"]`);
  await field.click();

  // Open conditional logic editor
  await page.click('button:has-text("Add Condition")');

  // Select watch field
  await page.selectOption('[name="watchField"]', { index: condition.watchFieldIndex });

  // Select operator
  await page.selectOption('[name="operator"]', condition.operator);

  // Enter value if applicable
  if (condition.value) {
    await page.fill('input[name="conditionValue"]', condition.value);
  }

  // Select action
  await page.selectOption('[name="action"]', condition.action);

  // Save condition
  await page.click('button:has-text("Save Condition")');
}

/**
 * Preview the form
 */
export async function previewForm(page: Page) {
  await page.click('button:has-text("Preview")');
  await page.waitForSelector('[data-testid="form-preview"]');
}

/**
 * Save/publish the form
 */
export async function publishForm(page: Page) {
  await page.click('button:has-text("Publish")');
  await page.waitForSelector('text=Form published');
}

/**
 * Save form as draft
 */
export async function saveFormDraft(page: Page) {
  await page.click('button:has-text("Save Draft")');
  await page.waitForSelector('text=Draft saved');
}

// ============================================================================
// Form Submission Helpers
// ============================================================================

/**
 * Navigate to public form URL
 */
export async function navigateToPublicForm(page: Page, formId: string) {
  await page.goto(`/public/forms/${formId}`);
  await page.waitForSelector('[data-testid="public-form"]');
}

/**
 * Submit a form with data
 */
export async function submitForm(
  page: Page,
  formData: Record<string, string | boolean>
) {
  // Fill form fields
  for (const [fieldName, value] of Object.entries(formData)) {
    if (typeof value === 'boolean') {
      const checkbox = page.locator(`input[name="${fieldName}"]`);
      const isChecked = await checkbox.isChecked();
      if (value !== isChecked) {
        await checkbox.click();
      }
    } else {
      await page.fill(`input[name="${fieldName}"], textarea[name="${fieldName}"]`, value);
    }
  }

  // Submit
  await page.click('button[type="submit"]');

  // Wait for confirmation
  await page.waitForSelector('[data-testid="form-submitted"]', { timeout: 5000 });
}

/**
 * Navigate to form submissions admin page
 */
export async function navigateToSubmissions(page: Page, formId: string) {
  await navigateToForms(page);
  await page.click(`[data-testid="form-${formId}"]`);
  await page.click('text=Submissions');
  await page.waitForSelector('[data-testid="submissions-list"]');
}

/**
 * Filter submissions
 */
export async function filterSubmissions(
  page: Page,
  filter: 'all' | 'unprocessed' | 'processed' | 'spam'
) {
  await page.click(`button:has-text("${filter}")`);
  await page.waitForTimeout(500); // Wait for filter to apply
}

/**
 * Mark submission as spam
 */
export async function markAsSpam(page: Page, submissionId: string) {
  await page.click(`[data-testid="submission-${submissionId}"] button:has-text("Spam")`);
  await page.waitForSelector(`[data-testid="submission-${submissionId}"][data-spam="true"]`);
}

// ============================================================================
// Campaign Helpers
// ============================================================================

/**
 * Navigate to campaigns page
 */
export async function navigateToCampaigns(page: Page) {
  await page.click('a[href*="campaigns"]');
  await page.waitForURL(/.*campaigns/);
}

/**
 * Create a new campaign
 */
export async function createCampaign(
  page: Page,
  options: {
    title: string;
    description: string;
    goal: number;
    useTemplate?: string;
  }
) {
  await page.click('button:has-text("New Campaign")');

  if (options.useTemplate) {
    await page.click(`text=${options.useTemplate}`);
  }

  await page.fill('input[name="title"]', options.title);
  await page.fill('textarea[name="description"]', options.description);
  await page.fill('input[name="goal"]', options.goal.toString());

  await page.click('button:has-text("Create")');

  // Wait for campaign builder
  await page.waitForSelector('[data-testid="campaign-builder"]');
}

/**
 * Add a donation tier
 */
export async function addDonationTier(
  page: Page,
  tier: {
    name: string;
    amount: number;
    description?: string;
    limited?: boolean;
    maxCount?: number;
  }
) {
  await page.click('button:has-text("Add Tier")');

  await page.fill('input[name="tierName"]', tier.name);
  await page.fill('input[name="tierAmount"]', tier.amount.toString());

  if (tier.description) {
    await page.fill('textarea[name="tierDescription"]', tier.description);
  }

  if (tier.limited) {
    await page.check('input[name="limited"]');
    if (tier.maxCount) {
      await page.fill('input[name="maxCount"]', tier.maxCount.toString());
    }
  }

  await page.click('button:has-text("Save Tier")');
}

/**
 * Publish a campaign
 */
export async function publishCampaign(page: Page) {
  await page.click('button:has-text("Publish Campaign")');
  await page.waitForSelector('text=Campaign published');
}

/**
 * Navigate to public campaign page
 */
export async function navigateToPublicCampaign(page: Page, campaignSlug: string) {
  await page.goto(`/public/campaigns/${campaignSlug}`);
  await page.waitForSelector('[data-testid="public-campaign"]');
}

/**
 * Make a donation
 */
export async function makeDonation(
  page: Page,
  options: {
    amount?: number;
    tierId?: string;
    donorName?: string;
    donorEmail?: string;
    message?: string;
    anonymous?: boolean;
  }
) {
  // Select tier or custom amount
  if (options.tierId) {
    await page.click(`[data-testid="tier-${options.tierId}"]`);
  } else if (options.amount) {
    await page.click('button:has-text("Custom Amount")');
    await page.fill('input[name="customAmount"]', options.amount.toString());
  }

  // Fill donor information
  if (!options.anonymous) {
    if (options.donorName) {
      await page.fill('input[name="donorName"]', options.donorName);
    }
    if (options.donorEmail) {
      await page.fill('input[name="donorEmail"]', options.donorEmail);
    }
    if (options.message) {
      await page.fill('textarea[name="donorMessage"]', options.message);
    }
  } else {
    await page.check('input[name="anonymous"]');
  }

  // Submit donation (using test payment)
  await page.click('button:has-text("Donate")');

  // Wait for confirmation
  await page.waitForSelector('[data-testid="donation-complete"]', { timeout: 10000 });
}

/**
 * Post a campaign update
 */
export async function postCampaignUpdate(
  page: Page,
  options: {
    title: string;
    content: string;
  }
) {
  await page.click('button:has-text("Post Update")');
  await page.fill('input[name="updateTitle"]', options.title);
  await page.fill('textarea[name="updateContent"]', options.content);
  await page.click('button:has-text("Publish Update")');
  await page.waitForSelector('text=Update published');
}

// ============================================================================
// Public Pages Helpers
// ============================================================================

/**
 * Navigate to public pages
 */
export async function navigateToPublicPages(page: Page) {
  await page.click('a[href*="public-pages"]');
  await page.waitForURL(/.*public-pages/);
}

/**
 * Create a public page
 */
export async function createPublicPage(
  page: Page,
  options: {
    title: string;
    slug: string;
    content: string;
    type: 'landing' | 'about' | 'events' | 'contact' | 'custom';
  }
) {
  await page.click('button:has-text("New Page")');

  await page.fill('input[name="title"]', options.title);
  await page.fill('input[name="slug"]', options.slug);
  await page.selectOption('select[name="type"]', options.type);

  // Fill content in rich text editor
  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await editor.fill(options.content);

  await page.click('button:has-text("Create")');
  await page.waitForSelector('[data-testid="page-editor"]');
}

/**
 * Configure SEO settings for a page
 */
export async function configureSEO(
  page: Page,
  seo: {
    title?: string;
    description?: string;
    ogImage?: string;
    twitterCard?: 'summary' | 'summary_large_image';
  }
) {
  await page.click('button:has-text("SEO Settings")');

  if (seo.title) {
    await page.fill('input[name="seoTitle"]', seo.title);
  }

  if (seo.description) {
    await page.fill('textarea[name="seoDescription"]', seo.description);
  }

  if (seo.ogImage) {
    await page.fill('input[name="ogImage"]', seo.ogImage);
  }

  if (seo.twitterCard) {
    await page.selectOption('select[name="twitterCard"]', seo.twitterCard);
  }

  await page.click('button:has-text("Save SEO")');
}

/**
 * Publish a public page
 */
export async function publishPublicPage(page: Page) {
  await page.click('button:has-text("Publish Page")');
  await page.waitForSelector('text=Page published');
}

/**
 * Navigate to published public page
 */
export async function navigateToPublishedPage(page: Page, slug: string) {
  await page.goto(`/public/pages/${slug}`);
  await page.waitForSelector('[data-testid="public-page"]');
}

// ============================================================================
// Analytics Helpers
// ============================================================================

/**
 * Navigate to form analytics
 */
export async function navigateToFormAnalytics(page: Page, formId: string) {
  await navigateToForms(page);
  await page.click(`[data-testid="form-${formId}"]`);
  await page.click('text=Analytics');
  await page.waitForSelector('[data-testid="analytics-dashboard"]');
}

/**
 * Get analytics metrics
 */
export async function getAnalyticsMetrics(page: Page): Promise<{
  views: number;
  submissions: number;
  conversionRate: number;
}> {
  const viewsText = await page.locator('[data-testid="metric-views"]').innerText();
  const submissionsText = await page.locator('[data-testid="metric-submissions"]').innerText();
  const conversionRateText = await page.locator('[data-testid="metric-conversion-rate"]').innerText();

  return {
    views: parseInt(viewsText.replace(/\D/g, '')),
    submissions: parseInt(submissionsText.replace(/\D/g, '')),
    conversionRate: parseFloat(conversionRateText.replace(/[^\d.]/g, '')),
  };
}

// ============================================================================
// Common Helpers
// ============================================================================

/**
 * Create identity and login
 */
export async function createAndLoginIdentity(page: Page, name: string) {
  await page.goto('/');
  await page.click('text=Get Started');
  await page.fill('input[placeholder="Enter your name"]', name);
  await page.click('button:has-text("Create Identity")');
  await page.waitForURL(/\/app\//);
}

/**
 * Create a group
 */
export async function createGroup(page: Page, groupName: string) {
  await page.click('button:has-text("New Group")');
  await page.fill('input[name="name"]', groupName);
  await page.fill('textarea[name="description"]', `Test group: ${groupName}`);
  await page.click('button[type="submit"]');
  await page.waitForSelector(`text=${groupName}`);
  await page.click(`text=${groupName}`);
}

/**
 * Wait for element and verify visibility
 */
export async function waitForAndVerify(page: Page, selector: string) {
  await page.waitForSelector(selector);
  await expect(page.locator(selector)).toBeVisible();
}

/**
 * Clean up test data (forms, campaigns, pages)
 */
export async function cleanupTestData(page: Page) {
  // This would typically use the database directly or admin endpoints
  // For now, just a placeholder
  console.log('Cleaning up test data...');
}
