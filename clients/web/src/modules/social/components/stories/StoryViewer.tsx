/**
 * StoryViewer Component
 * Full-screen carousel viewer for stories
 */

import { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Send,
  Eye,
  MessageCircle,
  Pause,
  Play,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSocialStore } from '../../socialStore';
import type { StoryGroup } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

interface StoryViewerProps {
  storyGroups: StoryGroup[];
  initialGroupIndex?: number;
  initialStoryIndex?: number;
  onClose: () => void;
}

const STORY_DURATION = 5000; // 5 seconds per story

export const StoryViewer: FC<StoryViewerProps> = ({
  storyGroups,
  initialGroupIndex = 0,
  initialStoryIndex = 0,
  onClose,
}) => {
  const { t } = useTranslation();
  const { viewStory, replyToStory, deleteStory, myStoryViews } = useSocialStore();
  const { currentIdentity } = useAuthStore();

  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const isOwnStory = currentStory?.authorId === currentIdentity?.publicKey;

  // Mark story as viewed
  useEffect(() => {
    if (currentStory && !myStoryViews.has(currentStory.id)) {
      viewStory(currentStory.id);
    }
  }, [currentStory, viewStory, myStoryViews]);

  // Auto-advance stories
  useEffect(() => {
    if (isPaused) {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      return;
    }

    const startTime = Date.now();
    const initialProgress = progress;

    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = initialProgress + (elapsed / STORY_DURATION) * 100;

      if (newProgress >= 100) {
        goToNextStory();
      } else {
        setProgress(newProgress);
      }
    }, 50);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPaused, groupIndex, storyIndex]);

  const goToNextStory = useCallback(() => {
    setProgress(0);

    // Try next story in current group
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
      return;
    }

    // Try next group
    if (groupIndex < storyGroups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
      return;
    }

    // No more stories, close viewer
    onClose();
  }, [storyIndex, groupIndex, currentGroup, storyGroups, onClose]);

  const goToPrevStory = useCallback(() => {
    setProgress(0);

    // If we're more than 10% into the story, restart it
    if (progress > 10) {
      setProgress(0);
      return;
    }

    // Try previous story in current group
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      return;
    }

    // Try previous group
    if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      const prevGroup = storyGroups[groupIndex - 1];
      setStoryIndex(prevGroup.stories.length - 1);
    }
  }, [storyIndex, groupIndex, storyGroups, progress]);

  const handleReply = async () => {
    if (!replyText.trim() || !currentStory) return;

    setIsSendingReply(true);
    try {
      await replyToStory(currentStory.id, replyText.trim());
      setReplyText('');
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleEmojiReply = async (emoji: string) => {
    if (!currentStory) return;

    try {
      await replyToStory(currentStory.id, emoji, true);
    } catch (error) {
      console.error('Failed to send emoji reaction:', error);
    }
  };

  const handleDelete = async () => {
    if (!currentStory) return;

    try {
      await deleteStory(currentStory.id);
      goToNextStory();
    } catch (error) {
      console.error('Failed to delete story:', error);
    }
  };

  if (!currentStory || !currentGroup) {
    return null;
  }

  // Get text style for text stories
  const getTextStyle = () => {
    const style = currentStory.textStyle;
    if (!style) return {};

    if (style.gradientStart && style.gradientEnd) {
      return {
        background: `linear-gradient(135deg, ${style.gradientStart}, ${style.gradientEnd})`,
        color: style.textColor,
      };
    }
    return {
      backgroundColor: style.backgroundColor,
      color: style.textColor,
    };
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[420px] h-[90vh] max-h-[800px] p-0 bg-black overflow-hidden">
        <div className="relative w-full h-full flex flex-col">
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
            {currentGroup.stories.map((_, idx) => (
              <Progress
                key={idx}
                value={idx < storyIndex ? 100 : idx === storyIndex ? progress : 0}
                className="h-0.5 flex-1 bg-white/30"
              />
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-white">
                <AvatarFallback>
                  {currentGroup.authorId.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-white text-sm">
                  {currentGroup.authorId.slice(0, 16)}...
                </p>
                <p className="text-xs text-white/70">
                  {formatDistanceToNow(currentStory.createdAt, { addSuffix: true })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </Button>

              {isOwnStory && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={handleDelete}
                    >
                      {t('storyViewer.deleteStory')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={onClose}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Story Content */}
          <div
            className="flex-1 flex items-center justify-center"
            style={currentStory.contentType === 'text' ? getTextStyle() : {}}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const width = rect.width;

              if (x < width / 3) {
                goToPrevStory();
              } else if (x > (width * 2) / 3) {
                goToNextStory();
              } else {
                setIsPaused(!isPaused);
              }
            }}
          >
            {currentStory.contentType === 'text' && (
              <p
                className={cn(
                  'px-8 break-words max-w-full',
                  currentStory.textStyle?.fontSize === 'small' && 'text-lg',
                  currentStory.textStyle?.fontSize === 'medium' && 'text-2xl',
                  currentStory.textStyle?.fontSize === 'large' && 'text-4xl',
                  currentStory.textStyle?.fontWeight === 'bold' && 'font-bold',
                  currentStory.textStyle?.textAlign === 'left' && 'text-left',
                  currentStory.textStyle?.textAlign === 'center' && 'text-center',
                  currentStory.textStyle?.textAlign === 'right' && 'text-right'
                )}
              >
                {currentStory.text}
              </p>
            )}

            {currentStory.contentType === 'image' && currentStory.media && (
              <img
                src={currentStory.media.url}
                alt="Story"
                className="max-w-full max-h-full object-contain"
              />
            )}

            {currentStory.contentType === 'video' && currentStory.media && (
              <video
                src={currentStory.media.url}
                autoPlay
                muted
                loop
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          {/* Navigation arrows (desktop) */}
          <button
            type="button"
            onClick={goToPrevStory}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors hidden md:block"
            aria-label="Previous story"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={goToNextStory}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors hidden md:block"
            aria-label="Next story"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Footer - Stats for own stories, Reply for others */}
          <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/70 to-transparent">
            {isOwnStory ? (
              // Stats for own stories
              <div className="flex items-center gap-4 text-white">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">{t('storyViewer.views', { count: currentStory.viewCount })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">{t('storyViewer.replies', { count: currentStory.replyCount })}</span>
                </div>
              </div>
            ) : currentStory.privacy.allowReplies ? (
              // Reply input for others' stories
              <div className="flex items-center gap-2">
                {/* Quick emoji reactions */}
                <div className="flex gap-1">
                  {['❤️', '🔥', '😂', '😮'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiReply(emoji)}
                      className="text-2xl hover:scale-110 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Text reply */}
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t('storyViewer.replyPlaceholder')}
                    className="bg-white/20 border-0 text-white placeholder:text-white/70"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                    onFocus={() => setIsPaused(true)}
                    onBlur={() => setIsPaused(false)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                    onClick={handleReply}
                    disabled={!replyText.trim() || isSendingReply}
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
