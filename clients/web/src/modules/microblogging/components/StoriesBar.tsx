/**
 * Stories Bar Component
 * Epic 61: Horizontal scrolling bar of user stories
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useSocialFeaturesStore } from '../socialFeaturesStore';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface StoriesBarProps {
  onCreateStory: () => void;
  onViewStory: (userId: string) => void;
  className?: string;
}

export function StoriesBar({ onCreateStory, onViewStory, className }: StoriesBarProps) {
  const { t } = useTranslation();
  const currentIdentity = useAuthStore((s) => s.currentIdentity);
  const getFeedStories = useSocialFeaturesStore((s) => s.getFeedStories);
  const viewedStories = useSocialFeaturesStore((s) => s.viewedStories);
  const getUserStories = useSocialFeaturesStore((s) => s.getUserStories);

  const storiesByUser = getFeedStories();
  const myStories = currentIdentity ? getUserStories(currentIdentity.publicKey) : [];
  const hasMyStory = myStories.length > 0;

  // Convert map to sorted array (users with unviewed stories first)
  const sortedUsers = useMemo(() => {
    const users = Array.from(storiesByUser.entries()).map(([userId, stories]) => {
      const hasUnviewed = stories.some((s) => !viewedStories.has(s.id));
      return { userId, stories, hasUnviewed };
    });

    // Sort: unviewed first, then by most recent story
    return users.sort((a, b) => {
      if (a.hasUnviewed !== b.hasUnviewed) {
        return a.hasUnviewed ? -1 : 1;
      }
      const aLatest = Math.max(...a.stories.map((s) => s.createdAt));
      const bLatest = Math.max(...b.stories.map((s) => s.createdAt));
      return bLatest - aLatest;
    });
  }, [storiesByUser, viewedStories]);

  if (sortedUsers.length === 0 && !currentIdentity) {
    return null;
  }

  return (
    <div className={cn('py-4', className)}>
      <ScrollArea className="w-full">
        <div className="flex gap-4 px-4">
          {/* Create story button / My story */}
          {currentIdentity && (
            <button
              onClick={hasMyStory ? () => onViewStory(currentIdentity.publicKey) : onCreateStory}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="relative">
                <div
                  className={cn(
                    'rounded-full p-0.5',
                    hasMyStory
                      ? 'bg-gradient-to-tr from-primary to-primary/60'
                      : 'bg-muted'
                  )}
                >
                  <Avatar className="h-14 w-14 border-2 border-background">
                    <AvatarFallback>
                      {currentIdentity.displayName?.[0]?.toUpperCase() || currentIdentity.name?.[0]?.toUpperCase() || 'Y'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {!hasMyStory && (
                  <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                    <Plus className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                {hasMyStory
                  ? t('stories.yourStory', 'Your story')
                  : t('stories.addStory', 'Add story')}
              </span>
            </button>
          )}

          {/* Other users' stories */}
          {sortedUsers.map(({ userId, stories, hasUnviewed }) => {
            const latestStory = stories[stories.length - 1];
            const displayName = latestStory?.authorId?.slice(0, 8) || 'User';

            return (
              <button
                key={userId}
                onClick={() => onViewStory(userId)}
                className="flex flex-col items-center gap-1 group"
              >
                <div
                  className={cn(
                    'rounded-full p-0.5',
                    hasUnviewed
                      ? 'bg-gradient-to-tr from-primary via-purple-500 to-pink-500'
                      : 'bg-muted'
                  )}
                >
                  <Avatar className="h-14 w-14 border-2 border-background">
                    <AvatarFallback>
                      {displayName[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors max-w-[60px] truncate">
                  {displayName}
                </span>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
