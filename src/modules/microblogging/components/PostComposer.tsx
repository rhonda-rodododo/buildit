/**
 * PostComposer Component
 * Rich text composer for creating posts with privacy controls
 */

import { FC, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { usePostsStore } from '../postsStore';
import type { PostPrivacy, CreatePostInput } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Lock,
  Globe,
  Users,
  Shield,
  Smile,
  Hash,
  AtSign,
  Clock,
  Link2,
  Link2Off,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { EmojiPicker } from '@/components/media/EmojiPicker';
import {
  useLinkPreviewFromText,
  LinkPreviewCard,
  LinkPreviewSkeleton,
} from '@/lib/linkPreview';

interface PostComposerProps {
  placeholder?: string;
  onPostCreated?: () => void;
  className?: string;
}

export const PostComposer: FC<PostComposerProps> = ({
  placeholder,
  onPostCreated,
  className,
}) => {
  const { t } = useTranslation();
  const { currentIdentity } = useAuthStore();
  const { createPost, schedulePost } = usePostsStore();
  const effectivePlaceholder = placeholder || t('posts.placeholder');

  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState<PostPrivacy>('group');
  const [isPosting, setIsPosting] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [linkPreviewsEnabled, setLinkPreviewsEnabled] = useState(true);
  const [showPublicWarning, setShowPublicWarning] = useState(false);
  const [pendingPrivacy, setPendingPrivacy] = useState<PostPrivacy | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Signal-style link preview generation
  // Previews are fetched by sender and encrypted with the post
  const {
    loading: previewLoading,
    previews,
    removePreview,
    clearPreviews,
  } = useLinkPreviewFromText(content, {
    autoGenerate: linkPreviewsEnabled,
    debounceMs: 800,
    maxPreviews: 3,
  });

  // Get min datetime for scheduling (now + 5 minutes)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  const handleSubmit = async () => {
    if (!content.trim() || !currentIdentity) return;

    setIsPosting(true);

    try {
      // Extract hashtags
      const hashtags = (content.match(/#[\w]+/g) || []).map(tag => tag.slice(1));

      // Extract mentions
      const mentions = (content.match(/@[\w]+/g) || []).map(mention => mention.slice(1));

      const input: CreatePostInput = {
        content: content.trim(),
        contentType: 'text',
        visibility: {
          privacy,
        },
        hashtags,
        mentions,
        // Include Signal-style link previews (encrypted with post)
        linkPreviews: previews.length > 0 ? previews : undefined,
      };

      await createPost(input);

      // Clear form
      setContent('');
      setPrivacy('group');
      clearPreviews();
      onPostCreated?.();

      // Show success toast
      toast.success(t('posts.postCreated'));
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.error(t('posts.postFailed'))
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedule = async () => {
    if (!content.trim() || !currentIdentity || !scheduledDateTime) return;

    const scheduledFor = new Date(scheduledDateTime).getTime();
    if (scheduledFor <= Date.now()) {
      toast.error(t('posts.selectFutureDate'));
      return;
    }

    setIsPosting(true);

    try {
      // Extract hashtags
      const hashtags = (content.match(/#[\w]+/g) || []).map(tag => tag.slice(1));

      // Extract mentions
      const mentions = (content.match(/@[\w]+/g) || []).map(mention => mention.slice(1));

      const input: CreatePostInput = {
        content: content.trim(),
        contentType: 'text',
        visibility: {
          privacy,
        },
        hashtags,
        mentions,
        // Include Signal-style link previews (encrypted with post)
        linkPreviews: previews.length > 0 ? previews : undefined,
      };

      await schedulePost(input, scheduledFor);

      // Clear form
      setContent('');
      setPrivacy('group');
      setScheduledDateTime('');
      setShowSchedulePicker(false);
      clearPreviews();
      onPostCreated?.();

      // Show success toast
      toast.success(t('posts.postScheduled'));
    } catch (error) {
      console.error('Failed to schedule post:', error);
      toast.error(t('posts.scheduleFailed'));
    } finally {
      setIsPosting(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + emoji + content.substring(end);

    setContent(newContent);

    // Set cursor position after emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    }, 0);

  };

  // Handle privacy change with warning for public posts
  const handlePrivacyChange = (value: PostPrivacy) => {
    if (value === 'public' && privacy !== 'public') {
      // Show warning dialog before switching to public
      setPendingPrivacy(value);
      setShowPublicWarning(true);
    } else {
      setPrivacy(value);
    }
  };

  // Confirm public privacy after warning
  const confirmPublicPrivacy = () => {
    if (pendingPrivacy) {
      setPrivacy(pendingPrivacy);
      setPendingPrivacy(null);
    }
    setShowPublicWarning(false);
  };

  // Cancel public privacy change
  const cancelPublicPrivacy = () => {
    setPendingPrivacy(null);
    setShowPublicWarning(false);
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Textarea - flush with card edges */}
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={effectivePlaceholder}
        className="min-h-[80px] resize-none border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base px-3 py-3"
        disabled={isPosting}
        aria-label="Post content"
      />

      {/* Link Previews (Signal-style encrypted) */}
      {linkPreviewsEnabled && (previews.length > 0 || previewLoading) && (
        <div className="px-3 pb-2 space-y-2">
          {previewLoading && previews.length === 0 && (
            <LinkPreviewSkeleton compact />
          )}
          {previews.map((preview) => (
            <LinkPreviewCard
              key={preview.url}
              preview={preview}
              compact
              showRemove
              onRemove={() => removePreview(preview.url)}
            />
          ))}
        </div>
      )}

      {/* Compact Toolbar - flush with card edges */}
      <div className="flex items-center justify-between border-t bg-muted/30 px-1 py-1">
        {/* Left side: action buttons */}
        <div className="flex items-center">
          {/* Emoji Picker - component has its own Popover */}
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            triggerButton={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isPosting}
                aria-label={t('posts.addEmoji')}
              >
                <Smile className="w-4 h-4" />
              </Button>
            }
          />

          {/* Link Preview Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${!linkPreviewsEnabled ? 'text-muted-foreground' : ''}`}
            onClick={() => {
              setLinkPreviewsEnabled(!linkPreviewsEnabled);
              if (linkPreviewsEnabled) {
                clearPreviews();
              }
            }}
            disabled={isPosting}
            aria-label={linkPreviewsEnabled ? t('posts.disableLinkPreviews') : t('posts.enableLinkPreviews')}
            title={linkPreviewsEnabled ? t('posts.linkPreviewsOn') : t('posts.linkPreviewsOff')}
          >
            {linkPreviewsEnabled ? (
              <Link2 className="w-4 h-4" />
            ) : (
              <Link2Off className="w-4 h-4" />
            )}
          </Button>

          {/* Character count - only when typing */}
          {content && (
            <span className="text-xs text-muted-foreground ml-2">
              {content.length}
              {(content.match(/#[\w]+/g) || []).length > 0 && (
                <> · <Hash className="w-3 h-3 inline" />{(content.match(/#[\w]+/g) || []).length}</>
              )}
              {(content.match(/@[\w]+/g) || []).length > 0 && (
                <> · <AtSign className="w-3 h-3 inline" />{(content.match(/@[\w]+/g) || []).length}</>
              )}
            </span>
          )}
        </div>

        {/* Right side: privacy + post */}
        <div className="flex items-center gap-1">
          {/* Compact Privacy selector */}
          <Select
            value={privacy}
            onValueChange={(value) => handlePrivacyChange(value as PostPrivacy)}
            disabled={isPosting}
          >
            <SelectTrigger
              className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-xs"
              aria-label={t('posts.postPrivacy')}
            >
              <SelectValue placeholder={t('posts.privacy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="group" title={t('posts.groupOnlyDesc')}>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  <span>{t('posts.groupOnly')}</span>
                </div>
              </SelectItem>
              <SelectItem value="public" title={t('posts.publicDesc')}>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 flex-shrink-0" />
                  <span>{t('posts.public')}</span>
                </div>
              </SelectItem>
              <SelectItem value="followers" title={t('posts.followersDesc')}>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 flex-shrink-0" />
                  <span>{t('posts.followers')}</span>
                </div>
              </SelectItem>
              <SelectItem value="encrypted" title={t('posts.encryptedDesc')}>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <span>{t('posts.encrypted')}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Post button with schedule dropdown */}
          <div className="flex items-center">
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isPosting}
              size="sm"
              className="h-8 px-3 rounded-r-none text-xs"
            >
              {isPosting ? '...' : t('posts.post')}
            </Button>
            <Popover open={showSchedulePicker} onOpenChange={setShowSchedulePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 px-1.5 rounded-l-none border-l border-primary-foreground/20"
                  disabled={!content.trim() || isPosting}
                  aria-label={t('posts.schedulePost')}
                >
                  <Clock className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-3">
                  <p className="font-medium text-sm">{t('posts.schedulePost')}</p>
                  <Input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    min={getMinDateTime()}
                    className="text-sm"
                  />
                  <Button
                    onClick={handleSchedule}
                    disabled={!scheduledDateTime || isPosting}
                    size="sm"
                    className="w-full"
                  >
                    {t('posts.schedule')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Public Privacy Warning Dialog */}
      <AlertDialog open={showPublicWarning} onOpenChange={setShowPublicWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-warning" />
              {t('posts.makePublicTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {t('posts.makePublicWarning')}
              </p>
              <p className="text-warning">
                {t('posts.publicActivistWarning')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPublicPrivacy}>
              {t('posts.keepPrivate')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmPublicPrivacy}>
              {t('posts.makePublic')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
