/**
 * Messages Tab - Direct Messages List
 *
 * Shows list of conversations and allows composing new messages.
 * Connects to Nostr relays and displays encrypted DMs.
 */

import { useState, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore, useMessageStore } from '../../src/stores'
import type { Conversation } from '../../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

interface ConversationListItem {
  contactPubkey: string
  contactName?: string
  lastMessage: string
  lastMessageAt: number
  unreadCount: number
}

function formatTime(timestamp: number): string {
  const now = Date.now() / 1000
  const diff = now - timestamp

  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function MessagesTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { identity } = useAuthStore()
  const { conversations, isLoading, isConnected, initialize, disconnect } = useMessageStore()
  const [searchQuery, setSearchQuery] = useState('')

  // Initialize message store when identity is available
  useEffect(() => {
    if (identity?.publicKey && identity?.privateKey) {
      initialize(identity.publicKey, identity.privateKey)
    }

    return () => {
      disconnect()
    }
  }, [identity?.publicKey, identity?.privateKey, initialize, disconnect])

  // Convert Map to array and filter
  const conversationList = useMemo(() => {
    const list: ConversationListItem[] = []

    conversations.forEach((conv: Conversation) => {
      const lastMessage = conv.messages[conv.messages.length - 1]
      list.push({
        contactPubkey: conv.contactPubkey,
        contactName: conv.contactName,
        lastMessage: lastMessage?.content || '',
        lastMessageAt: conv.lastMessageAt,
        unreadCount: conv.unreadCount,
      })
    })

    // Sort by last message time (newest first)
    list.sort((a, b) => b.lastMessageAt - a.lastMessageAt)

    // Filter by search
    if (searchQuery) {
      return list.filter(
        (c) =>
          c.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.contactPubkey.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return list
  }, [conversations, searchQuery])

  const renderConversation = ({ item }: { item: ConversationListItem }) => (
    <Pressable
      style={styles.conversationItem}
      onPress={() => {
        router.push(`/chat/${item.contactPubkey}`)
      }}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.contactName?.[0] || item.contactPubkey[0]?.toUpperCase() || '?'}
        </Text>
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.contactName || `${item.contactPubkey.slice(0, 8)}...`}
          </Text>
          <Text style={styles.timestamp}>{formatTime(item.lastMessageAt)}</Text>
        </View>
        <View style={styles.conversationPreview}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || 'No messages yet'}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  )

  if (!identity) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyTitle}>Not Logged In</Text>
        <Text style={styles.emptySubtitle}>
          Please create or import an identity to view messages.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/')}>
          <Text style={styles.primaryButtonText}>Go to Login</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerRight}>
          {isConnected && (
            <View style={styles.connectedBadge}>
              <View style={styles.connectedDot} />
            </View>
          )}
          <Pressable style={styles.newButton} onPress={() => router.push('/compose')}>
            <Text style={styles.newButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor="#a3a3a3"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Loading state */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0a0a0a" />
          <Text style={styles.loadingText}>Connecting to relays...</Text>
        </View>
      )}

      {/* Conversations List */}
      <FlatList
        data={conversationList}
        keyExtractor={(item) => item.contactPubkey}
        renderItem={renderConversation}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {isLoading ? null : (
              <>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>No Messages Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start a conversation by tapping the + button
                </Text>
              </>
            )}
          </View>
        }
      />
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
    fontSize: fontSize.xl,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#0a0a0a',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  newButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newButtonText: {
    fontSize: fontSize.lg,
    color: '#ffffff',
  },
  searchContainer: {
    padding: spacing[4],
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: fontSize.base,
    color: '#0a0a0a',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  listContent: {
    paddingBottom: spacing[6],
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#737373',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  contactName: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    flex: 1,
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
    marginLeft: spacing[2],
  },
  conversationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: fontSize.sm,
    color: '#737373',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing[2],
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: fontSize.xs,
    color: '#ffffff',
    fontWeight: String(fontWeight.semibold) as '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing[16],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: '#737373',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: 10,
    marginTop: spacing[4],
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
})
