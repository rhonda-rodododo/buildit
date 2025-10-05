import { FC, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import MDEditor from '@uiw/react-md-editor'

interface CreatePageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  onCreated?: () => void
}

export const CreatePageDialog: FC<CreatePageDialogProps> = ({
  open,
  onOpenChange,
  groupId,
  onCreated,
}) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')

  const handleCreate = async () => {
    console.log('Creating wiki page:', {
      groupId,
      title,
      content,
      category: category || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })

    // Reset form
    setTitle('')
    setContent('')
    setCategory('')
    setTags('')

    onOpenChange(false)
    onCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Wiki Page</DialogTitle>
          <DialogDescription>
            Create collaborative documentation for your community
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Category (optional)</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Getting Started, Organizing, Legal"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="organizing, safety, resources"
            />
          </div>

          <div className="grid gap-2">
            <Label>Content (Markdown)</Label>
            <div data-color-mode="light">
              <MDEditor
                value={content}
                onChange={(val) => setContent(val || '')}
                preview="edit"
                height={300}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title || !content}>
            Create Page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
