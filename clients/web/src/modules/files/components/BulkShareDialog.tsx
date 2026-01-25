/**
 * Bulk Share Dialog
 * Epic 57: Share multiple files at once
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link2, Users, Lock, Calendar, Share2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { fileManager } from '../fileManager'
import { useFilesStore } from '../filesStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { getCurrentPrivateKey } from '@/stores/authStore'
import type { FilePermission } from '../types'

interface BulkShareDialogProps {
  fileIds: string[]
  groupId: string
  onClose: () => void
  onComplete: () => void
}

export function BulkShareDialog({ fileIds, groupId, onClose, onComplete }: BulkShareDialogProps) {
  const { t } = useTranslation()
  const groupMembers = useGroupsStore((state) => state.groupMembers.get(groupId) || [])
  const files = useFilesStore((state) => state.files)

  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [permission, setPermission] = useState<FilePermission>('view')
  const [generateLink, setGenerateLink] = useState(false)
  const [linkPassword, setLinkPassword] = useState('')
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const privateKey = getCurrentPrivateKey()

  if (!privateKey || fileIds.length === 0) {
    return null
  }

  const selectedFiles = fileIds.map(id => files.get(id)).filter(f => f !== undefined)

  const handleBulkShare = async () => {
    const pk = getCurrentPrivateKey()
    if (!pk) return

    setIsSharing(true)
    setProgress(0)
    setErrors([])

    const expiresAt = expiresInDays
      ? Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const newErrors: string[] = []
    let successCount = 0

    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i]
      const file = files.get(fileId)

      try {
        await fileManager.createShare(
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
        successCount++
      } catch (err) {
        newErrors.push(`Failed to share ${file?.name || fileId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      setProgress(((i + 1) / fileIds.length) * 100)
    }

    setErrors(newErrors)
    setCompleted(true)
    setIsSharing(false)

    if (successCount === fileIds.length) {
      // All successful, close after a short delay
      setTimeout(() => {
        onComplete()
        onClose()
      }, 1500)
    }
  }

  const toggleUser = (pubkey: string) => {
    setSelectedUsers((prev) =>
      prev.includes(pubkey)
        ? prev.filter((p) => p !== pubkey)
        : [...prev, pubkey]
    )
  }

  if (completed) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              {t('files.bulkShare.complete')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600">
                {fileIds.length - errors.length} / {fileIds.length}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {t('files.bulkShare.filesSharedSuccessfully')}
              </p>
            </div>

            {errors.length > 0 && (
              <div className="rounded-lg bg-destructive/10 p-4">
                <p className="font-medium text-destructive mb-2">
                  {t('files.bulkShare.failedToShare', { count: errors.length })}
                </p>
                <ul className="text-sm text-destructive space-y-1">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={onClose}>{t('files.bulkShare.done')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t('files.bulkShare.title', { count: fileIds.length })}
          </DialogTitle>
          <DialogDescription>
            {t('files.bulkShare.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Selected files preview */}
        <div className="rounded-lg bg-muted p-3 max-h-32 overflow-auto">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.slice(0, 10).map(file => (
              <Badge key={file.id} variant="secondary">
                {file.name}
              </Badge>
            ))}
            {selectedFiles.length > 10 && (
              <Badge variant="outline">
                {t('files.bulkShare.more', { count: selectedFiles.length - 10 })}
              </Badge>
            )}
          </div>
        </div>

        {isSharing ? (
          <div className="py-8">
            <div className="text-center mb-4">
              <p className="text-lg font-medium">{t('files.bulkShare.sharingFiles')}</p>
              <p className="text-sm text-muted-foreground">
                {t('files.bulkShare.pleaseWait')}
              </p>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground mt-2">
              {t('files.bulkShare.percentComplete', { percent: Math.round(progress) })}
            </p>
          </div>
        ) : (
          <Tabs defaultValue="users" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                {t('files.bulkShare.shareWithUsers')}
              </TabsTrigger>
              <TabsTrigger value="link">
                <Link2 className="h-4 w-4 mr-2" />
                {t('files.bulkShare.createLinks')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div>
                <Label>{t('files.bulkShare.selectUsers')}</Label>
                <div className="mt-2 space-y-2 max-h-48 overflow-auto border rounded-lg p-2">
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
                        <p className="font-medium">{t('files.bulkShare.member')}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.pubkey.slice(0, 16)}...
                        </p>
                      </div>
                    </label>
                  ))}
                  {groupMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('files.bulkShare.noGroupMembers')}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label>{t('files.bulkShare.permissionLevel')}</Label>
                <Select value={permission} onValueChange={(v) => setPermission(v as FilePermission)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">{t('files.bulkShare.viewOnly')}</SelectItem>
                    <SelectItem value="download">{t('files.bulkShare.viewDownload')}</SelectItem>
                    <SelectItem value="edit">{t('files.bulkShare.viewDownloadEdit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="generate-link">{t('files.bulkShare.generateLinks')}</Label>
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
                        {t('files.bulkShare.passwordOptional')}
                      </Label>
                      <Input
                        id="link-password"
                        type="text"
                        placeholder={t('files.bulkShare.passwordPlaceholder')}
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="expires-in">
                        <Calendar className="inline h-4 w-4 mr-1" />
                        {t('files.bulkShare.expiresIn')}
                      </Label>
                      <Select
                        value={expiresInDays?.toString() || 'never'}
                        onValueChange={(v) => setExpiresInDays(v === 'never' ? null : parseInt(v))}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">{t('files.bulkShare.never')}</SelectItem>
                          <SelectItem value="1">{t('files.bulkShare.day')}</SelectItem>
                          <SelectItem value="7">{t('files.bulkShare.days7')}</SelectItem>
                          <SelectItem value="30">{t('files.bulkShare.days30')}</SelectItem>
                          <SelectItem value="90">{t('files.bulkShare.days90')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <div>
                <Label>{t('files.bulkShare.permissionLevel')}</Label>
                <Select value={permission} onValueChange={(v) => setPermission(v as FilePermission)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">{t('files.bulkShare.viewOnly')}</SelectItem>
                    <SelectItem value="download">{t('files.bulkShare.viewDownload')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleBulkShare}
                disabled={selectedUsers.length === 0 && !generateLink}
              >
                {t('files.bulkShare.title', { count: fileIds.length })}
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
