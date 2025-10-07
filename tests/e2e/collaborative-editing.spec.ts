/**
 * E2E Tests for Real-Time Collaborative Editing
 *
 * Tests CRDT-based collaboration with multiple users editing simultaneously
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

// Test configuration
const BASE_URL = 'http://localhost:5173'
const TEST_GROUP_NAME = 'Test Collaboration Group'
const TEST_DOCUMENT_TITLE = 'Collaborative Document'

/**
 * Helper: Create a new identity and login
 */
async function createAndLoginIdentity(page: Page, name: string) {
  await page.goto(`${BASE_URL}/`)

  // Create new identity
  await page.click('text=Get Started')
  await page.fill('input[placeholder="Enter your name"]', name)
  await page.click('button:has-text("Create Identity")')

  // Wait for redirect to app
  await page.waitForURL(`${BASE_URL}/app/feed`)
}

/**
 * Helper: Create a new group
 */
async function createGroup(page: Page, groupName: string) {
  await page.click('button:has-text("New Group")')
  await page.fill('input[name="name"]', groupName)
  await page.fill('textarea[name="description"]', 'A group for testing collaboration')
  await page.click('button[type="submit"]')

  // Wait for group to be created
  await page.waitForSelector(`text=${groupName}`)

  // Click on the group to enter it
  await page.click(`text=${groupName}`)
}

/**
 * Helper: Navigate to Documents module
 */
async function navigateToDocuments(page: Page) {
  await page.click('a[href*="documents"]')
  await page.waitForURL(/.*documents/)
}

/**
 * Helper: Create a new document
 */
async function createDocument(page: Page, title: string) {
  await page.click('button:has-text("New Document")')
  await page.fill('input[name="title"]', title)
  await page.click('button:has-text("Create")')

  // Wait for editor to load
  await page.waitForSelector('.ProseMirror')
}

/**
 * Helper: Enable collaboration for current document
 */
async function enableCollaboration(page: Page) {
  await page.click('button:has-text("Enable Collaboration")')

  // Wait for collaboration status indicator
  await page.waitForSelector('text=Connected')
}

/**
 * Helper: Type in the editor
 */
async function typeInEditor(page: Page, text: string) {
  const editor = page.locator('.ProseMirror')
  await editor.click()
  await editor.type(text)
}

/**
 * Helper: Get editor content
 */
async function getEditorContent(page: Page): Promise<string> {
  const editor = page.locator('.ProseMirror')
  return await editor.innerText()
}

/**
 * Test 1: Two users can collaborate on the same document
 */
test('two users editing same document simultaneously', async ({ browser }) => {
  // Create two browser contexts (two different users)
  const context1 = await browser.newContext()
  const context2 = await browser.newContext()

  const user1Page = await context1.newPage()
  const user2Page = await context2.newPage()

  try {
    // User 1: Create identity and group
    await createAndLoginIdentity(user1Page, 'Alice')
    await createGroup(user1Page, TEST_GROUP_NAME)
    await navigateToDocuments(user1Page)
    await createDocument(user1Page, TEST_DOCUMENT_TITLE)
    await enableCollaboration(user1Page)

    // Get group invite link (in real implementation)
    // For now, user 2 creates their own identity and joins same group

    // User 2: Create identity and join
    await createAndLoginIdentity(user2Page, 'Bob')
    // In real test: Use invite link to join group
    // For now: Create same group name (simulating join)
    await createGroup(user2Page, TEST_GROUP_NAME)
    await navigateToDocuments(user2Page)

    // User 2: Open the same document
    await user2Page.click(`text=${TEST_DOCUMENT_TITLE}`)
    await enableCollaboration(user2Page)

    // Wait for both users to connect
    await expect(user1Page.locator('text=Connected')).toBeVisible()
    await expect(user2Page.locator('text=Connected')).toBeVisible()

    // User 1 types
    await typeInEditor(user1Page, 'Hello from Alice!')

    // Wait a bit for sync
    await user1Page.waitForTimeout(1000)

    // User 2 should see Alice's text
    const user2Content = await getEditorContent(user2Page)
    expect(user2Content).toContain('Hello from Alice!')

    // User 2 types
    await typeInEditor(user2Page, '\nHello from Bob!')

    // Wait for sync
    await user2Page.waitForTimeout(1000)

    // User 1 should see Bob's text
    const user1Content = await getEditorContent(user1Page)
    expect(user1Content).toContain('Hello from Alice!')
    expect(user1Content).toContain('Hello from Bob!')

    // Both users should see 2 active participants
    await expect(user1Page.locator('text=2 active')).toBeVisible()
    await expect(user2Page.locator('text=2 active')).toBeVisible()

  } finally {
    await context1.close()
    await context2.close()
  }
})

/**
 * Test 2: Conflict-free merging of concurrent edits
 */
test('conflict-free merging of concurrent edits', async ({ browser }) => {
  const context1 = await browser.newContext()
  const context2 = await browser.newContext()

  const user1Page = await context1.newPage()
  const user2Page = await context2.newPage()

  try {
    // Setup both users
    await createAndLoginIdentity(user1Page, 'User1')
    await createGroup(user1Page, 'CRDT Test Group')
    await navigateToDocuments(user1Page)
    await createDocument(user1Page, 'Conflict Test')
    await enableCollaboration(user1Page)

    await createAndLoginIdentity(user2Page, 'User2')
    await createGroup(user2Page, 'CRDT Test Group')
    await navigateToDocuments(user2Page)
    await user2Page.click('text=Conflict Test')
    await enableCollaboration(user2Page)

    // Both users type at the same time
    await Promise.all([
      typeInEditor(user1Page, 'User1 edit'),
      typeInEditor(user2Page, 'User2 edit'),
    ])

    // Wait for sync
    await user1Page.waitForTimeout(2000)

    // Both users should see both edits (order may vary due to CRDT)
    const content1 = await getEditorContent(user1Page)
    const content2 = await getEditorContent(user2Page)

    expect(content1).toContain('User1 edit')
    expect(content1).toContain('User2 edit')
    expect(content2).toContain('User1 edit')
    expect(content2).toContain('User2 edit')

    // Content should be identical (eventual consistency)
    expect(content1).toBe(content2)

  } finally {
    await context1.close()
    await context2.close()
  }
})

/**
 * Test 3: Offline editing and sync when reconnected
 */
test('offline editing syncs when reconnected', async ({ browser }) => {
  const context1 = await browser.newContext()
  const user1Page = await context1.newPage()

  try {
    await createAndLoginIdentity(user1Page, 'Offline User')
    await createGroup(user1Page, 'Offline Test Group')
    await navigateToDocuments(user1Page)
    await createDocument(user1Page, 'Offline Test')
    await enableCollaboration(user1Page)

    // Wait for connection
    await expect(user1Page.locator('text=Connected')).toBeVisible()

    // Simulate going offline
    await context1.setOffline(true)

    // Wait for disconnected indicator
    await expect(user1Page.locator('text=Connecting')).toBeVisible({ timeout: 5000 })

    // Type while offline
    await typeInEditor(user1Page, 'Edited while offline')

    // Content should be saved locally
    const offlineContent = await getEditorContent(user1Page)
    expect(offlineContent).toContain('Edited while offline')

    // Go back online
    await context1.setOffline(false)

    // Should reconnect
    await expect(user1Page.locator('text=Connected')).toBeVisible({ timeout: 10000 })

    // Synced indicator should appear
    await expect(user1Page.locator('text=Synced')).toBeVisible({ timeout: 5000 })

    // Content should still be there
    const onlineContent = await getEditorContent(user1Page)
    expect(onlineContent).toContain('Edited while offline')

  } finally {
    await context1.close()
  }
})

/**
 * Test 4: Cursor presence and awareness
 */
test('shows participant cursors and presence', async ({ browser }) => {
  const context1 = await browser.newContext()
  const context2 = await browser.newContext()

  const user1Page = await context1.newPage()
  const user2Page = await context2.newPage()

  try {
    // Setup both users
    await createAndLoginIdentity(user1Page, 'Alice')
    await createGroup(user1Page, 'Presence Test')
    await navigateToDocuments(user1Page)
    await createDocument(user1Page, 'Presence Doc')
    await enableCollaboration(user1Page)

    await createAndLoginIdentity(user2Page, 'Bob')
    await createGroup(user2Page, 'Presence Test')
    await navigateToDocuments(user2Page)
    await user2Page.click('text=Presence Doc')
    await enableCollaboration(user2Page)

    // Wait for connection
    await user1Page.waitForTimeout(2000)

    // Check participant avatars are shown
    const user1Avatars = user1Page.locator('[title="Bob"]')
    await expect(user1Avatars).toBeVisible()

    const user2Avatars = user2Page.locator('[title="Alice"]')
    await expect(user2Avatars).toBeVisible()

    // Check active participant count
    await expect(user1Page.locator('text=2 active')).toBeVisible()
    await expect(user2Page.locator('text=2 active')).toBeVisible()

  } finally {
    await context1.close()
    await context2.close()
  }
})

/**
 * Test 5: Encrypted sync (relays can't read content)
 */
test('CRDT updates are encrypted', async ({ browser }) => {
  const context1 = await browser.newContext()
  const user1Page = await context1.newPage()

  try {
    // Setup
    await createAndLoginIdentity(user1Page, 'Security Test User')
    await createGroup(user1Page, 'Security Test')
    await navigateToDocuments(user1Page)
    await createDocument(user1Page, 'Secure Doc')
    await enableCollaboration(user1Page)

    // Intercept network requests to check encryption
    const encryptedRequests: any[] = []

    user1Page.on('request', (request) => {
      if (request.url().includes('relay') || request.method() === 'POST') {
        encryptedRequests.push({
          url: request.url(),
          postData: request.postData(),
        })
      }
    })

    // Type sensitive content
    await typeInEditor(user1Page, 'This is secret content that should be encrypted!')

    // Wait for network activity
    await user1Page.waitForTimeout(2000)

    // Check that requests don't contain plaintext
    for (const req of encryptedRequests) {
      const postData = req.postData || ''
      // Should NOT contain the plain text
      expect(postData).not.toContain('This is secret content')
      // Should contain encrypted data markers (NIP-17 event kinds)
      if (postData.includes('"kind"')) {
        const jsonData = JSON.parse(postData)
        // CRDT sync events should use kind 9001
        if (jsonData.kind === 9001 || jsonData.kind === 1059) {
          // Content should be encrypted (not readable)
          expect(jsonData.content).not.toContain('secret content')
        }
      }
    }

  } finally {
    await context1.close()
  }
})

/**
 * Test 6: PDF export works
 */
test('can export document to PDF', async ({ page }) => {
  await createAndLoginIdentity(page, 'PDF Test User')
  await createGroup(page, 'PDF Test Group')
  await navigateToDocuments(page)
  await createDocument(page, 'PDF Export Test')

  // Add content
  await typeInEditor(page, 'This document will be exported to PDF')

  // Trigger PDF export
  const downloadPromise = page.waitForEvent('download')
  await page.click('button:has-text("Export")')
  await page.click('text=PDF')

  // Check that download was triggered
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('.pdf')
})
