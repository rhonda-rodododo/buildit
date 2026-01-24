/**
 * Lock Screen Component
 *
 * Displayed when the app is locked, prompts for biometric or password unlock.
 */

import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { useAuthStore } from '../stores/authStore'

interface LockScreenProps {
  onUnlock?: () => void
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const insets = useSafeAreaInsets()
  const identity = useAuthStore((s) => s.identity)
  const biometricStatus = useAuthStore((s) => s.biometricStatus)
  const attemptBiometricUnlock = useAuthStore((s) => s.attemptBiometricUnlock)
  const unlock = useAuthStore((s) => s.unlock)
  const getBiometricName = useAuthStore((s) => s.getBiometricTypeName)

  const [isUnlocking, setIsUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const biometricName = getBiometricName()
  const canUseBiometric = biometricStatus?.isAvailable && biometricStatus?.isEnabled

  const handleBiometricUnlock = async () => {
    if (isUnlocking) return
    setIsUnlocking(true)
    setError(null)

    try {
      const success = await attemptBiometricUnlock()
      if (success) {
        onUnlock?.()
      } else {
        setError(`${biometricName} authentication failed. Please try again.`)
      }
    } catch (err) {
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

  // For now, if no biometric, just unlock (in production would require password)
  const handlePasswordUnlock = () => {
    // TODO: Implement password prompt
    // For now, just unlock directly
    unlock()
    onUnlock?.()
  }

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

        <Pressable
          style={styles.secondaryButton}
          onPress={handlePasswordUnlock}
        >
          <Text style={styles.secondaryButtonText}>
            {canUseBiometric ? 'Use Password Instead' : 'Unlock with Password'}
          </Text>
        </Pressable>
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
})
