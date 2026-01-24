/**
 * Biometric Authentication E2E Tests
 *
 * Tests the biometric authentication flows including:
 * - Biometric setup
 * - Biometric unlock
 * - Fallback to password
 *
 * Note: These tests require device with biometric capability.
 * Some tests may be skipped on devices without biometric hardware.
 */

import { device, element, by, expect } from 'detox'

describe('Biometric Authentication', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
    // Create identity for testing
    await element(by.text('Create Identity')).tap()
    await element(by.id('display-name-input')).typeText('Biometric Test User')
    await element(by.text('Create')).tap()
    await element(by.text("I've saved my recovery phrase")).tap()
  })

  beforeEach(async () => {
    // Navigate to security settings
    await element(by.id('settings-tab')).tap()
    await element(by.text('Security')).tap()
  })

  describe('Biometric Setup', () => {
    it('should show biometric option in security settings', async () => {
      await expect(element(by.text('Biometric Unlock'))).toBeVisible()
    })

    it('should show current biometric status', async () => {
      await expect(element(by.id('biometric-status'))).toBeVisible()
    })

    it('should show biometric type (Face ID/Touch ID/Fingerprint)', async () => {
      // Should show appropriate biometric type for device
      const faceId = element(by.text('Face ID'))
      const touchId = element(by.text('Touch ID'))
      const fingerprint = element(by.text('Fingerprint'))

      // At least one should be visible if biometrics available
      try {
        await expect(faceId).toBeVisible()
      } catch {
        try {
          await expect(touchId).toBeVisible()
        } catch {
          await expect(fingerprint).toBeVisible()
        }
      }
    })

    it('should enable biometric unlock', async () => {
      await element(by.id('biometric-toggle')).tap()
      // Should prompt for biometric enrollment
      await expect(element(by.text('Enable Biometric Unlock'))).toBeVisible()
    })

    it('should require biometric verification to enable', async () => {
      await element(by.id('biometric-toggle')).tap()
      await element(by.text('Enable')).tap()
      // System will prompt for biometric
      // In test mode, we simulate success
      await device.matchFace() // or device.matchFinger()
      await expect(element(by.id('biometric-enabled'))).toBeVisible()
    })

    it('should show success message after enabling', async () => {
      await element(by.id('biometric-toggle')).tap()
      await element(by.text('Enable')).tap()
      await device.matchFace()
      await expect(element(by.text('Biometric unlock enabled'))).toBeVisible()
    })
  })

  describe('Biometric Unlock', () => {
    beforeAll(async () => {
      // Enable biometrics first
      await element(by.id('settings-tab')).tap()
      await element(by.text('Security')).tap()
      await element(by.id('biometric-toggle')).tap()
      await element(by.text('Enable')).tap()
      await device.matchFace()
    })

    it('should show biometric prompt on app launch', async () => {
      // Terminate and relaunch app
      await device.terminateApp()
      await device.launchApp()
      await expect(element(by.text('Unlock with Biometric'))).toBeVisible()
    })

    it('should unlock on successful biometric', async () => {
      await device.terminateApp()
      await device.launchApp()
      await device.matchFace()
      await expect(element(by.id('home-tab'))).toBeVisible()
    })

    it('should show error on biometric failure', async () => {
      await device.terminateApp()
      await device.launchApp()
      await device.unmatchFace() // Simulate failed biometric
      await expect(element(by.text('Biometric authentication failed'))).toBeVisible()
    })

    it('should allow retry after failure', async () => {
      await device.terminateApp()
      await device.launchApp()
      await device.unmatchFace()
      await expect(element(by.text('Try Again'))).toBeVisible()
    })

    it('should show fallback option after failures', async () => {
      await device.terminateApp()
      await device.launchApp()
      await device.unmatchFace()
      await device.unmatchFace()
      await device.unmatchFace()
      await expect(element(by.text('Use Password'))).toBeVisible()
    })
  })

  describe('Password Fallback', () => {
    it('should show password option', async () => {
      await device.terminateApp()
      await device.launchApp()
      await expect(element(by.text('Use Password'))).toBeVisible()
    })

    it('should open password input', async () => {
      await device.terminateApp()
      await device.launchApp()
      await element(by.text('Use Password')).tap()
      await expect(element(by.id('password-input'))).toBeVisible()
    })

    it('should reject wrong password', async () => {
      await device.terminateApp()
      await device.launchApp()
      await element(by.text('Use Password')).tap()
      await element(by.id('password-input')).typeText('wrongpassword')
      await element(by.text('Unlock')).tap()
      await expect(element(by.text('Incorrect password'))).toBeVisible()
    })

    it('should unlock with correct password', async () => {
      await device.terminateApp()
      await device.launchApp()
      await element(by.text('Use Password')).tap()
      await element(by.id('password-input')).typeText('correctpassword')
      await element(by.text('Unlock')).tap()
      await expect(element(by.id('home-tab'))).toBeVisible()
    })
  })

  describe('Disable Biometric', () => {
    it('should show disable option when enabled', async () => {
      await expect(element(by.text('Disable Biometric'))).toBeVisible()
    })

    it('should require confirmation to disable', async () => {
      await element(by.text('Disable Biometric')).tap()
      await expect(element(by.text('Are you sure?'))).toBeVisible()
    })

    it('should require biometric to disable', async () => {
      await element(by.text('Disable Biometric')).tap()
      await element(by.text('Disable')).tap()
      // Should prompt for biometric verification
      await device.matchFace()
      await expect(element(by.id('biometric-disabled'))).toBeVisible()
    })

    it('should not show biometric prompt after disabling', async () => {
      await element(by.text('Disable Biometric')).tap()
      await element(by.text('Disable')).tap()
      await device.matchFace()
      await device.terminateApp()
      await device.launchApp()
      // Should show password unlock, not biometric
      await expect(element(by.id('password-input'))).toBeVisible()
    })
  })

  describe('Background/Foreground Behavior', () => {
    beforeAll(async () => {
      // Enable biometrics
      await element(by.id('settings-tab')).tap()
      await element(by.text('Security')).tap()
      if (await element(by.id('biometric-toggle')).exists) {
        await element(by.id('biometric-toggle')).tap()
        await element(by.text('Enable')).tap()
        await device.matchFace()
      }
    })

    it('should require biometric after app goes to background', async () => {
      await device.sendToHome()
      await device.launchApp()
      await expect(element(by.text('Unlock with Biometric'))).toBeVisible()
    })

    it('should not require unlock for quick background', async () => {
      // Brief background (< 30 seconds)
      await device.sendToHome()
      await new Promise(resolve => setTimeout(resolve, 1000))
      await device.launchApp()
      // Should still be unlocked
      await expect(element(by.id('home-tab'))).toBeVisible()
    })

    it('should require unlock after extended background', async () => {
      // Long background (simulated)
      await device.sendToHome()
      // Wait or simulate time passing
      await device.launchApp({ newInstance: true })
      await expect(element(by.text('Unlock with Biometric'))).toBeVisible()
    })
  })

  describe('Sensitive Actions', () => {
    it('should require biometric for recovery phrase', async () => {
      await element(by.text('View Recovery Phrase')).tap()
      await expect(element(by.text('Authenticate to continue'))).toBeVisible()
    })

    it('should show recovery phrase after biometric', async () => {
      await element(by.text('View Recovery Phrase')).tap()
      await device.matchFace()
      await expect(element(by.id('recovery-phrase-display'))).toBeVisible()
    })

    it('should require biometric for private key export', async () => {
      await element(by.text('Export Private Key')).tap()
      await expect(element(by.text('Authenticate to continue'))).toBeVisible()
    })

    it('should require biometric for account deletion', async () => {
      await element(by.id('settings-scroll')).scrollTo('bottom')
      await element(by.text('Delete Account')).tap()
      await expect(element(by.text('Authenticate to continue'))).toBeVisible()
    })
  })
})
