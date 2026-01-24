/**
 * Access Requests Panel
 * Epic 58: Admin panel to view and approve/deny document access requests
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Check,
  X,
  Clock,
  FileText,
  Folder,
  Eye,
  MessageSquare,
  Pencil,
  Shield,
  AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useDocumentsStore } from '../documentsStore'
import type { AccessRequest, DocumentPermission } from '../types'

interface AccessRequestsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  currentUserPubkey: string
}

const PERMISSION_ICONS: Record<DocumentPermission, typeof Eye> = {
  view: Eye,
  comment: MessageSquare,
  edit: Pencil,
  admin: Shield,
}

const PERMISSION_LABELS: Record<DocumentPermission, string> = {
  view: 'View',
  comment: 'Comment',
  edit: 'Edit',
  admin: 'Admin',
}

export function AccessRequestsPanel({
  open,
  onOpenChange,
  groupId,
  currentUserPubkey,
}: AccessRequestsPanelProps) {
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const getPendingAccessRequests = useDocumentsStore((state) => state.getPendingAccessRequests)
  const approveAccessRequest = useDocumentsStore((state) => state.approveAccessRequest)
  const denyAccessRequest = useDocumentsStore((state) => state.denyAccessRequest)

  const [requests, setRequests] = useState<AccessRequest[]>([])

  useEffect(() => {
    if (open) {
      loadRequests()
    }
  }, [open, groupId])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const pending = await getPendingAccessRequests(groupId)
      setRequests(pending)
    } catch (err) {
      console.error('Failed to load access requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (request: AccessRequest) => {
    setProcessingId(request.id)
    try {
      await approveAccessRequest(request.id, currentUserPubkey)
      await loadRequests()
    } catch (err) {
      console.error('Failed to approve request:', err)
      alert('Failed to approve request')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeny = async (request: AccessRequest) => {
    setProcessingId(request.id)
    try {
      await denyAccessRequest(request.id, currentUserPubkey)
      await loadRequests()
    } catch (err) {
      console.error('Failed to deny request:', err)
      alert('Failed to deny request')
    } finally {
      setProcessingId(null)
    }
  }

  const getResourceName = (request: AccessRequest): string => {
    // resourceTitle is stored in the request
    return request.resourceTitle || 'Unknown resource'
  }

  const getAvatarColor = (pubkey: string) => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    ]
    const hash = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const PermIcon = (permission: DocumentPermission) => PERMISSION_ICONS[permission] || Eye

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Access Requests
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending requests</p>
              <p className="text-sm text-muted-foreground mt-1">
                Access requests will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3 p-1">
              {requests.map((request) => {
                const Icon = request.resourceType === 'document' ? FileText : Folder
                const PermissionIcon = PermIcon(request.requestedPermission)
                const isProcessing = processingId === request.id

                return (
                  <Card key={request.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className={`text-white ${getAvatarColor(request.requesterPubkey)}`}>
                            {request.requesterPubkey.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">
                              {request.requesterPubkey.slice(0, 12)}...
                            </span>
                            <Badge variant="outline" className="gap-1 shrink-0">
                              <PermissionIcon className="h-3 w-3" />
                              {PERMISSION_LABELS[request.requestedPermission]}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{getResourceName(request)}</span>
                          </div>

                          {request.message && (
                            <p className="text-sm text-muted-foreground mt-2 italic">
                              "{request.message}"
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground mt-2">
                            Requested {formatDistanceToNow(request.createdAt, { addSuffix: true })}
                          </p>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeny(request)}
                            disabled={isProcessing}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request)}
                            disabled={isProcessing}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
