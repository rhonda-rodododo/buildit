/**
 * Join Group Screen
 *
 * Allows users to join a group via invite code or by scanning a QR code.
 */

import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useRouter, Stack } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { useAuthStore, useGroupsStore } from '../src/stores'
import { haptics } from '../src/utils/platform'

export default function JoinGroupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { identity } = useAuthStore()
  const { joinGroup } = useGroupsStore()

  const [inviteCode, setInviteCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const handleJoinGroup = useCallback(async () => {
    const code = inviteCode.trim()

    if (!code) {
      await haptics.error()
      Alert.alert('Error', 'Please enter an invite code')
      return
    }

    if (!identity?.publicKey) {
      await haptics.error()
      Alert.alert('Error', 'You must be logged in to join a group')
      return
    }

    setIsJoining(true)
    await haptics.light()

    try {
      // Parse invite code - could be:
      // 1. A nostr group ID (note1...)
      // 2. A group invite URL (nostr:naddr1... or https://buildit.network/g/...)
      // 3. A simple group code

      // For MVP, we'll support simple group IDs
      const groupId = parseInviteCode(code)

      if (!groupId) {
        throw new Error('Invalid invite code format')
      }

      await joinGroup(groupId)
      await haptics.success()

      Alert.alert('Success', 'You have joined the group!', [
        {
          text: 'Open Group',
          onPress: () => router.replace(`/group/${groupId}`),
        },
      ])
    } catch (error) {
      await haptics.error()
      console.error('Failed to join group:', error)
      Alert.alert(
        'Failed to Join',
        error instanceof Error ? error.message : 'Could not join the group. Please check the invite code and try again.'
      )
    } finally {
      setIsJoining(false)
    }
  }, [inviteCode, identity?.publicKey, joinGroup, router])

  const handleScanQR = useCallback(async () => {
    await haptics.light()
    router.push('/scan')
  }, [router])

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
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Join Group',
          headerBackTitle: 'Groups',
        }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Join Group</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Enter an invite code to join a group. You can get invite codes from group members or scan a QR code.
          </Text>
        </View>

        {/* Invite Code Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Invite Code</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter invite code or group ID"
            placeholderTextColor="#a3a3a3"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Join Button */}
        <Pressable
          style={[styles.primaryButton, isJoining && styles.primaryButtonDisabled]}
          onPress={handleJoinGroup}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>Join Group</Text>
          )}
        </Pressable>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Scan QR Button */}
        <Pressable style={styles.scanButton} onPress={handleScanQR}>
          <Text style={styles.scanButtonIcon}>📱</Text>
          <Text style={styles.scanButtonText}>Scan QR Code</Text>
        </Pressable>
      </View>
    </View>
  )
}

/**
 * Parse various invite code formats
 */
function parseInviteCode(code: string): string | null {
  const trimmed = code.trim()

  // Check if it's a nostr: URI
  if (trimmed.startsWith('nostr:')) {
    // Extract the identifier after nostr:
    const identifier = trimmed.slice(6)
    // TODO: Decode naddr or note identifier
    return identifier
  }

  // Check if it's a BuildIt group URL
  if (trimmed.includes('buildit.network/g/') || trimmed.includes('buildit.app/g/')) {
    const match = trimmed.match(/\/g\/([a-zA-Z0-9]+)/)
    if (match) {
      return match[1]
    }
  }

  // Check if it's a valid hex string (group ID)
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase()
  }

  // Check if it's a simple alphanumeric code
  if (/^[a-zA-Z0-9_-]{8,}$/.test(trimmed)) {
    return trimmed
  }

  // Return as-is if nothing matches
  return trimmed.length > 0 ? trimmed : null
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
  },
  backButton: {
    padding: spacing[2],
  },
  backButtonText: {
    fontSize: fontSize.xl,
    color: '#0a0a0a',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  infoBox: {
    padding: spacing[4],
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    marginBottom: spacing[6],
  },
  infoText: {
    fontSize: fontSize.sm,
    color: '#0c4a6e',
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: spacing[4],
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#737373',
    marginBottom: spacing[2],
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    fontSize: fontSize.base,
    color: '#0a0a0a',
  },
  primaryButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonDisabled: {
    backgroundColor: '#d4d4d4',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[6],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e5e5',
  },
  dividerText: {
    fontSize: fontSize.sm,
    color: '#a3a3a3',
    paddingHorizontal: spacing[4],
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: 10,
    gap: spacing[2],
  },
  scanButtonIcon: {
    fontSize: 20,
  },
  scanButtonText: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  errorText: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[4],
  },
})
