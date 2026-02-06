/**
 * PostComposer Component
 * Rich text composer for creating posts with privacy controls
 * and media upload support (images, videos).
 *
 * Epic 78: Media & File Upload System
 */

import { FC, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { usePostsStore } from '../postsStore';
import type { PostPrivacy, CreatePostInput } from '../types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
  ImagePlus,
  Video,
  X,
  Play,
  MapPin,
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
import {
  processMediaFiles,
  toMediaAttachment,
  revokeMediaUrls,
  formatFileSize,
  MAX_MEDIA_PER_POST,
  type ProcessedMedia,
} from '@/lib/media/mediaProcessor';
import type { LocationValue } from '@/modules/custom-fields/types';
import { LocationDisplay } from '@/modules/custom-fields/components/inputs/LocationDisplay';
import { geocodeAddress, reverseGeocode } from '@/lib/geo/distance';

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

  // Media state
  const [mediaItems, setMediaItems] = useState<ProcessedMedia[]>([]);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [mediaProcessingProgress, setMediaProcessingProgress] = useState(0);

  // Location state
  const [postLocation, setPostLocation] = useState<LocationValue | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<
    Array<{ lat: number; lng: number; label: string }>
  >([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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

  // Handle image file selection
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingMedia(true);
    setMediaProcessingProgress(10);

    try {
      const fileArray = Array.from(files);
      setMediaProcessingProgress(30);

      const { processed, errors } = await processMediaFiles(
        fileArray,
        mediaItems.length
      );

      setMediaProcessingProgress(90);

      // Show errors
      for (const error of errors) {
        toast.error(`${error.file.name}: ${error.error}`);
      }

      if (processed.length > 0) {
        setMediaItems((prev) => [...prev, ...processed]);
        toast.success(
          t('posts.mediaAdded', {
            count: processed.length,
            defaultValue: `${processed.length} media item(s) added`,
          })
        );
      }
    } catch (error) {
      console.error('Failed to process images:', error);
      toast.error(t('posts.mediaProcessingFailed', { defaultValue: 'Failed to process media' }));
    } finally {
      setIsProcessingMedia(false);
      setMediaProcessingProgress(0);
      // Reset input so same file can be selected again
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  }, [mediaItems.length, t]);

  // Handle video file selection
  const handleVideoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingMedia(true);
    setMediaProcessingProgress(10);

    try {
      const fileArray = Array.from(files);
      setMediaProcessingProgress(30);

      const { processed, errors } = await processMediaFiles(
        fileArray,
        mediaItems.length
      );

      setMediaProcessingProgress(90);

      for (const error of errors) {
        toast.error(`${error.file.name}: ${error.error}`);
      }

      if (processed.length > 0) {
        setMediaItems((prev) => [...prev, ...processed]);
        toast.success(
          t('posts.mediaAdded', {
            count: processed.length,
            defaultValue: `${processed.length} media item(s) added`,
          })
        );
      }
    } catch (error) {
      console.error('Failed to process video:', error);
      toast.error(t('posts.mediaProcessingFailed', { defaultValue: 'Failed to process media' }));
    } finally {
      setIsProcessingMedia(false);
      setMediaProcessingProgress(0);
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    }
  }, [mediaItems.length, t]);

  // Remove a media item
  const handleRemoveMedia = useCallback((id: string) => {
    setMediaItems((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) {
        revokeMediaUrls(item);
      }
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  // Handle location search
  const handleLocationSearch = useCallback(async () => {
    if (!locationSearchQuery.trim() || locationSearchQuery.length < 3) return;
    setIsSearchingLocation(true);
    try {
      const results = await geocodeAddress(locationSearchQuery);
      setLocationSearchResults(results);
    } finally {
      setIsSearchingLocation(false);
    }
  }, [locationSearchQuery]);

  // Select a location from search results
  const handleSelectLocation = useCallback(
    (result: { lat: number; lng: number; label: string }) => {
      setPostLocation({
        lat: result.lat,
        lng: result.lng,
        label: result.label,
        precision: 'neighborhood', // Default to neighborhood for posts
      });
      setShowLocationPicker(false);
      setLocationSearchQuery('');
      setLocationSearchResults([]);
    },
    [],
  );

  // Use current GPS location for post
  const handleUseGPSForPost = useCallback(async () => {
    if (!navigator.geolocation) return;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
        });
      });
      const { latitude, longitude } = position.coords;
      const label = await reverseGeocode(latitude, longitude);
      setPostLocation({
        lat: latitude,
        lng: longitude,
        label: label || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        precision: 'neighborhood',
      });
      setShowLocationPicker(false);
    } catch {
      toast.error(t('posts.locationFailed', { defaultValue: 'Failed to get location' }));
    }
  }, [t]);

  // Remove location from post
  const handleRemoveLocation = useCallback(() => {
    setPostLocation(null);
  }, []);

  // Build post input with media attachments
  const buildPostInput = (): CreatePostInput => {
    // Extract hashtags
    const hashtags = (content.match(/#[\w]+/g) || []).map((tag) => tag.slice(1));

    // Extract mentions
    const mentions = (content.match(/@[\w]+/g) || []).map((mention) => mention.slice(1));

    // Determine content type based on media
    const hasImages = mediaItems.some((m) => m.type === 'image');
    const hasVideos = mediaItems.some((m) => m.type === 'video');
    const contentType = hasVideos ? 'video' : hasImages ? 'image' : 'text';

    // Convert ProcessedMedia to MediaAttachments
    const media = mediaItems.length > 0
      ? mediaItems.map(toMediaAttachment)
      : undefined;

    return {
      content: content.trim(),
      contentType,
      media,
      visibility: {
        _v: '1.0.0',
        privacy,
      },
      hashtags,
      mentions,
      // Include Signal-style link previews (encrypted with post)
      linkPreviews: previews.length > 0 ? previews : undefined,
    };
  };

  const handleSubmit = async () => {
    if ((!content.trim() && mediaItems.length === 0) || !currentIdentity) return;

    setIsPosting(true);

    try {
      const input = buildPostInput();
      await createPost(input);

      // Clear form
      setContent('');
      setPrivacy('group');
      clearPreviews();
      // Clean up media URLs
      mediaItems.forEach(revokeMediaUrls);
      setMediaItems([]);
      setPostLocation(null);
      onPostCreated?.();

      // Show success toast
      toast.success(t('posts.postCreated'));
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.error(t('posts.postFailed'));
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedule = async () => {
    if ((!content.trim() && mediaItems.length === 0) || !currentIdentity || !scheduledDateTime) return;

    const scheduledFor = new Date(scheduledDateTime).getTime();
    if (scheduledFor <= Date.now()) {
      toast.error(t('posts.selectFutureDate'));
      return;
    }

    setIsPosting(true);

    try {
      const input = buildPostInput();
      await schedulePost(input, scheduledFor);

      // Clear form
      setContent('');
      setPrivacy('group');
      setScheduledDateTime('');
      setShowSchedulePicker(false);
      clearPreviews();
      mediaItems.forEach(revokeMediaUrls);
      setMediaItems([]);
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

  const canPost = (content.trim() || mediaItems.length > 0) && !isPosting && !isProcessingMedia;

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        onChange={handleImageSelect}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg"
        onChange={handleVideoSelect}
        className="hidden"
        aria-hidden="true"
      />

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

      {/* Media Processing Progress */}
      {isProcessingMedia && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>{t('posts.processingMedia', { defaultValue: 'Processing media...' })}</span>
          </div>
          <Progress value={mediaProcessingProgress} className="h-1" />
        </div>
      )}

      {/* Media Previews */}
      {mediaItems.length > 0 && (
        <div className="px-3 pb-2">
          <div className="grid gap-2" style={{
            gridTemplateColumns: mediaItems.length === 1
              ? '1fr'
              : mediaItems.length === 2
                ? '1fr 1fr'
                : 'repeat(auto-fill, minmax(120px, 1fr))',
          }}>
            {mediaItems.map((media) => (
              <div
                key={media.id}
                className="relative group rounded-lg overflow-hidden border bg-muted/30"
              >
                {media.type === 'image' ? (
                  <img
                    src={media.previewUrl}
                    alt={media.fileName}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="relative w-full h-32">
                    {media.thumbnailUrl ? (
                      <img
                        src={media.thumbnailUrl}
                        alt={media.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={media.previewUrl}
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="w-8 h-8 text-white fill-white" />
                    </div>
                    {media.duration && (
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {formatDuration(media.duration)}
                      </div>
                    )}
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={() => handleRemoveMedia(media.id)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={t('posts.removeMedia', { defaultValue: 'Remove media' })}
                >
                  <X className="w-3 h-3" />
                </button>

                {/* EXIF stripped indicator */}
                {media.exifStripped && (
                  <div className="absolute bottom-1 left-1 bg-green-600/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {t('posts.exifStripped', { defaultValue: 'EXIF stripped' })}
                  </div>
                )}

                {/* File size */}
                <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {formatFileSize(media.size)}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {mediaItems.length}/{MAX_MEDIA_PER_POST} {t('posts.mediaItems', { defaultValue: 'media items' })}
          </p>
        </div>
      )}

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

      {/* Location Tag Preview */}
      {postLocation && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <LocationDisplay value={postLocation} compact />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={handleRemoveLocation}
              aria-label={t('posts.removeLocation', { defaultValue: 'Remove location' })}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
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

          {/* Image Upload Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isPosting || isProcessingMedia || mediaItems.length >= MAX_MEDIA_PER_POST}
            onClick={() => imageInputRef.current?.click()}
            aria-label={t('posts.addImage', { defaultValue: 'Add image' })}
            title={t('posts.addImage', { defaultValue: 'Add image' })}
          >
            <ImagePlus className="w-4 h-4" />
          </Button>

          {/* Video Upload Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isPosting || isProcessingMedia || mediaItems.length >= MAX_MEDIA_PER_POST}
            onClick={() => videoInputRef.current?.click()}
            aria-label={t('posts.addVideo', { defaultValue: 'Add video' })}
            title={t('posts.addVideo', { defaultValue: 'Add video' })}
          >
            <Video className="w-4 h-4" />
          </Button>

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

          {/* Location Tag Button */}
          <Popover open={showLocationPicker} onOpenChange={setShowLocationPicker}>
            <PopoverTrigger asChild>
              <Button
                variant={postLocation ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                disabled={isPosting}
                aria-label={t('posts.addLocation', { defaultValue: 'Add location' })}
                title={t('posts.addLocation', { defaultValue: 'Add location' })}
              >
                <MapPin className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-3">
                <p className="font-medium text-sm">{t('posts.addLocationTitle', { defaultValue: 'Tag Location' })}</p>
                <p className="text-xs text-muted-foreground">
                  {t('posts.locationPrivacyNote', { defaultValue: 'Location will be shown at neighborhood precision for privacy.' })}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    placeholder={t('posts.searchLocation', { defaultValue: 'Search location...' })}
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLocationSearch();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLocationSearch}
                    disabled={isSearchingLocation || locationSearchQuery.length < 3}
                  >
                    {t('posts.search', { defaultValue: 'Search' })}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleUseGPSForPost}
                >
                  {t('posts.useCurrentLocation', { defaultValue: 'Use current location' })}
                </Button>
                {locationSearchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {locationSearchResults.map((result, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full px-2 py-1.5 text-left text-xs hover:bg-accent rounded transition-colors"
                        onClick={() => handleSelectLocation(result)}
                      >
                        <span className="line-clamp-2">{result.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

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
              disabled={!canPost}
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
                  disabled={!canPost}
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

/** Format duration in seconds to MM:SS */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
