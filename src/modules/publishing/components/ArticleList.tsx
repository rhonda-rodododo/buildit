/**
 * ArticleList Component
 * Displays list of articles with filtering and sorting
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublishingStore } from '../publishingStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  Clock,
  Send,
  Archive,
  FileText,
} from 'lucide-react';
import type { Article, ArticleStatus } from '../types';
import { formatDistanceToNow, format } from 'date-fns';

interface ArticleListProps {
  publicationId: string;
  onCreateArticle: () => void;
  onEditArticle: (article: Article) => void;
  onPreviewArticle: (article: Article) => void;
  onDeleteArticle: (articleId: string) => void;
  className?: string;
}

export const ArticleList: FC<ArticleListProps> = ({
  publicationId,
  onCreateArticle,
  onEditArticle,
  onPreviewArticle,
  onDeleteArticle,
  className,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'published' | 'title'>('updated');

  const { getPublicationArticles, publishArticle, unpublishArticle } = usePublishingStore();

  const articles = useMemo(() => {
    let result = getPublicationArticles(publicationId);

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((article) => article.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (article) =>
          article.title.toLowerCase().includes(query) ||
          article.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'published':
          return (b.publishedAt || 0) - (a.publishedAt || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'updated':
        default:
          return b.updatedAt - a.updatedAt;
      }
    });

    return result;
  }, [publicationId, getPublicationArticles, statusFilter, searchQuery, sortBy]);

  const getStatusBadge = (status: ArticleStatus) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500/20 text-green-600">{t('articleList.published')}</Badge>;
      case 'draft':
        return <Badge variant="secondary">{t('articleList.draft')}</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/20 text-blue-600">{t('articleList.scheduled')}</Badge>;
      case 'archived':
        return <Badge variant="outline">{t('articleList.archived')}</Badge>;
    }
  };

  const getVisibilityBadge = (visibility: Article['visibility']) => {
    switch (visibility) {
      case 'public':
        return <Badge variant="outline" className="text-xs">{t('articleList.public')}</Badge>;
      case 'subscribers':
        return <Badge variant="outline" className="text-xs">{t('articleList.subscribers')}</Badge>;
      case 'paid':
        return <Badge variant="outline" className="text-xs">{t('articleList.paidOnly')}</Badge>;
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{t('articleList.title')}</h2>
          <p className="text-muted-foreground">
            {articles.length !== 1
              ? t('articleList.articleCountPlural', { count: articles.length })
              : t('articleList.articleCount', { count: articles.length })}
          </p>
        </div>
        <Button onClick={onCreateArticle}>
          <Plus className="h-4 w-4 mr-2" />
          {t('articleList.newArticle')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('articleList.searchPlaceholder')}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ArticleStatus | 'all')}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('articleList.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('articleList.allStatus')}</SelectItem>
            <SelectItem value="draft">{t('articleList.draft')}</SelectItem>
            <SelectItem value="published">{t('articleList.published')}</SelectItem>
            <SelectItem value="scheduled">{t('articleList.scheduled')}</SelectItem>
            <SelectItem value="archived">{t('articleList.archived')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('articleList.sortBy')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">{t('articleList.lastUpdated')}</SelectItem>
            <SelectItem value="published">{t('articleList.publishedDate')}</SelectItem>
            <SelectItem value="title">{t('articleList.titleSort')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Articles Table */}
      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{t('articleList.noArticles')}</h3>
          <p className="text-muted-foreground mb-4">
            {t('articleList.noArticlesDesc')}
          </p>
          <Button onClick={onCreateArticle}>
            <Plus className="h-4 w-4 mr-2" />
            {t('articleList.createArticle')}
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">{t('articleList.tableTitle')}</TableHead>
                <TableHead>{t('articleList.tableStatus')}</TableHead>
                <TableHead>{t('articleList.tableVisibility')}</TableHead>
                <TableHead>{t('articleList.tableUpdated')}</TableHead>
                <TableHead className="text-right">{t('articleList.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <div>
                      <button
                        onClick={() => onEditArticle(article)}
                        className="font-medium hover:underline text-left"
                      >
                        {article.title || t('articleList.untitled')}
                      </button>
                      {article.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {article.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {article.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{article.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(article.status)}</TableCell>
                  <TableCell>{getVisibilityBadge(article.visibility)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {article.status === 'scheduled' && article.scheduledAt ? (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(article.scheduledAt, 'PP')}
                      </div>
                    ) : article.publishedAt ? (
                      formatDistanceToNow(article.publishedAt, { addSuffix: true })
                    ) : (
                      formatDistanceToNow(article.updatedAt, { addSuffix: true })
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditArticle(article)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t('articleList.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onPreviewArticle(article)}>
                          <Eye className="h-4 w-4 mr-2" />
                          {t('articleList.preview')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {article.status === 'draft' && (
                          <DropdownMenuItem onClick={() => publishArticle(article.id)}>
                            <Send className="h-4 w-4 mr-2" />
                            {t('articleList.publish')}
                          </DropdownMenuItem>
                        )}
                        {article.status === 'published' && (
                          <DropdownMenuItem onClick={() => unpublishArticle(article.id)}>
                            <Archive className="h-4 w-4 mr-2" />
                            {t('articleList.unpublish')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDeleteArticle(article.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('articleList.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
