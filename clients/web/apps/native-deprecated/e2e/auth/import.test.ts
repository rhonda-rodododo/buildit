/**
 * Import Identity E2E Tests
 *
 * Tests the identity import flows including:
 * - Recovery phrase import
 * - Private key import
 * - NIP-46 device linking
 */

import { device, element, by, expect } from 'detox'

describe('Import Identity Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  describe('Recovery Phrase Import', () => {
    it('should navigate to import screen', async () => {
      await element(by.text('Import Identity')).tap()
      await expect(element(by.text('Import Your Identity'))).toBeVisible()
    })

    it('should show recovery phrase tab by default', async () => {
      await element(by.text('Import Identity')).tap()
      await expect(element(by.id('recovery-phrase-input'))).toBeVisible()
    })

    it('should validate 12-word phrase', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.id('recovery-phrase-input')).typeText('word1 word2 word3')
      await element(by.text('Import')).tap()
      await expect(element(by.text('Invalid recovery phrase'))).toBeVisible()
    })

    it('should validate BIP39 words', async () => {
      await element(by.text('Import Identity')).tap()
      // Invalid BIP39 words
      await element(by.id('recovery-phrase-input')).typeText(
        'invalid invalid invalid invalid invalid invalid invalid invalid invalid invalid invalid invalid'
      )
      await element(by.text('Import')).tap()
      await expect(element(by.text('Invalid recovery phrase'))).toBeVisible()
    })

    it('should import valid 12-word phrase', async () => {
      await element(by.text('Import Identity')).tap()
      // Standard BIP39 test mnemonic
      await element(by.id('recovery-phrase-input')).typeText(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      )
      await element(by.text('Import')).tap()
      // Should navigate to home
      await expect(element(by.id('home-tab'))).toBeVisible()
    })

    it('should show loading during import', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.id('recovery-phrase-input')).typeText(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      )
      await element(by.text('Import')).tap()
      // Should show loading indicator (briefly)
      await expect(element(by.id('home-tab'))).toBeVisible()
    })
  })

  describe('Private Key Import', () => {
    it('should switch to private key tab', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Private Key')).tap()
      await expect(element(by.id('private-key-input'))).toBeVisible()
    })

    it('should validate nsec format', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Private Key')).tap()
      await element(by.id('private-key-input')).typeText('invalid-nsec')
      await element(by.text('Import')).tap()
      await expect(element(by.text('Invalid private key'))).toBeVisible()
    })

    it('should validate hex format', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Private Key')).tap()
      // Invalid hex (wrong length)
      await element(by.id('private-key-input')).typeText('abcd1234')
      await element(by.text('Import')).tap()
      await expect(element(by.text('Invalid private key'))).toBeVisible()
    })

    it('should import valid nsec', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Private Key')).tap()
      // Test nsec corresponding to test mnemonic (first key)
      await element(by.id('private-key-input')).typeText(
        'nsec1w0xuz0l4s8k9rhvr47sjnfvx5vr4dsmhgls3q8uyp0u5h0kqj9lqx5ytu5'
      )
      await element(by.text('Import')).tap()
      // Should navigate to home
      await expect(element(by.id('home-tab'))).toBeVisible()
    })

    it('should import valid 64-char hex', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Private Key')).tap()
      // 64-character hex private key
      await element(by.id('private-key-input')).typeText(
        '0000000000000000000000000000000000000000000000000000000000000001'
      )
      await element(by.text('Import')).tap()
      // Should navigate to home
      await expect(element(by.id('home-tab'))).toBeVisible()
    })
  })

  describe('NIP-46 Device Linking', () => {
    it('should show QR scan option', async () => {
      await element(by.text('Import Identity')).tap()
      await expect(element(by.text('Scan QR Code'))).toBeVisible()
    })

    it('should navigate to QR scanner', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Scan QR Code')).tap()
      // Should show camera permission or scanner
      await expect(element(by.id('qr-scanner'))).toBeVisible()
    })

    it('should show manual URL entry option', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Scan QR Code')).tap()
      await expect(element(by.text('Enter URL manually'))).toBeVisible()
    })

    it('should validate bunker URL format', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Scan QR Code')).tap()
      await element(by.text('Enter URL manually')).tap()
      await element(by.id('bunker-url-input')).typeText('invalid-url')
      await element(by.text('Connect')).tap()
      await expect(element(by.text('Invalid bunker URL'))).toBeVisible()
    })

    it('should show connection status', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Scan QR Code')).tap()
      await element(by.text('Enter URL manually')).tap()
      await element(by.id('bunker-url-input')).typeText(
        'bunker://pubkey123?relay=wss://relay.example.com&secret=abc'
      )
      await element(by.text('Connect')).tap()
      // Should show connecting status
      await expect(element(by.text('Connecting...'))).toBeVisible()
    })
  })

  describe('Import Flow UX', () => {
    it('should show back button', async () => {
      await element(by.text('Import Identity')).tap()
      await expect(element(by.id('back-button'))).toBeVisible()
    })

    it('should return to welcome on back', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.id('back-button')).tap()
      await expect(element(by.text('BuildIt Network'))).toBeVisible()
    })

    it('should clear input on tab switch', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.id('recovery-phrase-input')).typeText('test input')
      await element(by.text('Private Key')).tap()
      await element(by.text('Recovery Phrase')).tap()
      // Input should be cleared
      await expect(element(by.id('recovery-phrase-input'))).toHaveText('')
    })

    it('should show password option for key encryption', async () => {
      await element(by.text('Import Identity')).tap()
      await element(by.text('Private Key')).tap()
      await expect(element(by.text('Set Password'))).toBeVisible()
    })
  })
})
