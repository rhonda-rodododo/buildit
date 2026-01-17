/**
 * File Share Dialog
 * Share files with specific users or generate public links
 */

import { useState } from 'react'
import { Link2, Users, Lock, Calendar, Copy, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fileManager } from '../fileManager'
import { useFilesStore } from '../filesStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { getCurrentPrivateKey } from '@/stores/authStore'
import type { FilePermission } from '../types'

interface FileShareDialogProps {
  fileId: string
  groupId: string
  onClose: () => void
}

export function FileShareDialog({ fileId, groupId, onClose }: FileShareDialogProps) {
  const file = useFilesStore((state) => state.getFile(fileId))
  const groupMembers = useGroupsStore((state) => state.groupMembers.get(groupId) || [])

  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [permission, setPermission] = useState<FilePermission>('view')
  const [generateLink, setGenerateLink] = useState(false)
  const [linkPassword, setLinkPassword] = useState('')
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const privateKey = getCurrentPrivateKey()

  if (!file || !privateKey) {
    return null
  }

  const handleCreateShare = async () => {
    const pk = getCurrentPrivateKey()
    if (!pk) return

    setIsCreating(true)
    try {
      const expiresAt = expiresInDays
        ? Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)
        : null

      const share = await fileManager.createShare(
        {
          fileId,
          groupId,
          sharedWith: selectedUsers,
          permissions: [permission],
          generateLink,
          password: linkPassword || undefined,
          expiresAt,
        },
        pk
      )

      if (share.shareLink) {
        // Generate full URL for share link
        const shareUrl = `${window.location.origin}/share/${share.shareLink}`
        setShareLink(shareUrl)
      } else {
        // Close dialog if no link to show
        onClose()
      }
    } catch (err) {
      console.error('Failed to create share:', err)
      alert('Failed to create share')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const toggleUser = (pubkey: string) => {
    setSelectedUsers((prev) =>
      prev.includes(pubkey)
        ? prev.filter((p) => p !== pubkey)
        : [...prev, pubkey]
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share "{file.name}"</DialogTitle>
        </DialogHeader>

        {shareLink ? (
          // Show share link result
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-5 w-5 text-green-600" />
                <p className="font-semibold text-green-600">Share link created!</p>
              </div>
              <div className="flex items-center gap-2">
                <Input value={shareLink} readOnly className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              {linkPassword && (
                <p className="text-sm text-muted-foreground mt-2">
                  Password: <code className="bg-background px-2 py-1 rounded">{linkPassword}</code>
                </p>
              )}
              {expiresInDays && (
                <p className="text-sm text-muted-foreground mt-1">
                  Expires in {expiresInDays} days
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          // Show share creation form
          <Tabs defaultValue="users" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                Share with Users
              </TabsTrigger>
              <TabsTrigger value="link">
                <Link2 className="h-4 w-4 mr-2" />
                Create Link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div>
                <Label>Select Users</Label>
                <div className="mt-2 space-y-2 max-h-60 overflow-auto border rounded-lg p-2">
                  {groupMembers.map((member) => (
                    <label
                      key={member.pubkey}
                      className="flex items-center gap-3 p-2 hover:bg-accent rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(member.pubkey)}
                        onChange={() => toggleUser(member.pubkey)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium">Member</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.pubkey.slice(0, 16)}...
                        </p>
                      </div>
                    </label>
                  ))}
                  {groupMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No group members found
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label>Permission Level</Label>
                <Select value={permission} onValueChange={(v) => setPermission(v as FilePermission)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View only</SelectItem>
                    <SelectItem value="download">View & Download</SelectItem>
                    <SelectItem value="edit">View, Download & Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="generate-link">Generate public link</Label>
                  <Switch
                    id="generate-link"
                    checked={generateLink}
                    onCheckedChange={setGenerateLink}
                  />
                </div>

                {generateLink && (
                  <>
                    <div>
                      <Label htmlFor="link-password">
                        <Lock className="inline h-4 w-4 mr-1" />
                        Password (optional)
                      </Label>
                      <Input
                        id="link-password"
                        type="text"
                        placeholder="Leave empty for no password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="expires-in">
                        <Calendar className="inline h-4 w-4 mr-1" />
                        Expires in (days)
                      </Label>
                      <Select
                        value={expiresInDays?.toString() || 'never'}
                        onValueChange={(v) => setExpiresInDays(v === 'never' ? null : parseInt(v))}
                      >
                        <SelectTrigger className="mt-2">
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
                  </>
                )}
              </div>

              <div>
                <Label>Permission Level</Label>
                <Select value={permission} onValueChange={(v) => setPermission(v as FilePermission)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View only</SelectItem>
                    <SelectItem value="download">View & Download</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateShare}
                disabled={isCreating || (selectedUsers.length === 0 && !generateLink)}
              >
                {isCreating ? 'Creating...' : 'Create Share'}
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
