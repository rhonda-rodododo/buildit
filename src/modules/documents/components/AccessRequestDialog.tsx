/**
 * Access Request Dialog
 * Epic 58: Allow users to request access to documents/folders they don't have permission for
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Lock, Send } from 'lucide-react'
import { useDocumentsStore } from '../documentsStore'
import type { DocumentPermission } from '../types'

interface AccessRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resourceId: string
  resourceType: 'document' | 'folder'
  resourceTitle: string
  requesterPubkey: string
}

export function AccessRequestDialog({
  open,
  onOpenChange,
  resourceId,
  resourceType,
  resourceTitle,
  requesterPubkey,
}: AccessRequestDialogProps) {
  const { t } = useTranslation()
  const [requestedPermission, setRequestedPermission] = useState<DocumentPermission>('view')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const createAccessRequest = useDocumentsStore((state) => state.createAccessRequest)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await createAccessRequest({
        id: crypto.randomUUID(),
        resourceId,
        resourceType,
        resourceTitle,
        requesterPubkey,
        requestedPermission,
        message: message.trim() || undefined,
        status: 'pending',
        createdAt: Date.now(),
      })
      onOpenChange(false)
      setMessage('')
      setRequestedPermission('view')
    } catch (err) {
      console.error('Failed to create access request:', err)
      alert(t('documentsAccessRequestDialog.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('documentsAccessRequestDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('documentsAccessRequestDialog.description', { resourceTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="permission">{t('documentsAccessRequestDialog.accessLevel')}</Label>
            <Select
              value={requestedPermission}
              onValueChange={(v) => setRequestedPermission(v as DocumentPermission)}
            >
              <SelectTrigger id="permission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">{t('documentsAccessRequestDialog.viewOnly')}</SelectItem>
                <SelectItem value="comment">{t('documentsAccessRequestDialog.viewComment')}</SelectItem>
                <SelectItem value="edit">{t('documentsAccessRequestDialog.edit')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">{t('documentsAccessRequestDialog.messageLabel')}</Label>
            <Textarea
              id="message"
              placeholder={t('documentsAccessRequestDialog.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('documentsAccessRequestDialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? t('documentsAccessRequestDialog.sending') : t('documentsAccessRequestDialog.sendRequest')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
