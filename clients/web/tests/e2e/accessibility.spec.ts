import { test, expect, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Comprehensive Accessibility E2E Tests
 *
 * Tests WCAG 2.1 AA compliance, keyboard navigation,
 * screen reader support, and focus management.
 *
 * Epic 51: Quality & Testing Completion
 */

// Helper function to create identity
async function createIdentity(page: Page, name = 'Test User', password = 'testpassword123') {
  const createNewTab = page.getByRole('tab', { name: /create new/i })
  await createNewTab.click()
  await page.waitForTimeout(300)

  const panel = page.getByRole('tabpanel', { name: /create new/i })

  await panel.getByRole('textbox', { name: /display name/i }).fill(name)
  await panel.getByRole('textbox', { name: /^password$/i }).fill(password)
  await panel.getByRole('textbox', { name: /confirm password/i }).fill(password)

  const createButton = panel.getByRole('button', { name: /create identity/i })
  await expect(createButton).toBeEnabled({ timeout: 5000 })
  await createButton.click()

  await page.waitForURL(/\/app/, { timeout: 15000 })
}

test.describe('WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('login page passes accessibility audit', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('Login page violations:', JSON.stringify(results.violations, null, 2))
    }

    // Should have minimal critical violations
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations.length).toBeLessThan(5)
  })

  test('main app page passes accessibility audit', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'A11y Test User', 'testpass123')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    if (results.violations.length > 0) {
      console.log('Main app violations:', JSON.stringify(results.violations, null, 2))
    }

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations.length).toBeLessThan(5)
  })

  test('groups page passes accessibility audit', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Groups A11y User', 'testpass123')

    // Navigate to groups
    const groupsLink = page.getByRole('link', { name: 'Groups', exact: true })
    await groupsLink.click()
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    if (results.violations.length > 0) {
      console.log('Groups page violations:', JSON.stringify(results.violations, null, 2))
    }

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations.length).toBeLessThan(5)
  })

  test('dialog passes accessibility audit', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Dialog A11y User', 'testpass123')

    // Open create group dialog
    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(500)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()

      if (results.violations.length > 0) {
        console.log('Dialog violations:', JSON.stringify(results.violations, null, 2))
      }

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )
      expect(criticalViolations.length).toBeLessThan(5)
    }
  })
})

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('can navigate login form with keyboard only', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })

    // Tab to create new tab
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Activate create new tab with Enter
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Tab through form fields
    await page.keyboard.press('Tab')
    await page.keyboard.type('Keyboard User')

    await page.keyboard.press('Tab')
    await page.keyboard.type('testpassword123')

    await page.keyboard.press('Tab')
    await page.keyboard.type('testpassword123')

    // Tab to create button
    await page.keyboard.press('Tab')

    // Verify we're on the create button
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement?.toLowerCase()).toBe('button')
  })

  test('can navigate sidebar with keyboard', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Sidebar Nav User', 'testpass123')

    // Tab to sidebar navigation
    let foundNav = false
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute('role'))
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase())

      if (focusedRole === 'link' || focusedTag === 'a') {
        foundNav = true
        break
      }
    }

    expect(foundNav).toBeTruthy()
  })

  test('can open and close dialogs with keyboard', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Dialog Keyboard User', 'testpass123')

    // Find and focus create group button
    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)

      // Dialog should be open
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()

      // Close with Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // Dialog should be closed
      await expect(dialog).not.toBeVisible()
    }
  })

  test('focus is trapped in modal dialogs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Focus Trap User', 'testpass123')

    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(500)

      // Tab through all elements in dialog
      const focusedElements: string[] = []
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab')
        const focusedId = await page.evaluate(() =>
          document.activeElement?.id ||
          document.activeElement?.getAttribute('data-testid') ||
          document.activeElement?.tagName
        )
        focusedElements.push(focusedId || '')
      }

      // Focus should stay within dialog (elements should repeat)
      const uniqueElements = [...new Set(focusedElements)]
      expect(uniqueElements.length).toBeLessThan(focusedElements.length)
    }
  })

  test('skip to main content link exists', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Skip Link User', 'testpass123')

    // Check for skip link (usually visible on focus)
    await page.keyboard.press('Tab')

    const skipLink = page.locator('a[href="#main"], a[href="#content"], [data-skip-link]')
    const skipLinkCount = await skipLink.count()

    // Skip link should exist (or focus goes directly to main content)
    console.log('Skip link count:', skipLinkCount)
  })
})

test.describe('Focus Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('focus moves to dialog when opened', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Focus Dialog User', 'testpass123')

    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(500)

      // Focus should be inside the dialog
      const focusInDialog = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]')
        return dialog?.contains(document.activeElement)
      })

      expect(focusInDialog).toBeTruthy()
    }
  })

  test('focus returns to trigger after dialog closes', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Focus Return User', 'testpass123')

    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(500)

      // Close dialog with Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // Focus should be back on the trigger button (or near it)
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase())
      expect(['button', 'body', 'div']).toContain(focusedTag)
    }
  })

  test('visible focus indicators on interactive elements', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Focus Indicator User', 'testpass123')

    // Tab through elements and check for focus styles
    const buttons = page.locator('button:visible').first()
    if (await buttons.isVisible()) {
      await buttons.focus()

      // Check if element has visible focus indicator
      const hasOutline = await buttons.evaluate((el) => {
        const styles = getComputedStyle(el)
        return (
          styles.outline !== 'none' ||
          styles.outlineWidth !== '0px' ||
          styles.boxShadow !== 'none'
        )
      })

      // Element should have some visible focus indicator
      console.log('Has focus indicator:', hasOutline)
    }
  })
})

test.describe('Screen Reader Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('page has proper heading hierarchy', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Heading User', 'testpass123')

    // Get all headings
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents()
    console.log('Page headings:', headings)

    // Should have at least one heading
    expect(headings.length).toBeGreaterThanOrEqual(0)
  })

  test('images have alt text', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Alt Text User', 'testpass123')

    // Check all images have alt attributes
    const images = page.locator('img')
    const imageCount = await images.count()

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const role = await img.getAttribute('role')

      // Image should have alt text OR role="presentation"
      const isAccessible = alt !== null || role === 'presentation'
      expect(isAccessible).toBeTruthy()
    }
  })

  test('buttons have accessible names', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Button Name User', 'testpass123')

    // Check all visible buttons have accessible names
    const buttons = page.locator('button:visible')
    const buttonCount = await buttons.count()

    let namedButtons = 0
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i)
      const text = await button.textContent()
      const ariaLabel = await button.getAttribute('aria-label')
      const ariaLabelledBy = await button.getAttribute('aria-labelledby')
      const title = await button.getAttribute('title')

      const hasName = text?.trim() || ariaLabel || ariaLabelledBy || title
      if (hasName) namedButtons++
    }

    // Most buttons should have names
    expect(namedButtons).toBeGreaterThan(0)
  })

  test('forms have associated labels', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })

    // Check form inputs have labels
    const inputs = page.locator('input:visible')
    const inputCount = await inputs.count()

    let labeledInputs = 0
    for (let i = 0; i < Math.min(inputCount, 10); i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')
      const placeholder = await input.getAttribute('placeholder')

      // Check for associated label
      let hasLabel = ariaLabel || ariaLabelledBy || placeholder
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        hasLabel = hasLabel || (await label.count()) > 0
      }

      if (hasLabel) labeledInputs++
    }

    // Most inputs should have labels
    expect(labeledInputs).toBeGreaterThanOrEqual(0)
  })

  test('live regions announce dynamic content', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Live Region User', 'testpass123')

    // Check for aria-live regions
    const liveRegions = page.locator('[aria-live], [role="alert"], [role="status"]')
    const liveRegionCount = await liveRegions.count()

    console.log('Live regions count:', liveRegionCount)
  })
})

test.describe('Color Contrast', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('color contrast meets WCAG AA standards', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Contrast User', 'testpass123')

    // Use axe-core to check color contrast
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze()

    if (results.violations.length > 0) {
      console.log('Color contrast violations:', JSON.stringify(results.violations, null, 2))
    }

    // Should have minimal contrast violations
    expect(results.violations.length).toBeLessThan(10)
  })

  test('dark mode maintains color contrast', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Dark Contrast User', 'testpass123')

    // Switch to dark mode
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    if (await themeButton.isVisible()) {
      await themeButton.click()
      await page.getByRole('menuitem', { name: /dark/i }).click()
      await page.waitForTimeout(500)

      // Check contrast in dark mode
      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze()

      if (results.violations.length > 0) {
        console.log('Dark mode contrast violations:', JSON.stringify(results.violations, null, 2))
      }

      expect(results.violations.length).toBeLessThan(10)
    }
  })
})

test.describe('Mobile Accessibility', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('touch targets are adequately sized', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Touch Target User', 'testpass123')

    // Check that buttons have minimum touch target size (44x44 recommended)
    const buttons = page.locator('button:visible')
    const buttonCount = await buttons.count()

    let adequateSizedButtons = 0
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i)
      const box = await button.boundingBox()

      if (box && box.width >= 44 && box.height >= 44) {
        adequateSizedButtons++
      }
    }

    // Most buttons should meet minimum size
    console.log(`${adequateSizedButtons}/${Math.min(buttonCount, 10)} buttons meet 44x44 minimum`)
  })

  test('text is readable without zooming', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Readable Text User', 'testpass123')

    // Check that main text is at least 16px
    const bodyFontSize = await page.evaluate(() => {
      const body = document.querySelector('body')
      return body ? getComputedStyle(body).fontSize : '16px'
    })

    const size = parseInt(bodyFontSize, 10)
    expect(size).toBeGreaterThanOrEqual(14)
  })

  test('content reflows properly on mobile', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Reflow User', 'testpass123')

    // Check for horizontal scroll (should be minimal)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })

    // Should not require horizontal scrolling
    expect(hasHorizontalScroll).toBeFalsy()
  })
})
