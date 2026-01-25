/**
 * Folder Tree Component
 * Displays hierarchical folder structure for document organization
 */

import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocumentsStore } from '../documentsStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentFolder } from '../types'

interface FolderTreeProps {
  groupId: string
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
  onSelectStarred: () => void
  showStarred: boolean
}

interface FolderItemProps {
  folder: DocumentFolder
  level: number
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<DocumentFolder>) => void
  onDelete: () => void
  children: DocumentFolder[]
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
}

const FolderItem: FC<FolderItemProps> = ({
  folder,
  level,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  children,
  selectedFolderId,
  onSelectFolder,
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)

  const handleRename = () => {
    if (editName.trim() && editName !== folder.name) {
      onUpdate({ name: editName.trim() })
    }
    setIsEditing(false)
  }

  const hasChildren = children.length > 0

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors group',
              isSelected && 'bg-muted',
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={onSelect}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(!isOpen)
                }}
                className="p-0.5 hover:bg-muted-foreground/20 rounded"
              >
                {isOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-4" />}

            {isOpen ? (
              <FolderOpen
                className="h-4 w-4 shrink-0"
                style={{ color: folder.color || undefined }}
              />
            ) : (
              <Folder
                className="h-4 w-4 shrink-0"
                style={{ color: folder.color || undefined }}
              />
            )}

            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') setIsEditing(false)
                }}
                className="h-6 py-0 px-1 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm truncate flex-1">{folder.name}</span>
            )}

            <button
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted-foreground/20 rounded"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <MoreVertical className="h-3 w-3" />
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            {t('folderTree.contextMenu.rename')}
          </ContextMenuItem>
          <ContextMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            {t('folderTree.contextMenu.delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isOpen && hasChildren && (
        <div>
          {children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              isSelected={selectedFolderId === child.id}
              onSelect={() => onSelectFolder(child.id)}
              onUpdate={() => {
                // Update handled by parent
              }}
              onDelete={() => {
                // Delete handled by parent
              }}
              children={[]}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const FolderTree: FC<FolderTreeProps> = ({
  groupId,
  selectedFolderId,
  onSelectFolder,
  onSelectStarred,
  showStarred,
}) => {
  const { t } = useTranslation()
  const { getGroupFolders, getFolderChildren, addFolder, updateFolder, deleteFolder, getStarredDocuments } = useDocumentsStore()
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState('#6366f1')

  const rootFolders = getGroupFolders(groupId).filter((f) => !f.parentFolderId)
  const starredDocs = getStarredDocuments()

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return

    const folder: DocumentFolder = {
      id: crypto.randomUUID(),
      groupId,
      name: newFolderName.trim(),
      createdByPubkey: '', // Will be set by caller
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color: newFolderColor,
    }

    addFolder(folder)
    setNewFolderName('')
    setNewFolderDialogOpen(false)
  }

  const folderColors = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#3b82f6', // Blue
    '#6b7280', // Gray
  ]

  return (
    <div className="space-y-2">
      {/* All Documents */}
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors',
          selectedFolderId === null && !showStarred && 'bg-muted',
        )}
        onClick={() => onSelectFolder(null)}
      >
        <Folder className="h-4 w-4" />
        <span className="text-sm font-medium">{t('folderTree.allDocuments')}</span>
      </div>

      {/* Starred */}
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors',
          showStarred && 'bg-muted',
        )}
        onClick={onSelectStarred}
      >
        <Star className="h-4 w-4 text-yellow-500" />
        <span className="text-sm font-medium">{t('folderTree.starred')}</span>
        {starredDocs.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {starredDocs.length}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="border-t my-2" />

      {/* Folders Header */}
      <div className="flex items-center justify-between px-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t('folderTree.folders')}
        </span>
        <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <FolderPlus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('folderTree.dialog.title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder={t('folderTree.dialog.namePlaceholder')}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                }}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('folderTree.dialog.colorLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  {folderColors.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-transform',
                        newFolderColor === color
                          ? 'border-foreground scale-110'
                          : 'border-transparent hover:scale-105',
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewFolderColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
                {t('folderTree.dialog.cancel')}
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                {t('folderTree.dialog.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Folder List */}
      <div className="space-y-0.5">
        {rootFolders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            level={0}
            isSelected={selectedFolderId === folder.id}
            onSelect={() => onSelectFolder(folder.id)}
            onUpdate={(updates) => updateFolder(folder.id, updates)}
            onDelete={() => deleteFolder(folder.id)}
            children={getFolderChildren(folder.id)}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
          />
        ))}
        {rootFolders.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('folderTree.noFolders')}
          </p>
        )}
      </div>
    </div>
  )
}
