/**
 * Story Composer Component
 * Epic 61: Create stories with text, images, or videos
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image as ImageIcon,
  Video,
  Type,
  Palette,
  Send,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSocialFeaturesStore } from '../socialFeaturesStore';
import type { StoryContentType, PostVisibility } from '../types';
import { cn } from '@/lib/utils';

interface StoryComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const BACKGROUND_COLORS = [
  '#1a1a2e',
  '#16213e',
  '#0f3460',
  '#e94560',
  '#533483',
  '#1fab89',
  '#ff6b6b',
  '#4ecdc4',
  '#ffe66d',
  '#95e1d3',
];

const FONT_FAMILIES = [
  { value: 'system-ui', label: 'System' },
  { value: 'Georgia, serif', label: 'Serif' },
  { value: 'Courier New, monospace', label: 'Mono' },
  { value: 'Comic Sans MS, cursive', label: 'Casual' },
];

export function StoryComposer({ open, onOpenChange, onSuccess }: StoryComposerProps) {
  const { t } = useTranslation();
  const createStory = useSocialFeaturesStore((s) => s.createStory);

  const [contentType, setContentType] = useState<StoryContentType>('text');
  const [content, setContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUND_COLORS[0]);
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value);
  const [mediaUrl, setMediaUrl] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaType(file.type);

    if (file.type.startsWith('image/')) {
      setContentType('image');
    } else if (file.type.startsWith('video/')) {
      setContentType('video');
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate
    if (contentType === 'text' && !content.trim()) return;
    if ((contentType === 'image' || contentType === 'video') && !mediaUrl) return;

    setIsSubmitting(true);
    try {
      const visibility: PostVisibility = {
        privacy: 'followers',
      };

      await createStory({
        contentType,
        content: content.trim(),
        mediaUrl,
        mediaType,
        backgroundColor: contentType === 'text' ? backgroundColor : undefined,
        textColor: contentType === 'text' ? textColor : undefined,
        fontFamily: contentType === 'text' ? fontFamily : undefined,
        visibility,
      });

      // Reset form
      setContentType('text');
      setContent('');
      setMediaUrl(undefined);
      setMediaType(undefined);
      setBackgroundColor(BACKGROUND_COLORS[0]);

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create story:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }
    setContentType('text');
    setContent('');
    setMediaUrl(undefined);
    setMediaType(undefined);
    onOpenChange(false);
  };

  const isValid =
    (contentType === 'text' && content.trim().length > 0) ||
    ((contentType === 'image' || contentType === 'video') && mediaUrl);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{t('stories.create', 'Create Story')}</DialogTitle>
        </DialogHeader>

        {/* Content type selector */}
        <div className="flex gap-2 px-4">
          <Button
            variant={contentType === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setContentType('text')}
          >
            <Type className="h-4 w-4 mr-2" />
            {t('stories.text', 'Text')}
          </Button>
          <Button
            variant={contentType === 'image' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setContentType('image');
              fileInputRef.current?.click();
            }}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            {t('stories.image', 'Image')}
          </Button>
          <Button
            variant={contentType === 'video' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setContentType('video');
              fileInputRef.current?.click();
            }}
          >
            <Video className="h-4 w-4 mr-2" />
            {t('stories.video', 'Video')}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={contentType === 'video' ? 'video/*' : 'image/*'}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Preview area */}
        <div
          className="mx-4 aspect-[9/16] max-h-[400px] rounded-lg overflow-hidden flex items-center justify-center"
          style={{
            backgroundColor: contentType === 'text' ? backgroundColor : '#000',
          }}
        >
          {contentType === 'text' && (
            <div
              className="p-4 w-full h-full flex items-center justify-center"
              style={{
                color: textColor,
                fontFamily,
              }}
            >
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('stories.textPlaceholder', 'Type your story...')}
                className="bg-transparent border-none text-center text-xl resize-none focus:ring-0 placeholder:text-white/50"
                style={{
                  color: textColor,
                  fontFamily,
                }}
                maxLength={280}
              />
            </div>
          )}

          {contentType === 'image' && mediaUrl && (
            <img src={mediaUrl} alt="" className="max-w-full max-h-full object-contain" />
          )}

          {contentType === 'video' && mediaUrl && (
            <video
              src={mediaUrl}
              className="max-w-full max-h-full object-contain"
              controls
              muted
            />
          )}

          {(contentType === 'image' || contentType === 'video') && !mediaUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-white/50 flex flex-col items-center gap-2 hover:text-white/70 transition-colors"
            >
              {contentType === 'image' ? (
                <ImageIcon className="h-12 w-12" />
              ) : (
                <Video className="h-12 w-12" />
              )}
              <span className="text-sm">
                {t('stories.clickToUpload', 'Click to upload')}
              </span>
            </button>
          )}
        </div>

        {/* Text story customization */}
        {contentType === 'text' && (
          <div className="px-4 space-y-4">
            {/* Background color */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t('stories.backgroundColor', 'Background')}
              </Label>
              <div className="flex gap-2 flex-wrap">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setBackgroundColor(color)}
                    className={cn(
                      'h-8 w-8 rounded-full transition-transform',
                      backgroundColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Text color */}
            <div className="space-y-2">
              <Label>{t('stories.textColor', 'Text Color')}</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTextColor('#ffffff')}
                  className={cn(
                    'h-8 w-8 rounded-full bg-white border transition-transform',
                    textColor === '#ffffff' && 'ring-2 ring-offset-2 ring-primary scale-110'
                  )}
                />
                <button
                  onClick={() => setTextColor('#000000')}
                  className={cn(
                    'h-8 w-8 rounded-full bg-black border transition-transform',
                    textColor === '#000000' && 'ring-2 ring-offset-2 ring-primary scale-110'
                  )}
                />
              </div>
            </div>

            {/* Font family */}
            <div className="space-y-2">
              <Label>{t('stories.font', 'Font')}</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Caption for media stories */}
        {(contentType === 'image' || contentType === 'video') && mediaUrl && (
          <div className="px-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('stories.captionPlaceholder', 'Add a caption...')}
              className="min-h-[60px] resize-none"
              maxLength={280}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 p-4 pt-2">
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('common.sharing', 'Sharing...')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t('stories.share', 'Share Story')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
