import { FC } from 'react'
import { ConversationList } from './ConversationList'
import { MessageThread } from './MessageThread'
import { NewConversationDialog } from './NewConversationDialog'
import { Button } from '@/components/ui/button'
import { useMessagingStore } from '@/stores/messagingStore'

interface MessagingViewProps {
  groupId?: string;
}

export const MessagingView: FC<MessagingViewProps> = ({ groupId }) => {
  const { activeConversationId } = useMessagingStore()

  return (
    <div className="flex flex-col sm:flex-row h-full gap-4">
      {/* Sidebar - Conversation List */}
      <div className="w-full sm:w-80 border-b sm:border-b-0 sm:border-r pb-4 sm:pb-0 sm:pr-4 flex flex-col max-h-64 sm:max-h-none">
        <div className="mb-4">
          <NewConversationDialog trigger={<Button className="w-full text-sm">New Conversation</Button>} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList groupId={groupId} />
        </div>
      </div>

      {/* Main - Message Thread */}
      <div className="flex-1 border rounded-lg overflow-hidden min-h-[300px]">
        {activeConversationId ? (
          <MessageThread conversationId={activeConversationId} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
            Select a conversation or start a new one
          </div>
        )}
      </div>
    </div>
  )
}
