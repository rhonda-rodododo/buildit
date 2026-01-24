/**
 * Group Detail Page
 *
 * Shows group details, chat, members, and settings.
 * Supports NIP-29 group messaging.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useGroupsStore, type Group, useAuthStore } from '../../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'
import { haptics } from '../../src/utils/platform'
import { relayService } from '../../src/services/nostrRelay'
import { createEvent } from '@buildit/sdk'

type Tab = 'chat' | 'members' | 'info'

interface GroupMessage {
  id: string
  content: string
  pubkey: string
  createdAt: number
  isOwn: boolean
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }
  return date.toLocaleDateString()
}

export default function GroupDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { identity } = useAuthStore()
  const { groups, leaveGroup } = useGroupsStore()

  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [messageText, setMessageText] = useState('')
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Find the current group
  const group = groups.find((g) => g.id === id)

  const subscriptionRef = useRef<string | null>(null)

  // Load and subscribe to group messages
  useEffect(() => {
    if (!group || !identity?.publicKey) return

    setIsLoading(true)

    // Subscribe to NIP-29 group chat messages (kind 9) for this group
    const subId = relayService.subscribe(
      [
        {
          kinds: [9], // NIP-29 group chat message
          '#h': [group.id], // Filter by group ID
          limit: 50,
        },
      ],
      (event) => {
        // Handle incoming message
        const newMessage: GroupMessage = {
          id: event.id,
          content: event.content,
          pubkey: event.pubkey,
          createdAt: event.created_at,
          isOwn: event.pubkey === identity.publicKey,
        }

        setMessages((prev) => {
          // Check if message already exists
          if (prev.some((m) => m.id === event.id)) {
            return prev
          }
          // Add and sort by timestamp
          const updated = [...prev, newMessage]
          return updated.sort((a, b) => a.createdAt - b.createdAt)
        })
      },
      () => {
        // End of stored events (EOSE)
        setIsLoading(false)

        // Add welcome message if no messages yet
        setMessages((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: 'welcome',
                content: 'Welcome to the group! 👋 Start the conversation.',
                pubkey: 'system',
                createdAt: Math.floor(Date.now() / 1000) - 1,
                isOwn: false,
              },
            ]
          }
          return prev
        })
      }
    )

    subscriptionRef.current = subId

    return () => {
      if (subscriptionRef.current) {
        relayService.unsubscribe(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [group?.id, identity?.publicKey])

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !identity?.publicKey || !identity?.privateKey || !group) return

    await haptics.light()

    const content = messageText.trim()
    const timestamp = Math.floor(Date.now() / 1000)

    // Optimistic update - add message immediately
    const newMessage: GroupMessage = {
      id: Date.now().toString(),
      content,
      pubkey: identity.publicKey,
      createdAt: timestamp,
      isOwn: true,
    }

    setMessages((prev) => [...prev, newMessage])
    setMessageText('')

    try {
      // Create NIP-29 group chat message (kind 9)
      // createEvent creates and signs the event in one step
      const signedEvent = createEvent(
        9, // NIP-29 group chat message kind
        content,
        [['h', group.id]], // Group ID tag (NIP-29)
        identity.privateKey
      )

      // Publish to relays
      const result = await relayService.publish(signedEvent)

      if (!result.success) {
        // Message wasn't sent - could show an error indicator
        console.warn('Message may not have been delivered to any relay')
        await haptics.warning()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Could show error state on the message
      await haptics.error()
    }
  }, [messageText, identity?.publicKey, identity?.privateKey, group])

  const handleTabChange = useCallback(async (tab: Tab) => {
    await haptics.selection()
    setActiveTab(tab)
  }, [])

  const handleLeaveGroup = useCallback(async () => {
    if (!group) return

    await haptics.warning()

    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"? You will need an invite to rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(group.id)
              await haptics.success()
              router.replace('/(tabs)/groups')
            } catch (error) {
              await haptics.error()
              Alert.alert('Error', 'Failed to leave group. Please try again.')
            }
          },
        },
      ]
    )
  }, [group, leaveGroup, router])

  if (!group) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Group not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    )
  }

  const renderMessage = ({ item }: { item: GroupMessage }) => (
    <View style={[styles.messageBubble, item.isOwn ? styles.ownMessage : styles.otherMessage]}>
      {!item.isOwn && (
        <Text style={styles.messageSender}>
          {item.pubkey === 'system' ? 'System' : `${item.pubkey.slice(0, 8)}...`}
        </Text>
      )}
      <Text style={[styles.messageContent, item.isOwn && styles.ownMessageContent]}>
        {item.content}
      </Text>
      <Text style={[styles.messageTime, item.isOwn && styles.ownMessageTime]}>
        {formatTime(item.createdAt)}
      </Text>
    </View>
  )

  const renderChatTab = () => (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top + 100}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0a0a0a" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet. Start the conversation!</Text>
            </View>
          }
        />
      )}

      {/* Message Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || spacing[4] }]}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type a message..."
          placeholderTextColor="#a3a3a3"
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!messageText.trim()}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )

  const renderMembersTab = () => (
    <View style={styles.membersContainer}>
      <Text style={styles.sectionTitle}>Members ({group.memberCount})</Text>
      <View style={styles.memberItem}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>Y</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>You</Text>
          <Text style={styles.memberRole}>{group.myRole}</Text>
        </View>
      </View>
      <Text style={styles.memberNote}>
        More members will appear as they send messages or are discovered from relays.
      </Text>
    </View>
  )

  const renderInfoTab = () => (
    <View style={styles.infoContainer}>
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.infoDescription}>{group.description || 'No description'}</Text>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Members</Text>
          <Text style={styles.infoValue}>{group.memberCount}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Your Role</Text>
          <Text style={styles.infoValue}>{group.myRole}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue}>{formatDate(group.createdAt)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Last Activity</Text>
          <Text style={styles.infoValue}>{formatDate(group.lastActivity)}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Relays</Text>
        {group.relays.map((relay) => (
          <Text key={relay} style={styles.relayText}>
            {relay}
          </Text>
        ))}
      </View>

      <Pressable style={styles.leaveButton} onPress={handleLeaveGroup}>
        <Text style={styles.leaveButtonText}>Leave Group</Text>
      </Pressable>
    </View>
  )

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: group.name,
          headerBackTitle: 'Groups',
        }}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={styles.backArrow} onPress={() => router.back()}>
          <Text style={styles.backArrowText}>←</Text>
        </Pressable>
        <View style={styles.headerContent}>
          <View style={styles.groupAvatar}>
            <Text style={styles.groupAvatarText}>{group.name[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={styles.headerSubtitle}>{group.memberCount} members</Text>
          </View>
        </View>
        <Pressable style={styles.moreButton}>
          <Text style={styles.moreButtonText}>⋯</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['chat', 'members', 'info'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'chat' && renderChatTab()}
      {activeTab === 'members' && renderMembersTab()}
      {activeTab === 'info' && renderInfoTab()}
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
  errorText: {
    fontSize: fontSize.lg,
    color: '#737373',
    marginBottom: spacing[4],
  },
  backButton: {
    backgroundColor: '#0a0a0a',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: 10,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#ffffff',
  },
  backArrow: {
    marginRight: spacing[3],
    padding: spacing[2],
  },
  backArrowText: {
    fontSize: fontSize.xl,
    color: '#0a0a0a',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  groupAvatarText: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#737373',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: '#737373',
  },
  moreButton: {
    padding: spacing[2],
  },
  moreButtonText: {
    fontSize: fontSize.xl,
    color: '#0a0a0a',
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0a0a0a',
  },
  tabText: {
    fontSize: fontSize.sm,
    color: '#737373',
    fontWeight: String(fontWeight.medium) as '500',
  },
  activeTabText: {
    color: '#0a0a0a',
  },
  // Chat
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  messagesList: {
    padding: spacing[4],
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing[16],
  },
  emptyChatText: {
    fontSize: fontSize.sm,
    color: '#a3a3a3',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing[3],
    borderRadius: 16,
    marginBottom: spacing[2],
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0a0a0a',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5f5f5',
    borderBottomLeftRadius: 4,
  },
  messageSender: {
    fontSize: fontSize.xs,
    color: '#737373',
    marginBottom: spacing[1],
  },
  messageContent: {
    fontSize: fontSize.base,
    color: '#0a0a0a',
  },
  ownMessageContent: {
    color: '#ffffff',
  },
  messageTime: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
    marginTop: spacing[1],
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#ffffff',
    gap: spacing[2],
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: fontSize.base,
    color: '#0a0a0a',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#d4d4d4',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.bold) as '700',
  },
  // Members
  membersContainer: {
    flex: 1,
    padding: spacing[4],
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#737373',
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  memberAvatarText: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.bold) as '700',
    color: '#737373',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.medium) as '500',
    color: '#0a0a0a',
  },
  memberRole: {
    fontSize: fontSize.sm,
    color: '#737373',
    textTransform: 'capitalize',
  },
  memberNote: {
    fontSize: fontSize.sm,
    color: '#a3a3a3',
    marginTop: spacing[4],
    fontStyle: 'italic',
  },
  // Info
  infoContainer: {
    flex: 1,
    padding: spacing[4],
  },
  infoSection: {
    marginBottom: spacing[6],
  },
  infoDescription: {
    fontSize: fontSize.base,
    color: '#0a0a0a',
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: '#737373',
  },
  infoValue: {
    fontSize: fontSize.sm,
    color: '#0a0a0a',
    fontWeight: String(fontWeight.medium) as '500',
  },
  relayText: {
    fontSize: fontSize.sm,
    color: '#2563eb',
    marginBottom: spacing[1],
  },
  leaveButton: {
    backgroundColor: '#fef2f2',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing[4],
  },
  leaveButtonText: {
    color: '#dc2626',
    fontSize: fontSize.base,
    fontWeight: String(fontWeight.semibold) as '600',
  },
})
