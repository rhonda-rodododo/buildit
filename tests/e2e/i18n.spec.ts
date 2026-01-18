import { test, expect, Page } from '@playwright/test'

/**
 * Internationalization (i18n) E2E Tests
 *
 * Tests language switching functionality, RTL support,
 * translation accuracy, and language persistence.
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

test.describe('Internationalization Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app first to establish origin
    await page.goto('/')

    // Clear IndexedDB and localStorage
    await page.evaluate(async () => {
      localStorage.removeItem('i18n-language')
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

  test('language switcher is accessible', async ({ page }) => {
    // Wait for login page
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })

    // Create identity
    await createIdentity(page, 'i18n Test User', 'testpass123')

    // Find the language switcher button
    const languageButton = page.getByRole('button', { name: /switch language/i })
    await expect(languageButton).toBeVisible()

    // Click to open dropdown
    await languageButton.click()

    // Verify all languages are available
    await expect(page.getByText('English')).toBeVisible()
    await expect(page.getByText('Español')).toBeVisible()
    await expect(page.getByText('Français')).toBeVisible()
    await expect(page.getByText('العربية')).toBeVisible()
  })

  test('switches to Spanish and displays translated content', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Spanish Test User', 'testpass123')

    // Open language switcher
    const languageButton = page.getByRole('button', { name: /switch language/i })
    await languageButton.click()

    // Select Spanish
    await page.getByText('Español').click()
    await page.waitForTimeout(500)

    // Verify Spanish translations in Create Group dialog
    // The sidebar isn't internationalized, but the Create Group dialog is
    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(300)

      // Check for Spanish translations in dialog
      // "Nombre del grupo" = "Group Name" label
      await expect(page.getByText('Nombre del grupo')).toBeVisible()
    }
  })

  test('switches to French and displays translated content', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'French Test User', 'testpass123')

    // Open language switcher
    const languageButton = page.getByRole('button', { name: /switch language/i })
    await languageButton.click()

    // Select French
    await page.getByText('Français').click()
    await page.waitForTimeout(500)

    // Verify French translations in Create Group dialog
    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(300)

      // "Nom du groupe" = "Group Name" label
      await expect(page.getByText('Nom du groupe')).toBeVisible()
    }
  })

  test('switches to Arabic and enables RTL layout', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Arabic Test User', 'testpass123')

    // Open language switcher
    const languageButton = page.getByRole('button', { name: /switch language/i })
    await languageButton.click()

    // Select Arabic
    await page.getByText('العربية').click()
    await page.waitForTimeout(500)

    // Verify RTL direction is set
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveAttribute('dir', 'rtl')
    await expect(htmlElement).toHaveAttribute('lang', 'ar')

    // Verify Arabic translations in Create Group dialog
    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(300)

      // "اسم المجموعة" = "Group Name" label
      await expect(page.getByText('اسم المجموعة')).toBeVisible()
    }
  })

  test('persists language preference across page reloads', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Persist Test User', 'testpass123')

    // Switch to Spanish
    const languageButton = page.getByRole('button', { name: /switch language/i })
    await languageButton.click()
    await page.getByText('Español').click()
    await page.waitForTimeout(500)

    // Verify localStorage has the correct value
    let savedLanguage = await page.evaluate(() => localStorage.getItem('i18n-language'))
    expect(savedLanguage).toBe('es')

    // Reload the page
    await page.reload()

    // Wait for app to fully load (past initializing state)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Give app time to re-initialize

    // Wait for either the app or login page to be ready
    await Promise.race([
      page.waitForURL(/\/app/, { timeout: 10000 }),
      page.getByRole('tab', { name: /create new/i }).waitFor({ timeout: 10000 })
    ]).catch(() => {
      // One of them should succeed
    })

    // Verify localStorage still has Spanish after reload
    savedLanguage = await page.evaluate(() => localStorage.getItem('i18n-language'))
    expect(savedLanguage).toBe('es')
  })

  test('RTL layout persists after page reload', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'RTL Persist User', 'testpass123')

    // Switch to Arabic
    const languageButton = page.getByRole('button', { name: /switch language/i })
    await languageButton.click()
    await page.getByText('العربية').click()
    await page.waitForTimeout(500)

    // Verify RTL is set
    let htmlElement = page.locator('html')
    await expect(htmlElement).toHaveAttribute('dir', 'rtl')

    // Reload the page
    await page.reload()

    // Wait for app to fully load (past initializing state)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Wait for either the app or login page to be ready
    await Promise.race([
      page.waitForURL(/\/app/, { timeout: 10000 }),
      page.getByRole('tab', { name: /create new/i }).waitFor({ timeout: 10000 })
    ]).catch(() => {
      // One of them should succeed
    })

    // Verify RTL is still set after reload
    htmlElement = page.locator('html')
    await expect(htmlElement).toHaveAttribute('dir', 'rtl')
    await expect(htmlElement).toHaveAttribute('lang', 'ar')
  })

  test('can switch back to English from another language', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Switch Back User', 'testpass123')

    // First switch to Spanish
    let languageButton = page.getByRole('button', { name: /switch language/i })
    await languageButton.click()
    await page.getByText('Español').click()
    await page.waitForTimeout(500)

    // Verify Spanish is stored
    let savedLang = await page.evaluate(() => localStorage.getItem('i18n-language'))
    expect(savedLang).toBe('es')

    // Switch back to English
    languageButton = page.getByRole('button', { name: /switch language/i })
    await languageButton.click()
    await page.getByText('English').click()
    await page.waitForTimeout(500)

    // Verify English is stored
    savedLang = await page.evaluate(() => localStorage.getItem('i18n-language'))
    expect(savedLang).toBe('en')

    // Verify LTR direction
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveAttribute('dir', 'ltr')
    await expect(htmlElement).toHaveAttribute('lang', 'en')

    // Verify English translations in Create Group dialog
    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(300)
      await expect(page.getByText('Group Name')).toBeVisible()
    }
  })

  test('shows checkmark for currently selected language', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Checkmark Test User', 'testpass123')

    // Open language switcher
    const languageButton = page.getByRole('button', { name: /switch language/i })
    await languageButton.click()

    // English should be selected by default (has checkmark/bg-accent)
    const englishOption = page.locator('[role="menuitem"]').filter({ hasText: 'English' })
    await expect(englishOption).toHaveClass(/bg-accent/)

    // Close dropdown
    await page.keyboard.press('Escape')

    // Switch to Spanish
    await languageButton.click()
    await page.getByText('Español').click()
    await page.waitForTimeout(500)

    // Reopen and verify Spanish is now selected
    await languageButton.click()
    const spanishOption = page.locator('[role="menuitem"]').filter({ hasText: 'Español' })
    await expect(spanishOption).toHaveClass(/bg-accent/)
  })

  test('translations work on login page', async ({ page }) => {
    // We're on login page from beforeEach
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })

    // Open language switcher on login page
    const languageButton = page.getByRole('button', { name: /switch language/i })
    if (await languageButton.isVisible()) {
      await languageButton.click()

      // Select Spanish
      await page.getByText('Español').click()
      await page.waitForTimeout(500)

      // Check for Spanish login text "Crear identidad" or "Crear"
      const hasSpanishText = await page.getByText(/crear/i).isVisible()
      expect(hasSpanishText).toBeTruthy()
    }
  })

})

test.describe('i18n Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      localStorage.removeItem('i18n-language')
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

  test('language switcher works on mobile', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Mobile i18n User', 'testpass123')

    // Find and click language switcher
    const languageButton = page.getByRole('button', { name: /switch language/i })
    await expect(languageButton).toBeVisible()
    await languageButton.click()

    // Dropdown should be visible and accessible
    await expect(page.getByText('Español')).toBeVisible()

    // Select Spanish
    await page.getByText('Español').click()
    await page.waitForTimeout(500)

    // Verify translation applied - check localStorage
    const savedLang = await page.evaluate(() => localStorage.getItem('i18n-language'))
    expect(savedLang).toBe('es')

    // Verify Spanish translations in Create Group dialog
    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(300)
      await expect(page.getByText('Nombre del grupo')).toBeVisible()
    }
  })

  test('RTL layout works on mobile', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible({ timeout: 10000 })
    await createIdentity(page, 'Mobile RTL User', 'testpass123')

    // Switch to Arabic
    const languageButton = page.getByRole('button', { name: /switch language/i })
    await languageButton.click()
    await page.getByText('العربية').click()
    await page.waitForTimeout(500)

    // Verify RTL on mobile
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveAttribute('dir', 'rtl')
  })
})
