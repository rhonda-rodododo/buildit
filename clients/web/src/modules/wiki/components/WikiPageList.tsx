/**
 * WikiPageList — Grid/list of wiki pages with search
 * Extracted from WikiView for clean separation of list vs editor views
 */

import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Plus, Search } from 'lucide-react'
import { useWikiStore } from '../wikiStore'

interface WikiPageListProps {
  groupId: string
  onCreatePage: () => void
  onSelectPage: (pageId: string) => void
}

export const WikiPageList: FC<WikiPageListProps> = ({
  groupId,
  onCreatePage,
  onSelectPage,
}) => {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')

  const pagesRecord = useWikiStore((s) => s.pages)

  const pages = useMemo(() => {
    const allPages = Object.values(pagesRecord)
      .filter((p) => p.groupId === groupId)
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))

    if (!searchQuery) return allPages

    const q = searchQuery.toLowerCase()
    return allPages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        (p.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
    )
  }, [pagesRecord, groupId, searchQuery])

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t('wikiView.title')}
          </h2>
          <p className="text-muted-foreground">{t('wikiView.subtitle')}</p>
        </div>
        <Button onClick={onCreatePage}>
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
          {pages.map((page) => (
            <Card
              key={page.id}
              className="hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onSelectPage(page.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 shrink-0" />
                  <span className="truncate">
                    {page.title || t('wiki:untitledPage')}
                  </span>
                </CardTitle>
                {page.categoryId && (
                  <CardDescription>{page.categoryId}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground line-clamp-3">
                  {page.content
                    ? page.content.replace(/<[^>]*>/g, '').substring(0, 150)
                    : t('wiki:emptyPage')}
                </div>
                {(page.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(page.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {t('wikiView.updated', {
                      date: new Date(
                        page.updatedAt ?? page.createdAt,
                      ).toLocaleDateString(),
                    })}
                  </span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {page.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
