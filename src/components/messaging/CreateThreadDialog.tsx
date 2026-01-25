import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
import { useMessagingStore } from '@/stores/messagingStore'
import { createGroupThread } from '@/core/messaging/groupThread'
import { getNostrClient } from '@/core/nostr/client'
import type { GroupThread } from '@/types/group'

interface CreateThreadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
}

export function CreateThreadDialog({ open, onOpenChange, groupId }: CreateThreadDialogProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const { currentIdentity } = useAuthStore()
  const { addGroupThread } = useMessagingStore()

  const handleCreate = async () => {
    if (!title.trim() || !currentIdentity) return

    const privateKey = getCurrentPrivateKey()
    if (!privateKey) {
      console.error('App is locked, cannot create thread')
      return
    }

    setIsCreating(true)
    try {
      const client = getNostrClient()
      const event = await createGroupThread(
        client,
        groupId,
        title,
        category || undefined,
        privateKey
      )

      // Add to store
      const thread: GroupThread = {
        id: event.id,
        groupId,
        title,
        category: category || undefined,
        createdBy: currentIdentity.publicKey,
        createdAt: event.created_at,
        lastMessageAt: event.created_at,
        messageCount: 0,
        pinned: false,
      }

      addGroupThread(groupId, thread)

      // Reset and close
      setTitle('')
      setCategory('')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create thread:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createThreadDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('createThreadDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="thread-title">{t('createThreadDialog.titleLabel')}</Label>
            <Input
              id="thread-title"
              placeholder={t('createThreadDialog.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="thread-category">{t('createThreadDialog.categoryLabel')}</Label>
            <Input
              id="thread-category"
              placeholder={t('createThreadDialog.categoryPlaceholder')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isCreating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            {t('createThreadDialog.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim() || isCreating}>
            {isCreating ? t('createThreadDialog.creating') : t('createThreadDialog.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
