/**
 * Chat Detail Screen - Individual Conversation
 *
 * Shows message history with a contact and allows sending new messages.
 * Uses Nostr NIP-04 encryption for direct messages.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
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
} from 'react-native'
import { useRouter, useParams } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore, useMessageStore } from '../../src/stores'
import type { Message } from '../../src/stores'
import { spacing, fontSize, fontWeight } from '@buildit/design-tokens'

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ChatScreen() {
  const router = useRouter()
  const { pubkey } = useParams<{ pubkey: string }>()
  const insets = useSafeAreaInsets()
  const { identity } = useAuthStore()
  const { getConversation, sendMessage, markAsRead, isConnected } = useMessageStore()
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const conversation = pubkey ? getConversation(pubkey) : undefined
  const messages = conversation?.messages || []
  const contactName = conversation?.contactName || `${pubkey?.slice(0, 8)}...`

  // Mark conversation as read when viewing
  useEffect(() => {
    if (pubkey && conversation?.unreadCount && conversation.unreadCount > 0) {
      markAsRead(pubkey)
    }
  }, [pubkey, conversation?.unreadCount, markAsRead])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages.length])

  const handleSend = useCallback(async () => {
    if (!messageText.trim() || !pubkey || isSending) return

    const text = messageText.trim()
    setMessageText('')
    setIsSending(true)

    try {
      await sendMessage(pubkey, text)
    } catch (error) {
      console.error('Failed to send message:', error)
      // Restore the message text on failure
      setMessageText(text)
    } finally {
      setIsSending(false)
    }
  }, [messageText, pubkey, isSending, sendMessage])

  const renderMessage = ({ item }: { item: Message }) => {
    const isOutgoing = item.isOutgoing

    return (
      <View
        style={[
          styles.messageContainer,
          isOutgoing ? styles.outgoingContainer : styles.incomingContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOutgoing ? styles.outgoingText : styles.incomingText,
            ]}
          >
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isOutgoing ? styles.outgoingTime : styles.incomingTime,
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
            {isOutgoing && (
              <Text
                style={[
                  styles.messageStatus,
                  item.status === 'failed' && styles.failedStatus,
                ]}
              >
                {item.status === 'sending' && '○'}
                {item.status === 'sent' && '✓'}
                {item.status === 'delivered' && '✓✓'}
                {item.status === 'failed' && '!'}
              </Text>
            )}
          </View>
        </View>
      </View>
    )
  }

  if (!identity) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Not logged in</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/')}>
          <Text style={styles.primaryButtonText}>Go to Home</Text>
        </Pressable>
      </View>
    )
  }

  if (!pubkey) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Invalid conversation</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {contactName}
          </Text>
          {isConnected ? (
            <View style={styles.connectedBadge}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Online</Text>
            </View>
          ) : (
            <Text style={styles.offlineText}>Offline</Text>
          )}
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
          </View>
        }
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false })
        }}
      />

      {/* Input Area */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#a3a3a3"
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={5000}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          style={[
            styles.sendButton,
            (!messageText.trim() || isSending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!messageText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.sendButtonText}>→</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: fontSize.xl,
    color: '#0a0a0a',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 4,
  },
  connectedText: {
    fontSize: fontSize.xs,
    color: '#22c55e',
  },
  offlineText: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  messagesList: {
    padding: spacing[4],
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: spacing[2],
  },
  outgoingContainer: {
    alignItems: 'flex-end',
  },
  incomingContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: 16,
  },
  outgoingBubble: {
    backgroundColor: '#0a0a0a',
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: '#f5f5f5',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  outgoingText: {
    color: '#ffffff',
  },
  incomingText: {
    color: '#0a0a0a',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
    gap: spacing[1],
  },
  messageTime: {
    fontSize: fontSize.xs,
  },
  outgoingTime: {
    color: '#a3a3a3',
  },
  incomingTime: {
    color: '#737373',
  },
  messageStatus: {
    fontSize: fontSize.xs,
    color: '#a3a3a3',
  },
  failedStatus: {
    color: '#ef4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing[16],
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: String(fontWeight.semibold) as '600',
    color: '#0a0a0a',
    marginBottom: spacing[2],
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: '#737373',
    textAlign: 'center',
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
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: '#0a0a0a',
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#d4d4d4',
  },
  sendButtonText: {
    fontSize: fontSize.xl,
    color: '#ffffff',
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
