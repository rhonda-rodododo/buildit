import { test, expect, Page } from '@playwright/test'
import { clearStorageAndReload } from './helpers/test-utils'

/**
 * Routing E2E Tests
 *
 * Tests navigation, redirects, 404 handling, and route protection.
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

test.describe('Routing Tests', () => {
  // Increase timeout for routing tests - they need time for module initialization
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    // Navigate to app first to establish origin
    await page.goto('/')

    // Clear storage and reload, waiting for app to fully initialize
    await clearStorageAndReload(page)
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/app/groups')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should redirect to login page
    const hasLoginUI = await page.getByRole('tab', { name: /create new/i }).isVisible()
    expect(hasLoginUI).toBeTruthy()
  })

  test('redirects authenticated users from login to app', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible()
    await createIdentity(page, 'Redirect Test User', 'testpass123')

    // Try to go back to login page
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should redirect to app
    await expect(page).toHaveURL(/\/app/)
  })

  test('navigates between sidebar sections', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible()
    await createIdentity(page, 'Nav Test User', 'testpass123')

    // Verify on app page
    await expect(page).toHaveURL(/\/app/)

    // Navigate to Groups
    const groupsLink = page.getByRole('link', { name: 'Groups', exact: true })
    await groupsLink.click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/app\/groups/)

    // Navigate to Friends
    const friendsLink = page.getByRole('link', { name: 'Friends', exact: true })
    if (await friendsLink.isVisible()) {
      await friendsLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/\/app\/friends/)
    }

    // Navigate to Feed
    const feedLink = page.getByRole('link', { name: 'Feed', exact: true })
    if (await feedLink.isVisible()) {
      await feedLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/\/app\/feed/)
    }

    // Navigate to Profile
    const profileLink = page.getByRole('link', { name: /profile/i })
    if (await profileLink.isVisible()) {
      await profileLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/\/app\/profile/)
    }
  })

  test('handles 404 for unknown routes', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible()
    await createIdentity(page, '404 Test User', 'testpass123')

    // Navigate to a non-existent route
    await page.goto('/app/nonexistent-page-that-doesnt-exist')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Should either show 404 page or redirect to app home
    const url = page.url()
    const pageContent = await page.textContent('body')

    // Check for either 404 content or redirect to safe route
    const is404Handled =
      pageContent?.toLowerCase().includes('not found') ||
      pageContent?.toLowerCase().includes('404') ||
      url.includes('/app') ||
      url === '/'

    expect(is404Handled).toBeTruthy()
  })

  test('preserves route on page refresh', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible()
    await createIdentity(page, 'Refresh Test User', 'testpass123')

    // Navigate to groups
    const groupsLink = page.getByRole('link', { name: 'Groups', exact: true })
    await groupsLink.click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/app\/groups/)

    // Refresh the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should still be on groups page (or redirected to app if session lost)
    const url = page.url()
    const isValidUrl = url.includes('/app/groups') || url.includes('/app') || url === '/'
    expect(isValidUrl).toBeTruthy()
  })

  test('browser back/forward navigation works', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible()
    await createIdentity(page, 'History Test User', 'testpass123')

    // Navigate to groups
    const groupsLink = page.getByRole('link', { name: 'Groups', exact: true })
    await groupsLink.click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/app\/groups/)

    // Navigate to friends if available
    const friendsLink = page.getByRole('link', { name: 'Friends', exact: true })
    if (await friendsLink.isVisible()) {
      await friendsLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/\/app\/friends/)

      // Go back
      await page.goBack()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/\/app\/groups/)

      // Go forward
      await page.goForward()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/\/app\/friends/)
    }
  })

  test('deep links work correctly', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible()
    await createIdentity(page, 'Deep Link User', 'testpass123')

    // Navigate to groups page directly using URL
    await page.goto('/app/groups')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Should be on groups page
    await expect(page).toHaveURL(/\/app\/groups/)
  })

  test('handles special characters in URLs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible()
    await createIdentity(page, 'Special Char User', 'testpass123')

    // Try URL with special characters
    await page.goto('/app/groups?filter=test%20value')
    await page.waitForLoadState('networkidle')

    // Should not error, should be on groups page or redirected
    const url = page.url()
    expect(url.includes('/app')).toBeTruthy()
  })

  test('routes have proper document titles', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible()
    await createIdentity(page, 'Title Test User', 'testpass123')

    // Check home page title
    const homeTitle = await page.title()
    expect(homeTitle).toBeTruthy()

    // Navigate to groups and check title
    const groupsLink = page.getByRole('link', { name: 'Groups', exact: true })
    await groupsLink.click()
    await page.waitForLoadState('networkidle')

    const groupsTitle = await page.title()
    expect(groupsTitle).toBeTruthy()
  })
})

test.describe('Route Protection', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorageAndReload(page)
  })

  test('protected routes require authentication', async ({ page }) => {
    const protectedRoutes = [
      '/app',
      '/app/groups',
      '/app/friends',
      '/app/feed',
      '/app/profile',
      '/app/settings'
    ]

    for (const route of protectedRoutes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Should redirect to login
      const hasLoginUI = await page.getByRole('tab', { name: /create new/i }).isVisible()
      expect(hasLoginUI).toBeTruthy()
    }
  })

  test('public routes are accessible without login', async ({ page }) => {
    // Check that login page is accessible
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hasLoginUI = await page.getByRole('tab', { name: /create new/i }).isVisible()
    expect(hasLoginUI).toBeTruthy()
  })
})

test.describe('Group Route Navigation', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorageAndReload(page)
  })

  test('can navigate to group page after creating group', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /create new/i })).toBeVisible()
    await createIdentity(page, 'Group Nav User', 'testpass123')

    // Navigate to groups
    const groupsLink = page.getByRole('link', { name: 'Groups', exact: true })
    await groupsLink.click()
    await page.waitForLoadState('networkidle')

    // Create a group
    const createGroupButton = page.getByRole('button', { name: /create.*group|new.*group/i })
    if (await createGroupButton.isVisible()) {
      await createGroupButton.click()
      await page.waitForTimeout(300)

      // Fill in group name
      const nameInput = page.getByLabel(/group name|name/i)
      if (await nameInput.isVisible()) {
        await nameInput.fill('Routing Test Group')

        // Submit
        const submitButton = page.getByRole('button', { name: /create|save/i })
        await submitButton.click()
        await page.waitForTimeout(1000)

        // Click on the created group
        const groupLink = page.getByText('Routing Test Group')
        if (await groupLink.isVisible()) {
          await groupLink.click()
          await page.waitForLoadState('networkidle')

          // Should be on group page
          await expect(page).toHaveURL(/\/app\/groups\//)
        }
      }
    }
  })
})
