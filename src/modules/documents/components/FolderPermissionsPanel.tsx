/**
 * Folder Permissions Panel
 * Epic 58: Manage folder-level permissions with inheritance for documents
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Folder,
  Users,
  Plus,
  Trash2,
  Eye,
  MessageSquare,
  Pencil,
  Shield,
  X,
  GitBranch,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDocumentsStore } from '../documentsStore'
import { useGroupsStore } from '@/stores/groupsStore'
import type { DocumentPermission, FolderPermission } from '../types'

interface FolderPermissionsPanelProps {
  folderId: string
  groupId: string
  currentUserPubkey: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PERMISSION_ICONS: Record<DocumentPermission, typeof Eye> = {
  view: Eye,
  comment: MessageSquare,
  edit: Pencil,
  admin: Shield,
}

const PERMISSION_LABEL_KEYS: Record<DocumentPermission, string> = {
  view: 'folderPermissionsPanel.permissions.view',
  comment: 'folderPermissionsPanel.permissions.comment',
  edit: 'folderPermissionsPanel.permissions.edit',
  admin: 'folderPermissionsPanel.permissions.admin',
}

export function FolderPermissionsPanel({
  folderId,
  groupId,
  currentUserPubkey,
  open,
  onOpenChange,
}: FolderPermissionsPanelProps) {
  const { t } = useTranslation()
  const folders = useDocumentsStore((state) => state.folders)
  const folder = folders.get(folderId)
  const getFolderPermissions = useDocumentsStore((state) => state.getFolderPermissions)
  const setFolderPermission = useDocumentsStore((state) => state.setFolderPermission)
  const removeFolderPermission = useDocumentsStore((state) => state.removeFolderPermission)
  const groupMembers = useGroupsStore((state) => state.groupMembers.get(groupId) || [])
  const [permissions, setPermissions] = useState<FolderPermission[]>([])
  const [loading, setLoading] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedPermission, setSelectedPermission] = useState<DocumentPermission>('view')
  const [inheritToChildren, setInheritToChildren] = useState(true)

  useEffect(() => {
    if (open && folderId) {
      loadPermissions()
    }
  }, [open, folderId])

  const loadPermissions = () => {
    const folderPerms = getFolderPermissions(folderId)
    setPermissions(folderPerms)
  }

  const handleAddPermission = async () => {
    if (!selectedUser || !currentUserPubkey) return

    setLoading(true)
    try {
      setFolderPermission({
        folderId,
        groupId,
        userPubkey: selectedUser,
        permission: selectedPermission,
        inheritToChildren,
        addedByPubkey: currentUserPubkey,
        addedAt: Date.now(),
      })
      loadPermissions()
      setSelectedUser('')
      setAddingUser(false)
    } catch (err) {
      console.error('Failed to add permission:', err)
      alert(t('folderPermissionsPanel.errors.addFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRemovePermission = async (userPubkey: string) => {
    setLoading(true)
    try {
      removeFolderPermission(folderId, userPubkey)
      loadPermissions()
    } catch (err) {
      console.error('Failed to remove permission:', err)
      alert(t('folderPermissionsPanel.errors.removeFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleInheritance = (perm: FolderPermission) => {
    if (!currentUserPubkey) return

    setFolderPermission({
      ...perm,
      inheritToChildren: !perm.inheritToChildren,
      addedByPubkey: currentUserPubkey,
      addedAt: Date.now(),
    })
    loadPermissions()
  }

  // Get users who don't already have permissions
  const availableUsers = groupMembers.filter(
    (member) => !permissions.some((p) => p.userPubkey === member.pubkey)
  )

  const getAvatarColor = (pubkey: string) => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    ]
    const hash = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  if (!folder) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            {t('folderPermissionsPanel.title')}
          </DialogTitle>
          <DialogDescription>
            {t('folderPermissionsPanel.description', { name: folder.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Permissions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">
                <Users className="inline h-4 w-4 mr-1" />
                {t('folderPermissionsPanel.usersWithAccess')}
              </Label>
              {!addingUser && availableUsers.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingUser(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('folderPermissionsPanel.addUser')}
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-[200px]">
              {permissions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('folderPermissionsPanel.emptyState.title')}</p>
                  <p className="text-xs mt-1">
                    {t('folderPermissionsPanel.emptyState.description')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {permissions.map((perm) => {
                    const PermIcon = PERMISSION_ICONS[perm.permission]

                    return (
                      <Card key={perm.userPubkey}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback
                                className={`text-white text-xs ${getAvatarColor(perm.userPubkey)}`}
                              >
                                {perm.userPubkey.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {perm.userPubkey.slice(0, 16)}...
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <PermIcon className="h-3 w-3" />
                                  {t(PERMISSION_LABEL_KEYS[perm.permission])}
                                </Badge>
                                {perm.inheritToChildren && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs gap-1 cursor-pointer"
                                    onClick={() => handleToggleInheritance(perm)}
                                    title={t('folderPermissionsPanel.disableInheritance')}
                                  >
                                    <GitBranch className="h-3 w-3" />
                                    {t('folderPermissionsPanel.inherited')}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemovePermission(perm.userPubkey)}
                              disabled={loading}
                              className="text-destructive hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Add User Form */}
          {addingUser && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{t('folderPermissionsPanel.addPermission.title')}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddingUser(false)
                      setSelectedUser('')
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="select-user" className="text-xs text-muted-foreground">
                      {t('folderPermissionsPanel.addPermission.selectUser')}
                    </Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger id="select-user" className="mt-1">
                        <SelectValue placeholder={t('folderPermissionsPanel.addPermission.selectUserPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((member) => (
                          <SelectItem key={member.pubkey} value={member.pubkey}>
                            {member.pubkey.slice(0, 16)}...
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="select-permission" className="text-xs text-muted-foreground">
                      {t('folderPermissionsPanel.addPermission.permissionLevel')}
                    </Label>
                    <Select
                      value={selectedPermission}
                      onValueChange={(v) => setSelectedPermission(v as DocumentPermission)}
                    >
                      <SelectTrigger id="select-permission" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">{t('folderPermissionsPanel.permissionDescriptions.viewOnly')}</SelectItem>
                        <SelectItem value="comment">{t('folderPermissionsPanel.permissionDescriptions.viewComment')}</SelectItem>
                        <SelectItem value="edit">{t('folderPermissionsPanel.permissionDescriptions.edit')}</SelectItem>
                        <SelectItem value="admin">{t('folderPermissionsPanel.permissionDescriptions.adminFull')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="inherit-toggle" className="text-sm">
                        {t('folderPermissionsPanel.addPermission.applyToSubfolders')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('folderPermissionsPanel.addPermission.cascadeDescription')}
                      </p>
                    </div>
                    <Switch
                      id="inherit-toggle"
                      checked={inheritToChildren}
                      onCheckedChange={setInheritToChildren}
                    />
                  </div>

                  <Button
                    onClick={handleAddPermission}
                    disabled={!selectedUser || loading}
                    className="w-full"
                  >
                    {loading ? t('folderPermissionsPanel.addPermission.adding') : t('folderPermissionsPanel.addPermission.addButton')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info about inheritance */}
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <GitBranch className="inline h-3 w-3 mr-1" />
            {t('folderPermissionsPanel.inheritanceInfo')}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
