/**
 * SocialShareDialog Component
 *
 * Privacy-first sharing dialog. All share buttons are plain URL templates
 * that open in new windows — NO platform SDKs, widgets, or tracking scripts.
 * QR codes are generated entirely client-side.
 */

import { FC, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
// Separator available for use when expanding share UI sections
// import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Copy,
  Check,
  QrCode,
  Link2,
  Mail,
  Globe,
  AtSign,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSocialPublishingManager } from '../socialPublishingManager';
import { useAuthStore } from '@/stores/authStore';
import type { CreateShareLinkInput, ShareLink } from '../types';

interface SocialShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Module that owns the content */
  sourceModule: string;
  /** Content ID being shared */
  sourceContentId: string;
  /** Title of the content (for share text) */
  title: string;
  /** Description of the content */
  description?: string;
  /** Direct URL to the content (fallback if no share link exists) */
  contentUrl?: string;
  /** Called after a share link is created */
  onShareLinkCreated?: (link: ShareLink) => void;
}

export const SocialShareDialog: FC<SocialShareDialogProps> = ({
  open,
  onOpenChange,
  sourceModule,
  sourceContentId,
  title,
  description = '',
  contentUrl,
  onShareLinkCreated,
}) => {
  const { t } = useTranslation();
  const { currentIdentity } = useAuthStore();
  const manager = getSocialPublishingManager();

  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [shareUrl, setShareUrl] = useState(contentUrl || '');
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [trackClicks, setTrackClicks] = useState(true);
  const [, setIsCreating] = useState(false);

  // Generate share link on open
  useEffect(() => {
    if (!open || shareLink) return;

    const createLink = async () => {
      if (!currentIdentity?.publicKey) return;

      setIsCreating(true);
      try {
        const input: CreateShareLinkInput = {
          sourceModule,
          sourceContentId,
          customSlug: customSlug || undefined,
          trackClicks,
        };
        const link = await manager.createShareLink(input, currentIdentity.publicKey);
        setShareLink(link);
        setShareUrl(manager.getShareUrl(link.slug));
        onShareLinkCreated?.(link);
      } catch {
        // Fallback to content URL
        if (contentUrl) setShareUrl(contentUrl);
      } finally {
        setIsCreating(false);
      }
    };

    createLink();
  }, [open, shareLink, currentIdentity?.publicKey, sourceModule, sourceContentId, contentUrl, customSlug, trackClicks, manager, onShareLinkCreated]);

  // Generate QR code when requested
  useEffect(() => {
    if (!showQR || !shareUrl || qrDataUrl) return;

    manager.generateQRCode(shareUrl).then(setQrDataUrl);
  }, [showQR, shareUrl, qrDataUrl, manager]);

  const handleCopy = useCallback(async () => {
    const success = await manager.copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      toast.success(t('social-publishing.share.copied'));
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl, manager, t]);

  // Plain URL-based share handlers — NO SDKs or tracking scripts
  const handleMastodonShare = () => {
    const url = manager.getMastodonShareUrl(title, shareUrl);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleBlueskyShare = () => {
    const url = manager.getBlueskyShareUrl(title, shareUrl);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShare = () => {
    const url = manager.getEmailShareUrl(title, description, shareUrl);
    window.location.href = url;
  };

  const handleReset = () => {
    setShareLink(null);
    setShareUrl(contentUrl || '');
    setQrDataUrl(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t('social-publishing.share.title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">
              <Link2 className="h-4 w-4 mr-1" />
              Link
            </TabsTrigger>
            <TabsTrigger value="share">
              <ExternalLink className="h-4 w-4 mr-1" />
              {t('social-publishing.share.shareVia')}
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="h-4 w-4 mr-1" />
              {t('social-publishing.share.qrCode')}
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="space-y-4 pt-4">
            {/* Share URL */}
            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
                disabled={!shareUrl}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="track-clicks" className="text-sm">
                  Track clicks (privacy-preserving)
                </Label>
                <Switch
                  id="track-clicks"
                  checked={trackClicks}
                  onCheckedChange={(checked) => {
                    setTrackClicks(checked);
                    handleReset();
                  }}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Custom slug</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="my-custom-link"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value.replace(/[^a-z0-9-]/gi, ''))}
                    className="text-sm"
                  />
                  {customSlug && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReset}
                    >
                      Regenerate
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {shareLink && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">
                  {shareLink.slug}
                </Badge>
                {shareLink.trackClicks && (
                  <span>{shareLink.clickCount ?? 0} clicks</span>
                )}
              </div>
            )}
          </TabsContent>

          {/* Share Via Tab */}
          <TabsContent value="share" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">
              {/* Privacy notice */}
              Opens in a new window. No tracking scripts or platform widgets are loaded.
            </p>

            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start"
                onClick={handleMastodonShare}
                disabled={!shareUrl}
              >
                <Globe className="h-4 w-4 mr-3" />
                Mastodon
              </Button>

              <Button
                variant="outline"
                className="justify-start"
                onClick={handleBlueskyShare}
                disabled={!shareUrl}
              >
                <AtSign className="h-4 w-4 mr-3" />
                Bluesky
              </Button>

              <Button
                variant="outline"
                className="justify-start"
                onClick={handleEmailShare}
                disabled={!shareUrl}
              >
                <Mail className="h-4 w-4 mr-3" />
                Email
              </Button>

              <Button
                variant="outline"
                className="justify-start"
                onClick={handleCopy}
                disabled={!shareUrl}
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-3 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 mr-3" />
                )}
                {copied
                  ? t('social-publishing.share.copied')
                  : t('social-publishing.share.copyLink')}
              </Button>
            </div>
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="pt-4">
            <div className="flex flex-col items-center gap-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-64 h-64 rounded-lg border"
                />
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowQR(true)}
                  disabled={!shareUrl}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  {t('social-publishing.share.qrCode')}
                </Button>
              )}
              {qrDataUrl && (
                <p className="text-xs text-muted-foreground text-center">
                  Generated client-side. No external services used.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
