/**
 * Settings Tab - Account & Preferences
 *
 * Account management, security settings, linked devices, and preferences.
 */

import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Platform,
  TextInput,
  Modal,
} from 'react-native'
import { useRouter } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../src/stores'
import type { LinkedDevice } from '../../src/stores'
import { BiometricSettings, LanguagePicker, ThemeToggle } from '../../src/components'
import { useTranslation } from '../../src/i18n'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { haptics } from '../../src/utils/platform'

interface SettingRowProps {
  icon: string
  title: string
  subtitle?: string
  onPress?: () => void
  rightElement?: React.ReactNode
  danger?: boolean
}

function SettingRow({ icon, title, subtitle, onPress, rightElement, danger }: SettingRowProps) {
  return (
    <Pressable
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <Text style={styles.settingIcon}>{icon}</Text>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && <Text style={styles.settingArrow}>›</Text>)}
    </Pressable>
  )
}

function DeviceItem({ device, onRemove }: { device: LinkedDevice; onRemove: () => void }) {
  const platformIcon = device.platform === 'ios' ? '📱' : device.platform === 'android' ? '🤖' : '💻'
  const isRecent = Date.now() - device.lastSeen < 1000 * 60 * 5 // 5 minutes

  return (
    <View style={styles.deviceItem}>
      <Text style={styles.deviceIcon}>{platformIcon}</Text>
      <View style={styles.deviceContent}>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={styles.deviceMeta}>
          {isRecent ? 'Active now' : `Last seen ${formatRelativeTime(device.lastSeen)}`}
        </Text>
      </View>
      <Pressable style={styles.deviceRemove} onPress={onRemove}>
        <Text style={styles.deviceRemoveText}>Remove</Text>
      </Pressable>
    </View>
  )
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const PIN_LENGTH = 6

export default function SettingsTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { identity, linkedDevices, removeLinkedDevice, logout, hasPin, setPin, removePin } = useAuthStore()
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinValue, setPinValue] = useState('')
  const [confirmPinValue, setConfirmPinValue] = useState('')
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter')
  const [pinError, setPinError] = useState<string | null>(null)

  const pinEnabled = hasPin()

  const handlePinToggle = useCallback(async () => {
    if (pinEnabled) {
      // Disable PIN
      Alert.alert(
        'Remove PIN',
        'Are you sure you want to remove your PIN? You will need to set up biometric authentication or a new PIN to secure your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              await removePin()
              await haptics.success()
            },
          },
        ]
      )
    } else {
      // Set up PIN
      setShowPinModal(true)
      setPinValue('')
      setConfirmPinValue('')
      setPinStep('enter')
      setPinError(null)
    }
  }, [pinEnabled, removePin])

  const handlePinSubmit = useCallback(async () => {
    if (pinStep === 'enter') {
      if (pinValue.length !== PIN_LENGTH) {
        setPinError(`PIN must be ${PIN_LENGTH} digits`)
        await haptics.error()
        return
      }
      setPinStep('confirm')
      setPinError(null)
    } else {
      if (confirmPinValue !== pinValue) {
        setPinError('PINs do not match. Please try again.')
        setConfirmPinValue('')
        await haptics.error()
        return
      }
      try {
        await setPin(pinValue)
        await haptics.success()
        setShowPinModal(false)
        Alert.alert('Success', 'Your PIN has been set up successfully.')
      } catch {
        setPinError('Failed to set PIN. Please try again.')
        await haptics.error()
      }
    }
  }, [pinStep, pinValue, confirmPinValue, setPin])

  const handlePinClose = useCallback(() => {
    setShowPinModal(false)
    setPinValue('')
    setConfirmPinValue('')
    setPinStep('enter')
    setPinError(null)
  }, [])

  const handleShowRecoveryPhrase = () => {
    if (showRecoveryPhrase) {
      setShowRecoveryPhrase(false)
      return
    }

    Alert.alert(
      'Show Recovery Phrase',
      'Your recovery phrase is the only way to recover your account. Never share it with anyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Show',
          onPress: () => setShowRecoveryPhrase(true),
        },
      ]
    )
  }

  const handleRemoveDevice = (device: LinkedDevice) => {
    Alert.alert(
      'Remove Device',
      `Remove "${device.name}" from linked devices?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeLinkedDevice(device.id),
        },
      ]
    )
  }

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Make sure you have your recovery phrase saved before logging out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout()
            router.replace('/')
          },
        },
      ]
    )
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your local data. Your identity will still exist on the Nostr network. Make sure you have your recovery phrase saved!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await logout()
            router.replace('/')
          },
        },
      ]
    )
  }

  if (!identity) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Not Logged In</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/')}>
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {identity.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{identity.displayName || 'Anonymous'}</Text>
            <Text style={styles.profilePubkey}>
              {identity.publicKey.slice(0, 12)}...{identity.publicKey.slice(-8)}
            </Text>
          </View>
        </View>
        <SettingRow
          icon="✏️"
          title="Edit Profile"
          subtitle="Change your display name"
          onPress={() => router.push('/edit-profile')}
        />
        <SettingRow
          icon="📤"
          title="Share Profile"
          subtitle="Show your QR code"
          onPress={() => router.push('/share-profile')}
        />
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <SettingRow
          icon="🔑"
          title="Recovery Phrase"
          subtitle={showRecoveryPhrase ? 'Tap to hide' : 'Tap to reveal'}
          onPress={handleShowRecoveryPhrase}
        />
        {showRecoveryPhrase && identity.recoveryPhrase && (
          <View style={styles.recoveryPhraseContainer}>
            <Text style={styles.recoveryPhraseWarning}>
              Never share this phrase with anyone!
            </Text>
            <View style={styles.recoveryPhraseBox}>
              <Text style={styles.recoveryPhraseText}>{identity.recoveryPhrase}</Text>
            </View>
          </View>
        )}
        {Platform.OS !== 'web' && <BiometricSettings />}
        <SettingRow
          icon="🔢"
          title="PIN Lock"
          subtitle={pinEnabled ? 'PIN is enabled' : 'Set up a PIN to unlock'}
          rightElement={
            <Switch
              value={pinEnabled}
              onValueChange={handlePinToggle}
              trackColor={{ false: '#e5e5e5', true: '#0a0a0a' }}
              thumbColor="#ffffff"
            />
          }
        />
      </View>

      {/* PIN Setup Modal */}
      <Modal
        visible={showPinModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePinClose}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + spacing[4] }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={handlePinClose}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {pinStep === 'enter' ? 'Create PIN' : 'Confirm PIN'}
            </Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.pinSetupContent}>
            <Text style={styles.pinInstructions}>
              {pinStep === 'enter'
                ? `Enter a ${PIN_LENGTH}-digit PIN to secure your account`
                : 'Enter your PIN again to confirm'}
            </Text>

            {/* PIN dots display */}
            <View style={styles.pinDotsRow}>
              {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.pinDot,
                    index < (pinStep === 'enter' ? pinValue : confirmPinValue).length && styles.pinDotFilled,
                  ]}
                />
              ))}
            </View>

            {pinError && (
              <Text style={styles.pinErrorText}>{pinError}</Text>
            )}

            <TextInput
              style={styles.hiddenPinInput}
              value={pinStep === 'enter' ? pinValue : confirmPinValue}
              onChangeText={(text) => {
                const digitsOnly = text.replace(/\D/g, '').slice(0, PIN_LENGTH)
                if (pinStep === 'enter') {
                  setPinValue(digitsOnly)
                } else {
                  setConfirmPinValue(digitsOnly)
                }
                setPinError(null)
              }}
              keyboardType="number-pad"
              maxLength={PIN_LENGTH}
              autoFocus
            />

            <Pressable
              style={[
                styles.pinSubmitButton,
                (pinStep === 'enter' ? pinValue : confirmPinValue).length !== PIN_LENGTH && styles.pinSubmitButtonDisabled,
              ]}
              onPress={handlePinSubmit}
              disabled={(pinStep === 'enter' ? pinValue : confirmPinValue).length !== PIN_LENGTH}
            >
              <Text style={styles.pinSubmitButtonText}>
                {pinStep === 'enter' ? 'Continue' : 'Set PIN'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Devices Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Linked Devices</Text>
        <SettingRow
          icon="📱"
          title="Link New Device"
          subtitle="Scan QR code to connect"
          onPress={() => router.push('/scan')}
        />
        {linkedDevices.length > 0 && (
          <View style={styles.devicesList}>
            {linkedDevices.map((device) => (
              <DeviceItem
                key={device.id}
                device={device}
                onRemove={() => handleRemoveDevice(device)}
              />
            ))}
          </View>
        )}
        {linkedDevices.length === 0 && (
          <View style={styles.noDevices}>
            <Text style={styles.noDevicesText}>No linked devices</Text>
          </View>
        )}
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <SettingRow
          icon="🔔"
          title="Push Notifications"
          subtitle="Get notified of new messages"
          rightElement={
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#e5e5e5', true: '#0a0a0a' }}
              thumbColor="#ffffff"
            />
          }
        />
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('meta.preferences')}</Text>
        <ThemeToggle />
        <LanguagePicker />
      </View>

      {/* Network Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network</Text>
        <SettingRow
          icon="🌐"
          title="Relay Servers"
          subtitle="Manage Nostr relays"
          onPress={() => router.push('/relays')}
        />
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <SettingRow icon="ℹ️" title="About BuildIt" subtitle="Version 0.1.0" />
        <SettingRow icon="📖" title="Privacy Policy" onPress={() => {}} />
        <SettingRow icon="📝" title="Terms of Service" onPress={() => {}} />
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.sectionTitleDanger]}>Danger Zone</Text>
        <SettingRow
          icon="🚪"
          title="Log Out"
          subtitle="Keep your recovery phrase safe"
          onPress={handleLogout}
          danger
        />
        <SettingRow
          icon="🗑️"
          title="Delete Local Data"
          subtitle="Remove all data from this device"
          onPress={handleDeleteAccount}
          danger
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>BuildIt Network v0.1.0</Text>
        <Text style={styles.footerText}>Built with ❤️ for organizers</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  contentContainer: {
    paddingBottom: spacing[10],
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
  },
  section: {
    paddingTop: spacing[4],
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  sectionTitleDanger: {
    color: '#dc2626',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  profileAvatarText: {
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: 2,
  },
  profilePubkey: {
    fontSize: fontSize.sm,
    color: '#737373',
    fontFamily: 'monospace',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  settingIcon: {
    fontSize: 20,
    marginRight: spacing[3],
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  settingTitleDanger: {
    color: '#dc2626',
  },
  settingSubtitle: {
    fontSize: fontSize.sm,
    color: '#737373',
    marginTop: 2,
  },
  settingArrow: {
    fontSize: fontSize.xl,
    color: '#a3a3a3',
  },
  recoveryPhraseContainer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    backgroundColor: '#fef9c3',
  },
  recoveryPhraseWarning: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#854d0e',
    marginBottom: spacing[2],
  },
  recoveryPhraseBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: '#fde047',
  },
  recoveryPhraseText: {
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    color: '#0a0a0a',
    lineHeight: 22,
  },
  devicesList: {
    paddingHorizontal: spacing[4],
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  deviceIcon: {
    fontSize: 24,
    marginRight: spacing[3],
  },
  deviceContent: {
    flex: 1,
  },
  deviceName: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  deviceMeta: {
    fontSize: fontSize.sm,
    color: '#737373',
    marginTop: 2,
  },
  deviceRemove: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  deviceRemoveText: {
    fontSize: fontSize.sm,
    color: '#dc2626',
    fontWeight: String(fontWeight.medium) as '500',
  },
  noDevices: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
  },
  noDevicesText: {
    fontSize: fontSize.sm,
    color: '#a3a3a3',
  },
  footer: {
    paddingVertical: spacing[8],
    alignItems: 'center',
  },
  footerText: {
    fontSize: fontSize.sm,
    color: '#a3a3a3',
    marginBottom: spacing[1],
  },
  errorText: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[4],
  },
  primaryButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  // PIN Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
  },
  modalCancel: {
    fontSize: fontSize.base,
    color: '#0a0a0a',
  },
  modalHeaderSpacer: {
    width: 50,
  },
  pinSetupContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing[12],
    paddingHorizontal: spacing[6],
  },
  pinInstructions: {
    fontSize: fontSize.base,
    color: '#737373',
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  pinDotsRow: {
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
  hiddenPinInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  pinErrorText: {
    fontSize: fontSize.sm,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  pinSubmitButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginTop: spacing[4],
  },
  pinSubmitButtonDisabled: {
    backgroundColor: '#d4d4d4',
  },
  pinSubmitButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
})
