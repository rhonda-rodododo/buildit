/**
 * Folder Permissions Dialog
 * Epic 58: Manage folder-level permissions with inheritance
 */

import { useState, useEffect } from 'react'
import {
  Folder,
  Users,
  Plus,
  Trash2,
  Eye,
  Download,
  Pencil,
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
import { useFilesStore } from '../filesStore'
import { useGroupsStore } from '@/stores/groupsStore'
import type { FilePermission, FileFolderPermission } from '../types'

interface FolderPermissionsDialogProps {
  folderId: string
  groupId: string
  currentUserPubkey: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PERMISSION_ICONS: Record<FilePermission, typeof Eye> = {
  view: Eye,
  download: Download,
  edit: Pencil,
  delete: X,
}

const PERMISSION_LABELS: Record<FilePermission, string> = {
  view: 'View',
  download: 'Download',
  edit: 'Edit',
  delete: 'Delete',
}

export function FolderPermissionsDialog({
  folderId,
  groupId,
  currentUserPubkey,
  open,
  onOpenChange,
}: FolderPermissionsDialogProps) {
  const folder = useFilesStore((state) => state.getFolder(folderId))
  const getFolderPermissions = useFilesStore((state) => state.getFolderPermissions)
  const setFolderPermission = useFilesStore((state) => state.setFolderPermission)
  const removeFolderPermission = useFilesStore((state) => state.removeFolderPermission)
  const groupMembers = useGroupsStore((state) => state.groupMembers.get(groupId) || [])
  const [permissions, setPermissions] = useState<FileFolderPermission[]>([])
  const [loading, setLoading] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedPermission, setSelectedPermission] = useState<FilePermission>('view')
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
        permissions: [selectedPermission],
        inheritToChildren,
        addedByPubkey: currentUserPubkey,
        addedAt: Date.now(),
      })
      loadPermissions()
      setSelectedUser('')
      setAddingUser(false)
    } catch (err) {
      console.error('Failed to add permission:', err)
      alert('Failed to add permission')
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
      alert('Failed to remove permission')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleInheritance = (perm: FileFolderPermission) => {
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
            Folder Permissions
          </DialogTitle>
          <DialogDescription>
            Manage who can access "{folder.name}" and its contents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Permissions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">
                <Users className="inline h-4 w-4 mr-1" />
                Users with Access
              </Label>
              {!addingUser && availableUsers.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingUser(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add User
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-[200px]">
              {permissions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No specific permissions set</p>
                  <p className="text-xs mt-1">
                    Folder is accessible to all group members
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {permissions.map((perm) => {
                    const PermIcon = PERMISSION_ICONS[perm.permissions[0] || 'view']

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
                                  {perm.permissions.map((p) => PERMISSION_LABELS[p]).join(', ')}
                                </Badge>
                                {perm.inheritToChildren && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs gap-1 cursor-pointer"
                                    onClick={() => handleToggleInheritance(perm)}
                                    title="Click to disable inheritance"
                                  >
                                    <GitBranch className="h-3 w-3" />
                                    Inherited
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
                  <Label className="text-sm font-medium">Add User Permission</Label>
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
                      Select User
                    </Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger id="select-user" className="mt-1">
                        <SelectValue placeholder="Choose a user..." />
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
                      Permission Level
                    </Label>
                    <Select
                      value={selectedPermission}
                      onValueChange={(v) => setSelectedPermission(v as FilePermission)}
                    >
                      <SelectTrigger id="select-permission" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">View only</SelectItem>
                        <SelectItem value="download">View & Download</SelectItem>
                        <SelectItem value="edit">View, Download & Edit</SelectItem>
                        <SelectItem value="delete">Full Access (incl. Delete)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="inherit-toggle" className="text-sm">
                        Apply to subfolders
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Permission cascades to child folders and files
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
                    {loading ? 'Adding...' : 'Add Permission'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info about inheritance */}
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <GitBranch className="inline h-3 w-3 mr-1" />
            Inherited permissions automatically apply to all files and subfolders within this folder.
            Click the "Inherited" badge on a permission to disable inheritance for that user.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
