import { FC, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMessagingStore } from '@/stores/messagingStore'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { loadConversationHistory, sendDirectMessage, subscribeToDirectMessages } from '@/core/messaging/dm'
import { getNostrClient } from '@/core/nostr/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserMentionInput } from '@/components/mentions/UserMentionInput'

interface MessageThreadProps {
  conversationId: string
}

export const MessageThread: FC<MessageThreadProps> = ({ conversationId }) => {
  const { t } = useTranslation()
  const { getConversationMessages, setMessages, addMessage, markAsRead, conversations } = useMessagingStore()
  const { currentIdentity } = useAuthStore()
  const { addNotification } = useNotificationStore()
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messages = getConversationMessages(conversationId)
  const conversation = conversations.find(c => c.id === conversationId)
  const otherPubkey = conversation?.participants.find(p => p !== currentIdentity?.publicKey)

  useEffect(() => {
    if (!currentIdentity || !otherPubkey) return

    const client = getNostrClient()

    // Load conversation history
    const loadHistory = async () => {
      const privateKey = getCurrentPrivateKey()
      if (!privateKey) return
      const history = await loadConversationHistory(
        client,
        currentIdentity.publicKey,
        otherPubkey,
        privateKey
      )
      setMessages(conversationId, history)
    }

    loadHistory()

    // Subscribe to new messages
    const privateKey = getCurrentPrivateKey()
    if (!privateKey) return
    const subId = subscribeToDirectMessages(
      client,
      currentIdentity.publicKey,
      privateKey,
      (message) => {
        if (message.conversationId === conversationId) {
          addMessage(message)

          // Show notification if message is from someone else
          if (message.from !== currentIdentity.publicKey) {
            addNotification({
              type: 'new_dm',
              title: t('messageThread.newMessage'),
              message: `${message.from.slice(0, 8)}...: ${message.content.slice(0, 50)}`,
              metadata: {
                conversationId: message.conversationId,
                fromPubkey: message.from,
              },
            })
          }
        }
      },
      Math.floor(Date.now() / 1000)
    )

    // Mark as read
    markAsRead(conversationId)

    return () => {
      client.unsubscribe(subId)
    }
  }, [currentIdentity, conversationId, otherPubkey, setMessages, addMessage, markAsRead, addNotification])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!messageInput.trim() || !currentIdentity || !otherPubkey || sending) return

    const privateKey = getCurrentPrivateKey()
    if (!privateKey) {
      console.error('App is locked, cannot send message')
      return
    }

    setSending(true)
    try {
      const client = getNostrClient()

      await sendDirectMessage(
        client,
        otherPubkey,
        messageInput.trim(),
        privateKey
      )

      setMessageInput('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return t('messageThread.today')
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t('messageThread.yesterday')
    }
    return date.toLocaleDateString()
  }

  if (!currentIdentity || !otherPubkey) {
    return <div>{t('messageThread.invalidConversation')}</div>
  }

  const truncatePubkey = (pubkey: string) => {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`
  }

  let lastDate = ''

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <h3 className="font-semibold">{truncatePubkey(otherPubkey)}</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {t('messageThread.noMessages')}
          </div>
        ) : (
          messages.map((msg) => {
            const currentDate = formatDate(msg.timestamp)
            const showDateDivider = currentDate !== lastDate
            lastDate = currentDate

            const isFromMe = msg.from === currentIdentity.publicKey

            return (
              <div key={msg.id}>
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <span className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
                      {currentDate}
                    </span>
                  </div>
                )}
                <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${isFromMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    <Card
                      className={`p-3 ${
                        isFromMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                    </Card>
                    <span className="text-xs text-muted-foreground mt-1">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <UserMentionInput
              value={messageInput}
              onChange={setMessageInput}
              placeholder={t('messageThread.placeholder')}
              rows={1}
            />
          </div>
          <Button onClick={handleSend} disabled={sending || !messageInput.trim()}>
            {t('messageThread.send')}
          </Button>
        </div>
      </div>
    </div>
  )
}
