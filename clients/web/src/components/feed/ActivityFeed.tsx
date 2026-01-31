/**
 * ActivityFeed Component
 * Unified feed showing all activity from posts, events, mutual aid, proposals, etc.
 */

import { FC, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePostsStore } from '@/modules/microblogging/postsStore';
import { useEventsStore } from '@/modules/events/eventsStore';
import { useMutualAidStore } from '@/modules/mutual-aid/mutualAidStore';
import { useGovernanceStore } from '@/modules/governance/governanceStore';
import { useWikiStore } from '@/modules/wiki/wikiStore';
import { PostCard } from '@/modules/microblogging/components/PostCard';
import { EventFeedCard } from './EventFeedCard';
import { MutualAidFeedCard } from './MutualAidFeedCard';
import { ProposalFeedCard } from './ProposalFeedCard';
import { WikiUpdateFeedCard } from './WikiUpdateFeedCard';
import type { FeedItem } from './types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Filter,
  FileText,
  Calendar,
  HandHeart,
  Vote,
  BookOpen,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ActivityFeedProps {
  className?: string;
  groupId?: string; // Optional: filter to specific group
}

export const ActivityFeed: FC<ActivityFeedProps> = ({ className, groupId }) => {
  const { t } = useTranslation();
  const { posts, refreshFeed: refreshPosts, isLoadingFeed: _isLoadingPosts } =
    usePostsStore();
  const eventsStore = useEventsStore();
  const mutualAidStore = useMutualAidStore();
  const governanceStore = useGovernanceStore();
  const wikiStore = useWikiStore();

  const [activeTab, setActiveTab] = useState<'all' | 'my-groups' | 'mentions'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [contentTypeFilters, setContentTypeFilters] = useState<Set<FeedItem['type']>>(
    new Set(['post', 'event', 'mutual-aid', 'proposal', 'wiki-update'])
  );

  useEffect(() => {
    // Load initial data from all modules
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([refreshPosts()]);
        // Other stores will load data automatically
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [refreshPosts]);

  // Aggregate all feed items
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];

    // Add posts
    if (contentTypeFilters.has('post')) {
      posts.forEach((post) => {
        items.push({
          id: `post-${post.id}`,
          type: 'post',
          timestamp: post.createdAt,
          authorId: post.authorId,
          groupId: post.visibility.groupIds?.[0], // Use first group ID from visibility
          data: post,
        });
      });
    }

    // Add events
    if (contentTypeFilters.has('event') && eventsStore.events) {
      eventsStore.events.forEach((event) => {
        items.push({
          id: `event-${event.id}`,
          type: 'event',
          timestamp: event.createdAt,
          authorId: event.createdBy,
          groupId: event.groupId,
          data: {
            ...event,
            tags: event.tags.join(','), // Convert string[] to comma-separated string
          },
        });
      });
    }

    // Add mutual aid requests/offers (uses aidItems not requests)
    if (contentTypeFilters.has('mutual-aid') && mutualAidStore.aidItems) {
      mutualAidStore.aidItems.forEach((aidItem) => {
        // Only add items with groupId (DBMutualAidRequest requires it)
        if (aidItem.groupId) {
          // Map AidItem to DBMutualAidRequest format for the feed
          items.push({
            id: `mutual-aid-${aidItem.id}`,
            type: 'mutual-aid',
            timestamp: aidItem.createdAt,
            authorId: aidItem.createdBy,
            groupId: aidItem.groupId,
            data: {
              id: aidItem.id,
              groupId: aidItem.groupId,
              type: aidItem.type,
              category: aidItem.category,
              title: aidItem.title,
              description: aidItem.description,
              status: aidItem.status,
              location: aidItem.location,
              createdBy: aidItem.createdBy,
              created: aidItem.createdAt,
              expiresAt: aidItem.expiresAt,
            },
          });
        }
      });
    }

    // Add proposals
    if (contentTypeFilters.has('proposal') && governanceStore.proposals) {
      Object.values(governanceStore.proposals).forEach((proposal) => {
        items.push({
          id: `proposal-${proposal.id}`,
          type: 'proposal',
          timestamp: proposal.createdAt,
          authorId: proposal.createdBy,
          groupId: proposal.groupId,
          data: proposal,
        });
      });
    }

    // Add wiki pages
    if (contentTypeFilters.has('wiki-update') && wikiStore.pages) {
      Object.values(wikiStore.pages).forEach((page) => {
        items.push({
          id: `wiki-${page.id}`,
          type: 'wiki-update',
          timestamp: page.updatedAt ?? page.createdAt,
          authorId: page.lastEditedBy ?? page.createdBy,
          groupId: page.groupId,
          data: page, // Pass the full page object directly
        });
      });
    }

    // Deduplicate by id (stores may contain duplicate entries)
    const seen = new Set<string>();
    const unique = items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    // Sort by timestamp (newest first)
    const sorted = unique.sort((a, b) => b.timestamp - a.timestamp);

    // Filter by groupId if provided (e.g., when viewing a specific group's feed)
    if (groupId) {
      return sorted.filter(item => item.groupId === groupId);
    }
    return sorted;
  }, [posts, eventsStore.events, mutualAidStore.aidItems, governanceStore.proposals, wikiStore.pages, contentTypeFilters, groupId]);

  // Filter by tab
  const filteredItems = useMemo(() => {
    if (activeTab === 'all') {
      return feedItems;
    } else if (activeTab === 'my-groups') {
      // Show only items that belong to a group
      return feedItems.filter(item => item.groupId !== undefined);
    } else if (activeTab === 'mentions') {
      // Mention tracking deferred to Phase 2
      return feedItems;
    }
    return feedItems;
  }, [feedItems, activeTab]);

  const toggleContentType = (type: FeedItem['type']) => {
    setContentTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await refreshPosts();
    } finally {
      setIsLoading(false);
    }
  };

  const renderFeedItem = (item: FeedItem) => {
    switch (item.type) {
      case 'post':
        return <PostCard key={item.id} post={item.data} />;
      case 'event':
        return <EventFeedCard key={item.id} item={item} />;
      case 'mutual-aid':
        return <MutualAidFeedCard key={item.id} item={item} />;
      case 'proposal':
        return <ProposalFeedCard key={item.id} item={item} />;
      case 'wiki-update':
        return <WikiUpdateFeedCard key={item.id} item={item} />;
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Feed controls */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1">
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="all" className="flex-1">
              {t('activityFeed.tabs.all')}
            </TabsTrigger>
            <TabsTrigger value="my-groups" className="flex-1">
              {t('activityFeed.tabs.myGroups')}
            </TabsTrigger>
            <TabsTrigger value="mentions" className="flex-1">
              {t('activityFeed.tabs.mentions')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('activityFeed.actions.refresh')}
          </Button>

          {/* Content type filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                {t('activityFeed.actions.filter')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{t('activityFeed.contentTypes.title')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={contentTypeFilters.has('post')}
                onCheckedChange={() => toggleContentType('post')}
              >
                <FileText className="w-4 h-4 mr-2" />
                {t('activityFeed.contentTypes.posts')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={contentTypeFilters.has('event')}
                onCheckedChange={() => toggleContentType('event')}
              >
                <Calendar className="w-4 h-4 mr-2" />
                {t('activityFeed.contentTypes.events')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={contentTypeFilters.has('mutual-aid')}
                onCheckedChange={() => toggleContentType('mutual-aid')}
              >
                <HandHeart className="w-4 h-4 mr-2" />
                {t('activityFeed.contentTypes.mutualAid')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={contentTypeFilters.has('proposal')}
                onCheckedChange={() => toggleContentType('proposal')}
              >
                <Vote className="w-4 h-4 mr-2" />
                {t('activityFeed.contentTypes.proposals')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={contentTypeFilters.has('wiki-update')}
                onCheckedChange={() => toggleContentType('wiki-update')}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                {t('activityFeed.contentTypes.wikiUpdates')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Feed content */}
      <div className="space-y-4">
        {isLoading && filteredItems.length === 0 ? (
          // Loading skeletons
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </>
        ) : filteredItems.length === 0 ? (
          // Empty state
          <div className="text-center py-12 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-semibold mb-2">{t('activityFeed.empty.title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {activeTab === 'all' && t('activityFeed.empty.all')}
              {activeTab === 'my-groups' && t('activityFeed.empty.myGroups')}
              {activeTab === 'mentions' && t('activityFeed.empty.mentions')}
            </p>
          </div>
        ) : (
          // Feed items
          <>
            {filteredItems.map((item) => renderFeedItem(item))}

            {/* Load more button */}
            {filteredItems.length >= 20 && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" disabled={isLoading}>
                  {isLoading ? t('activityFeed.actions.loading') : t('activityFeed.actions.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
