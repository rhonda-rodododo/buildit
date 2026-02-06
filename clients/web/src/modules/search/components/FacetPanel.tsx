/**
 * Facet Panel Component
 * Filter sidebar for faceted search
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronRight,
  X,
  Calendar,
  User,
  Tag,
  Layers,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ModuleType } from '@/types/modules';
import type { FacetCounts, FacetFilters } from '../types';

// ============================================================================
// Types
// ============================================================================

interface FacetPanelProps {
  /** Available facet counts */
  facetCounts: FacetCounts;
  /** Current active filters */
  filters: FacetFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: FacetFilters) => void;
  /** Group name lookup */
  groupNames?: Record<string, string>;
  /** Author name lookup */
  authorNames?: Record<string, string>;
  /** Whether the panel is collapsible */
  collapsible?: boolean;
  /** Additional className */
  className?: string;
}

interface FacetSectionProps {
  title: string;
  icon: typeof Layers;
  values: Record<string, number>;
  selectedValues: string[];
  onToggle: (value: string) => void;
  displayNameLookup?: Record<string, string>;
  maxVisible?: number;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

// ============================================================================
// Module Type Display Names
// ============================================================================

const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  documents: 'Documents',
  messaging: 'Messages',
  events: 'Events',
  wiki: 'Wiki Pages',
  crm: 'Contacts',
  'mutual-aid': 'Mutual Aid',
  governance: 'Governance',
  files: 'Files',
  'custom-fields': 'Custom Fields',
  public: 'Public',
  calling: 'Calls',
  database: 'Database',
  microblogging: 'Posts',
  forms: 'Forms',
  fundraising: 'Fundraising',
  publishing: 'Publishing',
  newsletters: 'Newsletters',
  friends: 'Friends',
  security: 'Security',
  training: 'Training',
  marketplace: 'Marketplace',
  federation: 'Federation',
  'social-publishing': 'Social Publishing',
};

// ============================================================================
// Facet Section Component
// ============================================================================

function FacetSection({
  title,
  icon: Icon,
  values,
  selectedValues,
  onToggle,
  displayNameLookup,
  maxVisible = 5,
  collapsible = true,
  defaultOpen = true,
}: FacetSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);

  // Sort values by count
  const sortedValues = useMemo(() => {
    return Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({
        value,
        count,
        label: displayNameLookup?.[value] || value,
        isSelected: selectedValues.includes(value),
      }));
  }, [values, selectedValues, displayNameLookup]);

  // Visible values
  const visibleValues = showAll
    ? sortedValues
    : sortedValues.slice(0, maxVisible);

  const hasMore = sortedValues.length > maxVisible;

  if (sortedValues.length === 0) {
    return null;
  }

  const content = (
    <div className="space-y-2">
      {visibleValues.map(({ value, count, label, isSelected }) => (
        <div key={value} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Checkbox
              id={`facet-${title}-${value}`}
              checked={isSelected}
              onCheckedChange={() => onToggle(value)}
            />
            <Label
              htmlFor={`facet-${title}-${value}`}
              className="text-sm truncate cursor-pointer"
            >
              {label}
            </Label>
          </div>
          <Badge variant="secondary" className="text-xs h-5 px-1.5 shrink-0">
            {count}
          </Badge>
        </div>
      ))}

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-7"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show less' : `Show ${sortedValues.length - maxVisible} more`}
        </Button>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </div>
        {content}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-0 h-8 hover:bg-transparent"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{content}</CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Date Range Filter
// ============================================================================

function DateRangeFilter({
  dateRange,
  onDateRangeChange,
}: {
  dateRange?: { start: number; end: number };
  onDateRangeChange: (range: { start: number; end: number } | undefined) => void;
}) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState<Date | undefined>(
    dateRange ? new Date(dateRange.start) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    dateRange ? new Date(dateRange.end) : undefined
  );

  const handleStartChange = useCallback(
    (date: Date | undefined) => {
      setStartDate(date);
      if (date && endDate) {
        onDateRangeChange({ start: date.getTime(), end: endDate.getTime() });
      } else if (!date && !endDate) {
        onDateRangeChange(undefined);
      }
    },
    [endDate, onDateRangeChange]
  );

  const handleEndChange = useCallback(
    (date: Date | undefined) => {
      setEndDate(date);
      if (startDate && date) {
        onDateRangeChange({ start: startDate.getTime(), end: date.getTime() });
      } else if (!startDate && !date) {
        onDateRangeChange(undefined);
      }
    },
    [startDate, onDateRangeChange]
  );

  const handleClear = useCallback(() => {
    setStartDate(undefined);
    setEndDate(undefined);
    onDateRangeChange(undefined);
  }, [onDateRangeChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {t('search:filters.dateRange', 'Date Range')}
        </span>
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'flex-1 justify-start text-xs h-8',
                !startDate && 'text-muted-foreground'
              )}
            >
              {startDate ? startDate.toLocaleDateString() : t('search:filters.from', 'From')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={startDate}
              onSelect={handleStartChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'flex-1 justify-start text-xs h-8',
                !endDate && 'text-muted-foreground'
              )}
            >
              {endDate ? endDate.toLocaleDateString() : t('search:filters.to', 'To')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={endDate}
              onSelect={handleEndChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ============================================================================
// Facet Panel Component
// ============================================================================

export function FacetPanel({
  facetCounts,
  filters,
  onFiltersChange,
  groupNames = {},
  authorNames = {},
  collapsible = true,
  className,
}: FacetPanelProps) {
  const { t } = useTranslation();

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.moduleTypes?.length) count += filters.moduleTypes.length;
    if (filters.groupIds?.length) count += filters.groupIds.length;
    if (filters.tags?.length) count += filters.tags.length;
    if (filters.authors?.length) count += filters.authors.length;
    if (filters.dateRange) count += 1;
    return count;
  }, [filters]);

  // Toggle a module type filter
  const toggleModuleType = useCallback(
    (moduleType: string) => {
      const current = filters.moduleTypes || [];
      const updated = current.includes(moduleType as ModuleType)
        ? current.filter((t) => t !== moduleType)
        : [...current, moduleType as ModuleType];
      onFiltersChange({ ...filters, moduleTypes: updated.length > 0 ? updated : undefined });
    },
    [filters, onFiltersChange]
  );

  // Toggle a group filter
  const toggleGroup = useCallback(
    (groupId: string) => {
      const current = filters.groupIds || [];
      const updated = current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId];
      onFiltersChange({ ...filters, groupIds: updated.length > 0 ? updated : undefined });
    },
    [filters, onFiltersChange]
  );

  // Toggle a tag filter
  const toggleTag = useCallback(
    (tag: string) => {
      const current = filters.tags || [];
      const updated = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      onFiltersChange({ ...filters, tags: updated.length > 0 ? updated : undefined });
    },
    [filters, onFiltersChange]
  );

  // Toggle an author filter
  const toggleAuthor = useCallback(
    (author: string) => {
      const current = filters.authors || [];
      const updated = current.includes(author)
        ? current.filter((a) => a !== author)
        : [...current, author];
      onFiltersChange({ ...filters, authors: updated.length > 0 ? updated : undefined });
    },
    [filters, onFiltersChange]
  );

  // Update date range
  const updateDateRange = useCallback(
    (dateRange: { start: number; end: number } | undefined) => {
      onFiltersChange({ ...filters, dateRange });
    },
    [filters, onFiltersChange]
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('search:filters.title', 'Filters')}</h3>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={clearAllFilters}
          >
            {t('search:filters.clearAll', 'Clear all')} ({activeFilterCount})
          </Button>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-6 pr-4">
          {/* Content Type (Module Type) */}
          <FacetSection
            title={t('search:filters.contentType', 'Content Type')}
            icon={Layers}
            values={facetCounts.moduleType as Record<string, number>}
            selectedValues={(filters.moduleTypes || []) as string[]}
            onToggle={toggleModuleType}
            displayNameLookup={MODULE_TYPE_LABELS}
            collapsible={collapsible}
            defaultOpen={true}
          />

          {/* Groups */}
          {Object.keys(facetCounts.groups).length > 0 && (
            <FacetSection
              title={t('search:filters.groups', 'Groups')}
              icon={Users}
              values={facetCounts.groups}
              selectedValues={filters.groupIds || []}
              onToggle={toggleGroup}
              displayNameLookup={groupNames}
              collapsible={collapsible}
              defaultOpen={false}
            />
          )}

          {/* Tags */}
          {Object.keys(facetCounts.tags).length > 0 && (
            <FacetSection
              title={t('search:filters.tags', 'Tags')}
              icon={Tag}
              values={facetCounts.tags}
              selectedValues={filters.tags || []}
              onToggle={toggleTag}
              collapsible={collapsible}
              defaultOpen={false}
            />
          )}

          {/* Authors */}
          {Object.keys(facetCounts.authors).length > 0 && (
            <FacetSection
              title={t('search:filters.authors', 'Authors')}
              icon={User}
              values={facetCounts.authors}
              selectedValues={filters.authors || []}
              onToggle={toggleAuthor}
              displayNameLookup={authorNames}
              collapsible={collapsible}
              defaultOpen={false}
            />
          )}

          {/* Date Range */}
          <DateRangeFilter
            dateRange={filters.dateRange}
            onDateRangeChange={updateDateRange}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

export default FacetPanel;
