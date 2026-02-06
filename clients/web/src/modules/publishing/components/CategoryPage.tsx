/**
 * CategoryPage Component
 * Category/tag landing pages with article listing and description
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublishingStore } from '../publishingStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tag,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  FileText,
} from 'lucide-react';
import type { Article } from '../types';
import { format } from 'date-fns';

const ARTICLES_PER_PAGE = 10;

interface CategoryPageProps {
  publicationId: string;
  /** The category/tag to display */
  category: string;
  /** Optional category description */
  description?: string;
  onArticleClick?: (article: Article) => void;
  onCategoryClick?: (category: string) => void;
  onBack?: () => void;
  className?: string;
}

export const CategoryPage: FC<CategoryPageProps> = ({
  publicationId,
  category,
  description,
  onArticleClick,
  onCategoryClick,
  onBack,
  className,
}) => {
  const { t } = useTranslation();
  const { getPublicationArticles } = usePublishingStore();
  const [page, setPage] = useState(1);

  // Get all published articles
  const allPublishedArticles = useMemo(() => {
    return getPublicationArticles(publicationId, 'published');
  }, [publicationId, getPublicationArticles]);

  // Filter articles by category/tag
  const categoryArticles = useMemo(() => {
    const normalizedCategory = category.toLowerCase();
    return allPublishedArticles.filter((article) =>
      article.tags.some((tag) => tag.toLowerCase() === normalizedCategory)
    );
  }, [allPublishedArticles, category]);

  // Get all unique categories with article counts
  const allCategories = useMemo(() => {
    const tagCounts = new Map<string, number>();
    for (const article of allPublishedArticles) {
      for (const tag of article.tags) {
        const lower = tag.toLowerCase();
        tagCounts.set(lower, (tagCounts.get(lower) || 0) + 1);
      }
    }
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [allPublishedArticles]);

  // Pagination
  const totalPages = Math.ceil(categoryArticles.length / ARTICLES_PER_PAGE);
  const paginatedArticles = categoryArticles.slice(
    (page - 1) * ARTICLES_PER_PAGE,
    page * ARTICLES_PER_PAGE
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold capitalize">{category}</h2>
          </div>
          <Badge variant="secondary" className="ml-2">
            {categoryArticles.length}{' '}
            {categoryArticles.length === 1
              ? t('categoryPage.article')
              : t('categoryPage.articles')}
          </Badge>
        </div>

        {/* Category Description */}
        {description && (
          <p className="text-muted-foreground max-w-2xl mb-4">
            {description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content - Article List */}
        <div className="lg:col-span-3 space-y-4">
          {paginatedArticles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {t('categoryPage.noArticles')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('categoryPage.noArticlesInCategory', { category })}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedArticles.map((article) => (
                <Card
                  key={article.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onArticleClick?.(article)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Cover Image */}
                      {article.coverImage && (
                        <img
                          src={article.coverImage}
                          alt={article.title}
                          className="w-24 h-16 object-cover rounded-md flex-shrink-0"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <h3 className="font-semibold text-lg mb-1 line-clamp-1">
                          {article.title}
                        </h3>

                        {/* Subtitle */}
                        {article.subtitle && (
                          <p className="text-sm text-muted-foreground mb-1 line-clamp-1">
                            {article.subtitle}
                          </p>
                        )}

                        {/* Excerpt */}
                        {article.excerpt && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {article.excerpt}
                          </p>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(
                              article.publishedAt || article.createdAt,
                              'MMMM d, yyyy'
                            )}
                          </span>
                          {article.readingTimeMinutes && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {article.readingTimeMinutes} {t('categoryPage.minRead')}
                            </span>
                          )}
                          {article.authorName && (
                            <span className="text-xs text-muted-foreground">
                              {t('categoryPage.by')} {article.authorName}
                            </span>
                          )}
                        </div>

                        {/* Tags */}
                        <div className="flex gap-1 mt-2">
                          {article.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant={tag.toLowerCase() === category.toLowerCase() ? 'default' : 'outline'}
                              className="text-xs cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (tag.toLowerCase() !== category.toLowerCase()) {
                                  onCategoryClick?.(tag);
                                }
                              }}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {t('categoryPage.page', { page, total: totalPages })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {t('categoryPage.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        {t('categoryPage.next')}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Sidebar - Related Categories */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                {t('categoryPage.allCategories')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {allCategories.map(({ name, count }) => (
                  <Badge
                    key={name}
                    variant={name === category.toLowerCase() ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => {
                      if (name !== category.toLowerCase()) {
                        onCategoryClick?.(name);
                      }
                    }}
                  >
                    {name}
                    <span className="ml-1 text-xs opacity-70">({count})</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
