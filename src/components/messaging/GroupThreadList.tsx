import { useEffect } from 'react'
import { useMessagingStore } from '@/stores/messagingStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MessageSquare, Plus } from 'lucide-react'
import { getGroupThreads } from '@/core/messaging/groupThread'
import { getNostrClient } from '@/core/nostr/client'
import type { GroupThread } from '@/types/group'

interface GroupThreadListProps {
  groupId: string
  onCreateThread: () => void
}

export function GroupThreadList({ groupId, onCreateThread }: GroupThreadListProps) {
  const { groupThreads, activeThreadId, setActiveThread, setGroupThreads } = useMessagingStore()

  const threads = groupThreads.get(groupId) || []

  useEffect(() => {
    // Load threads for this group
    const client = getNostrClient()
    getGroupThreads(client, groupId).then((loadedThreads) => {
      setGroupThreads(groupId, loadedThreads)
    })
  }, [groupId, setGroupThreads])

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No threads yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Start a conversation by creating the first thread
        </p>
        <Button onClick={onCreateThread}>
          <Plus className="w-4 h-4 mr-2" />
          Create Thread
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Threads</h3>
        <Button size="sm" variant="outline" onClick={onCreateThread}>
          <Plus className="w-4 h-4 mr-2" />
          New Thread
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {threads.map((thread) => (
          <ThreadItem
            key={thread.id}
            thread={thread}
            isActive={thread.id === activeThreadId}
            onClick={() => setActiveThread(thread.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface ThreadItemProps {
  thread: GroupThread
  isActive: boolean
  onClick: () => void
}

function ThreadItem({ thread, isActive, onClick }: ThreadItemProps) {
  const lastMessageDate = new Date(thread.lastMessageAt * 1000)
  const now = new Date()
  const isToday = lastMessageDate.toDateString() === now.toDateString()

  const timeStr = isToday
    ? lastMessageDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : lastMessageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })

  return (
    <Card
      className={`p-4 m-2 cursor-pointer hover:bg-accent transition-colors ${
        isActive ? 'bg-accent border-primary' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-medium text-sm line-clamp-1">{thread.title}</h4>
        <span className="text-xs text-muted-foreground ml-2">{timeStr}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {thread.category && (
          <span className="bg-secondary px-2 py-1 rounded">{thread.category}</span>
        )}
        <span>{thread.messageCount} messages</span>
      </div>
    </Card>
  )
}
