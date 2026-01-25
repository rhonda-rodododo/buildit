/**
 * Lock Screen Component
 *
 * Displayed when the app is locked, prompts for biometric or password unlock.
 * Supports PIN-based unlock as fallback.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Keyboard,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { useAuthStore } from '../stores/authStore'
import { haptics } from '../utils/platform'

interface LockScreenProps {
  onUnlock?: () => void
}

const PIN_LENGTH = 6

export function LockScreen({ onUnlock }: LockScreenProps) {
  const insets = useSafeAreaInsets()
  const identity = useAuthStore((s) => s.identity)
  const biometricStatus = useAuthStore((s) => s.biometricStatus)
  const attemptBiometricUnlock = useAuthStore((s) => s.attemptBiometricUnlock)
  const unlock = useAuthStore((s) => s.unlock)
  const verifyPin = useAuthStore((s) => s.verifyPin)
  const hasPin = useAuthStore((s) => s.hasPin)
  const getBiometricName = useAuthStore((s) => s.getBiometricTypeName)

  const [isUnlocking, setIsUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPinEntry, setShowPinEntry] = useState(false)
  const [pin, setPin] = useState('')
  const [pinAttempts, setPinAttempts] = useState(0)
  const pinInputRef = useRef<TextInput>(null)

  const biometricName = getBiometricName()
  const canUseBiometric = biometricStatus?.isAvailable && biometricStatus?.isEnabled
  const pinEnabled = hasPin()

  const handleBiometricUnlock = async () => {
    if (isUnlocking) return
    setIsUnlocking(true)
    setError(null)

    try {
      const success = await attemptBiometricUnlock()
      if (success) {
        await haptics.success()
        onUnlock?.()
      } else {
        await haptics.error()
        setError(`${biometricName} authentication failed. Please try again.`)
      }
    } catch {
      await haptics.error()
      setError('An error occurred. Please try again.')
    } finally {
      setIsUnlocking(false)
    }
  }

  // Auto-prompt biometric on mount if available
  useEffect(() => {
    if (canUseBiometric) {
      // Small delay to ensure screen is ready
      const timer = setTimeout(() => {
        handleBiometricUnlock()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [])

  // Focus PIN input when shown
  useEffect(() => {
    if (showPinEntry) {
      setTimeout(() => {
        pinInputRef.current?.focus()
      }, 100)
    }
  }, [showPinEntry])

  const handlePinChange = useCallback(async (value: string) => {
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, '').slice(0, PIN_LENGTH)
    setPin(digitsOnly)
    setError(null)

    // Provide haptic feedback for each digit
    if (digitsOnly.length > pin.length) {
      await haptics.light()
    }

    // Auto-submit when PIN is complete
    if (digitsOnly.length === PIN_LENGTH) {
      Keyboard.dismiss()
      await handlePinSubmit(digitsOnly)
    }
  }, [pin.length])

  const handlePinSubmit = async (submittedPin: string) => {
    if (submittedPin.length !== PIN_LENGTH) return

    setIsUnlocking(true)
    setError(null)

    try {
      const isValid = await verifyPin(submittedPin)
      if (isValid) {
        await haptics.success()
        unlock()
        onUnlock?.()
      } else {
        await haptics.error()
        const newAttempts = pinAttempts + 1
        setPinAttempts(newAttempts)
        setPin('')

        if (newAttempts >= 5) {
          setError('Too many failed attempts. Please wait before trying again.')
        } else {
          setError(`Incorrect PIN. ${5 - newAttempts} attempts remaining.`)
        }
      }
    } catch {
      await haptics.error()
      setError('An error occurred. Please try again.')
      setPin('')
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleShowPinEntry = async () => {
    await haptics.light()
    setShowPinEntry(true)
    setError(null)
    setPin('')
  }

  const handleBackToBiometric = async () => {
    await haptics.light()
    setShowPinEntry(false)
    setError(null)
    setPin('')
  }

  // If no PIN is set and no biometric, just unlock (first-time setup scenario)
  const handleNoSecurityUnlock = async () => {
    await haptics.light()
    unlock()
    onUnlock?.()
  }

  // PIN entry screen
  if (showPinEntry) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing[12] }]}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>B</Text>
          </View>
        </View>

        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.subtitle}>
          Enter your {PIN_LENGTH}-digit PIN to unlock
        </Text>

        {/* PIN dots display */}
        <View style={styles.pinDotsContainer}>
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                index < pin.length && styles.pinDotFilled,
              ]}
            />
          ))}
        </View>

        {/* Hidden text input for keyboard */}
        <TextInput
          ref={pinInputRef}
          style={styles.hiddenInput}
          value={pin}
          onChangeText={handlePinChange}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          secureTextEntry
          autoFocus
        />

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isUnlocking && (
          <ActivityIndicator size="small" color="#0a0a0a" style={styles.loader} />
        )}

        {/* Back to biometric option */}
        {canUseBiometric && (
          <Pressable style={styles.secondaryButton} onPress={handleBackToBiometric}>
            <Text style={styles.secondaryButtonText}>Use {biometricName} Instead</Text>
          </Pressable>
        )}

        {/* Tap to show keyboard again */}
        <Pressable
          style={styles.tapToFocus}
          onPress={() => pinInputRef.current?.focus()}
        >
          <Text style={styles.tapToFocusText}>Tap to enter PIN</Text>
        </Pressable>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[6] }]}>
          <Text style={styles.footerText}>
            Your data is encrypted and stored securely on this device.
          </Text>
        </View>
      </View>
    )
  }

  // Main unlock screen
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[12] }]}>
      {/* App icon/logo area */}
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>B</Text>
        </View>
      </View>

      <Text style={styles.title}>BuildIt</Text>
      <Text style={styles.subtitle}>
        {identity?.displayName
          ? `Welcome back, ${identity.displayName}`
          : 'Welcome back'}
      </Text>

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Unlock buttons */}
      <View style={styles.buttonContainer}>
        {canUseBiometric && (
          <Pressable
            style={[styles.primaryButton, isUnlocking && styles.buttonDisabled]}
            onPress={handleBiometricUnlock}
            disabled={isUnlocking}
          >
            {isUnlocking ? (
              <ActivityIndicator color="#fafafa" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Unlock with {biometricName}
              </Text>
            )}
          </Pressable>
        )}

        {pinEnabled ? (
          <Pressable style={styles.secondaryButton} onPress={handleShowPinEntry}>
            <Text style={styles.secondaryButtonText}>
              {canUseBiometric ? 'Use PIN Instead' : 'Unlock with PIN'}
            </Text>
          </Pressable>
        ) : !canUseBiometric ? (
          // No security configured - allow unlock (first-time or testing)
          <Pressable style={styles.primaryButton} onPress={handleNoSecurityUnlock}>
            <Text style={styles.primaryButtonText}>Unlock</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Security notice */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[6] }]}>
        <Text style={styles.footerText}>
          Your data is encrypted and stored securely on this device.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  logoContainer: {
    marginBottom: spacing[6],
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 36,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#fafafa',
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: fontSize.base,
    color: '#737373',
    marginBottom: spacing[8],
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: spacing[3],
    borderRadius: 8,
    marginBottom: spacing[4],
    width: '100%',
    maxWidth: 320,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: '#991b1b',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    gap: spacing[3],
  },
  primaryButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fafafa',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  secondaryButton: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0a0a0a',
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing[6],
  },
  footerText: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
    textAlign: 'center',
  },
  // PIN entry styles
  pinDotsContainer: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d4d4d4',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: '#0a0a0a',
    borderColor: '#0a0a0a',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  loader: {
    marginBottom: spacing[4],
  },
  tapToFocus: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    marginTop: spacing[4],
  },
  tapToFocusText: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
})
