/**
 * Biometric Settings Component
 *
 * Allows users to enable/disable biometric authentication (Face ID, Touch ID, etc.)
 */

import { useState } from 'react'
import { View, Text, Switch, StyleSheet, Alert, Platform } from 'react-native'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { useAuthStore } from '../stores/authStore'

export function BiometricSettings() {
  const biometricStatus = useAuthStore((s) => s.biometricStatus)
  const enableBiometric = useAuthStore((s) => s.enableBiometric)
  const disableBiometric = useAuthStore((s) => s.disableBiometric)
  const getBiometricName = useAuthStore((s) => s.getBiometricTypeName)
  const [isToggling, setIsToggling] = useState(false)

  if (!biometricStatus?.isAvailable) {
    return null
  }

  const biometricName = getBiometricName()

  const handleToggle = async (newValue: boolean) => {
    if (isToggling) return
    setIsToggling(true)

    try {
      if (newValue) {
        const success = await enableBiometric()
        if (!success) {
          Alert.alert(
            'Unable to Enable',
            `Could not enable ${biometricName}. Please ensure you have ${biometricName} set up on your device.`
          )
        }
      } else {
        Alert.alert(
          `Disable ${biometricName}?`,
          `You will need to use your password to unlock the app.`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: async () => {
                await disableBiometric()
              },
            },
          ]
        )
      }
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{biometricName}</Text>
          <Text style={styles.subtitle}>
            {Platform.OS === 'ios'
              ? `Use ${biometricName} to quickly unlock the app`
              : 'Use biometric authentication to quickly unlock'}
          </Text>
        </View>
        <Switch
          value={biometricStatus.isEnabled}
          onValueChange={handleToggle}
          disabled={isToggling}
          trackColor={{ false: '#d4d4d4', true: '#22c55e' }}
          thumbColor={biometricStatus.isEnabled ? '#ffffff' : '#fafafa'}
          ios_backgroundColor="#d4d4d4"
        />
      </View>

      {biometricStatus.isEnabled && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {biometricName} is enabled. Your identity will be protected by your
            device's biometric security.
          </Text>
        </View>
      )}

      {biometricStatus.securityLevel === 'low' && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Your device's biometric security level is low. For better security,
            consider using a passcode instead.
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing[4],
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  infoBox: {
    marginTop: spacing[3],
    marginHorizontal: spacing[4],
    padding: spacing[3],
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  infoText: {
    fontSize: fontSize.xs,
    color: '#166534',
    lineHeight: 18,
  },
  warningBox: {
    marginTop: spacing[3],
    marginHorizontal: spacing[4],
    padding: spacing[3],
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    fontSize: fontSize.xs,
    color: '#92400e',
    lineHeight: 18,
  },
})
