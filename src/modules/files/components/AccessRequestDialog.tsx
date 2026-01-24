/**
 * Access Request Dialog
 * Epic 58: Allow users to request access to files/folders they don't have permission for
 */

import { useState } from 'react'
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
      alert('Failed to submit access request')
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
            Request Access
          </DialogTitle>
          <DialogDescription>
            Request access to "{resourceName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="permission">Access Level</Label>
            <Select
              value={requestedPermission}
              onValueChange={(v) => setRequestedPermission(v as FilePermission)}
            >
              <SelectTrigger id="permission">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View only</SelectItem>
                <SelectItem value="download">View & Download</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Why do you need access to this file?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
