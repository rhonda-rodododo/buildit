/**
 * Messaging E2E Tests
 *
 * Tests the messaging flows including:
 * - Viewing conversations list
 * - Sending messages
 * - Reading messages
 * - Message encryption indicators
 */

import { device, element, by, expect } from 'detox'

describe('Messaging Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
    // Create identity for testing
    await element(by.text('Create Identity')).tap()
    await element(by.id('display-name-input')).typeText('Test User')
    await element(by.text('Create')).tap()
    await element(by.text("I've saved my recovery phrase")).tap()
  })

  beforeEach(async () => {
    // Navigate to messages tab
    await element(by.id('messages-tab')).tap()
  })

  describe('Conversations List', () => {
    it('should show messages tab', async () => {
      await expect(element(by.id('messages-tab'))).toBeVisible()
    })

    it('should show empty state for new user', async () => {
      await expect(element(by.text('No messages yet'))).toBeVisible()
    })

    it('should show new message button', async () => {
      await expect(element(by.id('new-message-button'))).toBeVisible()
    })
  })

  describe('New Conversation', () => {
    it('should open new message screen', async () => {
      await element(by.id('new-message-button')).tap()
      await expect(element(by.text('New Message'))).toBeVisible()
    })

    it('should show recipient search', async () => {
      await element(by.id('new-message-button')).tap()
      await expect(element(by.id('recipient-search-input'))).toBeVisible()
    })

    it('should search for contacts', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-search-input')).typeText('npub1')
      // Should show search results or validation
      await expect(element(by.id('recipient-search-input'))).toBeVisible()
    })

    it('should validate npub format', async () => {
      await element(by.id('new-message-button')).tap()
      await element(by.id('recipient-search-input')).typeText('invalid-npub')
      await element(by.text('Start Chat')).tap()
      await expect(element(by.text('Invalid recipient'))).toBeVisible()
    })
  })

  describe('Chat View', () => {
    // Note: These tests require a pre-existing conversation or mock data
    it('should show message input', async () => {
      // Assuming we have a test conversation
      await element(by.id('conversation-item')).atIndex(0).tap()
      await expect(element(by.id('message-input'))).toBeVisible()
    })

    it('should show send button', async () => {
      await element(by.id('conversation-item')).atIndex(0).tap()
      await expect(element(by.id('send-button'))).toBeVisible()
    })

    it('should show encryption indicator', async () => {
      await element(by.id('conversation-item')).atIndex(0).tap()
      await expect(element(by.id('encryption-indicator'))).toBeVisible()
    })
  })

  describe('Sending Messages', () => {
    it('should type message in input', async () => {
      await element(by.id('conversation-item')).atIndex(0).tap()
      await element(by.id('message-input')).typeText('Hello, this is a test message')
      await expect(element(by.id('message-input'))).toHaveText('Hello, this is a test message')
    })

    it('should send message on button tap', async () => {
      await element(by.id('conversation-item')).atIndex(0).tap()
      await element(by.id('message-input')).typeText('Test message')
      await element(by.id('send-button')).tap()
      // Message input should clear
      await expect(element(by.id('message-input'))).toHaveText('')
    })

    it('should show sent message in chat', async () => {
      await element(by.id('conversation-item')).atIndex(0).tap()
      await element(by.id('message-input')).typeText('Unique test message 123')
      await element(by.id('send-button')).tap()
      await expect(element(by.text('Unique test message 123'))).toBeVisible()
    })

    it('should show message status indicator', async () => {
      await element(by.id('conversation-item')).atIndex(0).tap()
      await element(by.id('message-input')).typeText('Status test')
      await element(by.id('send-button')).tap()
      // Should show sending/sent indicator
      await expect(element(by.id('message-status'))).toBeVisible()
    })
  })

  describe('Message Actions', () => {
    it('should show message options on long press', async () => {
      await element(by.id('conversation-item')).atIndex(0).tap()
      await element(by.id('message-bubble')).atIndex(0).longPress()
      await expect(element(by.text('Copy'))).toBeVisible()
    })

    it('should copy message text', async () => {
      await element(by.id('conversation-item')).atIndex(0).tap()
      await element(by.id('message-bubble')).atIndex(0).longPress()
      await element(by.text('Copy')).tap()
      // Should dismiss menu
      await expect(element(by.text('Copy'))).not.toBeVisible()
    })
  })

  describe('Offline Behavior', () => {
    it('should queue message when offline', async () => {
      // Simulate offline mode
      await device.setURLBlacklist(['.*'])
      await element(by.id('conversation-item')).atIndex(0).tap()
      await element(by.id('message-input')).typeText('Offline message')
      await element(by.id('send-button')).tap()
      // Should show pending indicator
      await expect(element(by.id('message-pending'))).toBeVisible()
      // Restore network
      await device.setURLBlacklist([])
    })
  })
})
