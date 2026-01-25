/**
 * Relay Management Screen
 *
 * Allows users to view, add, and remove Nostr relays.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useRouter, Stack } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { haptics } from '../src/utils/platform'
import { relayService, DEFAULT_RELAYS, type RelayConfig } from '../src/services/nostrRelay'
import { setSecureItem, getSecureItem, STORAGE_KEYS } from '../src/storage/secureStorage'

interface RelayInfo {
  url: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  isDefault: boolean
}

export default function RelaysScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [relays, setRelays] = useState<RelayInfo[]>([])
  const [newRelayUrl, setNewRelayUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)

  // Load saved relays on mount
  useEffect(() => {
    loadRelays()
  }, [])

  const loadRelays = async () => {
    setIsLoading(true)
    try {
      // Load custom relays from storage
      const savedRelaysJson = await getSecureItem(STORAGE_KEYS.RELAY_CONFIG)
      const savedRelays: string[] = savedRelaysJson ? JSON.parse(savedRelaysJson) : []

      // Get default relay URLs
      const defaultRelayUrls = DEFAULT_RELAYS.map((r) => r.url)

      // Combine with custom relays (deduped)
      const allRelayUrls = [...new Set([...defaultRelayUrls, ...savedRelays])]

      // Get connection status from relay service
      const statuses = relayService.getStatuses()
      const connectedUrls = statuses.filter((s) => s.connected).map((s) => s.url)

      const relayInfos: RelayInfo[] = allRelayUrls.map((url) => ({
        url,
        status: connectedUrls.includes(url) ? 'connected' : 'disconnected',
        isDefault: defaultRelayUrls.includes(url),
      }))

      setRelays(relayInfos)
    } catch (error) {
      console.error('Failed to load relays:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddRelay = useCallback(async () => {
    const url = newRelayUrl.trim()

    // Validate URL
    if (!url) {
      await haptics.error()
      Alert.alert('Error', 'Please enter a relay URL')
      return
    }

    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      await haptics.error()
      Alert.alert('Error', 'Relay URL must start with wss:// or ws://')
      return
    }

    // Check if already added
    if (relays.some((r) => r.url === url)) {
      await haptics.warning()
      Alert.alert('Already Added', 'This relay is already in your list')
      return
    }

    setIsAdding(true)
    await haptics.light()

    try {
      // Add to list
      const newRelay: RelayInfo = {
        url,
        status: 'connecting',
        isDefault: false,
      }

      setRelays((prev) => [...prev, newRelay])
      setNewRelayUrl('')

      // Save to storage
      const savedRelaysJson = await getSecureItem(STORAGE_KEYS.RELAY_CONFIG)
      const savedRelays: string[] = savedRelaysJson ? JSON.parse(savedRelaysJson) : []
      await setSecureItem(STORAGE_KEYS.RELAY_CONFIG, JSON.stringify([...savedRelays, url]))

      // Try to connect
      await relayService.connect([{ url, read: true, write: true }])

      // Update status
      setRelays((prev) =>
        prev.map((r) => (r.url === url ? { ...r, status: 'connected' } : r))
      )

      await haptics.success()
    } catch (error) {
      console.error('Failed to add relay:', error)
      setRelays((prev) =>
        prev.map((r) => (r.url === url ? { ...r, status: 'error' } : r))
      )
      await haptics.error()
    } finally {
      setIsAdding(false)
    }
  }, [newRelayUrl, relays])

  const handleRemoveRelay = useCallback(
    async (url: string) => {
      const relay = relays.find((r) => r.url === url)

      if (relay?.isDefault) {
        await haptics.warning()
        Alert.alert(
          'Cannot Remove',
          'Default relays cannot be removed. You can add your own relays instead.'
        )
        return
      }

      Alert.alert('Remove Relay', `Remove ${url}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await haptics.medium()

            // Remove from list
            setRelays((prev) => prev.filter((r) => r.url !== url))

            // Remove from storage
            const savedRelaysJson = await getSecureItem(STORAGE_KEYS.RELAY_CONFIG)
            const savedRelays: string[] = savedRelaysJson ? JSON.parse(savedRelaysJson) : []
            await setSecureItem(
              STORAGE_KEYS.RELAY_CONFIG,
              JSON.stringify(savedRelays.filter((r) => r !== url))
            )

            // Note: Individual relay disconnect not supported yet
            // relayService.disconnect() disconnects all relays
          },
        },
      ])
    },
    [relays]
  )

  const handleReconnect = useCallback(async (url: string) => {
    await haptics.light()

    setRelays((prev) =>
      prev.map((r) => (r.url === url ? { ...r, status: 'connecting' } : r))
    )

    try {
      await relayService.connect([{ url, read: true, write: true }])
      setRelays((prev) =>
        prev.map((r) => (r.url === url ? { ...r, status: 'connected' } : r))
      )
      await haptics.success()
    } catch {
      setRelays((prev) =>
        prev.map((r) => (r.url === url ? { ...r, status: 'error' } : r))
      )
      await haptics.error()
    }
  }, [])

  const getStatusColor = (status: RelayInfo['status']) => {
    switch (status) {
      case 'connected':
        return '#22c55e'
      case 'connecting':
        return '#f59e0b'
      case 'error':
        return '#ef4444'
      default:
        return '#a3a3a3'
    }
  }

  const getStatusLabel = (status: RelayInfo['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'error':
        return 'Error'
      default:
        return 'Disconnected'
    }
  }

  const renderRelay = ({ item }: { item: RelayInfo }) => (
    <View style={styles.relayItem}>
      <View style={styles.relayContent}>
        <View style={styles.relayHeader}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={styles.relayUrl} numberOfLines={1}>
            {item.url.replace('wss://', '').replace('ws://', '')}
          </Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
        <Text style={styles.relayStatus}>{getStatusLabel(item.status)}</Text>
      </View>

      <View style={styles.relayActions}>
        {(item.status === 'disconnected' || item.status === 'error') && (
          <Pressable
            style={styles.reconnectButton}
            onPress={() => handleReconnect(item.url)}
          >
            <Text style={styles.reconnectButtonText}>Connect</Text>
          </Pressable>
        )}
        {!item.isDefault && (
          <Pressable
            style={styles.removeButton}
            onPress={() => handleRemoveRelay(item.url)}
          >
            <Text style={styles.removeButtonText}>×</Text>
          </Pressable>
        )}
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Relay Servers',
          headerBackTitle: 'Settings',
        }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Relay Servers</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Add Relay */}
      <View style={styles.addSection}>
        <Text style={styles.addLabel}>Add Custom Relay</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="wss://relay.example.com"
            placeholderTextColor="#a3a3a3"
            value={newRelayUrl}
            onChangeText={setNewRelayUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Pressable
            style={[styles.addButton, isAdding && styles.addButtonDisabled]}
            onPress={handleAddRelay}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Relays are servers that store and transmit your messages on the Nostr network.
          Using multiple relays improves reliability and censorship resistance.
        </Text>
      </View>

      {/* Relay List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a0a0a" />
          <Text style={styles.loadingText}>Loading relays...</Text>
        </View>
      ) : (
        <FlatList
          data={relays}
          keyExtractor={(item) => item.url}
          renderItem={renderRelay}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No relays configured</Text>
            </View>
          }
        />
      )}

      {/* Stats */}
      <View style={[styles.statsBar, { paddingBottom: insets.bottom || spacing[4] }]}>
        <Text style={styles.statsText}>
          {relays.filter((r) => r.status === 'connected').length} of {relays.length} connected
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  addSection: {
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addLabel: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#737373',
    marginBottom: spacing[2],
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  addInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: fontSize.base,
    color: '#0a0a0a',
  },
  addButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: 10,
    justifyContent: 'center',
    minWidth: 60,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#d4d4d4',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  infoBox: {
    margin: spacing[4],
    padding: spacing[3],
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: '#0c4a6e',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
  },
  loadingText: {
    fontSize: fontSize.base,
    color: '#737373',
  },
  listContent: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },
  relayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  relayContent: {
    flex: 1,
  },
  relayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  relayUrl: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  defaultBadge: {
    backgroundColor: '#e5e5e5',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: fontSize.xs,
    color: '#737373',
  },
  relayStatus: {
    fontSize: fontSize.sm,
    color: '#a3a3a3',
    marginLeft: 16,
  },
  relayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  reconnectButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 6,
  },
  reconnectButtonText: {
    fontSize: fontSize.sm,
    color: '#0a0a0a',
    fontWeight: String(fontWeight.medium) as '500',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: fontSize.lg,
    color: '#dc2626',
    fontWeight: String(fontWeight.bold) as '700',
  },
  emptyContainer: {
    paddingVertical: spacing[10],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.base,
    color: '#a3a3a3',
  },
  statsBar: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  statsText: {
    fontSize: fontSize.sm,
    color: '#737373',
    textAlign: 'center',
  },
})
