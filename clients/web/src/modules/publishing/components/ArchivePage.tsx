/**
 * ArchivePage Component
 * Auto-generated archive pages organized by month/year with pagination
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublishingStore } from '../publishingStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Archive,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
} from 'lucide-react';
import type { Article } from '../types';
import { format } from 'date-fns';

const ARTICLES_PER_PAGE = 10;

interface ArchivePageProps {
  publicationId: string;
  /** Optional initial year/month filter, e.g., "2026/01" */
  initialFilter?: string;
  onArticleClick?: (article: Article) => void;
  onBack?: () => void;
  className?: string;
}

interface MonthGroup {
  year: number;
  month: number;
  label: string;
  articles: Article[];
  /** SEO-friendly path segment: /archive/2026/01 */
  path: string;
}

export const ArchivePage: FC<ArchivePageProps> = ({
  publicationId,
  initialFilter,
  onArticleClick,
  onBack,
  className,
}) => {
  const { t } = useTranslation();
  const { getPublicationArticles } = usePublishingStore();

  // Get published articles sorted by publishedAt desc
  const publishedArticles = useMemo(() => {
    return getPublicationArticles(publicationId, 'published');
  }, [publicationId, getPublicationArticles]);

  // Group articles by month/year
  const monthGroups = useMemo((): MonthGroup[] => {
    const groups = new Map<string, MonthGroup>();

    for (const article of publishedArticles) {
      const date = new Date(article.publishedAt || article.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (!groups.has(key)) {
        groups.set(key, {
          year,
          month: month + 1,
          label: format(date, 'MMMM yyyy'),
          articles: [],
          path: `/archive/${year}/${String(month + 1).padStart(2, '0')}`,
        });
      }

      groups.get(key)!.articles.push(article);
    }

    // Sort by date descending
    return Array.from(groups.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [publishedArticles]);

  // Parse initial filter
  const parseFilter = (filter?: string): { year?: number; month?: number } => {
    if (!filter) return {};
    const parts = filter.split('/');
    const year = parseInt(parts[0], 10);
    const month = parts.length > 1 ? parseInt(parts[1], 10) : undefined;
    return { year: isNaN(year) ? undefined : year, month };
  };

  const parsedFilter = parseFilter(initialFilter);
  const [selectedYear, setSelectedYear] = useState<number | null>(parsedFilter.year ?? null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(parsedFilter.month ?? null);
  const [page, setPage] = useState(1);

  // Get filtered articles based on selection
  const filteredArticles = useMemo((): Article[] => {
    if (selectedYear && selectedMonth) {
      const group = monthGroups.find(
        (g) => g.year === selectedYear && g.month === selectedMonth
      );
      return group?.articles || [];
    }

    if (selectedYear) {
      return monthGroups
        .filter((g) => g.year === selectedYear)
        .flatMap((g) => g.articles);
    }

    return publishedArticles;
  }, [selectedYear, selectedMonth, monthGroups, publishedArticles]);

  // Pagination
  const totalPages = Math.ceil(filteredArticles.length / ARTICLES_PER_PAGE);
  const paginatedArticles = filteredArticles.slice(
    (page - 1) * ARTICLES_PER_PAGE,
    page * ARTICLES_PER_PAGE
  );

  // Get unique years for sidebar
  const years = useMemo(() => {
    const yearSet = new Set(monthGroups.map((g) => g.year));
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [monthGroups]);

  // Handle month selection
  const handleMonthSelect = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    setPage(1);
  };

  // Handle year selection
  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setSelectedMonth(null);
    setPage(1);
  };

  // Clear filters
  const handleClearFilter = () => {
    setSelectedYear(null);
    setSelectedMonth(null);
    setPage(1);
  };

  // Get current filter label
  const getFilterLabel = (): string => {
    if (selectedYear && selectedMonth) {
      const group = monthGroups.find(
        (g) => g.year === selectedYear && g.month === selectedMonth
      );
      return group?.label || `${selectedYear}/${selectedMonth}`;
    }
    if (selectedYear) {
      return String(selectedYear);
    }
    return t('archivePage.allArticles');
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Archive className="h-6 w-6" />
              {t('archivePage.title')}
            </h2>
            <p className="text-muted-foreground">
              {filteredArticles.length}{' '}
              {filteredArticles.length === 1
                ? t('archivePage.article')
                : t('archivePage.articles')}
              {selectedYear && (
                <>
                  {' '}
                  {t('archivePage.in')} {getFilterLabel()}
                </>
              )}
            </p>
          </div>
        </div>
        {(selectedYear || selectedMonth) && (
          <Button variant="outline" size="sm" onClick={handleClearFilter}>
            {t('archivePage.showAll')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Month/Year Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('archivePage.browseByDate')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {years.map((year) => {
                const yearGroups = monthGroups.filter((g) => g.year === year);
                const yearTotal = yearGroups.reduce((sum, g) => sum + g.articles.length, 0);

                return (
                  <div key={year}>
                    <button
                      onClick={() => handleYearSelect(year)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors ${
                        selectedYear === year && !selectedMonth
                          ? 'bg-accent font-medium'
                          : ''
                      }`}
                    >
                      <span>{year}</span>
                      <Badge variant="secondary" className="text-xs">
                        {yearTotal}
                      </Badge>
                    </button>

                    {/* Show months when year is selected */}
                    {selectedYear === year && (
                      <div className="ml-3 mt-1 space-y-0.5">
                        {yearGroups.map((group) => (
                          <button
                            key={`${group.year}-${group.month}`}
                            onClick={() => handleMonthSelect(group.year, group.month)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm hover:bg-accent transition-colors ${
                              selectedMonth === group.month
                                ? 'bg-accent font-medium'
                                : ''
                            }`}
                          >
                            <span>{format(new Date(group.year, group.month - 1), 'MMMM')}</span>
                            <Badge variant="outline" className="text-xs">
                              {group.articles.length}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {years.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('archivePage.noArticlesYet')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Article List */}
        <div className="lg:col-span-3 space-y-4">
          {paginatedArticles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {t('archivePage.noArticlesFound')}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t('archivePage.noArticlesDescription')}
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
                              {article.readingTimeMinutes} {t('archivePage.minRead')}
                            </span>
                          )}
                          {article.tags.length > 0 && (
                            <div className="flex gap-1">
                              {article.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
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
                      {t('archivePage.page', { page, total: totalPages })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {t('archivePage.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        {t('archivePage.next')}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
