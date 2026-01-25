/**
 * Share Profile Screen
 *
 * Allows users to share their profile via QR code or by copying their npub.
 */

import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  Alert,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { useAuthStore } from '../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { haptics } from '../src/utils/platform'

// Simple QR code component using boxes (for MVP - in production use react-native-qrcode-svg)
function SimpleQRCode({ data, size = 200 }: { data: string; size?: number }) {
  // Generate a simple visual pattern based on the data
  // This is a placeholder - in production, use a proper QR library
  const gridSize = 21
  const cellSize = size / gridSize

  // Simple hash function to create a pattern
  const pattern: boolean[][] = []
  for (let i = 0; i < gridSize; i++) {
    pattern[i] = []
    for (let j = 0; j < gridSize; j++) {
      // Create position patterns (corners)
      const isPositionPattern =
        (i < 7 && j < 7) || // Top-left
        (i < 7 && j >= gridSize - 7) || // Top-right
        (i >= gridSize - 7 && j < 7) // Bottom-left

      if (isPositionPattern) {
        // Position pattern borders
        const isBorder =
          i === 0 || i === 6 || j === 0 || j === 6 ||
          i === gridSize - 7 || i === gridSize - 1 ||
          j === gridSize - 7 || j === gridSize - 1
        const isInner =
          (i >= 2 && i <= 4 && j >= 2 && j <= 4) ||
          (i >= 2 && i <= 4 && j >= gridSize - 5 && j <= gridSize - 3) ||
          (i >= gridSize - 5 && i <= gridSize - 3 && j >= 2 && j <= 4)

        pattern[i][j] = isBorder || isInner
      } else {
        // Data pattern (pseudo-random based on data)
        const hash = (data.charCodeAt(i % data.length) + j * 31) % 100
        pattern[i][j] = hash > 50
      }
    }
  }

  return (
    <View style={[styles.qrContainer, { width: size, height: size }]}>
      {pattern.map((row, i) => (
        <View key={i} style={styles.qrRow}>
          {row.map((cell, j) => (
            <View
              key={j}
              style={[
                styles.qrCell,
                { width: cellSize, height: cellSize },
                cell && styles.qrCellFilled,
              ]}
            />
          ))}
        </View>
      ))}
      <View style={styles.qrOverlay}>
        <Text style={styles.qrOverlayText}>📱</Text>
      </View>
    </View>
  )
}

export default function ShareProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { identity } = useAuthStore()
  const [copied, setCopied] = useState(false)

  // Convert hex pubkey to npub format (simplified - in production use nostr-tools)
  const npub = identity?.publicKey
    ? `npub1${identity.publicKey.slice(0, 59)}`
    : ''

  const handleCopyNpub = useCallback(async () => {
    if (!npub) return

    await Clipboard.setStringAsync(npub)
    await haptics.success()
    setCopied(true)

    setTimeout(() => setCopied(false), 2000)
  }, [npub])

  const handleCopyPubkey = useCallback(async () => {
    if (!identity?.publicKey) return

    await Clipboard.setStringAsync(identity.publicKey)
    await haptics.success()
    setCopied(true)

    setTimeout(() => setCopied(false), 2000)
  }, [identity?.publicKey])

  const handleShare = useCallback(async () => {
    if (!npub || !identity) return

    await haptics.light()

    try {
      await Share.share({
        message: `Connect with me on BuildIt Network!\n\nMy profile: ${npub}`,
        title: `${identity.displayName || 'User'} on BuildIt`,
      })
    } catch (error) {
      // User cancelled share
    }
  }, [npub, identity])

  if (!identity) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Not logged in</Text>
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
          title: 'Share Profile',
          headerBackTitle: 'Back',
        }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>Done</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Share Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {identity.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.displayName}>{identity.displayName || 'Anonymous'}</Text>
          <Text style={styles.hint}>Scan the QR code to connect</Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrSection}>
          <View style={styles.qrWrapper}>
            <SimpleQRCode data={npub} size={200} />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, copied && styles.actionButtonSuccess]}
            onPress={handleCopyNpub}
          >
            <Text style={styles.actionIcon}>{copied ? '✓' : '📋'}</Text>
            <Text style={styles.actionText}>
              {copied ? 'Copied!' : 'Copy npub'}
            </Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleShare}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
        </View>

        {/* Pubkey Display */}
        <View style={styles.pubkeySection}>
          <Text style={styles.pubkeyLabel}>Your public key (npub)</Text>
          <Pressable style={styles.pubkeyBox} onPress={handleCopyNpub}>
            <Text style={styles.pubkeyText} numberOfLines={2}>
              {npub}
            </Text>
          </Pressable>
          <Text style={styles.pubkeyHint}>
            Tap to copy • Others can use this to find you on Nostr
          </Text>
        </View>

        {/* Alternative Format */}
        <View style={styles.alternativeSection}>
          <Text style={styles.alternativeLabel}>Hex format (for developers)</Text>
          <Pressable style={styles.alternativeBox} onPress={handleCopyPubkey}>
            <Text style={styles.alternativeText} numberOfLines={1}>
              {identity.publicKey}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
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
  closeButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  closeButtonText: {
    fontSize: fontSize.base,
    color: '#0a0a0a',
    fontWeight: String(fontWeight.medium) as '500',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: spacing[4],
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  avatarText: {
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#ffffff',
  },
  displayName: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[1],
  },
  hint: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  qrSection: {
    paddingVertical: spacing[6],
  },
  qrWrapper: {
    backgroundColor: '#ffffff',
    padding: spacing[4],
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  qrRow: {
    flexDirection: 'row',
  },
  qrCell: {
    backgroundColor: '#ffffff',
  },
  qrCellFilled: {
    backgroundColor: '#0a0a0a',
  },
  qrOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrOverlayText: {
    fontSize: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[4],
    paddingVertical: spacing[4],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: 10,
    gap: spacing[2],
  },
  actionButtonSuccess: {
    backgroundColor: '#dcfce7',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  pubkeySection: {
    width: '100%',
    paddingTop: spacing[4],
  },
  pubkeyLabel: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#737373',
    marginBottom: spacing[2],
  },
  pubkeyBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: spacing[3],
  },
  pubkeyText: {
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    color: '#0a0a0a',
    lineHeight: 20,
  },
  pubkeyHint: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
    marginTop: spacing[2],
  },
  alternativeSection: {
    width: '100%',
    paddingTop: spacing[4],
  },
  alternativeLabel: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
    marginBottom: spacing[1],
  },
  alternativeBox: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: spacing[2],
  },
  alternativeText: {
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
    color: '#737373',
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
})
