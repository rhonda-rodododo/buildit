import { FC } from 'react'
import { ConversationList } from './ConversationList'
import { MessageThread } from './MessageThread'
import { NewConversationDialog } from './NewConversationDialog'
import { Button } from '@/components/ui/button'
import { useMessagingStore } from '@/stores/messagingStore'

export const MessagingView: FC = () => {
  const { activeConversationId } = useMessagingStore()

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar - Conversation List */}
      <div className="w-80 border-r pr-4 flex flex-col">
        <div className="mb-4">
          <NewConversationDialog trigger={<Button className="w-full">New Conversation</Button>} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList />
        </div>
      </div>

      {/* Main - Message Thread */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        {activeConversationId ? (
          <MessageThread conversationId={activeConversationId} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Select a conversation or start a new one
          </div>
        )}
      </div>
    </div>
  )
}
