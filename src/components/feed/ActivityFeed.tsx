/**
 * ActivityFeed Component
 * Unified feed showing all activity from posts, events, mutual aid, proposals, etc.
 */

import { FC, useEffect, useState } from 'react';
import { usePostsStore } from '@/modules/microblogging/postsStore';
import { PostCard } from '@/modules/microblogging/components/PostCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityFeedProps {
  className?: string;
}

export const ActivityFeed: FC<ActivityFeedProps> = ({ className }) => {
  const { posts, getPosts, feedFilter, setFeedFilter, refreshFeed, isLoadingFeed, loadMorePosts } = usePostsStore();
  const [activeTab, setActiveTab] = useState<'all' | 'following' | 'my-groups' | 'mentions'>('all');

  useEffect(() => {
    // Load initial posts
    refreshFeed();
  }, [refreshFeed]);

  const handleTabChange = (value: string) => {
    const newTab = value as typeof activeTab;
    setActiveTab(newTab);

    // Update feed filter based on tab
    if (newTab === 'all') {
      setFeedFilter({ type: 'all' });
    } else if (newTab === 'following') {
      setFeedFilter({ type: 'following' });
    } else if (newTab === 'my-groups') {
      setFeedFilter({ type: 'group' });
    } else if (newTab === 'mentions') {
      setFeedFilter({ type: 'mentions' });
    }
  };

  const filteredPosts = getPosts();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Feed controls */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1">
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="all" className="flex-1">All Activity</TabsTrigger>
            <TabsTrigger value="my-groups" className="flex-1">My Groups</TabsTrigger>
            <TabsTrigger value="mentions" className="flex-1">Mentions</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshFeed()}
            disabled={isLoadingFeed}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingFeed ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Feed content */}
      <div className="space-y-4">
        {isLoadingFeed && filteredPosts.length === 0 ? (
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
        ) : filteredPosts.length === 0 ? (
          // Empty state
          <div className="text-center py-12 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {activeTab === 'all' && 'Be the first to share an update!'}
              {activeTab === 'my-groups' && 'Join groups to see their activity'}
              {activeTab === 'mentions' && 'No one has mentioned you yet'}
            </p>
          </div>
        ) : (
          // Posts list
          <>
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}

            {/* Load more button */}
            {filteredPosts.length >= (feedFilter.limit || 20) && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => loadMorePosts()}
                  disabled={isLoadingFeed}
                >
                  {isLoadingFeed ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
