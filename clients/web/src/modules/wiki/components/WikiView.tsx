import { FC, useState, Suspense, lazy, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useWikiStore } from '../wikiStore'

// Lazy load CreatePageDialog to avoid loading heavy MDEditor until needed
const CreatePageDialog = lazy(() => import('./CreatePageDialog').then(m => ({ default: m.CreatePageDialog })))

interface WikiViewProps {
  groupId?: string
}

export const WikiView: FC<WikiViewProps> = ({ groupId = 'global' }) => {
  const { t } = useTranslation()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Access raw state to avoid selector instability
  const pagesRecord = useWikiStore(state => state.pages)

  // Memoize filtered/searched pages to prevent infinite re-renders
  const pages = useMemo(() => {
    const allPages = Object.values(pagesRecord)
      .filter(p => p.groupId === groupId)
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))

    if (!searchQuery) return allPages

    const lowercaseQuery = searchQuery.toLowerCase()
    return allPages.filter(p =>
      p.title.toLowerCase().includes(lowercaseQuery) ||
      p.content.toLowerCase().includes(lowercaseQuery) ||
      (p.tags ?? []).some(t => t.toLowerCase().includes(lowercaseQuery))
    )
  }, [pagesRecord, groupId, searchQuery])

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('wikiView.title')}</h2>
          <p className="text-muted-foreground">
            {t('wikiView.subtitle')}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('wikiView.newPage')}
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('wikiView.searchPlaceholder')}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {pages.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              {searchQuery ? t('wikiView.noResults') : t('wikiView.empty')}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map(page => (
            <Card key={page.id} className="hover:bg-muted/50 cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {page.title}
                </CardTitle>
                {page.categoryId && (
                  <CardDescription>{page.categoryId}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground line-clamp-3">
                  {page.content.substring(0, 150)}...
                </div>
                {(page.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(page.tags ?? []).map(tag => (
                      <span key={tag} className="text-xs px-2 py-1 bg-muted rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {t('wikiView.updated', { date: new Date(page.updatedAt ?? page.createdAt).toLocaleDateString() })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        <CreatePageDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          groupId={groupId}
          onCreated={() => {
            // Refresh pages list
          }}
        />
      </Suspense>
    </div>
  )
}
