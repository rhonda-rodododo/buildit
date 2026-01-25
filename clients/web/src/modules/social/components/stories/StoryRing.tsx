/**
 * StoryRing Component
 * Display story rings/avatars in a horizontal list
 */

import { FC, useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import { useSocialStore } from '../../socialStore';
import { StoryComposer } from './StoryComposer';
import { StoryViewer } from './StoryViewer';
import type { StoryGroup } from '../../types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

interface StoryRingProps {
  className?: string;
}

export const StoryRing: FC<StoryRingProps> = ({ className }) => {
  const { storyGroups, loadStories, myStoryViews, getMyStories } = useSocialStore();
  const { currentIdentity } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadStories();
      setIsLoading(false);
    };
    load();
  }, [loadStories]);

  const myStories = getMyStories();
  const hasOwnStories = myStories.length > 0;

  // Create a combined list with own stories first
  const displayGroups: StoryGroup[] = [];

  // Add own stories group if exists
  if (currentIdentity) {
    const ownGroup = storyGroups.find((g) => g.authorId === currentIdentity.publicKey);
    if (ownGroup) {
      displayGroups.push(ownGroup);
    }
  }

  // Add other story groups
  storyGroups
    .filter((g) => g.authorId !== currentIdentity?.publicKey)
    .forEach((g) => displayGroups.push(g));

  const handleStoryClick = (groupIndex: number) => {
    // Adjust index if own stories are first
    const actualIndex = hasOwnStories ? groupIndex : groupIndex;
    setSelectedGroupIndex(actualIndex);
    setViewerOpen(true);
  };

  if (isLoading) {
    return (
      <div className={cn('py-4', className)}>
        <div className="flex gap-4 px-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="w-16 h-16 rounded-full" />
              <Skeleton className="w-12 h-3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className={cn('w-full', className)}>
        <div className="flex gap-4 p-4">
          {/* Add Story Button (always first) */}
          <StoryComposer
            triggerButton={
              <button
                type="button"
                className="flex flex-col items-center gap-2 flex-shrink-0"
              >
                <div className="relative">
                  <div
                    className={cn(
                      'w-16 h-16 rounded-full flex items-center justify-center',
                      hasOwnStories
                        ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-0.5'
                        : 'bg-muted'
                    )}
                  >
                    {hasOwnStories ? (
                      <Avatar className="w-[60px] h-[60px] border-2 border-background">
                        <AvatarFallback>
                          {currentIdentity?.publicKey.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                        <Plus className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {!hasOwnStories && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Plus className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium">
                  {hasOwnStories ? 'Your story' : 'Add story'}
                </span>
              </button>
            }
          />

          {/* Story Groups */}
          {displayGroups.map((group, index) => {
            const isOwn = group.authorId === currentIdentity?.publicKey;
            if (isOwn && index === 0) return null; // Skip own story if already shown above

            const hasUnviewed = group.stories.some((s) => !myStoryViews.has(s.id));

            return (
              <button
                key={group.authorId}
                type="button"
                onClick={() => handleStoryClick(index)}
                className="flex flex-col items-center gap-2 flex-shrink-0"
              >
                <div
                  className={cn(
                    'w-16 h-16 rounded-full p-0.5',
                    hasUnviewed
                      ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500'
                      : 'bg-muted'
                  )}
                >
                  <Avatar className="w-full h-full border-2 border-background">
                    <AvatarFallback>
                      {group.authorId.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-xs font-medium truncate max-w-[64px]">
                  {group.authorId.slice(0, 8)}...
                </span>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Story Viewer */}
      {viewerOpen && (
        <StoryViewer
          storyGroups={displayGroups}
          initialGroupIndex={selectedGroupIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
};
