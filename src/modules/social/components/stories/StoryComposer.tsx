/**
 * StoryComposer Component
 * Create stories with text, images, or videos
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Plus,
  Type,
  Image as ImageIcon,
  Video,
  Palette,
  Globe,
  Users,
  Heart,
  Lock,
  MessageCircle,
} from 'lucide-react';
import { useSocialStore } from '../../socialStore';
import type { CreateStoryInput, StoryContentType, StoryTextStyle, StoryPrivacy } from '../../types';
import { cn } from '@/lib/utils';

interface StoryComposerProps {
  onStoryCreated?: () => void;
  className?: string;
  triggerButton?: React.ReactNode;
}

const BACKGROUND_PRESETS: StoryTextStyle[] = [
  { backgroundColor: '#1a1a2e', textColor: '#ffffff', fontSize: 'large', fontWeight: 'bold', textAlign: 'center' },
  { backgroundColor: '#16213e', gradientStart: '#16213e', gradientEnd: '#0f3460', textColor: '#ffffff', fontSize: 'large', fontWeight: 'bold', textAlign: 'center' },
  { backgroundColor: '#ff6b6b', gradientStart: '#ff6b6b', gradientEnd: '#ee5253', textColor: '#ffffff', fontSize: 'large', fontWeight: 'bold', textAlign: 'center' },
  { backgroundColor: '#6c5ce7', gradientStart: '#6c5ce7', gradientEnd: '#a29bfe', textColor: '#ffffff', fontSize: 'large', fontWeight: 'bold', textAlign: 'center' },
  { backgroundColor: '#00b894', gradientStart: '#00b894', gradientEnd: '#00cec9', textColor: '#ffffff', fontSize: 'large', fontWeight: 'bold', textAlign: 'center' },
  { backgroundColor: '#fdcb6e', gradientStart: '#fdcb6e', gradientEnd: '#f39c12', textColor: '#2d3436', fontSize: 'large', fontWeight: 'bold', textAlign: 'center' },
  { backgroundColor: '#e84393', gradientStart: '#e84393', gradientEnd: '#fd79a8', textColor: '#ffffff', fontSize: 'large', fontWeight: 'bold', textAlign: 'center' },
  { backgroundColor: '#2d3436', textColor: '#dfe6e9', fontSize: 'large', fontWeight: 'normal', textAlign: 'center' },
];

export const StoryComposer: FC<StoryComposerProps> = ({
  onStoryCreated,
  className,
  triggerButton,
}) => {
  const { t } = useTranslation();
  const { createStory } = useSocialStore();

  const [isOpen, setIsOpen] = useState(false);
  const [contentType, setContentType] = useState<StoryContentType>('text');
  const [text, setText] = useState('');
  const [textStyle, setTextStyle] = useState<StoryTextStyle>(BACKGROUND_PRESETS[0]);
  const [visibility, setVisibility] = useState<StoryPrivacy['visibility']>('friends');
  const [allowReplies, setAllowReplies] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStyleChange = (preset: StoryTextStyle) => {
    setTextStyle(preset);
  };

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    setTextStyle((prev) => ({ ...prev, fontSize: size }));
  };

  const handleTextAlignChange = (align: 'left' | 'center' | 'right') => {
    setTextStyle((prev) => ({ ...prev, textAlign: align }));
  };

  const handleSubmit = async () => {
    if (contentType === 'text' && !text.trim()) {
      toast.error(t('storyComposer.toast.emptyText'));
      return;
    }

    setIsSubmitting(true);

    try {
      const input: CreateStoryInput = {
        contentType,
        text: text.trim() || undefined,
        textStyle: contentType === 'text' ? textStyle : undefined,
        privacy: {
          visibility,
          allowReplies,
        },
      };

      await createStory(input);
      toast.success(t('storyComposer.toast.success'));

      // Reset form
      setText('');
      setTextStyle(BACKGROUND_PRESETS[0]);
      setVisibility('friends');
      setAllowReplies(true);
      setIsOpen(false);

      onStoryCreated?.();
    } catch (error) {
      console.error('Failed to create story:', error);
      toast.error(t('storyComposer.toast.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBackgroundStyle = () => {
    if (textStyle.gradientStart && textStyle.gradientEnd) {
      return {
        background: `linear-gradient(135deg, ${textStyle.gradientStart}, ${textStyle.gradientEnd})`,
        color: textStyle.textColor,
      };
    }
    return {
      backgroundColor: textStyle.backgroundColor,
      color: textStyle.textColor,
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" className={className}>
            <Plus className="w-4 h-4 mr-2" />
            {t('storyComposer.addStory')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('storyComposer.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Content Type Selector */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={contentType === 'text' ? 'default' : 'outline'}
              onClick={() => setContentType('text')}
              className="flex-1"
            >
              <Type className="w-4 h-4 mr-2" />
              {t('storyComposer.contentTypes.text')}
            </Button>
            <Button
              type="button"
              variant={contentType === 'image' ? 'default' : 'outline'}
              onClick={() => setContentType('image')}
              className="flex-1"
              disabled
              title={t('storyComposer.contentTypes.imageComingSoon')}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              {t('storyComposer.contentTypes.image')}
            </Button>
            <Button
              type="button"
              variant={contentType === 'video' ? 'default' : 'outline'}
              onClick={() => setContentType('video')}
              className="flex-1"
              disabled
              title={t('storyComposer.contentTypes.videoComingSoon')}
            >
              <Video className="w-4 h-4 mr-2" />
              {t('storyComposer.contentTypes.video')}
            </Button>
          </div>

          {/* Text Story Editor */}
          {contentType === 'text' && (
            <>
              {/* Preview */}
              <div
                className="aspect-[9/16] max-h-[300px] rounded-lg flex items-center justify-center p-6 transition-all"
                style={getBackgroundStyle()}
              >
                <p
                  className={cn(
                    'transition-all break-words max-w-full',
                    textStyle.fontSize === 'small' && 'text-lg',
                    textStyle.fontSize === 'medium' && 'text-2xl',
                    textStyle.fontSize === 'large' && 'text-4xl',
                    textStyle.fontWeight === 'bold' && 'font-bold',
                    textStyle.textAlign === 'left' && 'text-left',
                    textStyle.textAlign === 'center' && 'text-center',
                    textStyle.textAlign === 'right' && 'text-right'
                  )}
                >
                  {text || t('storyComposer.preview.placeholder')}
                </p>
              </div>

              {/* Text Input */}
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('storyComposer.textInput.placeholder')}
                className="resize-none"
                maxLength={280}
              />
              <p className="text-xs text-muted-foreground text-right">
                {t('storyComposer.textInput.charCount', { current: text.length, max: 280 })}
              </p>

              {/* Background Presets */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  {t('storyComposer.style.background')}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {BACKGROUND_PRESETS.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleStyleChange(preset)}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        textStyle.backgroundColor === preset.backgroundColor
                          ? 'border-primary scale-110'
                          : 'border-transparent hover:scale-105'
                      )}
                      style={{
                        background: preset.gradientStart
                          ? `linear-gradient(135deg, ${preset.gradientStart}, ${preset.gradientEnd})`
                          : preset.backgroundColor,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>{t('storyComposer.style.fontSize')}</Label>
                  <Select
                    value={textStyle.fontSize}
                    onValueChange={(v) => handleFontSizeChange(v as 'small' | 'medium' | 'large')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">{t('storyComposer.style.fontSizes.small')}</SelectItem>
                      <SelectItem value="medium">{t('storyComposer.style.fontSizes.medium')}</SelectItem>
                      <SelectItem value="large">{t('storyComposer.style.fontSizes.large')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Text Align */}
                <div className="flex-1 space-y-2">
                  <Label>{t('storyComposer.style.alignment')}</Label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <Button
                        key={align}
                        type="button"
                        variant={textStyle.textAlign === align ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleTextAlignChange(align)}
                        className="flex-1 capitalize"
                      >
                        {align}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Privacy Settings */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <Label>{t('storyComposer.privacy.label')}</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as StoryPrivacy['visibility'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      {t('storyComposer.privacy.public')}
                    </div>
                  </SelectItem>
                  <SelectItem value="friends">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {t('storyComposer.privacy.friends')}
                    </div>
                  </SelectItem>
                  <SelectItem value="close-friends">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      {t('storyComposer.privacy.closeFriends')}
                    </div>
                  </SelectItem>
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {t('storyComposer.privacy.custom')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="allow-replies" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                {t('storyComposer.allowReplies')}
              </Label>
              <Switch
                id="allow-replies"
                checked={allowReplies}
                onCheckedChange={setAllowReplies}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || (contentType === 'text' && !text.trim())}
            className="w-full"
          >
            {isSubmitting ? t('storyComposer.submit.creating') : t('storyComposer.submit.share')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
