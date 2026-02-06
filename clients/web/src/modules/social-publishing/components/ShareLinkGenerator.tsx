/**
 * ShareLinkGenerator Component
 *
 * Inline component for generating share links with options for
 * custom slugs, expiration, password protection, and click tracking.
 *
 * Privacy: Slugs generated client-side with nanoid.
 * No external URL shortening services.
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Link2,
  Copy,
  Check,
  CalendarIcon,
  BarChart2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getSocialPublishingManager } from '../socialPublishingManager';
import { useAuthStore } from '@/stores/authStore';
import type { ShareLink, CreateShareLinkInput } from '../types';

interface ShareLinkGeneratorProps {
  sourceModule: string;
  sourceContentId: string;
  onLinkCreated?: (link: ShareLink) => void;
  className?: string;
}

export const ShareLinkGenerator: FC<ShareLinkGeneratorProps> = ({
  sourceModule,
  sourceContentId,
  onLinkCreated,
  className,
}) => {
  const { t } = useTranslation();
  const { currentIdentity } = useAuthStore();
  const manager = getSocialPublishingManager();

  const [customSlug, setCustomSlug] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [trackClicks, setTrackClicks] = useState(true);
  const [generatedLink, setGeneratedLink] = useState<ShareLink | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleGenerate = async () => {
    if (!currentIdentity?.publicKey) {
      toast.error('Not authenticated');
      return;
    }

    setIsGenerating(true);
    try {
      const input: CreateShareLinkInput = {
        sourceModule,
        sourceContentId,
        customSlug: customSlug || undefined,
        expiresAt,
        trackClicks,
      };

      const link = await manager.createShareLink(input, currentIdentity.publicKey);
      const url = manager.getShareUrl(link.slug);
      setGeneratedLink(link);
      setShareUrl(url);
      onLinkCreated?.(link);
      toast.success('Share link created');
    } catch {
      toast.error('Failed to create share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    const success = await manager.copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      toast.success(t('social-publishing.share.copied'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5" />
          Share Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!generatedLink ? (
          <>
            {/* Custom Slug */}
            <div className="space-y-2">
              <Label className="text-sm">Custom slug (optional)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">buildit.network/s/</span>
                <Input
                  placeholder="my-link"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.replace(/[^a-z0-9-]/gi, ''))}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {t('social-publishing.share.expiration')}
              </Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    {expiresAt
                      ? format(expiresAt, 'PPP')
                      : t('social-publishing.share.noExpiry')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiresAt}
                    onSelect={(date) => {
                      setExpiresAt(date);
                      setCalendarOpen(false);
                    }}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
              {expiresAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpiresAt(undefined)}
                  className="text-xs"
                >
                  Clear expiration
                </Button>
              )}
            </div>

            {/* Click Tracking */}
            <div className="flex items-center justify-between">
              <Label htmlFor="track-toggle" className="text-sm flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Track clicks
              </Label>
              <Switch
                id="track-toggle"
                checked={trackClicks}
                onCheckedChange={setTrackClicks}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Session-based counting only. No user identification or cookies.
            </p>

            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
              <Link2 className="h-4 w-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Generate Link'}
            </Button>
          </>
        ) : (
          <>
            {/* Generated link display */}
            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{generatedLink.slug}</Badge>
              {generatedLink.trackClicks && (
                <Badge variant="secondary">
                  <BarChart2 className="h-3 w-3 mr-1" />
                  Tracking
                </Badge>
              )}
              {generatedLink.expiresAt && (
                <Badge variant="secondary">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  Expires {format(new Date(generatedLink.expiresAt * 1000), 'PP')}
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGeneratedLink(null);
                setShareUrl('');
                setCustomSlug('');
              }}
            >
              Generate another
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
