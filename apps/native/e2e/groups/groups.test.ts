/**
 * Groups E2E Tests
 *
 * Tests the group management flows including:
 * - Viewing groups list
 * - Creating groups
 * - Joining groups
 * - Group settings
 */

import { device, element, by, expect } from 'detox'

describe('Groups Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
    // Create identity for testing
    await element(by.text('Create Identity')).tap()
    await element(by.id('display-name-input')).typeText('Test User')
    await element(by.text('Create')).tap()
    await element(by.text("I've saved my recovery phrase")).tap()
  })

  beforeEach(async () => {
    // Navigate to groups tab
    await element(by.id('groups-tab')).tap()
  })

  describe('Groups List', () => {
    it('should show groups tab', async () => {
      await expect(element(by.id('groups-tab'))).toBeVisible()
    })

    it('should show empty state for new user', async () => {
      await expect(element(by.text('No groups yet'))).toBeVisible()
    })

    it('should show create group button', async () => {
      await expect(element(by.id('create-group-button'))).toBeVisible()
    })

    it('should show join group button', async () => {
      await expect(element(by.id('join-group-button'))).toBeVisible()
    })
  })

  describe('Create Group', () => {
    it('should open create group screen', async () => {
      await element(by.id('create-group-button')).tap()
      await expect(element(by.text('Create Group'))).toBeVisible()
    })

    it('should show group name input', async () => {
      await element(by.id('create-group-button')).tap()
      await expect(element(by.id('group-name-input'))).toBeVisible()
    })

    it('should show group description input', async () => {
      await element(by.id('create-group-button')).tap()
      await expect(element(by.id('group-description-input'))).toBeVisible()
    })

    it('should require group name', async () => {
      await element(by.id('create-group-button')).tap()
      await element(by.text('Create')).tap()
      await expect(element(by.text('Group name is required'))).toBeVisible()
    })

    it('should create group with valid name', async () => {
      await element(by.id('create-group-button')).tap()
      await element(by.id('group-name-input')).typeText('Test Group')
      await element(by.id('group-description-input')).typeText('A test group for E2E testing')
      await element(by.text('Create')).tap()
      // Should navigate to group or show success
      await expect(element(by.text('Test Group'))).toBeVisible()
    })

    it('should show privacy options', async () => {
      await element(by.id('create-group-button')).tap()
      await expect(element(by.text('Privacy'))).toBeVisible()
    })
  })

  describe('Join Group', () => {
    it('should open join group screen', async () => {
      await element(by.id('join-group-button')).tap()
      await expect(element(by.text('Join Group'))).toBeVisible()
    })

    it('should show group invite code input', async () => {
      await element(by.id('join-group-button')).tap()
      await expect(element(by.id('invite-code-input'))).toBeVisible()
    })

    it('should show QR scanner option', async () => {
      await element(by.id('join-group-button')).tap()
      await expect(element(by.id('scan-qr-button'))).toBeVisible()
    })

    it('should validate invite code', async () => {
      await element(by.id('join-group-button')).tap()
      await element(by.id('invite-code-input')).typeText('invalid-code')
      await element(by.text('Join')).tap()
      await expect(element(by.text('Invalid invite code'))).toBeVisible()
    })
  })

  describe('Group View', () => {
    beforeAll(async () => {
      // Create a group first
      await element(by.id('groups-tab')).tap()
      await element(by.id('create-group-button')).tap()
      await element(by.id('group-name-input')).typeText('Test Group View')
      await element(by.text('Create')).tap()
    })

    it('should show group name', async () => {
      await element(by.text('Test Group View')).tap()
      await expect(element(by.text('Test Group View'))).toBeVisible()
    })

    it('should show group chat tab', async () => {
      await element(by.text('Test Group View')).tap()
      await expect(element(by.id('group-chat-tab'))).toBeVisible()
    })

    it('should show group members tab', async () => {
      await element(by.text('Test Group View')).tap()
      await expect(element(by.id('group-members-tab'))).toBeVisible()
    })

    it('should show group settings option', async () => {
      await element(by.text('Test Group View')).tap()
      await expect(element(by.id('group-settings-button'))).toBeVisible()
    })
  })

  describe('Group Chat', () => {
    it('should show message input in group chat', async () => {
      await element(by.text('Test Group View')).tap()
      await element(by.id('group-chat-tab')).tap()
      await expect(element(by.id('group-message-input'))).toBeVisible()
    })

    it('should send message to group', async () => {
      await element(by.text('Test Group View')).tap()
      await element(by.id('group-chat-tab')).tap()
      await element(by.id('group-message-input')).typeText('Hello group!')
      await element(by.id('group-send-button')).tap()
      await expect(element(by.text('Hello group!'))).toBeVisible()
    })
  })

  describe('Group Members', () => {
    it('should show members list', async () => {
      await element(by.text('Test Group View')).tap()
      await element(by.id('group-members-tab')).tap()
      await expect(element(by.id('members-list'))).toBeVisible()
    })

    it('should show current user as admin', async () => {
      await element(by.text('Test Group View')).tap()
      await element(by.id('group-members-tab')).tap()
      await expect(element(by.text('Admin'))).toBeVisible()
    })

    it('should show invite member button for admins', async () => {
      await element(by.text('Test Group View')).tap()
      await element(by.id('group-members-tab')).tap()
      await expect(element(by.id('invite-member-button'))).toBeVisible()
    })
  })

  describe('Group Settings', () => {
    it('should open group settings', async () => {
      await element(by.text('Test Group View')).tap()
      await element(by.id('group-settings-button')).tap()
      await expect(element(by.text('Group Settings'))).toBeVisible()
    })

    it('should show edit name option', async () => {
      await element(by.text('Test Group View')).tap()
      await element(by.id('group-settings-button')).tap()
      await expect(element(by.text('Edit Name'))).toBeVisible()
    })

    it('should show leave group option', async () => {
      await element(by.text('Test Group View')).tap()
      await element(by.id('group-settings-button')).tap()
      await expect(element(by.text('Leave Group'))).toBeVisible()
    })

    it('should confirm before leaving group', async () => {
      await element(by.text('Test Group View')).tap()
      await element(by.id('group-settings-button')).tap()
      await element(by.text('Leave Group')).tap()
      await expect(element(by.text('Are you sure?'))).toBeVisible()
    })
  })
})
