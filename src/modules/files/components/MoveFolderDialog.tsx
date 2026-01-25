/**
 * Move Folder Dialog
 * Dialog to select a target folder for moving files
 * Epic 57: Bulk operations support
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, ChevronRight, Home } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useFilesStore } from '../filesStore'

interface MoveFolderDialogProps {
  groupId: string
  currentFolderId: string | null
  selectedCount: number
  onMove: (targetFolderId: string | null) => void
  onClose: () => void
}

export function MoveFolderDialog({
  groupId,
  currentFolderId,
  selectedCount,
  onMove,
  onClose,
}: MoveFolderDialogProps) {
  const { t } = useTranslation()
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const allFolders = useFilesStore((state) =>
    Array.from(state.folders.values()).filter((f) => f.groupId === groupId)
  )

  // Build folder tree structure
  const buildFolderTree = (parentId: string | null = null): typeof allFolders => {
    return allFolders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const rootFolders = buildFolderTree(null)

  // Recursive folder item component
  const FolderItem = ({
    folder,
    depth = 0,
  }: {
    folder: (typeof allFolders)[0]
    depth?: number
  }) => {
    const [expanded, setExpanded] = useState(false)
    const childFolders = buildFolderTree(folder.id)
    const hasChildren = childFolders.length > 0
    const isSelected = selectedFolder === folder.id
    const isCurrent = folder.id === currentFolderId

    return (
      <div>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
            isSelected && 'bg-accent',
            isCurrent && 'opacity-50'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (!isCurrent) {
              setSelectedFolder(folder.id)
            }
          }}
          disabled={isCurrent}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn(
                'h-4 w-4 shrink-0 transition-transform cursor-pointer',
                expanded && 'rotate-90'
              )}
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            />
          ) : (
            <span className="w-4" />
          )}
          <Folder className="h-4 w-4 shrink-0 text-blue-500" />
          <span className="truncate">{folder.name}</span>
          {isCurrent && (
            <span className="ml-auto text-xs text-muted-foreground">{t('moveFolderDialog.current')}</span>
          )}
        </button>
        {expanded && hasChildren && (
          <div>
            {childFolders.map((child) => (
              <FolderItem key={child.id} folder={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('moveFolderDialog.title', { count: selectedCount })}</DialogTitle>
          <DialogDescription>
            {t('moveFolderDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-64 rounded-md border p-2">
          {/* Root folder option */}
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
              selectedFolder === null && 'bg-accent',
              currentFolderId === null && 'opacity-50'
            )}
            onClick={() => {
              if (currentFolderId !== null) {
                setSelectedFolder(null)
              }
            }}
            disabled={currentFolderId === null}
          >
            <span className="w-4" />
            <Home className="h-4 w-4 shrink-0" />
            <span>{t('moveFolderDialog.root')}</span>
            {currentFolderId === null && (
              <span className="ml-auto text-xs text-muted-foreground">{t('moveFolderDialog.current')}</span>
            )}
          </button>

          {/* Folder tree */}
          {rootFolders.map((folder) => (
            <FolderItem key={folder.id} folder={folder} />
          ))}

          {allFolders.length === 0 && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              {t('moveFolderDialog.noFolders')}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('moveFolderDialog.cancel')}
          </Button>
          <Button
            onClick={() => onMove(selectedFolder)}
            disabled={
              selectedFolder === currentFolderId ||
              (selectedFolder === null && currentFolderId === null)
            }
          >
            {t('moveFolderDialog.moveHere')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
