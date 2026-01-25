/**
 * Folder Browser
 * Breadcrumb navigation for folder hierarchy
 */

import { ChevronRight, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFilesStore } from '../filesStore'

export function FolderBrowser() {
  const currentFolderId = useFilesStore((state) => state.currentFolderId)
  const getFolderPath = useFilesStore((state) => state.getFolderPath)
  const setCurrentFolder = useFilesStore((state) => state.setCurrentFolder)

  const path = currentFolderId ? getFolderPath(currentFolderId) : []

  return (
    <div className="flex items-center gap-1 border-b bg-muted/30 px-4 py-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCurrentFolder(null)}
        className="h-8 gap-1"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Root</span>
      </Button>

      {path.map((folder) => (
        <div key={folder.id} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentFolder(folder.id)}
            className="h-8"
          >
            {folder.name}
          </Button>
        </div>
      ))}
    </div>
  )
}
