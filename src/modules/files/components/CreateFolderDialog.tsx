/**
 * Create Folder Dialog
 * Dialog for creating new folders
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import { fileManager } from '../fileManager'

interface CreateFolderDialogProps {
  groupId: string
  parentId: string | null
  onClose: () => void
}

export function CreateFolderDialog({ groupId, parentId, onClose }: CreateFolderDialogProps) {
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const currentIdentity = useAuthStore((state) => state.currentIdentity)

  const handleCreate = async () => {
    if (!currentIdentity?.privateKey || !name.trim()) return

    setIsCreating(true)

    try {
      await fileManager.createFolder(
        {
          groupId,
          parentId,
          name: name.trim(),
        },
        currentIdentity.privateKey
      )

      onClose()
    } catch (error) {
      console.error('Failed to create folder:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Folder</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Folder Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter folder name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleCreate()
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
