/**
 * Search Input Component
 * Reusable search input with suggestions and scope indicator
 */

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Loader2, Globe, Users, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { SearchScope, SearchScopePreset } from '../types';

// ============================================================================
// Types
// ============================================================================

interface SearchInputProps {
  /** Current search query */
  value: string;
  /** Callback when query changes */
  onChange: (value: string) => void;
  /** Callback when search is submitted */
  onSubmit?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether search is in progress */
  isLoading?: boolean;
  /** Current search scope */
  scope?: SearchScope;
  /** Callback to change scope */
  onScopeChange?: (scope: SearchScope) => void;
  /** Autocomplete suggestions */
  suggestions?: string[];
  /** Callback when suggestion is selected */
  onSuggestionSelect?: (suggestion: string) => void;
  /** Whether to show scope selector */
  showScopeSelector?: boolean;
  /** Current group ID (for scope display) */
  currentGroupId?: string;
  /** Current group name (for scope display) */
  currentGroupName?: string;
  /** Additional className */
  className?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScopeIcon(scope: SearchScope) {
  switch (scope.type) {
    case 'global':
      return Globe;
    case 'group':
      return Users;
    case 'module':
    case 'module-in-group':
      return FileText;
    default:
      return Search;
  }
}

function getScopeLabel(scope: SearchScope, groupName?: string): string {
  switch (scope.type) {
    case 'global':
      return 'All groups';
    case 'group':
      return groupName || 'Current group';
    case 'module':
      return `All ${scope.moduleType}`;
    case 'module-in-group':
      return `${scope.moduleType} in group`;
    default:
      return 'Search';
  }
}

// ============================================================================
// Search Input Component
// ============================================================================

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  isLoading = false,
  scope = { type: 'global' },
  onScopeChange,
  suggestions = [],
  onSuggestionSelect,
  showScopeSelector = false,
  currentGroupId,
  currentGroupName,
  className,
  autoFocus = false,
}: SearchInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [scopePopoverOpen, setScopePopoverOpen] = useState(false);

  const ScopeIcon = getScopeIcon(scope);
  const scopeLabel = getScopeLabel(scope, currentGroupName);

  // Handle keyboard navigation in suggestions
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          setShowSuggestions(true);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          setShowSuggestions(true);
          break;
        case 'Enter':
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            e.preventDefault();
            onSuggestionSelect?.(suggestions[selectedIndex]);
            setShowSuggestions(false);
            setSelectedIndex(-1);
          } else {
            onSubmit?.();
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [suggestions, selectedIndex, onSuggestionSelect, onSubmit]
  );

  // Show suggestions when typing
  useEffect(() => {
    if (value.length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
    setSelectedIndex(-1);
  }, [value, suggestions]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      onSuggestionSelect?.(suggestion);
      setShowSuggestions(false);
      setSelectedIndex(-1);
      inputRef.current?.focus();
    },
    [onSuggestionSelect]
  );

  // Handle scope change
  const handleScopeChange = useCallback(
    (preset: SearchScopePreset) => {
      let newScope: SearchScope;
      switch (preset) {
        case 'global':
          newScope = { type: 'global' };
          break;
        case 'current-group':
          if (currentGroupId) {
            newScope = { type: 'group', groupId: currentGroupId };
          } else {
            newScope = { type: 'global' };
          }
          break;
        default:
          newScope = { type: 'global' };
      }
      onScopeChange?.(newScope);
      setScopePopoverOpen(false);
    },
    [currentGroupId, onScopeChange]
  );

  // Clear input
  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className={cn('relative', className)}>
      <div className="relative flex items-center">
        {/* Scope Selector */}
        {showScopeSelector && onScopeChange && (
          <Popover open={scopePopoverOpen} onOpenChange={setScopePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-2 z-10 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ScopeIcon className="h-3.5 w-3.5 mr-1" />
                <span className="max-w-[80px] truncate">{scopeLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              <div className="grid gap-1">
                <Button
                  variant={scope.type === 'global' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="justify-start"
                  onClick={() => handleScopeChange('global')}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  {t('search:scope.global', 'All groups')}
                </Button>
                {currentGroupId && (
                  <Button
                    variant={scope.type === 'group' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="justify-start"
                    onClick={() => handleScopeChange('current-group')}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {currentGroupName || t('search:scope.currentGroup', 'Current group')}
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Search Icon */}
        {!showScopeSelector && (
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}

        {/* Input */}
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value.length >= 2 && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={placeholder || t('search:placeholder', 'Search...')}
          className={cn(
            'w-full pr-10',
            showScopeSelector ? 'pl-28' : 'pl-10'
          )}
          autoFocus={autoFocus}
        />

        {/* Loading/Clear Button */}
        <div className="absolute right-2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {value && !isLoading && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">{t('common:clear', 'Clear')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border rounded-md shadow-lg">
          <ul className="py-1">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer transition-colors',
                  index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                )}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Search className="inline h-3.5 w-3.5 mr-2 text-muted-foreground" />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SearchInput;
