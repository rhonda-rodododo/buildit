/**
 * Access Request Dialog
 * Epic 58: Allow users to request access to files/folders they don't have permission for
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
import { useFilesStore } from '../filesStore'
import type { FilePermission } from '../types'

interface AccessRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resourceId: string
  resourceType: 'file' | 'folder'
  resourceName: string
  requesterPubkey: string
}

export function AccessRequestDialog({
  open,
  onOpenChange,
  resourceId,
  resourceType,
  resourceName,
  requesterPubkey,
}: AccessRequestDialogProps) {
  const { t } = useTranslation()
  const [requestedPermission, setRequestedPermission] = useState<FilePermission>('view')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const createAccessRequest = useFilesStore((state) => state.createAccessRequest)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await createAccessRequest({
        id: crypto.randomUUID(),
        resourceId,
        resourceType,
        resourceName,
        requesterPubkey,
        requestedPermissions: [requestedPermission],
        message: message.trim() || undefined,
        status: 'pending',
        createdAt: Date.now(),
      })
      onOpenChange(false)
      setMessage('')
      setRequestedPermission('view')
    } catch (err) {
      console.error('Failed to create access request:', err)
      alert(t('filesAccessRequestDialog.error'))
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
            {t('filesAccessRequestDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('filesAccessRequestDialog.description', { resourceName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="permission">{t('filesAccessRequestDialog.accessLevel')}</Label>
            <Select
              value={requestedPermission}
              onValueChange={(v) => setRequestedPermission(v as FilePermission)}
            >
              <SelectTrigger id="permission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">{t('filesAccessRequestDialog.viewOnly')}</SelectItem>
                <SelectItem value="download">{t('filesAccessRequestDialog.viewDownload')}</SelectItem>
                <SelectItem value="edit">{t('filesAccessRequestDialog.edit')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">{t('filesAccessRequestDialog.messageLabel')}</Label>
            <Textarea
              id="message"
              placeholder={t('filesAccessRequestDialog.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('filesAccessRequestDialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? t('filesAccessRequestDialog.sending') : t('filesAccessRequestDialog.sendRequest')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
