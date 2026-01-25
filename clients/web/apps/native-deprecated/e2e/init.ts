/**
 * E2E Test Initialization
 *
 * Global setup and utilities for Detox E2E tests
 */

import { device } from 'detox'

/**
 * Reset app state between test suites
 */
export async function resetApp(): Promise<void> {
  await device.uninstallApp()
  await device.installApp()
  await device.launchApp({ newInstance: true })
}

/**
 * Create a test identity for authenticated tests
 */
export async function createTestIdentity(name: string = 'Test User'): Promise<void> {
  const { element, by, expect } = require('detox')

  await element(by.text('Create Identity')).tap()
  await element(by.id('display-name-input')).typeText(name)
  await element(by.text('Create')).tap()
  await element(by.text("I've saved my recovery phrase")).tap()

  // Verify we're on home screen
  await expect(element(by.id('home-tab'))).toBeVisible()
}

/**
 * Import an identity using recovery phrase
 */
export async function importTestIdentity(phrase: string): Promise<void> {
  const { element, by, expect } = require('detox')

  await element(by.text('Import Identity')).tap()
  await element(by.id('recovery-phrase-input')).typeText(phrase)
  await element(by.text('Import')).tap()

  // Verify we're on home screen
  await expect(element(by.id('home-tab'))).toBeVisible()
}

/**
 * Navigate to a specific tab
 */
export async function navigateToTab(tab: 'home' | 'messages' | 'groups' | 'settings'): Promise<void> {
  const { element, by } = require('detox')
  await element(by.id(`${tab}-tab`)).tap()
}

/**
 * Wait for network request to complete
 */
export async function waitForNetwork(timeout: number = 10000): Promise<void> {
  // Detox automatically waits for network requests
  // This is a utility for explicit waiting if needed
  await new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * Simulate offline mode
 */
export async function goOffline(): Promise<void> {
  await device.setURLBlacklist(['.*'])
}

/**
 * Restore online mode
 */
export async function goOnline(): Promise<void> {
  await device.setURLBlacklist([])
}

/**
 * Take a screenshot for debugging
 */
export async function takeDebugScreenshot(name: string): Promise<void> {
  await device.takeScreenshot(name)
}

/**
 * Test data constants
 */
export const TEST_DATA = {
  // Standard BIP39 test mnemonic (DO NOT use for real accounts)
  TEST_RECOVERY_PHRASE: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',

  // Test npubs for contact/messaging tests
  TEST_NPUB: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz4p',

  // Test group invite code
  TEST_INVITE_CODE: 'buildit://join/test-group-code',

  // Test relay URLs
  TEST_RELAYS: [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band',
  ],
}

/**
 * Platform-specific utilities
 */
export const platform = {
  isIOS: () => device.getPlatform() === 'ios',
  isAndroid: () => device.getPlatform() === 'android',
}
