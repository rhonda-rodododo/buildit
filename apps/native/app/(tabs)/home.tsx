/**
 * Home Tab - Dashboard
 *
 * Main dashboard showing activity feed, quick actions, and status.
 */

import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native'
import { useState, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore, useMessageStore } from '../../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

export default function HomeTab() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { identity, logout } = useAuthStore()
  const { conversations, isConnected } = useMessageStore()
  const [refreshing, setRefreshing] = useState(false)

  // Count total unread messages
  const unreadCount = Array.from(conversations.values()).reduce(
    (sum, conv) => sum + conv.unreadCount,
    0
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    // In a real app, we'd refresh data from relays here
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setRefreshing(false)
  }, [])

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
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0a0a0a" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {identity.displayName || 'User'}
          </Text>
          <Text style={styles.pubkey}>
            {identity.publicKey.slice(0, 8)}...{identity.publicKey.slice(-8)}
          </Text>
        </View>
        <View style={[styles.statusBadge, isConnected && styles.statusBadgeActive]}>
          <View style={[styles.statusDot, isConnected && styles.statusDotActive]} />
          <Text style={[styles.statusText, isConnected && styles.statusTextActive]}>
            {isConnected ? 'Connected' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Pressable style={styles.statCard} onPress={() => (router.push as (href: string) => void)('/(tabs)/messages')}>
          <Text style={styles.statNumber}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Unread Messages</Text>
        </Pressable>
        <Pressable style={styles.statCard} onPress={() => (router.push as (href: string) => void)('/(tabs)/groups')}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Active Groups</Text>
        </Pressable>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <Pressable style={styles.actionCard} onPress={() => router.push('/compose')}>
          <Text style={styles.actionIcon}>✉️</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>New Message</Text>
            <Text style={styles.actionSubtitle}>Start a private conversation</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        <Pressable style={styles.actionCard} onPress={() => router.push('/create-group')}>
          <Text style={styles.actionIcon}>➕</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Create Group</Text>
            <Text style={styles.actionSubtitle}>Start organizing together</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        <Pressable style={styles.actionCard} onPress={() => router.push('/scan')}>
          <Text style={styles.actionIcon}>📱</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Link Device</Text>
            <Text style={styles.actionSubtitle}>Connect another device</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.emptyActivity}>
          <Text style={styles.emptyText}>No recent activity</Text>
          <Text style={styles.emptySubtext}>
            Your activity from messages and groups will appear here
          </Text>
        </View>
      </View>

      {/* Logout */}
      <Pressable style={styles.logoutButton} onPress={async () => {
        await logout()
        router.replace('/')
      }}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
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
    padding: spacing[5],
    paddingBottom: spacing[10],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[6],
  },
  greeting: {
    fontSize: fontSize['2xl'],
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
    marginBottom: spacing[1],
  },
  pubkey: {
    fontSize: fontSize.sm,
    color: '#737373',
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 20,
  },
  statusBadgeActive: {
    backgroundColor: '#dcfce7',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a3a3a3',
    marginRight: spacing[2],
  },
  statusDotActive: {
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#737373',
  },
  statusTextActive: {
    color: '#16a34a',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: spacing[4],
    alignItems: 'center',
  },
  statNumber: {
    fontSize: fontSize['3xl'],
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
    marginBottom: spacing[1],
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  actionIcon: {
    fontSize: 24,
    marginRight: spacing[3],
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  actionArrow: {
    fontSize: fontSize.xl,
    color: '#a3a3a3',
  },
  emptyActivity: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: spacing[6],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[1],
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: '#737373',
    textAlign: 'center',
  },
  logoutButton: {
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[4],
  },
  logoutText: {
    fontSize: fontSize.sm,
    color: '#dc2626',
    fontWeight: String(fontWeight.medium) as '500',
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
