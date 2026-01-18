/**
 * Share Dialog Component
 * Manage document sharing permissions and generate share links
 * Inspired by Google Docs / Proton Drive sharing experience
 */

import { FC, useState, useMemo } from 'react'
import { useDocumentsStore } from '../documentsStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Share2,
  Link2,
  Users,
  Copy,
  Check,
  Trash2,
  Globe,
  Lock,
  Eye,
  MessageSquare,
  Pencil,
  Shield,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentPermission, DocumentShareLink, DocumentCollaborator } from '../types'
import { formatDistanceToNow } from 'date-fns'

export interface ShareDialogProps {
  documentId: string
  documentTitle: string
  currentUserPubkey: string
  trigger?: React.ReactNode
  onClose?: () => void
}

const PermissionBadge: FC<{ permission: DocumentPermission }> = ({ permission }) => {
  const config = {
    view: { label: 'Viewer', icon: Eye, color: 'bg-blue-100 text-blue-700' },
    comment: { label: 'Commenter', icon: MessageSquare, color: 'bg-green-100 text-green-700' },
    edit: { label: 'Editor', icon: Pencil, color: 'bg-orange-100 text-orange-700' },
    admin: { label: 'Admin', icon: Shield, color: 'bg-purple-100 text-purple-700' },
  }

  const { label, icon: Icon, color } = config[permission]

  return (
    <Badge variant="secondary" className={cn('gap-1', color)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}

export const ShareDialog: FC<ShareDialogProps> = ({
  documentId,
  documentTitle,
  currentUserPubkey,
  trigger,
}) => {
  const {
    getShareLinks,
    addShareLink,
    deleteShareLink,
    getCollaborators,
    addCollaborator,
    removeCollaborator,
    updateCollaboratorPermission,
  } = useDocumentsStore()

  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePermission, setInvitePermission] = useState<DocumentPermission>('view')

  // Link sharing state
  const [linkPermission, setLinkPermission] = useState<DocumentPermission>('view')
  const [linkExpiry, setLinkExpiry] = useState<string>('never')
  const [linkIsPublic, setLinkIsPublic] = useState(true)

  const shareLinks = getShareLinks(documentId)
  const collaborators = getCollaborators(documentId)

  // Generate avatar color from pubkey
  const getAvatarColor = (pubkey: string) => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    ]
    const hash = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const handleCreateLink = () => {
    let expiresAt: number | undefined
    if (linkExpiry !== 'never') {
      const now = Date.now()
      const expiryDays = parseInt(linkExpiry)
      expiresAt = now + expiryDays * 24 * 60 * 60 * 1000
    }

    const link: DocumentShareLink = {
      id: crypto.randomUUID(),
      documentId,
      createdByPubkey: currentUserPubkey,
      permission: linkPermission,
      createdAt: Date.now(),
      expiresAt,
      isPublic: linkIsPublic,
      accessCount: 0,
    }

    addShareLink(link)
  }

  const handleCopyLink = async (link: DocumentShareLink) => {
    const shareUrl = `${window.location.origin}/share/${link.id}`
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleInvite = () => {
    if (!inviteEmail.trim()) return

    // In a real app, this would look up user by email/pubkey
    // For now, we'll use the email as a placeholder pubkey
    const collaborator: DocumentCollaborator = {
      documentId,
      userPubkey: inviteEmail.trim(), // Would be resolved pubkey
      permission: invitePermission,
      addedByPubkey: currentUserPubkey,
      addedAt: Date.now(),
    }

    addCollaborator(collaborator)
    setInviteEmail('')
  }

  const activeLinks = useMemo(() => {
    return shareLinks.filter((link) => {
      if (!link.expiresAt) return true
      return link.expiresAt > Date.now()
    })
  }, [shareLinks])

  const expiredLinks = useMemo(() => {
    return shareLinks.filter((link) => {
      if (!link.expiresAt) return false
      return link.expiresAt <= Date.now()
    })
  }, [shareLinks])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share "{documentTitle}"
          </DialogTitle>
          <DialogDescription>
            Invite people or create a shareable link
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="people" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="people" className="gap-2">
              <Users className="h-4 w-4" />
              People
            </TabsTrigger>
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="h-4 w-4" />
              Link
            </TabsTrigger>
          </TabsList>

          {/* People Tab */}
          <TabsContent value="people" className="space-y-4 mt-4">
            {/* Invite input */}
            <div className="flex gap-2">
              <Input
                placeholder="Add people by npub or email..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Select
                value={invitePermission}
                onValueChange={(v) => setInvitePermission(v as DocumentPermission)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Viewer
                    </div>
                  </SelectItem>
                  <SelectItem value="comment">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Commenter
                    </div>
                  </SelectItem>
                  <SelectItem value="edit">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-4 w-4" />
                      Editor
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>
                Invite
              </Button>
            </div>

            {/* Collaborators list */}
            <div className="space-y-2 max-h-64 overflow-auto">
              {/* Owner */}
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={cn('text-white', getAvatarColor(currentUserPubkey))}>
                    {currentUserPubkey.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    You
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {currentUserPubkey.slice(0, 12)}...
                  </p>
                </div>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  <Shield className="h-3 w-3 mr-1" />
                  Owner
                </Badge>
              </div>

              {collaborators.map((collab) => (
                <div key={collab.userPubkey} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={cn('text-white', getAvatarColor(collab.userPubkey))}>
                      {collab.userPubkey.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {collab.userPubkey.slice(0, 16)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Added {formatDistanceToNow(collab.addedAt, { addSuffix: true })}
                    </p>
                  </div>
                  <Select
                    value={collab.permission}
                    onValueChange={(v) =>
                      updateCollaboratorPermission(documentId, collab.userPubkey, v as DocumentPermission)
                    }
                  >
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">Viewer</SelectItem>
                      <SelectItem value="comment">Commenter</SelectItem>
                      <SelectItem value="edit">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCollaborator(documentId, collab.userPubkey)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {collaborators.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No collaborators yet. Invite people to collaborate.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Link Tab */}
          <TabsContent value="link" className="space-y-4 mt-4">
            {/* Create link options */}
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {linkIsPublic ? (
                    <Globe className="h-4 w-4 text-green-600" />
                  ) : (
                    <Lock className="h-4 w-4 text-orange-600" />
                  )}
                  <span className="text-sm font-medium">
                    {linkIsPublic ? 'Public link' : 'Private link'}
                  </span>
                </div>
                <Switch
                  checked={linkIsPublic}
                  onCheckedChange={setLinkIsPublic}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {linkIsPublic
                  ? 'Anyone with the link can access this document'
                  : 'Only people signed into BuildIt can access this link'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Permission</label>
                  <Select
                    value={linkPermission}
                    onValueChange={(v) => setLinkPermission(v as DocumentPermission)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View only</SelectItem>
                      <SelectItem value="comment">Can comment</SelectItem>
                      <SelectItem value="edit">Can edit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Expires</label>
                  <Select value={linkExpiry} onValueChange={setLinkExpiry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleCreateLink} className="w-full">
                <Link2 className="h-4 w-4 mr-2" />
                Create Link
              </Button>
            </div>

            {/* Active links */}
            {activeLinks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Active Links</h4>
                {activeLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <PermissionBadge permission={link.permission} />
                        {link.isPublic ? (
                          <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            Public
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Private
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{link.accessCount} views</span>
                        {link.expiresAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires {formatDistanceToNow(link.expiresAt, { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(link)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteShareLink(documentId, link.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Expired links */}
            {expiredLinks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Expired Links
                </h4>
                {expiredLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-3 border rounded-lg opacity-60"
                  >
                    <div className="flex-1">
                      <PermissionBadge permission={link.permission} />
                      <p className="text-xs text-muted-foreground mt-1">
                        Expired {formatDistanceToNow(link.expiresAt!, { addSuffix: true })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteShareLink(documentId, link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {activeLinks.length === 0 && expiredLinks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No share links created yet
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
