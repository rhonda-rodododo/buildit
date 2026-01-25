/**
 * ActivityFeed Component
 * Unified feed showing posts, events, proposals, and other activity
 */

import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
                <SelectValue placeholder={t('activityFeed.feedType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>{t('activityFeed.types.all')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="following">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>{t('activityFeed.types.following')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="group">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>{t('activityFeed.types.group')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="mentions">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>{t('activityFeed.types.mentions')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="bookmarks">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>{t('activityFeed.types.bookmarks')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="scheduled">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4" />
                    <span>{t('activityFeed.types.scheduled')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="pinned">
                  <div className="flex items-center gap-2">
                    <Pin className="w-4 h-4" />
                    <span>{t('activityFeed.types.pinned')}</span>
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
              {t('activityFeed.filters')}
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
            {t('activityFeed.refresh')}
          </Button>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('activityFeed.contentType')}</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'text', label: t('activityFeed.contentTypes.text'), icon: MessageSquare },
                    { value: 'event-share', label: t('activityFeed.contentTypes.eventShare'), icon: Calendar },
                    { value: 'document-share', label: t('activityFeed.contentTypes.documentShare'), icon: FileText },
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
                <label className="text-sm font-medium mb-2 block">{t('activityFeed.privacyLevel')}</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'public', label: t('activityFeed.privacyLevels.public') },
                    { value: 'group', label: t('activityFeed.privacyLevels.group') },
                    { value: 'followers', label: t('activityFeed.privacyLevels.followers') },
                    { value: 'encrypted', label: t('activityFeed.privacyLevels.encrypted') },
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
                <label className="text-sm font-medium mb-2 block">{t('activityFeed.dateRange')}</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label htmlFor="filter-date-from" className="text-xs text-muted-foreground mb-1 block">{t('activityFeed.from')}</label>
                    <Input
                      id="filter-date-from"
                      type="date"
                      value={feedFilter.dateFrom ? new Date(feedFilter.dateFrom).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const dateFrom = e.target.value ? new Date(e.target.value).getTime() : undefined;
                        setFeedFilter({ dateFrom });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="filter-date-to" className="text-xs text-muted-foreground mb-1 block">{t('activityFeed.to')}</label>
                    <Input
                      id="filter-date-to"
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
                      {t('activityFeed.clear')}
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
            <h3 className="text-lg font-semibold mb-2">{t('activityFeed.noPosts.title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {showComposer
                ? t('activityFeed.noPosts.beFirst')
                : t('activityFeed.noPosts.noActivity')}
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
                {t('activityFeed.clearFilters')}
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
                  {t('activityFeed.loading')}
                </>
              ) : (
                t('activityFeed.loadMore')
              )}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoadingFeed && filteredPosts.length === 0 && (
          <Card className="p-8">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm text-muted-foreground">{t('activityFeed.loadingFeed')}</span>
            </div>
          </Card>
        )}
      </div>
      )}
    </div>
  );
};
