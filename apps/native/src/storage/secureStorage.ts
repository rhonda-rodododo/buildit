/**
 * Secure Storage Abstraction
 *
 * Uses expo-secure-store on native, localStorage on web.
 * Encrypts sensitive data at rest on native devices.
 */

import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

// Storage keys
export const STORAGE_KEYS = {
  PRIVATE_KEY: 'buildit_private_key',
  PUBLIC_KEY: 'buildit_public_key',
  RECOVERY_PHRASE: 'buildit_recovery_phrase',
  DISPLAY_NAME: 'buildit_display_name',
  ABOUT: 'buildit_about',
  LINKED_DEVICES: 'buildit_linked_devices',
  RELAY_CONFIG: 'buildit_relay_config',
  LANGUAGE: 'buildit_language',
  THEME: 'buildit_theme',
  BUNKER_CONNECTIONS: 'buildit_bunker_connections',
  MESSAGE_QUEUE: 'buildit_message_queue',
  GROUPS_CACHE: 'buildit_groups_cache',
  PIN_HASH: 'buildit_pin_hash',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/**
 * Store a value securely
 */
export async function setSecureItem(key: StorageKey, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Web fallback - localStorage (less secure but functional)
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      console.error('Failed to store in localStorage:', error)
      throw new Error('Storage not available')
    }
  } else {
    // Native - use SecureStore
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  }
}

/**
 * Retrieve a value from secure storage
 */
export async function getSecureItem(key: StorageKey): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error('Failed to read from localStorage:', error)
      return null
    }
  } else {
    return await SecureStore.getItemAsync(key)
  }
}

/**
 * Delete a value from secure storage
 */
export async function deleteSecureItem(key: StorageKey): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Failed to delete from localStorage:', error)
    }
  } else {
    await SecureStore.deleteItemAsync(key)
  }
}

/**
 * Store a JSON object securely
 */
export async function setSecureJSON<T>(key: StorageKey, value: T): Promise<void> {
  const serialized = JSON.stringify(value)
  await setSecureItem(key, serialized)
}

/**
 * Retrieve a JSON object from secure storage
 */
export async function getSecureJSON<T>(key: StorageKey): Promise<T | null> {
  const value = await getSecureItem(key)
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

/**
 * Clear all app storage (for logout)
 */
export async function clearAllSecureStorage(): Promise<void> {
  const keys = Object.values(STORAGE_KEYS)
  await Promise.all(keys.map((key) => deleteSecureItem(key)))
}

/**
 * Check if any identity exists in storage
 */
export async function hasStoredIdentity(): Promise<boolean> {
  const privateKey = await getSecureItem(STORAGE_KEYS.PRIVATE_KEY)
  return privateKey !== null
}
