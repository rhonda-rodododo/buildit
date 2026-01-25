import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMessagingStore } from '@/stores/messagingStore'
import { useAuthStore } from '@/stores/authStore'
import { getConversationId } from '@/core/messaging/dm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NewConversationDialogProps {
  trigger?: React.ReactNode
}

export const NewConversationDialog: FC<NewConversationDialogProps> = ({ trigger }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pubkey, setPubkey] = useState('')
  const { addConversation, setActiveConversation, conversations } = useMessagingStore()
  const { currentIdentity } = useAuthStore()

  const handleCreate = () => {
    if (!pubkey.trim() || !currentIdentity) return

    const trimmedPubkey = pubkey.trim()

    // Validate pubkey format (64 hex characters)
    if (!/^[0-9a-f]{64}$/i.test(trimmedPubkey)) {
      alert(t('messages.invalidPublicKey'))
      return
    }

    const conversationId = getConversationId(currentIdentity.publicKey, trimmedPubkey)

    // Check if conversation already exists
    const existingConv = conversations.find(c => c.id === conversationId)
    if (existingConv) {
      setActiveConversation(conversationId)
      setOpen(false)
      setPubkey('')
      return
    }

    // Create new conversation
    addConversation({
      id: conversationId,
      participants: [currentIdentity.publicKey, trimmedPubkey],
      unreadCount: 0,
    })

    setActiveConversation(conversationId)
    setOpen(false)
    setPubkey('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>{t('messages.newConversation')}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('messages.startNewConversation')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="pubkey">{t('messages.recipientPublicKey')}</Label>
            <Input
              id="pubkey"
              placeholder={t('messages.recipientPlaceholder')}
              value={pubkey}
              onChange={(e) => setPubkey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate()
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!pubkey.trim()}>
              {t('messages.startConversation')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
