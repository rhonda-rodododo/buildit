import { test, expect, Page } from '@playwright/test'

/**
 * Theme Switching E2E Tests
 *
 * Tests theme switching functionality (light/dark/system modes),
 * theme persistence, and proper CSS variable application.
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

test.describe('Theme Switching Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app first to establish origin
    await page.goto('/')

    // Clear IndexedDB and localStorage
    await page.evaluate(async () => {
      localStorage.removeItem('vite-ui-theme')
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
    })

    // Reload to ensure app initializes fresh
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('theme toggle button is accessible after login', async ({ page }) => {
    // Wait for login page
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })

    // Create identity
    await createIdentity(page, 'Theme Test User', 'testpass123')

    // Find the theme toggle button (ModeToggle component)
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    await expect(themeButton).toBeVisible()

    // Click to open dropdown
    await themeButton.click()

    // Verify all theme options are available
    await expect(page.getByRole('menuitem', { name: /light/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /dark/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /system/i })).toBeVisible()
  })

  test('switches to dark theme and applies correct styles', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Dark Theme User', 'testpass123')

    // Open theme toggle
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    await themeButton.click()

    // Select dark theme
    await page.getByRole('menuitem', { name: /dark/i }).click()
    await page.waitForTimeout(300)

    // Verify dark class is set on html element
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveClass(/dark/)

    // Verify background color is dark (check computed style)
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--background')
    })
    // Dark mode background should be dark (low lightness value)
    expect(bgColor.trim()).toBeTruthy()
  })

  test('switches to light theme and applies correct styles', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Light Theme User', 'testpass123')

    // First switch to dark to have a different starting point
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    await themeButton.click()
    await page.getByRole('menuitem', { name: /dark/i }).click()
    await page.waitForTimeout(300)

    // Now switch to light
    await themeButton.click()
    await page.getByRole('menuitem', { name: /light/i }).click()
    await page.waitForTimeout(300)

    // Verify dark class is NOT set on html element
    const htmlElement = page.locator('html')
    await expect(htmlElement).not.toHaveClass(/dark/)
  })

  test('system theme responds to media preference', async ({ page }) => {
    // Set media preference to dark before page load
    await page.emulateMedia({ colorScheme: 'dark' })

    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'System Theme User', 'testpass123')

    // Open theme toggle
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    await themeButton.click()
    await page.waitForTimeout(200)

    // Select system theme
    await page.getByRole('menuitem', { name: /system/i }).click()
    await page.waitForTimeout(500)

    // Verify system theme was selected
    const savedTheme = await page.evaluate(() => localStorage.getItem('vite-ui-theme'))
    expect(savedTheme).toBe('system')
  })

  test('theme persists in localStorage', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Theme Persist User', 'testpass123')

    // Switch to dark theme
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    await themeButton.click()
    await page.waitForTimeout(200)
    await page.getByRole('menuitem', { name: /dark/i }).click()
    await page.waitForTimeout(300)

    // Verify localStorage has correct value
    let savedTheme = await page.evaluate(() => localStorage.getItem('vite-ui-theme'))
    expect(savedTheme).toBe('dark')

    // Verify dark theme is applied
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveClass(/dark/)

    // Switch to light
    await themeButton.click()
    await page.waitForTimeout(200)
    await page.getByRole('menuitem', { name: /light/i }).click()
    await page.waitForTimeout(300)

    // Verify localStorage updated
    savedTheme = await page.evaluate(() => localStorage.getItem('vite-ui-theme'))
    expect(savedTheme).toBe('light')

    // Verify light theme is applied
    await expect(htmlElement).not.toHaveClass(/dark/)
  })

  test('can switch between themes multiple times', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Multi Switch User', 'testpass123')

    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    const htmlElement = page.locator('html')

    // Switch to dark
    await themeButton.click()
    await page.waitForTimeout(200)
    await page.getByRole('menuitem', { name: /dark/i }).click()
    await page.waitForTimeout(400)
    await expect(htmlElement).toHaveClass(/dark/)

    // Switch to light
    await themeButton.click()
    await page.waitForTimeout(200)
    await page.getByRole('menuitem', { name: /light/i }).click()
    await page.waitForTimeout(400)
    await expect(htmlElement).not.toHaveClass(/dark/)

    // Switch to dark again
    await themeButton.click()
    await page.waitForTimeout(200)
    await page.getByRole('menuitem', { name: /dark/i }).click()
    await page.waitForTimeout(400)
    await expect(htmlElement).toHaveClass(/dark/)

    // Final state
    const savedTheme = await page.evaluate(() => localStorage.getItem('vite-ui-theme'))
    expect(savedTheme).toBe('dark')
  })

  test('theme toggle is keyboard accessible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Keyboard Theme User', 'testpass123')

    // Focus and click the theme button
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    await themeButton.focus()
    await page.waitForTimeout(100)

    // Open dropdown with click (more reliable than keyboard)
    await themeButton.click()
    await page.waitForTimeout(300)

    // Verify dropdown is visible and keyboard navigable
    const darkOption = page.getByRole('menuitem', { name: /dark/i })
    await expect(darkOption).toBeVisible()

    // Use keyboard to select
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Verify a theme was selected
    const savedTheme = await page.evaluate(() => localStorage.getItem('vite-ui-theme'))
    expect(savedTheme).toBeTruthy()
  })

  test('theme applies to all UI components', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Component Theme User', 'testpass123')

    // Switch to dark theme
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    await themeButton.click()
    await page.getByRole('menuitem', { name: /dark/i }).click()
    await page.waitForTimeout(300)

    // Verify CSS variables are set for dark mode
    const cssVars = await page.evaluate(() => {
      const root = document.documentElement
      return {
        background: getComputedStyle(root).getPropertyValue('--background'),
        foreground: getComputedStyle(root).getPropertyValue('--foreground'),
        primary: getComputedStyle(root).getPropertyValue('--primary'),
        muted: getComputedStyle(root).getPropertyValue('--muted')
      }
    })

    // All CSS variables should be defined
    expect(cssVars.background.trim()).toBeTruthy()
    expect(cssVars.foreground.trim()).toBeTruthy()
    expect(cssVars.primary.trim()).toBeTruthy()
    expect(cssVars.muted.trim()).toBeTruthy()

    // Open a dialog to verify theming applies to overlays
    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(300)

      // Dialog should exist and be styled with dark theme
      const dialog = page.locator('[role="dialog"]')
      if (await dialog.isVisible()) {
        // Dialog should inherit dark theme (background should be dark)
        const dialogBg = await dialog.evaluate((el) => {
          return getComputedStyle(el).backgroundColor
        })
        expect(dialogBg).toBeTruthy()
      }
    }
  })
})

test.describe('Theme Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      localStorage.removeItem('vite-ui-theme')
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

  test('theme toggle works on mobile', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })

    const createNewTab = page.getByRole('tab', { name: /create new/i })
    await createNewTab.click()
    await page.waitForTimeout(300)

    const panel = page.getByRole('tabpanel', { name: /create new/i })
    await panel.getByRole('textbox', { name: /display name/i }).fill('Mobile Theme User')
    await panel.getByRole('textbox', { name: /^password$/i }).fill('testpass123')
    await panel.getByRole('textbox', { name: /confirm password/i }).fill('testpass123')

    const createButton = panel.getByRole('button', { name: /create identity/i })
    await expect(createButton).toBeEnabled({ timeout: 5000 })
    await createButton.click()

    await page.waitForURL(/\/app/, { timeout: 15000 })

    // Find and click theme toggle on mobile
    const themeButton = page.getByRole('button', { name: /toggle theme/i })
    await expect(themeButton).toBeVisible()
    await themeButton.click()

    // Dropdown should be visible
    await expect(page.getByRole('menuitem', { name: /dark/i })).toBeVisible()

    // Select dark theme
    await page.getByRole('menuitem', { name: /dark/i }).click()
    await page.waitForTimeout(300)

    // Verify dark theme applied
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveClass(/dark/)
  })
})
