/**
 * File Share Dialog
 * Share files with specific users or generate public links
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
          <DialogTitle>{t('fileShareDialog.shareTitle', { name: file.name })}</DialogTitle>
        </DialogHeader>

        {shareLink ? (
          // Show share link result
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-5 w-5 text-green-600" />
                <p className="font-semibold text-green-600">{t('fileShareDialog.shareLinkCreated')}</p>
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
                      {t('fileShareDialog.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      {t('fileShareDialog.copy')}
                    </>
                  )}
                </Button>
              </div>
              {linkPassword && (
                <p className="text-sm text-muted-foreground mt-2">
                  {t('fileShareDialog.password')}: <code className="bg-background px-2 py-1 rounded">{linkPassword}</code>
                </p>
              )}
              {expiresInDays && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('fileShareDialog.expiresIn', { days: expiresInDays })}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                {t('fileShareDialog.done')}
              </Button>
            </div>
          </div>
        ) : (
          // Show share creation form
          <Tabs defaultValue="users" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                {t('fileShareDialog.shareWithUsers')}
              </TabsTrigger>
              <TabsTrigger value="link">
                <Link2 className="h-4 w-4 mr-2" />
                {t('fileShareDialog.createLink')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div>
                <Label>{t('fileShareDialog.selectUsers')}</Label>
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
                        <p className="font-medium">{t('fileShareDialog.member')}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.pubkey.slice(0, 16)}...
                        </p>
                      </div>
                    </label>
                  ))}
                  {groupMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('fileShareDialog.noMembersFound')}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label>{t('fileShareDialog.permissionLevel')}</Label>
                <Select value={permission} onValueChange={(v) => setPermission(v as FilePermission)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">{t('fileShareDialog.viewOnly')}</SelectItem>
                    <SelectItem value="download">{t('fileShareDialog.viewDownload')}</SelectItem>
                    <SelectItem value="edit">{t('fileShareDialog.viewDownloadEdit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="generate-link">{t('fileShareDialog.generatePublicLink')}</Label>
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
                        {t('fileShareDialog.passwordOptional')}
                      </Label>
                      <Input
                        id="link-password"
                        type="text"
                        placeholder={t('fileShareDialog.passwordPlaceholder')}
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="expires-in">
                        <Calendar className="inline h-4 w-4 mr-1" />
                        {t('fileShareDialog.expiresInDays')}
                      </Label>
                      <Select
                        value={expiresInDays?.toString() || 'never'}
                        onValueChange={(v) => setExpiresInDays(v === 'never' ? null : parseInt(v))}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">{t('fileShareDialog.never')}</SelectItem>
                          <SelectItem value="1">{t('fileShareDialog.oneDay')}</SelectItem>
                          <SelectItem value="7">{t('fileShareDialog.sevenDays')}</SelectItem>
                          <SelectItem value="30">{t('fileShareDialog.thirtyDays')}</SelectItem>
                          <SelectItem value="90">{t('fileShareDialog.ninetyDays')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <div>
                <Label>{t('fileShareDialog.permissionLevel')}</Label>
                <Select value={permission} onValueChange={(v) => setPermission(v as FilePermission)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">{t('fileShareDialog.viewOnly')}</SelectItem>
                    <SelectItem value="download">{t('fileShareDialog.viewDownload')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                {t('fileShareDialog.cancel')}
              </Button>
              <Button
                onClick={handleCreateShare}
                disabled={isCreating || (selectedUsers.length === 0 && !generateLink)}
              >
                {isCreating ? t('fileShareDialog.creating') : t('fileShareDialog.createShare')}
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
