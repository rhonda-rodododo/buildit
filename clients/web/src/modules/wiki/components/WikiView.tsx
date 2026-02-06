/**
 * WikiView — Main wiki module view
 * State-driven: shows page list or editor based on currentPageId
 */

import { FC, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWikiStore } from '../wikiStore'
import { WikiPageList } from './WikiPageList'
import { WikiEditor } from './WikiEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface WikiViewProps {
  groupId?: string
}

export const WikiView: FC<WikiViewProps> = ({ groupId = 'global' }) => {
  const { t } = useTranslation()
  const currentPageId = useWikiStore((s) => s.currentPageId)
  const pages = useWikiStore((s) => s.pages)
  const setCurrentPage = useWikiStore((s) => s.setCurrentPage)
  const createPage = useWikiStore((s) => s.createPage)
  const updatePage = useWikiStore((s) => s.updatePage)
  const getCategories = useWikiStore((s) => s.getCategories)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState<string>('')

  const currentPage = currentPageId ? pages[currentPageId] : undefined
  const categories = getCategories(groupId)

  const handleCreatePage = useCallback(() => {
    setNewTitle('')
    setNewDescription('')
    setNewCategory('')
    setShowCreateDialog(true)
  }, [])

  const handleConfirmCreate = useCallback(() => {
    if (!newTitle.trim()) return

    const pageId = createPage(groupId)

    // Update the page with the provided title and metadata
    updatePage(pageId, {
      title: newTitle.trim(),
      content: newDescription.trim() ? `<p>${newDescription.trim()}</p>` : '',
      categoryId: newCategory || undefined,
      status: 'draft',
    })

    setShowCreateDialog(false)
    setNewTitle('')
    setNewDescription('')
    setNewCategory('')
  }, [createPage, updatePage, groupId, newTitle, newDescription, newCategory])

  const handleSelectPage = useCallback(
    (pageId: string) => {
      setCurrentPage(pageId)
    },
    [setCurrentPage],
  )

  const handleBack = useCallback(() => {
    setCurrentPage(null)
  }, [setCurrentPage])

  if (currentPage) {
    return (
      <WikiEditor page={currentPage} groupId={groupId} onBack={handleBack} />
    )
  }

  return (
    <>
      <WikiPageList
        groupId={groupId}
        onCreatePage={handleCreatePage}
        onSelectPage={handleSelectPage}
      />

      {/* Create Page Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('wikiView.createPage', 'Create Wiki Page')}</DialogTitle>
            <DialogDescription>
              {t('wikiView.createPageDesc', 'Add a new page to the knowledge base.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="page-title">{t('wikiView.pageTitle', 'Page Title')}</Label>
              <Input
                id="page-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('wikiView.pageTitlePlaceholder', 'Enter a page title...')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTitle.trim()) {
                    handleConfirmCreate()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-description">{t('wikiView.pageDescription', 'Description (optional)')}</Label>
              <Textarea
                id="page-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t('wikiView.pageDescPlaceholder', 'Brief description of this page...')}
                rows={3}
              />
            </div>
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>{t('wikiView.category', 'Category')}</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('wikiView.selectCategory', 'Select a category')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('wikiView.noCategory', 'No category')}</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleConfirmCreate} disabled={!newTitle.trim()}>
              {t('wikiView.createButton', 'Create Page')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
