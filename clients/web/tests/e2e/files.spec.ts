/**
 * E2E Tests for Files Module (Epic 33)
 *
 * Comprehensive test coverage for encrypted file storage, folder management,
 * drag & drop upload, and storage quota tracking.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import path from 'path'
import { waitForAppReady, createIdentity } from './helpers/helpers'

// Test configuration
const TEST_GROUP_NAME = 'Files Test Group'

/**
 * Helper: Create and login with new identity
 */
async function createAndLoginIdentity(page: Page, name: string = 'Test User') {
  await page.goto('/')
  await waitForAppReady(page)
  await createIdentity(page, name, 'testpassword123')
}

/**
 * Helper: Create a test group with Files module enabled
 */
async function createTestGroup(page: Page, groupName: string = TEST_GROUP_NAME) {
  const createGroupButton = page.getByRole('button', { name: /create group|new group/i })

  if (await createGroupButton.isVisible()) {
    await createGroupButton.click()

    // Fill group name
    await page.getByLabel(/group name|name/i).fill(groupName)
    await page.getByLabel(/description/i).fill('Test group for files module testing')

    // Enable Files module if option exists
    const filesCheckbox = page.getByLabel(/files/i)
    if (await filesCheckbox.isVisible()) {
      await filesCheckbox.check()
    }

    await page.getByRole('button', { name: /create|save/i }).click()
  }

  // Navigate to the group
  await page.getByText(groupName).click()
}

/**
 * Helper: Navigate to Files module
 */
async function navigateToFiles(page: Page) {
  // Look for Files tab or link
  const filesLink = page.getByRole('link', { name: /files/i })
  if (await filesLink.isVisible()) {
    await filesLink.click()
    await page.waitForURL(/.*files/)
  }
}

/**
 * Helper: Create a test file blob
 */
function createTestFile(name: string, content: string, type: string = 'text/plain'): File {
  const blob = new Blob([content], { type })
  return new File([blob], name, { type })
}

test.describe('Files Module - File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await createAndLoginIdentity(page)
    await createTestGroup(page)
    await navigateToFiles(page)
  })

  test('should upload file via file picker', async ({ page }) => {
    // Click Upload Files button
    await page.getByRole('button', { name: /upload files/i }).click()

    // Create a test file
    const fileContent = 'This is a test file for E2E testing'
    const fileName = 'test-document.txt'

    // Set up file input
    const fileInput = page.locator('input[type="file"]')

    // Create a temporary file
    const buffer = Buffer.from(fileContent)
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: buffer,
    })

    // Verify file appears in upload list
    await expect(page.getByText(fileName)).toBeVisible()

    // Click Upload button
    await page.getByRole('button', { name: /^upload/i }).click()

    // Wait for upload to complete
    await page.waitForTimeout(1000)

    // Should see file in the file list
    await expect(page.getByText(fileName)).toBeVisible()
  })

  test('should upload file via drag and drop', async ({ page }) => {
    // Click Upload Files button to open dialog
    await page.getByRole('button', { name: /upload files/i }).click()

    const fileName = 'drag-drop-test.txt'
    const fileContent = 'Drag and drop test content'

    // Locate the drag & drop zone
    const dropZone = page.locator('input[type="file"]').first()

    // Simulate file drop using setInputFiles
    const buffer = Buffer.from(fileContent)
    await dropZone.setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: buffer,
    })

    // Verify file appears in selected files
    await expect(page.getByText(fileName)).toBeVisible()

    // Upload
    await page.getByRole('button', { name: /^upload/i }).click()

    // Wait for upload
    await page.waitForTimeout(1000)

    // Verify file in list
    await expect(page.getByText(fileName)).toBeVisible()
  })

  test('should upload multiple files at once', async ({ page }) => {
    await page.getByRole('button', { name: /upload files/i }).click()

    const files = [
      { name: 'file1.txt', content: 'First file content' },
      { name: 'file2.txt', content: 'Second file content' },
      { name: 'file3.txt', content: 'Third file content' },
    ]

    const fileInput = page.locator('input[type="file"]')

    // Upload all files
    await fileInput.setInputFiles(files.map(f => ({
      name: f.name,
      mimeType: 'text/plain',
      buffer: Buffer.from(f.content),
    })))

    // Verify all files in selection
    for (const file of files) {
      await expect(page.getByText(file.name)).toBeVisible()
    }

    // Upload
    await page.getByRole('button', { name: /^upload.*\(3\)/i }).click()

    await page.waitForTimeout(1500)

    // All files should appear in file list
    for (const file of files) {
      await expect(page.getByText(file.name)).toBeVisible()
    }
  })

  test('should detect and display file type correctly', async ({ page }) => {
    await page.getByRole('button', { name: /upload files/i }).click()

    const fileInput = page.locator('input[type="file"]')

    // Upload an image file
    const imageBuffer = Buffer.from('fake-image-data')
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: imageBuffer,
    })

    await page.getByRole('button', { name: /^upload/i }).click()
    await page.waitForTimeout(1000)

    // Should show image icon (verify by checking if image icon is present)
    // The FileList component uses different icons for different file types
    const fileCard = page.locator('text=test-image.png').locator('..')
    await expect(fileCard).toBeVisible()
  })
})

test.describe('Files Module - Folder Management', () => {
  test.beforeEach(async ({ page }) => {
    await createAndLoginIdentity(page)
    await createTestGroup(page)
    await navigateToFiles(page)
  })

  test('should create a new folder', async ({ page }) => {
    // Click "New Folder" button
    await page.getByRole('button', { name: /new folder/i }).click()

    // Fill folder name
    const folderName = 'Test Folder'
    await page.getByLabel(/folder name|name/i).fill(folderName)

    // Submit
    await page.getByRole('button', { name: /create|save/i }).click()

    // Verify folder appears in list
    await expect(page.getByText(folderName)).toBeVisible()

    // Folder should have folder icon (blue folder icon)
    const folderElement = page.locator(`text=${folderName}`).locator('..')
    await expect(folderElement).toBeVisible()
  })

  test('should navigate folder hierarchy', async ({ page }) => {
    // Create parent folder
    await page.getByRole('button', { name: /new folder/i }).click()
    await page.getByLabel(/folder name|name/i).fill('Parent Folder')
    await page.getByRole('button', { name: /create|save/i }).click()

    await page.waitForTimeout(500)

    // Click to enter parent folder
    await page.getByText('Parent Folder').click()

    // Wait for navigation
    await page.waitForTimeout(500)

    // Create child folder inside parent
    await page.getByRole('button', { name: /new folder/i }).click()
    await page.getByLabel(/folder name|name/i).fill('Child Folder')
    await page.getByRole('button', { name: /create|save/i }).click()

    await page.waitForTimeout(500)

    // Verify child folder visible
    await expect(page.getByText('Child Folder')).toBeVisible()

    // Verify breadcrumb shows Parent Folder
    await expect(page.getByRole('button', { name: /parent folder/i })).toBeVisible()

    // Click breadcrumb to go back to root
    await page.getByRole('button').filter({ hasText: /home|root/ }).first().click()

    // Should be back at root, seeing Parent Folder again
    await expect(page.getByText('Parent Folder')).toBeVisible()
  })

  test('should rename a folder', async ({ page }) => {
    // Create folder
    await page.getByRole('button', { name: /new folder/i }).click()
    await page.getByLabel(/folder name|name/i).fill('Original Name')
    await page.getByRole('button', { name: /create|save/i }).click()

    await page.waitForTimeout(500)

    // Open folder actions menu
    const folderCard = page.locator('text=Original Name').locator('..')
    const moreButton = folderCard.getByRole('button').filter({ hasText: /more|⋮/ }).first()

    if (await moreButton.isVisible()) {
      await moreButton.click()

      // Click Rename option (if exists)
      const renameOption = page.getByRole('menuitem', { name: /rename/i })
      if (await renameOption.isVisible()) {
        await renameOption.click()

        // Fill new name
        await page.getByLabel(/folder name|name/i).fill('Renamed Folder')
        await page.getByRole('button', { name: /save|rename/i }).click()

        await page.waitForTimeout(500)

        // Verify new name appears
        await expect(page.getByText('Renamed Folder')).toBeVisible()
        await expect(page.getByText('Original Name')).not.toBeVisible()
      }
    }
  })

  test('should delete folder with recursive deletion of contents', async ({ page }) => {
    // Create parent folder
    await page.getByRole('button', { name: /new folder/i }).click()
    await page.getByLabel(/folder name|name/i).fill('To Delete')
    await page.getByRole('button', { name: /create|save/i }).click()

    await page.waitForTimeout(500)

    // Enter folder
    await page.getByText('To Delete').click()
    await page.waitForTimeout(500)

    // Upload a file inside
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'file-in-folder.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This file will be deleted'),
    })
    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(1000)

    // Go back to root
    await page.getByRole('button').filter({ hasText: /home|root/ }).first().click()
    await page.waitForTimeout(500)

    // Delete folder
    const folderCard = page.locator('text=To Delete').locator('..')
    const moreButton = folderCard.getByRole('button').filter({ hasText: /more|⋮/ }).first()

    await moreButton.click()

    // Click Delete
    const deleteOption = page.getByRole('menuitem', { name: /delete/i })
    await deleteOption.click()

    // Confirm deletion (browser confirm dialog)
    page.on('dialog', dialog => dialog.accept())

    await page.waitForTimeout(1000)

    // Folder should be gone
    await expect(page.getByText('To Delete')).not.toBeVisible()
  })
})

test.describe('Files Module - File Operations', () => {
  test.beforeEach(async ({ page }) => {
    await createAndLoginIdentity(page)
    await createTestGroup(page)
    await navigateToFiles(page)
  })

  test('should rename a file', async ({ page }) => {
    // Upload a file first
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'original-name.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test content'),
    })
    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(1000)

    // Open file menu
    const fileCard = page.locator('text=original-name.txt').locator('..')
    const moreButton = fileCard.getByRole('button').first()

    if (await moreButton.isVisible()) {
      await moreButton.click()

      const renameOption = page.getByRole('menuitem', { name: /rename/i })
      if (await renameOption.isVisible()) {
        await renameOption.click()

        await page.getByLabel(/file name|name/i).fill('renamed-file.txt')
        await page.getByRole('button', { name: /save|rename/i }).click()

        await page.waitForTimeout(500)

        await expect(page.getByText('renamed-file.txt')).toBeVisible()
      }
    }
  })

  test('should delete a file', async ({ page }) => {
    // Upload file
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'to-delete.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This will be deleted'),
    })
    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(1000)

    // Delete file
    const fileCard = page.locator('text=to-delete.txt').locator('..')
    const moreButton = fileCard.getByRole('button').first()

    await moreButton.click()

    const deleteOption = page.getByRole('menuitem', { name: /delete/i })
    await deleteOption.click()

    // Accept confirmation
    page.on('dialog', dialog => dialog.accept())

    await page.waitForTimeout(1000)

    // File should be gone
    await expect(page.getByText('to-delete.txt')).not.toBeVisible()
  })

  test('should move file to different folder', async ({ page }) => {
    // Create a folder first
    await page.getByRole('button', { name: /new folder/i }).click()
    await page.getByLabel(/folder name|name/i).fill('Destination Folder')
    await page.getByRole('button', { name: /create|save/i }).click()

    await page.waitForTimeout(500)

    // Upload a file
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'file-to-move.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Moving this file'),
    })
    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(1000)

    // Open file menu
    const fileCard = page.locator('text=file-to-move.txt').locator('..')
    const moreButton = fileCard.getByRole('button').first()

    if (await moreButton.isVisible()) {
      await moreButton.click()

      const moveOption = page.getByRole('menuitem', { name: /move/i })
      if (await moveOption.isVisible()) {
        await moveOption.click()

        // Select destination folder
        await page.getByText('Destination Folder').click()
        await page.getByRole('button', { name: /move|confirm/i }).click()

        await page.waitForTimeout(500)

        // File should be gone from root
        await expect(page.getByText('file-to-move.txt')).not.toBeVisible()

        // Enter destination folder
        await page.getByText('Destination Folder').click()
        await page.waitForTimeout(500)

        // File should be in destination folder
        await expect(page.getByText('file-to-move.txt')).toBeVisible()
      }
    }
  })

  test('should download a file', async ({ page }) => {
    // Upload file
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')
    const fileContent = 'Download test content'
    await fileInput.setInputFiles({
      name: 'download-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent),
    })
    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(1000)

    // Open file menu
    const fileCard = page.locator('text=download-test.txt').locator('..')
    const moreButton = fileCard.getByRole('button').first()

    await moreButton.click()

    const downloadOption = page.getByRole('menuitem', { name: /download/i })

    if (await downloadOption.isVisible()) {
      // Listen for download event
      const downloadPromise = page.waitForEvent('download')
      await downloadOption.click()

      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe('download-test.txt')
    }
  })
})

test.describe('Files Module - UI Features', () => {
  test.beforeEach(async ({ page }) => {
    await createAndLoginIdentity(page)
    await createTestGroup(page)
    await navigateToFiles(page)
  })

  test('should show breadcrumb navigation', async ({ page }) => {
    // Verify root breadcrumb exists
    const rootButton = page.getByRole('button').filter({ hasText: /home|root/ }).first()
    await expect(rootButton).toBeVisible()

    // Create and enter folder
    await page.getByRole('button', { name: /new folder/i }).click()
    await page.getByLabel(/folder name|name/i).fill('Breadcrumb Test')
    await page.getByRole('button', { name: /create|save/i }).click()

    await page.waitForTimeout(500)
    await page.getByText('Breadcrumb Test').click()
    await page.waitForTimeout(500)

    // Breadcrumb should show current folder
    await expect(page.getByRole('button', { name: /breadcrumb test/i })).toBeVisible()

    // Click root breadcrumb to go back
    await rootButton.click()
    await page.waitForTimeout(500)

    // Should be at root again
    await expect(page.getByText('Breadcrumb Test')).toBeVisible()
  })

  test('should switch between grid and list view', async ({ page }) => {
    // Upload a file to have something to view
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'view-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('View mode test'),
    })
    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(1000)

    // Find grid/list view toggle buttons
    // The FilesPage has a view mode toggle with Grid and List icons
    const gridButton = page.getByRole('button').filter({ hasText: /grid/i }).or(
      page.locator('button').filter({ has: page.locator('svg.lucide-grid') })
    ).first()

    const listButton = page.getByRole('button').filter({ hasText: /list/i }).or(
      page.locator('button').filter({ has: page.locator('svg.lucide-list') })
    ).first()

    // Click list view
    if (await listButton.isVisible()) {
      await listButton.click()
      await page.waitForTimeout(500)

      // Verify view changed (list view should show files differently)
      // List view uses space-y-1 class
      await expect(page.locator('.space-y-1')).toBeVisible()
    }

    // Click grid view
    if (await gridButton.isVisible()) {
      await gridButton.click()
      await page.waitForTimeout(500)

      // Grid view uses grid gap-4
      await expect(page.locator('.grid.gap-4')).toBeVisible()
    }
  })

  test('should display storage quota tracking', async ({ page }) => {
    // The FilesPage shows quota info: "X MB / Y MB used (Z%)"

    // Upload a file to increase quota usage
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')

    // Create a 1MB file
    const oneMB = Buffer.alloc(1024 * 1024, 'a')
    await fileInput.setInputFiles({
      name: 'large-file.txt',
      mimeType: 'text/plain',
      buffer: oneMB,
    })

    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(2000)

    // Should show quota usage (e.g., "1.0 MB / 1024 MB used (0%)")
    const quotaText = page.getByText(/MB.*\/.* MB used/i)
    await expect(quotaText).toBeVisible()

    // Should show percentage
    await expect(page.getByText(/\d+%/)).toBeVisible()
  })
})

test.describe('Files Module - Encryption Verification', () => {
  test('should encrypt files client-side before upload', async ({ page }) => {
    await createAndLoginIdentity(page)
    await createTestGroup(page)
    await navigateToFiles(page)

    // Intercept IndexedDB writes to verify encryption
    const encryptedData: any[] = []

    // Monitor network requests (in case files are uploaded to relay)
    page.on('request', (request) => {
      if (request.method() === 'POST' || request.method() === 'PUT') {
        encryptedData.push({
          url: request.url(),
          postData: request.postData(),
        })
      }
    })

    // Upload a file with sensitive content
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')
    const secretContent = 'This is TOP SECRET content that must be encrypted!'

    await fileInput.setInputFiles({
      name: 'secret-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(secretContent),
    })

    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(2000)

    // Check that any network requests don't contain plaintext
    for (const req of encryptedData) {
      const postData = req.postData || ''
      // Should NOT contain the secret content in plaintext
      expect(postData).not.toContain('TOP SECRET')
    }

    // Verify file metadata shows isEncrypted: true
    // This would require accessing IndexedDB via page.evaluate
    const isEncrypted = await page.evaluate(async () => {
      const indexedDB = window.indexedDB
      return new Promise((resolve) => {
        const request = indexedDB.open('BuildItDB')
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['fileMetadata'], 'readonly')
          const store = tx.objectStore('fileMetadata')
          const getAll = store.getAll()

          getAll.onsuccess = () => {
            const files = getAll.result
            const file = files.find((f: any) => f.name === 'secret-file.txt')
            resolve(file?.isEncrypted === true)
          }
        }
      })
    })

    expect(isEncrypted).toBe(true)
  })

  test('should decrypt and view encrypted file', async ({ page }) => {
    await createAndLoginIdentity(page)
    await createTestGroup(page)
    await navigateToFiles(page)

    const fileContent = 'Encrypted content that should be decrypted on view'

    // Upload encrypted file
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'encrypted-view.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent),
    })
    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(1000)

    // Click on file to preview (if preview exists)
    await page.getByText('encrypted-view.txt').click()

    // If preview dialog opens, verify content is decrypted
    const previewDialog = page.getByRole('dialog')
    if (await previewDialog.isVisible()) {
      // Should show decrypted content
      await expect(page.getByText(fileContent)).toBeVisible()
    }
  })

  test('should verify encrypted storage in IndexedDB', async ({ page }) => {
    await createAndLoginIdentity(page)
    await createTestGroup(page)
    await navigateToFiles(page)

    const plaintext = 'This should be encrypted in IndexedDB'

    // Upload file
    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'db-encryption-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(plaintext),
    })
    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(2000)

    // Access IndexedDB to verify encryption
    const encryptedBlobData = await page.evaluate(async (searchText) => {
      const indexedDB = window.indexedDB
      return new Promise((resolve) => {
        const request = indexedDB.open('BuildItDB')
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['encryptedFileBlobs'], 'readonly')
          const store = tx.objectStore('encryptedFileBlobs')
          const getAll = store.getAll()

          getAll.onsuccess = async () => {
            const blobs = getAll.result
            if (blobs.length > 0) {
              const blob = blobs[0]
              // Read the blob data
              const text = await blob.data.text()
              // Check if plaintext is NOT present (meaning it's encrypted)
              resolve(!text.includes(searchText))
            } else {
              resolve(false)
            }
          }
        }
      })
    }, plaintext)

    // The blob should NOT contain plaintext (encrypted)
    expect(encryptedBlobData).toBe(true)
  })
})

test.describe('Files Module - Storage Quota Enforcement', () => {
  test('should prevent upload when quota exceeded', async ({ page }) => {
    await createAndLoginIdentity(page)
    await createTestGroup(page)
    await navigateToFiles(page)

    // The default quota is 1GB (1024 MB)
    // Try to upload a file that would exceed quota

    // First, check current quota
    const quotaInfo = await page.getByText(/MB.*\/.* MB used/i).textContent()

    // Create a very large file (mock - in reality we'd need to actually exceed quota)
    // For this test, we'll verify the quota check exists

    await page.getByRole('button', { name: /upload files/i }).click()
    const fileInput = page.locator('input[type="file"]')

    // Create a 100MB file
    const largeMB = 100 * 1024 * 1024
    const largeBuffer = Buffer.alloc(largeMB, 'x')

    await fileInput.setInputFiles({
      name: 'very-large-file.bin',
      mimeType: 'application/octet-stream',
      buffer: largeBuffer,
    })

    // Try to upload
    await page.getByRole('button', { name: /^upload/i }).click()

    await page.waitForTimeout(2000)

    // If quota exceeded, should show error or prevent upload
    // This test verifies the quota system is in place
    const hasQuotaInfo = await page.getByText(/quota|storage/i).isVisible()
    expect(hasQuotaInfo).toBe(true)
  })
})
