/**
 * Visual Regression Testing Setup
 *
 * Configures Playwright for screenshot comparison testing.
 * Provides viewport definitions, threshold configuration,
 * and helper utilities for visual regression tests.
 *
 * Epic 82: Comprehensive Test Coverage
 */

import type { Page, PageScreenshotOptions } from '@playwright/test'

// ============== Viewport Definitions ==============

/**
 * Standard viewport sizes for responsive visual regression testing.
 * These map to the breakpoints used throughout the BuildIt UI.
 */
export const viewports = {
  mobile: { width: 375, height: 667, label: 'mobile' },
  tablet: { width: 768, height: 1024, label: 'tablet' },
  desktop: { width: 1280, height: 720, label: 'desktop' },
} as const

export type ViewportName = keyof typeof viewports
export type ViewportConfig = (typeof viewports)[ViewportName]

/**
 * All viewport names for iteration in parameterized tests.
 */
export const allViewports: ViewportName[] = ['mobile', 'tablet', 'desktop']

// ============== Theme Definitions ==============

/**
 * Theme variants to test for visual regression.
 * BuildIt supports light and dark themes via CSS class on <html>.
 */
export const themes = {
  dark: {
    label: 'dark',
    colorScheme: 'dark' as const,
    setupClass: 'dark',
  },
  light: {
    label: 'light',
    colorScheme: 'light' as const,
    setupClass: '',
  },
} as const

export type ThemeName = keyof typeof themes
export type ThemeConfig = (typeof themes)[ThemeName]

/**
 * All theme names for iteration in parameterized tests.
 */
export const allThemes: ThemeName[] = ['dark', 'light']

// ============== Screenshot Comparison Configuration ==============

/**
 * Default threshold for pixel-level comparison.
 * A value of 0.2 allows up to 20% pixel difference which
 * accounts for anti-aliasing and sub-pixel rendering differences
 * across platforms and CI environments.
 */
export const defaultPixelDiffThreshold = 0.2

/**
 * Maximum number of differing pixels allowed as a ratio of total pixels.
 * This provides a secondary check beyond per-pixel threshold.
 * 0.01 means at most 1% of pixels can differ.
 */
export const maxDiffPixelRatio = 0.01

/**
 * Playwright screenshot comparison options used across all visual tests.
 * These values balance catching real regressions against flaky diffs.
 */
export const screenshotCompareOptions = {
  /** Per-pixel color difference threshold (0-1). Higher = more lenient. */
  threshold: defaultPixelDiffThreshold,

  /** Maximum percentage of pixels that can differ (0-1). */
  maxDiffPixelRatio: maxDiffPixelRatio,

  /** Animations can cause flaky diffs, so disable them. */
  animations: 'disabled' as const,
}

/**
 * Default screenshot options applied when capturing screenshots.
 */
export const defaultScreenshotOptions: PageScreenshotOptions = {
  fullPage: false,
  animations: 'disabled',
}

// ============== Page Routes ==============

/**
 * Routes for the major pages in the BuildIt application.
 * These represent the pages that should have visual regression baselines.
 */
export const pageRoutes = {
  login: '/login',
  home: '/app',
  messages: '/app/messages',
  groups: '/app/groups',
  friends: '/app/friends',
  settings: '/app/settings',
  settingsProfile: '/app/settings/profile',
  settingsSecurity: '/app/settings/security',
  settingsPrivacy: '/app/settings/privacy',
  settingsNotifications: '/app/settings/notifications',
  settingsPreferences: '/app/settings/preferences',
} as const

export type PageRouteName = keyof typeof pageRoutes

// ============== Helper Functions ==============

/**
 * Generates a deterministic snapshot name from page, viewport, and theme.
 * Format: {page}-{viewport}-{theme}
 *
 * @example getSnapshotName('login', 'mobile', 'dark') => 'login-mobile-dark'
 */
export function getSnapshotName(
  page: string,
  viewport: ViewportName,
  theme: ThemeName,
): string {
  return `${page}-${viewport}-${theme}`
}

/**
 * Sets the viewport size on a Playwright page.
 */
export async function setViewport(
  page: Page,
  viewport: ViewportName,
): Promise<void> {
  const { width, height } = viewports[viewport]
  await page.setViewportSize({ width, height })
}

/**
 * Applies the specified theme to the page by setting the appropriate
 * class on the <html> element and updating localStorage.
 */
export async function applyTheme(
  page: Page,
  theme: ThemeName,
): Promise<void> {
  const config = themes[theme]

  await page.emulateMedia({ colorScheme: config.colorScheme })

  await page.evaluate(
    ({ themeName, className }) => {
      // Set localStorage (BuildIt persists theme here)
      localStorage.setItem('buildn-ui-theme', themeName)

      // Apply/remove dark class
      const html = document.documentElement
      if (className === 'dark') {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
    },
    { themeName: theme, className: config.setupClass },
  )

  // Allow theme transition to complete
  await page.waitForTimeout(200)
}

/**
 * Waits for the page to reach a stable state suitable for screenshot capture.
 * This includes waiting for:
 * - Network idle (no pending requests)
 * - Animations to complete
 * - Fonts to load
 * - Images to load
 */
export async function waitForVisualStability(page: Page): Promise<void> {
  // Wait for network to settle
  await page.waitForLoadState('networkidle').catch(() => {
    // networkidle can timeout on pages with persistent connections (WebSocket)
    // Fall back to domcontentloaded
  })

  // Wait for fonts to load
  await page.evaluate(() =>
    document.fonts.ready.then(() => true).catch(() => true),
  )

  // Disable CSS transitions/animations for deterministic screenshots
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  })

  // Allow a brief settle period for any remaining paint operations
  await page.waitForTimeout(300)
}

/**
 * Creates an identity on the login page for tests that need authentication.
 * Matches the pattern used in existing e2e tests (theme.spec.ts).
 */
export async function createTestIdentity(
  page: Page,
  name = 'Visual Test User',
  password = 'testpassword123',
): Promise<void> {
  const createNewTab = page.getByRole('tab', { name: /create new/i })
  await createNewTab.click()
  await page.waitForTimeout(300)

  const panel = page.getByRole('tabpanel', { name: /create new/i })
  await panel.getByRole('textbox', { name: /display name/i }).fill(name)
  await panel.getByRole('textbox', { name: /^password$/i }).fill(password)
  await panel
    .getByRole('textbox', { name: /confirm password/i })
    .fill(password)

  const createButton = panel.getByRole('button', {
    name: /create identity/i,
  })
  await createButton.click()

  await page.waitForURL(/\/app/, { timeout: 15000 })
}

/**
 * Clears all persistent state (IndexedDB, localStorage) for a clean test.
 * Should be called in beforeEach hooks.
 */
export async function clearPersistentState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.clear()
    const databases = await indexedDB.databases()
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name)
      }
    }
  })
}

/**
 * Masks dynamic content regions that change between test runs.
 * Elements matching these selectors will be replaced with solid-color
 * rectangles to prevent false positive diffs.
 *
 * Common dynamic elements:
 * - Timestamps
 * - User avatars (generated/random)
 * - Notification badges with counts
 * - Loading spinners
 */
export const dynamicContentSelectors = [
  '[data-testid="timestamp"]',
  '[data-testid="avatar"]',
  '[data-testid="notification-count"]',
  '.animate-spin',
  '.animate-pulse',
  '[role="progressbar"]',
]

/**
 * Masks dynamic content on the page before taking a screenshot.
 * Replaces elements matching dynamicContentSelectors with gray placeholders.
 */
export async function maskDynamicContent(page: Page): Promise<void> {
  await page.evaluate((selectors) => {
    for (const selector of selectors) {
      const elements = document.querySelectorAll<HTMLElement>(selector)
      elements.forEach((el) => {
        el.style.visibility = 'hidden'
      })
    }
  }, dynamicContentSelectors)
}
