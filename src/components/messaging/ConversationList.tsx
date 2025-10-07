import { FC, useEffect } from 'react'
import { useMessagingStore } from '@/stores/messagingStore'
import { useAuthStore } from '@/stores/authStore'
import { getConversations } from '@/core/messaging/dm'
import { getNostrClient } from '@/core/nostr/client'
import { Card } from '@/components/ui/card'

interface ConversationListProps {
  onSelectConversation?: (conversationId: string) => void;
  groupId?: string; // Optional: filter conversations to specific group
}

export const ConversationList: FC<ConversationListProps> = ({ onSelectConversation, groupId }) => {
  const { conversations, setConversations, activeConversationId, setActiveConversation } = useMessagingStore()
  const { currentIdentity } = useAuthStore()

  useEffect(() => {
    if (!currentIdentity) return

    const loadConversations = async () => {
      const client = getNostrClient()
      const convs = await getConversations(client, currentIdentity.publicKey, currentIdentity.privateKey)
      setConversations(convs)
    }

    loadConversations()
  }, [currentIdentity, setConversations])

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversation(conversationId)
    onSelectConversation?.(conversationId)
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getOtherParticipant = (participants: string[]) => {
    return participants.find(p => p !== currentIdentity?.publicKey) || 'Unknown'
  }

  const truncatePubkey = (pubkey: string) => {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`
  }

  if (!currentIdentity) {
    return <div>Please log in to view conversations</div>
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold mb-4">Conversations</h2>
      {conversations.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No conversations yet. Start a new one!
        </Card>
      ) : (
        conversations.map((conv) => {
          const otherPubkey = getOtherParticipant(conv.participants)
          const isActive = activeConversationId === conv.id

          return (
            <Card
              key={conv.id}
              className={`p-4 cursor-pointer transition-colors hover:bg-accent ${
                isActive ? 'bg-accent border-primary' : ''
              }`}
              onClick={() => handleSelectConversation(conv.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {truncatePubkey(otherPubkey)}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {conv.lastMessage.content}
                    </p>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                    {formatTimestamp(conv.lastMessage.timestamp)}
                  </p>
                )}
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
