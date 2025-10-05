import { useState, useEffect, useRef } from 'react'
import { useMessagingStore } from '@/stores/messagingStore'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Send } from 'lucide-react'
import {
  sendGroupMessage,
  loadThreadMessages,
  subscribeToGroupThread,
} from '@/core/messaging/groupThread'
import { getNostrClient } from '@/core/nostr/client'
import type { GroupMessage } from '@/types/group'

interface GroupThreadViewProps {
  threadId: string
  groupId: string
  groupKey: Uint8Array // Shared encryption key for the group
}

export function GroupThreadView({ threadId, groupId, groupKey }: GroupThreadViewProps) {
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { getThreadMessages, setThreadMessages, addThreadMessage } = useMessagingStore()
  const { currentIdentity } = useAuthStore()
  const { addNotification } = useNotificationStore()

  const messages = getThreadMessages(threadId)

  // Load thread messages on mount
  useEffect(() => {
    if (!threadId) return

    const client = getNostrClient()
    loadThreadMessages(client, groupId, threadId, groupKey).then((loadedMessages) => {
      setThreadMessages(threadId, loadedMessages)
    })
  }, [threadId, groupId, groupKey, setThreadMessages])

  // Subscribe to new messages
  useEffect(() => {
    if (!threadId) return

    const client = getNostrClient()
    const subId = subscribeToGroupThread(
      client,
      groupId,
      threadId,
      groupKey,
      (message: GroupMessage) => {
        addThreadMessage(message)

        // Show notification if message is from someone else
        if (currentIdentity && message.from !== currentIdentity.publicKey) {
          addNotification({
            type: 'new_group_message',
            title: 'New Group Message',
            message: `${message.from.slice(0, 8)}...: ${message.content.slice(0, 50)}`,
            metadata: {
              threadId: message.threadId,
              groupId: message.groupId,
              fromPubkey: message.from,
            },
          })
        }
      },
      Math.floor(Date.now() / 1000)
    )

    return () => {
      client.unsubscribe(subId)
    }
  }, [threadId, groupId, groupKey, addThreadMessage, currentIdentity, addNotification])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || !currentIdentity) return

    setIsLoading(true)
    try {
      const client = getNostrClient()
      await sendGroupMessage(
        client,
        threadId,
        groupId,
        newMessage,
        currentIdentity.privateKey,
        groupKey
      )
      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!threadId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a thread to start messaging
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message, idx) => {
            const prevMessage = idx > 0 ? messages[idx - 1] : null
            const showDateDivider =
              !prevMessage ||
              new Date(message.timestamp * 1000).toDateString() !==
                new Date(prevMessage.timestamp * 1000).toDateString()

            return (
              <div key={message.id}>
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <div className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
                      {new Date(message.timestamp * 1000).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                )}
                <MessageBubble message={message} isOwn={message.from === currentIdentity?.publicKey} />
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: GroupMessage
  isOwn: boolean
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const timeStr = new Date(message.timestamp * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Truncate pubkey for display
  const senderDisplay = isOwn ? 'You' : `${message.from.slice(0, 8)}...`

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <Card className={`max-w-[70%] p-3 ${isOwn ? 'bg-primary text-primary-foreground' : ''}`}>
        {!isOwn && <div className="text-xs font-medium mb-1 opacity-70">{senderDisplay}</div>}
        <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
        <div className={`text-xs mt-1 ${isOwn ? 'opacity-70' : 'text-muted-foreground'}`}>
          {timeStr}
        </div>
      </Card>
    </div>
  )
}
