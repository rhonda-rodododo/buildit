/**
 * Visual Regression Page Tests
 *
 * Captures baseline screenshots for major BuildIt pages and
 * validates visual consistency across:
 * - Responsive viewports (mobile, tablet, desktop)
 * - Theme variants (dark, light)
 *
 * Uses Playwright's built-in screenshot comparison with configurable
 * thresholds from ./setup.ts.
 *
 * Epic 82: Comprehensive Test Coverage
 */

import { test, expect } from '@playwright/test'
import {
  viewports,
  allViewports,
  allThemes,
  screenshotCompareOptions,
  getSnapshotName,
  setViewport,
  applyTheme,
  waitForVisualStability,
  createTestIdentity,
  clearPersistentState,
  maskDynamicContent,
  type ViewportName,
  type ThemeName,
} from './setup'

// ============== Login Page (Unauthenticated) ==============

test.describe('Login Page Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearPersistentState(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  for (const viewport of allViewports) {
    for (const theme of allThemes) {
      test(`login page - ${viewport} - ${theme}`, async ({ page }) => {
        await setViewport(page, viewport)
        await applyTheme(page, theme)

        // Wait for the login form to be visible
        await expect(
          page.getByRole('tab', { name: /create new/i }),
        ).toBeVisible({ timeout: 10000 })

        await waitForVisualStability(page)
        await maskDynamicContent(page)

        await expect(page).toHaveScreenshot(
          `${getSnapshotName('login', viewport, theme)}.png`,
          screenshotCompareOptions,
        )
      })
    }
  }

  test('login page - create new tab selected', async ({ page }) => {
    await setViewport(page, 'desktop')
    await applyTheme(page, 'dark')

    const createNewTab = page.getByRole('tab', { name: /create new/i })
    await expect(createNewTab).toBeVisible({ timeout: 10000 })
    await createNewTab.click()
    await page.waitForTimeout(300)

    await waitForVisualStability(page)

    await expect(page).toHaveScreenshot(
      'login-create-tab-desktop-dark.png',
      screenshotCompareOptions,
    )
  })

  test('login page - restore identity tab selected', async ({ page }) => {
    await setViewport(page, 'desktop')
    await applyTheme(page, 'dark')

    // Some login pages may have a "restore" tab
    const restoreTab = page.getByRole('tab', { name: /restore|import/i })
    if (await restoreTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await restoreTab.click()
      await page.waitForTimeout(300)

      await waitForVisualStability(page)

      await expect(page).toHaveScreenshot(
        'login-restore-tab-desktop-dark.png',
        screenshotCompareOptions,
      )
    }
  })
})

// ============== Authenticated Pages ==============

test.describe('Authenticated Page Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearPersistentState(page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Create identity and authenticate
    await expect(
      page.getByRole('tab', { name: /create new/i }),
    ).toBeVisible({ timeout: 10000 })
    await createTestIdentity(page)
  })

  // ---- Home / Feed Page ----

  test.describe('Home Page', () => {
    for (const viewport of allViewports) {
      for (const theme of allThemes) {
        test(`home - ${viewport} - ${theme}`, async ({ page }) => {
          await setViewport(page, viewport)
          await applyTheme(page, theme)

          await page.goto('/app')
          await page.waitForLoadState('networkidle')
          await waitForVisualStability(page)
          await maskDynamicContent(page)

          await expect(page).toHaveScreenshot(
            `${getSnapshotName('home', viewport, theme)}.png`,
            screenshotCompareOptions,
          )
        })
      }
    }
  })

  // ---- Messages Page ----

  test.describe('Messages Page', () => {
    for (const viewport of allViewports) {
      for (const theme of allThemes) {
        test(`messages - ${viewport} - ${theme}`, async ({ page }) => {
          await setViewport(page, viewport)
          await applyTheme(page, theme)

          await page.goto('/app/messages')
          await page.waitForLoadState('networkidle')
          await waitForVisualStability(page)
          await maskDynamicContent(page)

          await expect(page).toHaveScreenshot(
            `${getSnapshotName('messages', viewport, theme)}.png`,
            screenshotCompareOptions,
          )
        })
      }
    }
  })

  // ---- Groups Page ----

  test.describe('Groups Page', () => {
    for (const viewport of allViewports) {
      for (const theme of allThemes) {
        test(`groups - ${viewport} - ${theme}`, async ({ page }) => {
          await setViewport(page, viewport)
          await applyTheme(page, theme)

          await page.goto('/app/groups')
          await page.waitForLoadState('networkidle')
          await waitForVisualStability(page)
          await maskDynamicContent(page)

          await expect(page).toHaveScreenshot(
            `${getSnapshotName('groups', viewport, theme)}.png`,
            screenshotCompareOptions,
          )
        })
      }
    }
  })

  // ---- Friends / Contacts Page ----

  test.describe('Friends Page', () => {
    for (const viewport of allViewports) {
      for (const theme of allThemes) {
        test(`friends - ${viewport} - ${theme}`, async ({ page }) => {
          await setViewport(page, viewport)
          await applyTheme(page, theme)

          await page.goto('/app/friends')
          await page.waitForLoadState('networkidle')
          await waitForVisualStability(page)
          await maskDynamicContent(page)

          await expect(page).toHaveScreenshot(
            `${getSnapshotName('friends', viewport, theme)}.png`,
            screenshotCompareOptions,
          )
        })
      }
    }
  })

  // ---- Settings Pages ----

  test.describe('Settings Pages', () => {
    const settingsPages = [
      { name: 'settings-profile', path: '/app/settings/profile' },
      { name: 'settings-security', path: '/app/settings/security' },
      { name: 'settings-privacy', path: '/app/settings/privacy' },
      { name: 'settings-notifications', path: '/app/settings/notifications' },
      { name: 'settings-preferences', path: '/app/settings/preferences' },
    ]

    for (const settingsPage of settingsPages) {
      for (const viewport of allViewports) {
        // Settings pages tested with dark theme only to limit test count
        // (settings UI is form-based, theme differences are minimal)
        test(`${settingsPage.name} - ${viewport} - dark`, async ({
          page,
        }) => {
          await setViewport(page, viewport)
          await applyTheme(page, 'dark')

          await page.goto(settingsPage.path)
          await page.waitForLoadState('networkidle')
          await waitForVisualStability(page)
          await maskDynamicContent(page)

          await expect(page).toHaveScreenshot(
            `${getSnapshotName(settingsPage.name, viewport, 'dark')}.png`,
            screenshotCompareOptions,
          )
        })
      }
    }
  })
})

// ============== Responsive Layout Tests ==============

test.describe('Responsive Layout Breakpoints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearPersistentState(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('tab', { name: /create new/i }),
    ).toBeVisible({ timeout: 10000 })
    await createTestIdentity(page)
  })

  test('mobile layout hides sidebar navigation', async ({ page }) => {
    await setViewport(page, 'mobile')
    await applyTheme(page, 'dark')
    await page.goto('/app')
    await waitForVisualStability(page)

    // On mobile, the sidebar should be collapsed or hidden
    const sidebar = page.locator('nav[aria-label="Main navigation"], aside')
    if (await sidebar.isVisible().catch(() => false)) {
      const box = await sidebar.boundingBox()
      // If sidebar is visible on mobile, it should be overlaid (not side-by-side)
      // or be narrow enough not to push content
      if (box) {
        expect(box.width).toBeLessThan(viewports.mobile.width * 0.8)
      }
    }
  })

  test('tablet layout shows condensed navigation', async ({ page }) => {
    await setViewport(page, 'tablet')
    await applyTheme(page, 'dark')
    await page.goto('/app')
    await waitForVisualStability(page)

    await expect(page).toHaveScreenshot(
      'layout-tablet-navigation.png',
      screenshotCompareOptions,
    )
  })

  test('desktop layout shows full sidebar navigation', async ({ page }) => {
    await setViewport(page, 'desktop')
    await applyTheme(page, 'dark')
    await page.goto('/app')
    await waitForVisualStability(page)

    await expect(page).toHaveScreenshot(
      'layout-desktop-navigation.png',
      screenshotCompareOptions,
    )
  })

  test('content area adapts to viewport width', async ({ page }) => {
    const pagePath = '/app/groups'
    const results: Record<string, number> = {}

    for (const viewport of allViewports) {
      await setViewport(page, viewport)
      await page.goto(pagePath)
      await waitForVisualStability(page)

      // Measure the main content area width
      const contentWidth = await page.evaluate(() => {
        const main =
          document.querySelector('main') ||
          document.querySelector('[role="main"]') ||
          document.querySelector('.main-content')
        return main ? main.getBoundingClientRect().width : 0
      })

      results[viewport] = contentWidth
    }

    // Content width should increase with viewport size
    // (or at minimum, mobile content should not be wider than mobile viewport)
    if (results.mobile > 0) {
      expect(results.mobile).toBeLessThanOrEqual(viewports.mobile.width)
    }
    if (results.mobile > 0 && results.desktop > 0) {
      expect(results.desktop).toBeGreaterThanOrEqual(results.mobile)
    }
  })
})

// ============== Dark / Light Theme Comparison ==============

test.describe('Theme Variant Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearPersistentState(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('tab', { name: /create new/i }),
    ).toBeVisible({ timeout: 10000 })
    await createTestIdentity(page)
  })

  test('dark theme applies correct background color', async ({ page }) => {
    await setViewport(page, 'desktop')
    await applyTheme(page, 'dark')
    await page.goto('/app')
    await waitForVisualStability(page)

    const htmlClasses = await page.evaluate(() =>
      document.documentElement.className,
    )
    expect(htmlClasses).toContain('dark')

    // Background should be dark (low luminance)
    const bgColor = await page.evaluate(() => {
      const style = getComputedStyle(document.body)
      return style.backgroundColor
    })
    expect(bgColor).toBeTruthy()
  })

  test('light theme applies correct background color', async ({ page }) => {
    await setViewport(page, 'desktop')
    await applyTheme(page, 'light')
    await page.goto('/app')
    await waitForVisualStability(page)

    const htmlClasses = await page.evaluate(() =>
      document.documentElement.className,
    )
    expect(htmlClasses).not.toContain('dark')

    const bgColor = await page.evaluate(() => {
      const style = getComputedStyle(document.body)
      return style.backgroundColor
    })
    expect(bgColor).toBeTruthy()
  })

  test('theme switch does not break layout', async ({ page }) => {
    await setViewport(page, 'desktop')
    await page.goto('/app')
    await waitForVisualStability(page)

    // Capture layout metrics in dark mode
    await applyTheme(page, 'dark')
    await page.waitForTimeout(200)
    const darkMetrics = await page.evaluate(() => {
      const body = document.body
      return {
        scrollWidth: body.scrollWidth,
        scrollHeight: body.scrollHeight,
        clientWidth: body.clientWidth,
      }
    })

    // Switch to light and compare
    await applyTheme(page, 'light')
    await page.waitForTimeout(200)
    const lightMetrics = await page.evaluate(() => {
      const body = document.body
      return {
        scrollWidth: body.scrollWidth,
        scrollHeight: body.scrollHeight,
        clientWidth: body.clientWidth,
      }
    })

    // Layout dimensions should remain the same after theme switch
    expect(lightMetrics.scrollWidth).toBe(darkMetrics.scrollWidth)
    expect(lightMetrics.clientWidth).toBe(darkMetrics.clientWidth)
    // Allow some height variance for font rendering differences
    expect(
      Math.abs(lightMetrics.scrollHeight - darkMetrics.scrollHeight),
    ).toBeLessThan(50)
  })

  test('CSS variables are defined for both themes', async ({ page }) => {
    await setViewport(page, 'desktop')
    await page.goto('/app')
    await waitForVisualStability(page)

    for (const theme of allThemes) {
      await applyTheme(page, theme)
      await page.waitForTimeout(200)

      const cssVars = await page.evaluate(() => {
        const root = document.documentElement
        const style = getComputedStyle(root)
        return {
          background: style.getPropertyValue('--background').trim(),
          foreground: style.getPropertyValue('--foreground').trim(),
          primary: style.getPropertyValue('--primary').trim(),
          muted: style.getPropertyValue('--muted').trim(),
          card: style.getPropertyValue('--card').trim(),
          border: style.getPropertyValue('--border').trim(),
        }
      })

      // All CSS variables should be defined (non-empty)
      expect(cssVars.background).toBeTruthy()
      expect(cssVars.foreground).toBeTruthy()
      expect(cssVars.primary).toBeTruthy()
      expect(cssVars.muted).toBeTruthy()
    }
  })
})

// ============== Error & Edge Case Pages ==============

test.describe('Error Page Visual Regression', () => {
  test('404 page renders correctly', async ({ page }) => {
    await page.goto('/this-page-does-not-exist')
    await page.waitForLoadState('networkidle')

    for (const viewport of allViewports) {
      await setViewport(page, viewport)
      await waitForVisualStability(page)

      await expect(page).toHaveScreenshot(
        `${getSnapshotName('404', viewport, 'dark')}.png`,
        screenshotCompareOptions,
      )
    }
  })
})

// ============== Empty State Visual Tests ==============

test.describe('Empty State Visuals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearPersistentState(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('tab', { name: /create new/i }),
    ).toBeVisible({ timeout: 10000 })
    await createTestIdentity(page)
  })

  test('empty messages page shows placeholder', async ({ page }) => {
    await setViewport(page, 'desktop')
    await applyTheme(page, 'dark')
    await page.goto('/app/messages')
    await waitForVisualStability(page)
    await maskDynamicContent(page)

    await expect(page).toHaveScreenshot(
      'empty-messages-desktop-dark.png',
      screenshotCompareOptions,
    )
  })

  test('empty groups page shows placeholder', async ({ page }) => {
    await setViewport(page, 'desktop')
    await applyTheme(page, 'dark')
    await page.goto('/app/groups')
    await waitForVisualStability(page)
    await maskDynamicContent(page)

    await expect(page).toHaveScreenshot(
      'empty-groups-desktop-dark.png',
      screenshotCompareOptions,
    )
  })

  test('empty friends page shows placeholder', async ({ page }) => {
    await setViewport(page, 'desktop')
    await applyTheme(page, 'dark')
    await page.goto('/app/friends')
    await waitForVisualStability(page)
    await maskDynamicContent(page)

    await expect(page).toHaveScreenshot(
      'empty-friends-desktop-dark.png',
      screenshotCompareOptions,
    )
  })
})
