import { FC, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Loader2 } from 'lucide-react';
import { searchByUsername } from '@/core/username/usernameUtils';

export interface UsernameSearchResult {
  pubkey: string;
  username: string;
  displayName?: string;
}

export interface UsernameSearchProps {
  onSelect?: (result: UsernameSearchResult) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  limit?: number;
}

/**
 * UsernameSearch component
 * Search for users by username with autocomplete suggestions
 */
export const UsernameSearch: FC<UsernameSearchProps> = ({
  onSelect,
  placeholder = 'Search users...',
  className = '',
  autoFocus = false,
  limit = 10,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UsernameSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Search with debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const searchResults = await searchByUsername(query, limit);
        setResults(searchResults);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, limit]);

  const handleSelect = (result: UsernameSearchResult) => {
    setQuery('');
    setShowResults(false);
    setResults([]);
    onSelect?.(result);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder={placeholder}
          className="pl-9 pr-9"
          autoFocus={autoFocus}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
          {results.map(result => (
            <button
              key={result.pubkey}
              onClick={() => handleSelect(result)}
              className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-3 transition-colors"
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {result.displayName?.slice(0, 2).toUpperCase() || result.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {result.displayName && (
                  <div className="font-medium text-sm truncate">{result.displayName}</div>
                )}
                <div className={`text-sm ${result.displayName ? 'text-muted-foreground' : 'font-medium'} truncate`}>
                  @{result.username}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showResults && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-3 text-center text-sm text-muted-foreground">
          No users found
        </div>
      )}
    </div>
  );
};
