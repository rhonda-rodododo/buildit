/**
 * Story Viewer Component
 * Epic 61: Full-screen story viewer with carousel navigation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  Pause,
  Play,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSocialFeaturesStore } from '../socialFeaturesStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow } from 'date-fns';

interface StoryViewerProps {
  userId: string;
  onClose: () => void;
  onNextUser?: () => void;
  onPrevUser?: () => void;
}

const STORY_DURATION = 5000; // 5 seconds per story

export function StoryViewer({ userId, onClose, onNextUser, onPrevUser }: StoryViewerProps) {
  const { t } = useTranslation();
  const currentIdentity = useAuthStore((s) => s.currentIdentity);
  const getUserStories = useSocialFeaturesStore((s) => s.getUserStories);
  const viewStory = useSocialFeaturesStore((s) => s.viewStory);
  const replyToStory = useSocialFeaturesStore((s) => s.replyToStory);
  const deleteStory = useSocialFeaturesStore((s) => s.deleteStory);
  const viewedStories = useSocialFeaturesStore((s) => s.viewedStories);

  const stories = getUserStories(userId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const progressRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const currentStory = stories[currentIndex];
  const isOwnStory = currentIdentity?.publicKey === userId;

  // Mark story as viewed
  useEffect(() => {
    if (currentStory && !viewedStories.has(currentStory.id)) {
      viewStory(currentStory.id);
    }
  }, [currentStory, viewStory, viewedStories]);

  // Auto-advance timer
  useEffect(() => {
    if (isPaused || !currentStory) return;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(newProgress);

      if (elapsed >= STORY_DURATION) {
        // Move to next story
        if (currentIndex < stories.length - 1) {
          setCurrentIndex(currentIndex + 1);
          startTimeRef.current = Date.now();
        } else if (onNextUser) {
          onNextUser();
        } else {
          onClose();
        }
      } else {
        progressRef.current = requestAnimationFrame(animate);
      }
    };

    startTimeRef.current = Date.now();
    progressRef.current = requestAnimationFrame(animate);

    return () => {
      if (progressRef.current) {
        cancelAnimationFrame(progressRef.current);
      }
    };
  }, [currentIndex, isPaused, stories.length, onNextUser, onClose, currentStory]);

  const goToNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
      startTimeRef.current = Date.now();
    } else if (onNextUser) {
      onNextUser();
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onNextUser, onClose]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
      startTimeRef.current = Date.now();
    } else if (onPrevUser) {
      onPrevUser();
    }
  }, [currentIndex, onPrevUser]);

  const handleReply = async () => {
    if (!replyText.trim() || !currentStory || isSending) return;

    setIsSending(true);
    try {
      await replyToStory(currentStory.id, replyText.trim());
      setReplyText('');
    } catch (error) {
      console.error('Failed to reply:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async () => {
    if (!currentStory) return;
    await deleteStory(currentStory.id);
    if (stories.length <= 1) {
      onClose();
    } else {
      goToNext();
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          setIsPaused((p) => !p);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, onClose]);

  if (!currentStory) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Navigation arrows */}
      {(currentIndex > 0 || onPrevUser) && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
          onClick={goToPrev}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {(currentIndex < stories.length - 1 || onNextUser) && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
          onClick={goToNext}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Story content */}
      <div className="relative w-full max-w-md h-full max-h-[90vh] flex flex-col">
        {/* Progress bars */}
        <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
          {stories.map((_, index) => (
            <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width:
                    index < currentIndex
                      ? '100%'
                      : index === currentIndex
                        ? `${progress}%`
                        : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-10 left-4 right-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-white">
              <AvatarFallback>{userId.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="text-white">
              <p className="font-medium text-sm">{userId.slice(0, 12)}...</p>
              <p className="text-xs opacity-70">
                {formatDistanceToNow(currentStory.createdAt, { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setIsPaused((p) => !p)}
            >
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </Button>

            {isOwnStory && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('stories.delete', 'Delete story')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Story content */}
        <div
          className="flex-1 flex items-center justify-center"
          style={{
            backgroundColor: currentStory.backgroundColor || '#000',
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 2) {
              goToPrev();
            } else {
              goToNext();
            }
          }}
        >
          {currentStory.contentType === 'image' && currentStory.mediaUrl && (
            <img
              src={currentStory.mediaUrl}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          )}

          {currentStory.contentType === 'video' && currentStory.mediaUrl && (
            <video
              src={currentStory.mediaUrl}
              className="max-w-full max-h-full object-contain"
              autoPlay
              muted
              loop
            />
          )}

          {currentStory.contentType === 'text' && (
            <div
              className="p-8 text-center"
              style={{
                color: currentStory.textColor || '#fff',
                fontFamily: currentStory.fontFamily || 'inherit',
              }}
            >
              <p className="text-2xl font-medium">{currentStory.content}</p>
            </div>
          )}

          {/* Caption for media stories */}
          {currentStory.contentType !== 'text' && currentStory.content && (
            <div className="absolute bottom-24 left-4 right-4 text-white text-center">
              <p className="text-sm bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2">
                {currentStory.content}
              </p>
            </div>
          )}
        </div>

        {/* View count for own stories */}
        {isOwnStory && (
          <div className="absolute bottom-24 left-4 text-white flex items-center gap-1 text-sm">
            <Eye className="h-4 w-4" />
            {currentStory.viewCount} {t('stories.views', 'views')}
          </div>
        )}

        {/* Reply input (for others' stories) */}
        {!isOwnStory && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex gap-2">
              <Input
                placeholder={t('stories.replyPlaceholder', 'Send a reply...')}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/50"
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
              />
              <Button
                size="icon"
                onClick={handleReply}
                disabled={!replyText.trim() || isSending}
                className="bg-white/20 hover:bg-white/30"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
