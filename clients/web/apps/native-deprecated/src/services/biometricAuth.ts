/**
 * Biometric Authentication Service
 *
 * Provides Face ID, Touch ID, and fingerprint authentication
 * using expo-local-authentication.
 */

import { Platform } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { getSecureItem, setSecureItem, deleteSecureItem, STORAGE_KEYS } from '../storage/secureStorage'

// Storage key for biometric preference
const BIOMETRIC_ENABLED_KEY = 'buildit_biometric_enabled' as const

export type BiometricType = 'facial' | 'fingerprint' | 'iris' | 'none'

export interface BiometricStatus {
  isAvailable: boolean
  isEnabled: boolean
  biometricType: BiometricType
  securityLevel: 'none' | 'low' | 'high'
}

export interface AuthenticateOptions {
  promptMessage?: string
  cancelLabel?: string
  fallbackLabel?: string
  disableDeviceFallback?: boolean
}

/**
 * Check what biometric authentication types are available
 */
export async function getBiometricTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
  try {
    return await LocalAuthentication.supportedAuthenticationTypesAsync()
  } catch {
    return []
  }
}

/**
 * Map LocalAuthentication types to a friendly BiometricType
 */
function mapBiometricType(types: LocalAuthentication.AuthenticationType[]): BiometricType {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'facial'
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'fingerprint'
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'iris'
  }
  return 'none'
}

/**
 * Get a human-friendly name for the biometric type
 */
export function getBiometricTypeName(type: BiometricType): string {
  switch (type) {
    case 'facial':
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition'
    case 'fingerprint':
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint'
    case 'iris':
      return 'Iris Scanner'
    case 'none':
    default:
      return 'Biometrics'
  }
}

/**
 * Check if biometric authentication is available on this device
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync()
    if (!compatible) return false

    const enrolled = await LocalAuthentication.isEnrolledAsync()
    return enrolled
  } catch {
    return false
  }
}

/**
 * Get the current security level
 */
export async function getSecurityLevel(): Promise<'none' | 'low' | 'high'> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync()
    switch (level) {
      case LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG:
      case LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK:
        return 'high'
      case LocalAuthentication.SecurityLevel.SECRET:
        return 'low'
      default:
        return 'none'
    }
  } catch {
    return 'none'
  }
}

/**
 * Get the full biometric status
 */
export async function getBiometricStatus(): Promise<BiometricStatus> {
  const isAvailable = await isBiometricAvailable()
  const types = await getBiometricTypes()
  const biometricType = mapBiometricType(types)
  const securityLevel = await getSecurityLevel()

  // Check if user has enabled biometric unlock
  const enabledStr = await getSecureItem(BIOMETRIC_ENABLED_KEY as typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS])
  const isEnabled = enabledStr === 'true'

  return {
    isAvailable,
    isEnabled: isAvailable && isEnabled,
    biometricType,
    securityLevel,
  }
}

/**
 * Enable biometric authentication
 * Returns true if successfully enabled
 */
export async function enableBiometricAuth(): Promise<boolean> {
  const isAvailable = await isBiometricAvailable()
  if (!isAvailable) {
    return false
  }

  // Verify the user can authenticate before enabling
  const result = await authenticate({
    promptMessage: 'Verify your identity to enable biometric unlock',
    fallbackLabel: 'Use Passcode',
  })

  if (result.success) {
    await setSecureItem(
      BIOMETRIC_ENABLED_KEY as typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS],
      'true'
    )
    return true
  }

  return false
}

/**
 * Disable biometric authentication
 */
export async function disableBiometricAuth(): Promise<void> {
  await deleteSecureItem(BIOMETRIC_ENABLED_KEY as typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS])
}

/**
 * Authenticate using biometrics
 */
export async function authenticate(
  options: AuthenticateOptions = {}
): Promise<LocalAuthentication.LocalAuthenticationResult> {
  const {
    promptMessage = 'Authenticate to unlock',
    cancelLabel = 'Cancel',
    fallbackLabel = 'Use Passcode',
    disableDeviceFallback = false,
  } = options

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      fallbackLabel,
      disableDeviceFallback,
    })

    return result
  } catch (error) {
    console.error('Biometric authentication error:', error)
    return {
      success: false,
      error: 'unknown',
    }
  }
}

/**
 * Quick unlock using biometrics (if enabled)
 * Returns true if unlocked successfully via biometrics
 * Returns false if biometrics not enabled or authentication failed
 */
export async function quickUnlock(): Promise<boolean> {
  const status = await getBiometricStatus()

  if (!status.isAvailable || !status.isEnabled) {
    return false
  }

  const typeName = getBiometricTypeName(status.biometricType)
  const result = await authenticate({
    promptMessage: `Unlock BuildIt with ${typeName}`,
    fallbackLabel: 'Use Password',
  })

  return result.success
}

/**
 * Check if quick unlock is available
 */
export async function canQuickUnlock(): Promise<boolean> {
  const status = await getBiometricStatus()
  return status.isAvailable && status.isEnabled
}
