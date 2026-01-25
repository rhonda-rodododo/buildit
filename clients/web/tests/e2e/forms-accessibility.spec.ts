/**
 * E2E Tests for Forms & Fundraising Accessibility
 * Tests keyboard navigation, screen reader support, ARIA labels,
 * and WCAG 2.1 AA compliance
 */

import { test, expect, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createAndLoginIdentity,
  createGroup,
  navigateToForms,
  createForm,
  addFieldToForm,
  editFieldProperties,
  publishForm,
  navigateToPublicForm,
  navigateToCampaigns,
  createCampaign,
  publishCampaign,
  navigateToPublicCampaign,
} from './helpers/forms-helpers';

const TEST_GROUP_NAME = 'Accessibility Test Group';

test.describe('Forms Accessibility', () => {
  let adminContext: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    adminContext = await browser.newContext();
  });

  test.afterEach(async () => {
    await adminContext.close();
  });

  test('should navigate form builder with keyboard', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'Keyboard User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Keyboard Navigation Test',
    });

    // Tab to field palette
    await adminPage.keyboard.press('Tab');
    await adminPage.keyboard.press('Tab');

    // Verify focus on first field type
    const focusedElement = await adminPage.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focusedElement).toContain('field-palette');

    // Use arrow keys to navigate palette
    await adminPage.keyboard.press('ArrowDown');
    await adminPage.keyboard.press('ArrowDown');

    // Press Enter to add field
    await adminPage.keyboard.press('Enter');

    // Wait for field to be added
    await adminPage.waitForSelector('[data-testid^="form-field-"]');

    // Tab to field editor
    await adminPage.keyboard.press('Tab');

    // Edit with keyboard only
    await adminPage.keyboard.type('Full Name');

    // Navigate to next field with Tab
    await adminPage.keyboard.press('Tab');
    await adminPage.keyboard.type('Enter your full name');

    // Save with keyboard (Ctrl+S or Cmd+S)
    await adminPage.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');

    // Verify form saved
    await expect(adminPage.locator('text=Draft saved')).toBeVisible();
  });

  test('should submit form with keyboard only', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Form Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Keyboard Form Test',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Name',
      required: true,
    });

    await addFieldToForm(adminPage, 'email');
    await editFieldProperties(adminPage, 1, {
      label: 'Email',
      required: true,
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Public user: Navigate to form
    await navigateToPublicForm(publicPage, formId!);

    // Tab to first field
    await publicPage.keyboard.press('Tab');
    await publicPage.keyboard.press('Tab'); // Skip header/navigation

    // Type in first field
    await publicPage.keyboard.type('John Doe');

    // Tab to second field
    await publicPage.keyboard.press('Tab');
    await publicPage.keyboard.type('john@example.com');

    // Tab to submit button
    await publicPage.keyboard.press('Tab');

    // Verify focus on submit button
    const focusedButton = await publicPage.evaluate(() => document.activeElement?.textContent);
    expect(focusedButton).toContain('Submit');

    // Press Enter to submit
    await publicPage.keyboard.press('Enter');

    // Verify submission success
    await expect(publicPage.locator('[data-testid="form-submitted"]')).toBeVisible();

    await publicContext.close();
  });

  test('should have proper ARIA labels and roles', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'ARIA Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'ARIA Test Form',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Full Name',
      required: true,
      helpText: 'Enter your first and last name',
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Navigate to public form
    await navigateToPublicForm(publicPage, formId!);

    // Verify form has proper role
    await expect(publicPage.locator('form[role="form"]')).toBeVisible();

    // Verify field has label
    const nameField = publicPage.locator('input[name="full-name"]');
    const labelledBy = await nameField.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();

    // Verify required field has aria-required
    const isRequired = await nameField.getAttribute('aria-required');
    expect(isRequired).toBe('true');

    // Verify help text has aria-describedby
    const describedBy = await nameField.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    // Verify submit button has proper role and label
    const submitButton = publicPage.locator('button[type="submit"]');
    await expect(submitButton).toHaveAttribute('aria-label', /submit/i);

    await publicContext.close();
  });

  test('should meet WCAG 2.1 AA standards for form builder', async () => {
    const adminPage = await adminContext.newPage();

    await createAndLoginIdentity(adminPage, 'WCAG Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'WCAG Test Form',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Name',
      required: true,
    });

    // Run axe accessibility audit
    const results = await new AxeBuilder({ page: adminPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Verify no violations
    expect(results.violations).toHaveLength(0);

    // If there are violations, log them for debugging
    if (results.violations.length > 0) {
      console.log('Accessibility violations:', JSON.stringify(results.violations, null, 2));
    }
  });

  test('should meet WCAG 2.1 AA standards for public form', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Public WCAG Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Public WCAG Test',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Email',
      required: true,
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Navigate to public form
    await navigateToPublicForm(publicPage, formId!);

    // Run axe accessibility audit on public form
    const results = await new AxeBuilder({ page: publicPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Verify no violations
    expect(results.violations).toHaveLength(0);

    if (results.violations.length > 0) {
      console.log('Public form accessibility violations:', JSON.stringify(results.violations, null, 2));
    }

    await publicContext.close();
  });

  test('should meet WCAG 2.1 AA standards for campaign page', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create campaign
    await createAndLoginIdentity(adminPage, 'Campaign WCAG Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'WCAG Campaign Test',
      description: 'Testing accessibility',
      goal: 1000,
    });

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Navigate to public campaign
    await navigateToPublicCampaign(publicPage, campaignSlug!);

    // Run axe accessibility audit
    const results = await new AxeBuilder({ page: publicPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Verify no violations
    expect(results.violations).toHaveLength(0);

    if (results.violations.length > 0) {
      console.log('Campaign accessibility violations:', JSON.stringify(results.violations, null, 2));
    }

    await publicContext.close();
  });

  test('should have sufficient color contrast', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Contrast Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Color Contrast Test',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Test Field',
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Navigate to public form
    await navigateToPublicForm(publicPage, formId!);

    // Run contrast-specific audit
    const results = await new AxeBuilder({ page: publicPage })
      .withTags(['cat.color'])
      .analyze();

    // Verify no color contrast violations
    const contrastViolations = results.violations.filter((v) =>
      v.id.includes('color-contrast')
    );
    expect(contrastViolations).toHaveLength(0);

    await publicContext.close();
  });

  test('should have visible focus indicators', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Focus Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Focus Indicator Test',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Name',
    });

    await addFieldToForm(adminPage, 'email');
    await editFieldProperties(adminPage, 1, {
      label: 'Email',
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Navigate to public form
    await navigateToPublicForm(publicPage, formId!);

    // Tab to first field
    await publicPage.keyboard.press('Tab');
    await publicPage.keyboard.press('Tab');

    // Get computed styles of focused element
    const focusStyles = await publicPage.evaluate(() => {
      const focused = document.activeElement as HTMLElement;
      const styles = window.getComputedStyle(focused);
      return {
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow,
      };
    });

    // Verify focus indicator is visible
    const hasFocusIndicator =
      (focusStyles.outlineWidth !== '0px' && focusStyles.outlineStyle !== 'none') ||
      focusStyles.boxShadow !== 'none';

    expect(hasFocusIndicator).toBe(true);

    await publicContext.close();
  });

  test('should support screen reader navigation', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Screen Reader Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Screen Reader Test',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Name',
      required: true,
      helpText: 'Enter your full name',
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Navigate to public form
    await navigateToPublicForm(publicPage, formId!);

    // Verify semantic HTML structure
    await expect(publicPage.locator('main')).toBeVisible();
    await expect(publicPage.locator('form')).toBeVisible();

    // Verify heading hierarchy
    const headings = await publicPage.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);

    // Verify form has accessible name
    const formName = await publicPage.locator('form').getAttribute('aria-label');
    expect(formName).toBeTruthy();

    // Verify labels are properly associated
    const nameInput = publicPage.locator('input[name="name"]');
    const labelFor = await publicPage.locator('label[for="name"]').count();
    expect(labelFor).toBeGreaterThan(0);

    // Verify error messages are announced
    await publicPage.click('button[type="submit"]'); // Submit without filling required field

    const errorMessage = publicPage.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();

    await publicContext.close();
  });

  test('should handle skip links for keyboard users', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create campaign (complex page with multiple sections)
    await createAndLoginIdentity(adminPage, 'Skip Link Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToCampaigns(adminPage);

    await createCampaign(adminPage, {
      title: 'Skip Link Test Campaign',
      description: 'Testing skip navigation',
      goal: 5000,
    });

    await publishCampaign(adminPage);

    const campaignSlug = await adminPage.getAttribute('[data-testid="campaign-slug"]', 'value');

    // Navigate to campaign
    await navigateToPublicCampaign(publicPage, campaignSlug!);

    // Tab once to reveal skip link
    await publicPage.keyboard.press('Tab');

    // Verify skip link is visible when focused
    const skipLink = publicPage.locator('a:has-text("Skip to main content")');
    await expect(skipLink).toBeVisible();

    // Activate skip link
    await publicPage.keyboard.press('Enter');

    // Verify focus moved to main content
    const focusedElement = await publicPage.evaluate(() => {
      const active = document.activeElement;
      return active?.tagName;
    });

    expect(focusedElement).toBe('MAIN');

    await publicContext.close();
  });

  test('should announce dynamic content changes to screen readers', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create form with conditional logic
    await createAndLoginIdentity(adminPage, 'Dynamic Content Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Dynamic Content Test',
    });

    await addFieldToForm(adminPage, 'checkbox');
    await editFieldProperties(adminPage, 0, {
      label: 'Show additional field',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 1, {
      label: 'Additional field',
    });

    // Add conditional logic (field 1 shows when field 0 is checked)
    // (This would use the conditional logic editor from earlier tests)

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Navigate to public form
    await navigateToPublicForm(publicPage, formId!);

    // Check the checkbox to reveal hidden field
    await publicPage.check('input[name="show-additional-field"]');

    // Verify ARIA live region announces the change
    const liveRegion = publicPage.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeVisible();

    // The live region should announce the field is now visible
    const announcement = await liveRegion.innerText();
    expect(announcement).toContain('Additional field');

    await publicContext.close();
  });

  test('should support high contrast mode', async () => {
    const adminPage = await adminContext.newPage();

    // Emulate high contrast mode
    await adminPage.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });

    await createAndLoginIdentity(adminPage, 'High Contrast User');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'High Contrast Test',
    });

    await addFieldToForm(adminPage, 'text');

    // Verify form builder is still usable in high contrast mode
    await expect(adminPage.locator('[data-testid="form-builder"]')).toBeVisible();

    // Verify field palette is visible
    await expect(adminPage.locator('[data-testid^="field-palette-"]').first()).toBeVisible();

    // Verify form canvas is visible
    await expect(adminPage.locator('[data-testid^="form-field-"]').first()).toBeVisible();
  });

  test('should support text resizing up to 200%', async () => {
    const adminPage = await adminContext.newPage();
    const publicContext = await adminPage.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();

    // Admin: Create form
    await createAndLoginIdentity(adminPage, 'Text Resize Admin');
    await createGroup(adminPage, TEST_GROUP_NAME);
    await navigateToForms(adminPage);

    await createForm(adminPage, {
      title: 'Text Resize Test',
    });

    await addFieldToForm(adminPage, 'text');
    await editFieldProperties(adminPage, 0, {
      label: 'Name',
    });

    await publishForm(adminPage);

    const formId = await adminPage.getAttribute('[data-testid="current-form"]', 'data-form-id');

    // Navigate to public form
    await navigateToPublicForm(publicPage, formId!);

    // Increase text size to 200%
    await publicPage.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });

    // Verify form is still usable
    await expect(publicPage.locator('form')).toBeVisible();

    // Verify no horizontal scrolling (responsive)
    const hasHorizontalScroll = await publicPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);

    // Verify all interactive elements are still clickable
    await expect(publicPage.locator('input[name="name"]')).toBeVisible();
    await expect(publicPage.locator('button[type="submit"]')).toBeVisible();

    await publicContext.close();
  });
});
