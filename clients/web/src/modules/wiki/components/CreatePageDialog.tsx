import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  groupId: _groupId, // Will be used when wiki store is implemented
  onCreated,
}) => {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tags, setTags] = useState('')

  const handleCreate = async () => {
    // Wiki page creation implementation pending wikiStore integration

    // Reset form
    setTitle('')
    setContent('')
    setCategoryId('')
    setTags('')

    onOpenChange(false)
    onCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createPageDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('createPageDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">{t('createPageDialog.titleLabel')}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('createPageDialog.titlePlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="categoryId">{t('createPageDialog.categoryLabel')}</Label>
            <Input
              id="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder={t('createPageDialog.categoryPlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">{t('createPageDialog.tagsLabel')}</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('createPageDialog.tagsPlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t('createPageDialog.contentLabel')}</Label>
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
            {t('createPageDialog.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={!title || !content}>
            {t('createPageDialog.createPage')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
