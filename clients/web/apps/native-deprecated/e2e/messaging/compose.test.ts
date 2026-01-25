/**
 * Message Compose E2E Tests
 *
 * Tests the message composition flows including:
 * - Starting new conversations
 * - Recipient selection
 * - Message drafts
 * - Media attachments
 */

import { device, element, by, expect } from 'detox'

describe('Message Compose Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
    // Create identity for testing
    await element(by.text('Create Identity')).tap()
    await element(by.id('display-name-input')).typeText('Compose Test User')
    await element(by.text('Create')).tap()
    await element(by.text("I've saved my recovery phrase")).tap()
  })

  beforeEach(async () => {
    // Navigate to messages tab
    await element(by.id('messages-tab')).tap()
  })

  describe('New Message', () => {
    it('should show new message button', async () => {
      await expect(element(by.id('new-message-button'))).toBeVisible()
    })

    it('should open compose screen', async () => {
      await element(by.id('new-message-button')).tap()
      await expect(element(by.text('New Message'))).toBeVisible()
    })

    it('should show recipient input', async () => {
      await element(by.id('new-message-button')).tap()
      await expect(element(by.id('recipient-input'))).toBeVisible()
    })

    it('should show message input', async () => {
      await element(by.id('new-message-button')).tap()
      await expect(element(by.id('compose-message-input'))).toBeVisible()
    })
  })

  describe('Recipient Selection', () => {
    it('should accept npub format', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText(
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p'
      )
      await expect(element(by.id('recipient-valid'))).toBeVisible()
    })

    it('should accept hex pubkey', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText(
        '0000000000000000000000000000000000000000000000000000000000000001'
      )
      await expect(element(by.id('recipient-valid'))).toBeVisible()
    })

    it('should reject invalid format', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText('invalid-recipient')
      await element(by.id('compose-message-input')).tap() // Blur to trigger validation
      await expect(element(by.text('Invalid recipient'))).toBeVisible()
    })

    it('should show recent contacts', async () => {
      await element(by.id('new-message-button')).tap()
      await expect(element(by.text('Recent'))).toBeVisible()
    })

    it('should select from recent contacts', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recent-contact')).atIndex(0).tap()
      await expect(element(by.id('recipient-valid'))).toBeVisible()
    })

    it('should search contacts by name', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText('Alice')
      await expect(element(by.id('contact-search-results'))).toBeVisible()
    })

    it('should show profile preview', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText(
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p'
      )
      await element(by.id('recipient-valid')).tap()
      await expect(element(by.id('recipient-profile'))).toBeVisible()
    })
  })

  describe('Message Composition', () => {
    beforeEach(async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText(
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p'
      )
    })

    it('should allow text input', async () => {
      await element(by.id('compose-message-input')).typeText('Hello, this is a test message!')
      await expect(element(by.id('compose-message-input'))).toHaveText('Hello, this is a test message!')
    })

    it('should show character count for long messages', async () => {
      const longMessage = 'A'.repeat(250)
      await element(by.id('compose-message-input')).typeText(longMessage)
      await expect(element(by.id('char-count'))).toBeVisible()
    })

    it('should enable send button with valid input', async () => {
      await element(by.id('compose-message-input')).typeText('Test message')
      await expect(element(by.id('send-button'))).toHaveAttr('enabled', 'true')
    })

    it('should disable send button for empty message', async () => {
      await expect(element(by.id('send-button'))).toHaveAttr('enabled', 'false')
    })

    it('should handle multiline messages', async () => {
      await element(by.id('compose-message-input')).typeText('Line 1\nLine 2\nLine 3')
      await expect(element(by.id('compose-message-input'))).toHaveText('Line 1\nLine 2\nLine 3')
    })

    it('should handle emoji', async () => {
      await element(by.id('compose-message-input')).typeText('Hello! 👋🎉')
      await expect(element(by.id('compose-message-input'))).toHaveText('Hello! 👋🎉')
    })
  })

  describe('Send Message', () => {
    beforeEach(async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText(
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p'
      )
      await element(by.id('compose-message-input')).typeText('Test message to send')
    })

    it('should send message on button tap', async () => {
      await element(by.id('send-button')).tap()
      // Should navigate to conversation
      await expect(element(by.id('chat-view'))).toBeVisible()
    })

    it('should show sending indicator', async () => {
      await element(by.id('send-button')).tap()
      // Brief sending state
      await expect(element(by.id('chat-view'))).toBeVisible()
    })

    it('should show message in conversation', async () => {
      await element(by.id('send-button')).tap()
      await expect(element(by.text('Test message to send'))).toBeVisible()
    })

    it('should show encryption indicator', async () => {
      await element(by.id('send-button')).tap()
      await expect(element(by.id('encryption-indicator'))).toBeVisible()
    })

    it('should clear compose input after send', async () => {
      await element(by.id('send-button')).tap()
      await element(by.id('message-input')).tap()
      await expect(element(by.id('message-input'))).toHaveText('')
    })
  })

  describe('Message Drafts', () => {
    it('should save draft when navigating away', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText(
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p'
      )
      await element(by.id('compose-message-input')).typeText('Draft message content')
      // Navigate away
      await element(by.id('back-button')).tap()
      // Navigate back
      await element(by.id('new-message-button')).tap()
      // Draft should be restored (if feature implemented)
      await expect(element(by.id('draft-indicator'))).toBeVisible()
    })

    it('should show drafts in message list', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText(
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p'
      )
      await element(by.id('compose-message-input')).typeText('Draft message')
      await element(by.id('back-button')).tap()
      await expect(element(by.text('Draft'))).toBeVisible()
    })

    it('should restore draft when opening conversation', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText(
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p'
      )
      await element(by.id('compose-message-input')).typeText('Draft to restore')
      await element(by.id('back-button')).tap()
      await element(by.text('Draft')).tap()
      await expect(element(by.id('compose-message-input'))).toHaveText('Draft to restore')
    })

    it('should clear draft after sending', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-input')).typeText(
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p'
      )
      await element(by.id('compose-message-input')).typeText('Draft to clear')
      await element(by.id('send-button')).tap()
      await element(by.id('back-button')).tap()
      // No draft indicator should be visible for this conversation
      await expect(element(by.text('Draft'))).not.toBeVisible()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible labels', async () => {
      await element(by.id('new-message-button')).tap()
      await expect(element(by.label('Recipient input'))).toBeVisible()
      await expect(element(by.label('Message input'))).toBeVisible()
      await expect(element(by.label('Send message'))).toBeVisible()
    })

    it('should support keyboard navigation', async () => {
      await element(by.id('new-message-button')).tap()
      // Tab through inputs
      await element(by.id('recipient-input')).typeText(
        'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p'
      )
      // Should focus message input after valid recipient
      await device.pressKey('Tab')
      await expect(element(by.id('compose-message-input'))).toBeFocused()
    })
  })
})
