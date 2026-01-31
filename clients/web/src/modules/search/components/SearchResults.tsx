/**
 * Search Results Component
 * Displays search results with highlighting and navigation
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { sanitizeHtml } from '@/lib/security/sanitize';
import {
  FileText,
  MessageSquare,
  Calendar,
  BookOpen,
  Users,
  HeartHandshake,
  Vote,
  FolderOpen,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ModuleType } from '@/types/modules';
import type { SearchResult, FormattedSearchResult } from '../types';

// ============================================================================
// Types
// ============================================================================

interface SearchResultsProps {
  /** Search results to display */
  results: SearchResult[];
  /** Total result count (for pagination display) */
  totalCount: number;
  /** Whether results are loading */
  isLoading?: boolean;
  /** Search execution time in ms */
  searchTimeMs?: number;
  /** Callback when a result is clicked */
  onResultClick?: (result: SearchResult) => void;
  /** Result formatter */
  formatResult?: (result: SearchResult) => FormattedSearchResult;
  /** Maximum height */
  maxHeight?: string;
  /** Show empty state */
  showEmptyState?: boolean;
  /** Query string for empty state */
  query?: string;
}

interface SearchResultItemProps {
  result: SearchResult;
  formatted: FormattedSearchResult;
  onClick: () => void;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const MODULE_ICONS: Record<ModuleType, typeof FileText> = {
  documents: FileText,
  messaging: MessageSquare,
  events: Calendar,
  wiki: BookOpen,
  crm: Users,
  'mutual-aid': HeartHandshake,
  governance: Vote,
  files: FolderOpen,
  'custom-fields': FileText,
  public: FileText,
  calling: MessageSquare,
  database: FileText,
  microblogging: MessageSquare,
  forms: FileText,
  fundraising: HeartHandshake,
  publishing: BookOpen,
  newsletters: MessageSquare,
  friends: Users,
  security: FileText,
  training: BookOpen,
};

// ============================================================================
// Default Formatter
// ============================================================================

function defaultFormatResult(result: SearchResult): FormattedSearchResult {
  const doc = result.document;
  const Icon = MODULE_ICONS[doc.moduleType] || FileText;

  return {
    title: doc.title || doc.id,
    subtitle: doc.moduleType,
    icon: Icon.name || 'file-text',
    path: `/groups/${doc.groupId}/${doc.moduleType}/${doc.entityId}`,
    preview: result.highlightedExcerpt || doc.excerpt,
    timestamp: doc.updatedAt,
    badges: doc.tags.slice(0, 3).map((tag) => ({ label: tag })),
  };
}

// ============================================================================
// Search Result Item
// ============================================================================

function SearchResultItem({ result, formatted, onClick }: SearchResultItemProps) {
  const Icon = MODULE_ICONS[result.document.moduleType] || FileText;

  // Format relative time
  const relativeTime = useMemo(() => {
    if (!formatted.timestamp) return null;
    const now = Date.now();
    const diff = now - formatted.timestamp;

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return new Date(formatted.timestamp).toLocaleDateString();
  }, [formatted.timestamp]);

  return (
    <button
      className={cn(
        'w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors',
        'focus:outline-none focus:bg-accent/50',
        'group'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 p-2 bg-muted rounded-md">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">
              {formatted.title}
            </h4>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Subtitle / Metadata */}
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span className="capitalize">{formatted.subtitle}</span>
            {relativeTime && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {relativeTime}
                </span>
              </>
            )}
          </div>

          {/* Preview */}
          {formatted.preview && (
            <p
              className="mt-1.5 text-sm text-muted-foreground line-clamp-2"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatted.preview) }}
            />
          )}

          {/* Tags */}
          {formatted.badges && formatted.badges.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {formatted.badges.map((badge, i) => (
                <Badge
                  key={i}
                  variant={badge.variant || 'secondary'}
                  className="text-xs h-5 px-1.5"
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Score indicator (debug) */}
        {import.meta.env.DEV && (
          <span className="text-[10px] text-muted-foreground opacity-50">
            {result.score.toFixed(2)}
          </span>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ResultSkeleton() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="flex-1">
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4 mt-1" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ query }: { query?: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="p-3 bg-muted rounded-full mb-4">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-sm mb-1">
        {query
          ? t('search:noResults', 'No results found')
          : t('search:emptyState', 'Start searching')}
      </h3>
      <p className="text-sm text-muted-foreground max-w-[300px]">
        {query
          ? t('search:noResultsHint', 'Try different keywords or adjust your filters')
          : t('search:emptyStateHint', 'Type to search across all your content')}
      </p>
    </div>
  );
}

// ============================================================================
// Search Results Component
// ============================================================================

export function SearchResults({
  results,
  totalCount,
  isLoading = false,
  searchTimeMs,
  onResultClick,
  formatResult = defaultFormatResult,
  maxHeight = '400px',
  showEmptyState = true,
  query,
}: SearchResultsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Handle result click
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      if (onResultClick) {
        onResultClick(result);
      } else {
        // Default: navigate to the result path
        const formatted = formatResult(result);
        navigate(formatted.path);
      }
    },
    [onResultClick, formatResult, navigate]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 3 }).map((_, i) => (
          <ResultSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (results.length === 0 && showEmptyState) {
    return <EmptyState query={query} />;
  }

  return (
    <div>
      {/* Results header */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-b flex items-center justify-between">
        <span>
          {t('search:resultCount', '{{count}} results', { count: totalCount })}
          {totalCount > results.length && (
            <span> ({t('search:showing', 'showing {{count}}', { count: results.length })})</span>
          )}
        </span>
        {searchTimeMs !== undefined && (
          <span>{t('search:searchTime', '{{time}}ms', { time: Math.round(searchTimeMs) })}</span>
        )}
      </div>

      {/* Results list */}
      <ScrollArea style={{ maxHeight }}>
        <div className="divide-y">
          {results.map((result) => (
            <SearchResultItem
              key={result.document.id}
              result={result}
              formatted={formatResult(result)}
              onClick={() => handleResultClick(result)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default SearchResults;
