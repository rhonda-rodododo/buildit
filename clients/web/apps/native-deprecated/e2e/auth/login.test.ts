/**
 * Login Flow E2E Tests
 *
 * Tests the authentication flows including:
 * - Creating a new identity
 * - Importing via recovery phrase
 * - Importing via private key
 */

import { device, element, by, expect } from 'detox'

describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  describe('Initial Launch', () => {
    it('should show welcome screen on first launch', async () => {
      await expect(element(by.text('BuildIt Network'))).toBeVisible()
    })

    it('should show create identity button', async () => {
      await expect(element(by.text('Create Identity'))).toBeVisible()
    })

    it('should show import identity button', async () => {
      await expect(element(by.text('Import Identity'))).toBeVisible()
    })
  })

  describe('Create New Identity', () => {
    it('should navigate to create identity screen', async () => {
      await element(by.text('Create Identity')).tap()
      await expect(element(by.text('Create Your Identity'))).toBeVisible()
    })

    it('should require display name', async () => {
      await element(by.text('Create Identity')).tap()
      await element(by.text('Create')).tap()
      // Should show error or stay on same screen
      await expect(element(by.text('Create Your Identity'))).toBeVisible()
    })

    it('should create identity with valid display name', async () => {
      await element(by.text('Create Identity')).tap()
      await element(by.id('display-name-input')).typeText('Test User')
      await element(by.text('Create')).tap()
      // Should show recovery phrase
      await expect(element(by.text('Save Your Recovery Phrase'))).toBeVisible()
    })

    it('should show 12-word recovery phrase', async () => {
      await element(by.text('Create Identity')).tap()
      await element(by.id('display-name-input')).typeText('Test User')
      await element(by.text('Create')).tap()
      // Should display recovery phrase words
      await expect(element(by.id('recovery-phrase-display'))).toBeVisible()
    })

    it('should navigate to home after confirming recovery phrase', async () => {
      await element(by.text('Create Identity')).tap()
      await element(by.id('display-name-input')).typeText('Test User')
      await element(by.text('Create')).tap()
      await element(by.text("I've saved my recovery phrase")).tap()
      // Should be on home screen
      await expect(element(by.id('home-tab'))).toBeVisible()
    })
  })

  describe('Import Identity', () => {
    it('should navigate to import screen', async () => {
      await element(by.text('Import Identity')).tap()
      await expect(element(by.text('Import Your Identity'))).toBeVisible()
    })

    it('should show recovery phrase input', async () => {
      await element(by.text('Import Identity')).tap()
      await expect(element(by.id('recovery-phrase-input'))).toBeVisible()
    })

    it('should show private key tab', async () => {
      await element(by.text('Import Identity')).tap()
      await expect(element(by.text('Private Key'))).toBeVisible()
    })

    it('should reject invalid recovery phrase', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.id('recovery-phrase-input')).typeText('invalid phrase')
      await element(by.text('Import')).tap()
      await expect(element(by.text('Invalid recovery phrase'))).toBeVisible()
    })

    it('should import valid recovery phrase', async () => {
      // Note: Use a test recovery phrase in CI/CD
      await element(by.text('Import Identity')).tap()
      await element(by.id('recovery-phrase-input')).typeText(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      )
      await element(by.text('Import')).tap()
      // Should navigate to home
      await expect(element(by.id('home-tab'))).toBeVisible()
    })
  })

  describe('Logout', () => {
    beforeEach(async () => {
      // Create identity first
      await element(by.text('Create Identity')).tap()
      await element(by.id('display-name-input')).typeText('Test User')
      await element(by.text('Create')).tap()
      await element(by.text("I've saved my recovery phrase")).tap()
    })

    it('should navigate to settings', async () => {
      await element(by.id('settings-tab')).tap()
      await expect(element(by.text('Settings'))).toBeVisible()
    })

    it('should show logout option', async () => {
      await element(by.id('settings-tab')).tap()
      await expect(element(by.text('Log Out'))).toBeVisible()
    })

    it('should confirm before logging out', async () => {
      await element(by.id('settings-tab')).tap()
      await element(by.text('Log Out')).tap()
      await expect(element(by.text('Cancel'))).toBeVisible()
    })

    it('should logout and return to welcome screen', async () => {
      await element(by.id('settings-tab')).tap()
      await element(by.text('Log Out')).tap()
      await element(by.text('Log Out')).atIndex(1).tap() // Confirm
      await expect(element(by.text('BuildIt Network'))).toBeVisible()
    })
  })
})
