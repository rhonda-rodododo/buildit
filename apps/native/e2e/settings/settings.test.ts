/**
 * Settings E2E Tests
 *
 * Tests the settings flows including:
 * - Profile settings
 * - Security settings
 * - Privacy settings
 * - App preferences
 */

import { device, element, by, expect } from 'detox'

describe('Settings Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
    // Create identity for testing
    await element(by.text('Create Identity')).tap()
    await element(by.id('display-name-input')).typeText('Test User')
    await element(by.text('Create')).tap()
    await element(by.text("I've saved my recovery phrase")).tap()
  })

  beforeEach(async () => {
    // Navigate to settings tab
    await element(by.id('settings-tab')).tap()
  })

  describe('Settings Screen', () => {
    it('should show settings tab', async () => {
      await expect(element(by.id('settings-tab'))).toBeVisible()
    })

    it('should show settings title', async () => {
      await expect(element(by.text('Settings'))).toBeVisible()
    })

    it('should show profile section', async () => {
      await expect(element(by.text('Profile'))).toBeVisible()
    })

    it('should show security section', async () => {
      await expect(element(by.text('Security'))).toBeVisible()
    })

    it('should show privacy section', async () => {
      await expect(element(by.text('Privacy'))).toBeVisible()
    })
  })

  describe('Profile Settings', () => {
    it('should open profile settings', async () => {
      await element(by.text('Profile')).tap()
      await expect(element(by.text('Edit Profile'))).toBeVisible()
    })

    it('should show current display name', async () => {
      await element(by.text('Profile')).tap()
      await expect(element(by.text('Test User'))).toBeVisible()
    })

    it('should allow editing display name', async () => {
      await element(by.text('Profile')).tap()
      await element(by.id('display-name-input')).clearText()
      await element(by.id('display-name-input')).typeText('Updated Name')
      await element(by.text('Save')).tap()
      await expect(element(by.text('Updated Name'))).toBeVisible()
    })

    it('should show profile picture option', async () => {
      await element(by.text('Profile')).tap()
      await expect(element(by.id('profile-picture'))).toBeVisible()
    })

    it('should show npub', async () => {
      await element(by.text('Profile')).tap()
      await expect(element(by.id('npub-display'))).toBeVisible()
    })

    it('should copy npub on tap', async () => {
      await element(by.text('Profile')).tap()
      await element(by.id('copy-npub-button')).tap()
      await expect(element(by.text('Copied!'))).toBeVisible()
    })
  })

  describe('Security Settings', () => {
    it('should open security settings', async () => {
      await element(by.text('Security')).tap()
      await expect(element(by.text('Security Settings'))).toBeVisible()
    })

    it('should show biometric option', async () => {
      await element(by.text('Security')).tap()
      await expect(element(by.text('Biometric Unlock'))).toBeVisible()
    })

    it('should show recovery phrase option', async () => {
      await element(by.text('Security')).tap()
      await expect(element(by.text('View Recovery Phrase'))).toBeVisible()
    })

    it('should require authentication to view recovery phrase', async () => {
      await element(by.text('Security')).tap()
      await element(by.text('View Recovery Phrase')).tap()
      // Should prompt for biometric or show warning
      await expect(element(by.text('Authenticate to continue'))).toBeVisible()
    })

    it('should show device linking option', async () => {
      await element(by.text('Security')).tap()
      await expect(element(by.text('Link Device'))).toBeVisible()
    })

    it('should show linked devices', async () => {
      await element(by.text('Security')).tap()
      await expect(element(by.text('Linked Devices'))).toBeVisible()
    })
  })

  describe('Privacy Settings', () => {
    it('should open privacy settings', async () => {
      await element(by.text('Privacy')).tap()
      await expect(element(by.text('Privacy Settings'))).toBeVisible()
    })

    it('should show Five Eyes warning toggle', async () => {
      await element(by.text('Privacy')).tap()
      await expect(element(by.text('Show Jurisdiction Warning'))).toBeVisible()
    })

    it('should show relay settings', async () => {
      await element(by.text('Privacy')).tap()
      await expect(element(by.text('Relay Servers'))).toBeVisible()
    })

    it('should open relay management', async () => {
      await element(by.text('Privacy')).tap()
      await element(by.text('Relay Servers')).tap()
      await expect(element(by.text('Manage Relays'))).toBeVisible()
    })

    it('should show default relays', async () => {
      await element(by.text('Privacy')).tap()
      await element(by.text('Relay Servers')).tap()
      await expect(element(by.id('relay-list'))).toBeVisible()
    })
  })

  describe('App Preferences', () => {
    it('should show appearance option', async () => {
      await expect(element(by.text('Appearance'))).toBeVisible()
    })

    it('should open appearance settings', async () => {
      await element(by.text('Appearance')).tap()
      await expect(element(by.text('Theme'))).toBeVisible()
    })

    it('should show theme options', async () => {
      await element(by.text('Appearance')).tap()
      await expect(element(by.text('Light'))).toBeVisible()
      await expect(element(by.text('Dark'))).toBeVisible()
      await expect(element(by.text('System'))).toBeVisible()
    })

    it('should show notifications option', async () => {
      await expect(element(by.text('Notifications'))).toBeVisible()
    })

    it('should open notification settings', async () => {
      await element(by.text('Notifications')).tap()
      await expect(element(by.text('Push Notifications'))).toBeVisible()
    })

    it('should show language option', async () => {
      await expect(element(by.text('Language'))).toBeVisible()
    })
  })

  describe('About & Help', () => {
    it('should show about section', async () => {
      await expect(element(by.text('About'))).toBeVisible()
    })

    it('should show app version', async () => {
      await element(by.text('About')).tap()
      await expect(element(by.id('app-version'))).toBeVisible()
    })

    it('should show help option', async () => {
      await expect(element(by.text('Help'))).toBeVisible()
    })

    it('should show privacy policy link', async () => {
      await element(by.text('About')).tap()
      await expect(element(by.text('Privacy Policy'))).toBeVisible()
    })

    it('should show terms of service link', async () => {
      await element(by.text('About')).tap()
      await expect(element(by.text('Terms of Service'))).toBeVisible()
    })
  })

  describe('Danger Zone', () => {
    it('should show logout option', async () => {
      await element(by.id('settings-scroll')).scrollTo('bottom')
      await expect(element(by.text('Log Out'))).toBeVisible()
    })

    it('should show delete account option', async () => {
      await element(by.id('settings-scroll')).scrollTo('bottom')
      await expect(element(by.text('Delete Account'))).toBeVisible()
    })

    it('should confirm before deleting account', async () => {
      await element(by.id('settings-scroll')).scrollTo('bottom')
      await element(by.text('Delete Account')).tap()
      await expect(element(by.text('This action cannot be undone'))).toBeVisible()
    })

    it('should require typing confirmation to delete', async () => {
      await element(by.id('settings-scroll')).scrollTo('bottom')
      await element(by.text('Delete Account')).tap()
      await expect(element(by.id('delete-confirmation-input'))).toBeVisible()
    })
  })
})
