/**
 * ActivityFeed Component
 * Unified feed showing posts, events, proposals, and other activity
 */

import { FC, useState, useEffect } from 'react';
import { usePostsStore } from '../postsStore';
import type { PostFeedFilter, PostPrivacy, PostContentType } from '../types';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Filter,
  Loader2,
  MessageSquare,
  Calendar,
  FileText,
  CalendarClock,
  Pin,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScheduledPostsView } from './ScheduledPostsView';
import { Separator } from '@/components/ui/separator';

interface ActivityFeedProps {
  groupId?: string;
  showComposer?: boolean;
  defaultFilter?: Partial<PostFeedFilter>;
  className?: string;
}

export const ActivityFeed: FC<ActivityFeedProps> = ({
  groupId,
  showComposer = true,
  defaultFilter,
  className,
}) => {
  const {
    posts,
    feedFilter,
    isLoadingFeed,
    hasMorePosts,
    getPosts,
    loadMorePosts,
    refreshFeed,
    setFeedFilter,
  } = usePostsStore();

  const [showFilters, setShowFilters] = useState(false);

  // Initialize filter with defaults
  useEffect(() => {
    if (defaultFilter) {
      setFeedFilter(defaultFilter);
    }
    if (groupId) {
      setFeedFilter({ groupIds: [groupId] });
    }
  }, [groupId, defaultFilter, setFeedFilter]);

  // Load initial feed
  useEffect(() => {
    if (posts.length === 0) {
      refreshFeed();
    }
  }, [posts.length, refreshFeed]);

  const handleRefresh = async () => {
    await refreshFeed();
  };

  const handleLoadMore = async () => {
    if (!isLoadingFeed && hasMorePosts) {
      await loadMorePosts();
    }
  };

  const handleFilterTypeChange = (value: string) => {
    setFeedFilter({ type: value as PostFeedFilter['type'] });
  };

  const filteredPosts = getPosts(feedFilter);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Composer */}
      {showComposer && (
        <PostComposer
          onPostCreated={handleRefresh}
        />
      )}

      {/* Filters Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {/* Feed Type Selector */}
            <Select
              value={feedFilter.type || 'all'}
              onValueChange={handleFilterTypeChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Feed type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>All Activity</span>
                  </div>
                </SelectItem>
                <SelectItem value="following">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Following</span>
                  </div>
                </SelectItem>
                <SelectItem value="group">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Group Posts</span>
                  </div>
                </SelectItem>
                <SelectItem value="mentions">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Mentions</span>
                  </div>
                </SelectItem>
                <SelectItem value="bookmarks">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Bookmarks</span>
                  </div>
                </SelectItem>
                <SelectItem value="scheduled">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4" />
                    <span>Scheduled</span>
                  </div>
                </SelectItem>
                <SelectItem value="pinned">
                  <div className="flex items-center gap-2">
                    <Pin className="w-4 h-4" />
                    <span>Pinned</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Toggle */}
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoadingFeed}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingFeed ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">Content Type</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'text', label: 'Text', icon: MessageSquare },
                    { value: 'event-share', label: 'Events', icon: Calendar },
                    { value: 'document-share', label: 'Documents', icon: FileText },
                  ].map(({ value, label, icon: Icon }) => {
                    const isSelected = feedFilter.contentTypes?.includes(value as PostContentType);
                    return (
                      <Button
                        key={value}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const current = feedFilter.contentTypes || [];
                          const newTypes = isSelected
                            ? current.filter((t) => t !== value)
                            : [...current, value as PostContentType];
                          setFeedFilter({
                            contentTypes: newTypes.length > 0 ? newTypes : undefined
                          });
                        }}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Privacy Level</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'public', label: 'Public' },
                    { value: 'group', label: 'Group' },
                    { value: 'followers', label: 'Followers' },
                    { value: 'encrypted', label: 'Encrypted' },
                  ].map(({ value, label }) => {
                    const isSelected = feedFilter.privacyLevels?.includes(value as PostPrivacy);
                    return (
                      <Button
                        key={value}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const current = feedFilter.privacyLevels || [];
                          const newPrivacy = isSelected
                            ? current.filter((p) => p !== value)
                            : [...current, value as PostPrivacy];
                          setFeedFilter({
                            privacyLevels: newPrivacy.length > 0 ? newPrivacy : undefined
                          });
                        }}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">From</label>
                    <Input
                      type="date"
                      value={feedFilter.dateFrom ? new Date(feedFilter.dateFrom).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const dateFrom = e.target.value ? new Date(e.target.value).getTime() : undefined;
                        setFeedFilter({ dateFrom });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">To</label>
                    <Input
                      type="date"
                      value={feedFilter.dateTo ? new Date(feedFilter.dateTo).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const dateTo = e.target.value ? new Date(e.target.value).setHours(23, 59, 59, 999) : undefined;
                        setFeedFilter({ dateTo });
                      }}
                    />
                  </div>
                  {(feedFilter.dateFrom || feedFilter.dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-5"
                      onClick={() => setFeedFilter({ dateFrom: undefined, dateTo: undefined })}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Scheduled Posts View */}
      {feedFilter.type === 'scheduled' && (
        <ScheduledPostsView />
      )}

      {/* Feed Content */}
      {feedFilter.type !== 'scheduled' && (
      <div className="space-y-4">
        {filteredPosts.length === 0 && !isLoadingFeed && (
          <Card className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {showComposer
                ? "Be the first to share something!"
                : "No activity to display with current filters."}
            </p>
            {showFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFeedFilter({
                    type: 'all',
                    contentTypes: undefined,
                    privacyLevels: undefined,
                  });
                  setShowFilters(false);
                }}
              >
                Clear Filters
              </Button>
            )}
          </Card>
        )}

        {filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {/* Load More */}
        {hasMorePosts && filteredPosts.length > 0 && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingFeed}
            >
              {isLoadingFeed ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoadingFeed && filteredPosts.length === 0 && (
          <Card className="p-8">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading feed...</span>
            </div>
          </Card>
        )}
      </div>
      )}
    </div>
  );
};
