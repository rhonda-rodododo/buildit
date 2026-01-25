/**
 * AddFriendDialog Component
 * Multi-tab dialog for adding friends via username, QR, email, or invite link
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { User, QrCode, Mail, Link as LinkIcon, Copy, Check, Camera, X } from 'lucide-react';
import { useFriendsStore } from '../friendsStore';
import { useAuthStore } from '@/stores/authStore';
import type { FriendQRData } from '../types';
import { toast } from 'sonner';

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFriendDialog({ open, onOpenChange }: AddFriendDialogProps) {
  const { t } = useTranslation();
  const { currentIdentity } = useAuthStore();
  const { addFriend, createInviteLink } = useFriendsStore();

  // Tab 1: Username search
  const [usernameQuery, setUsernameQuery] = useState('');
  const [friendMessage, setFriendMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Tab 2: QR code
  const [qrData, setQrData] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string>('');
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<string>('qr-reader');

  // Tab 3: Email invite
  const [email, setEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  // Tab 4: Invite link
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  // Generate QR code for current user
  useEffect(() => {
    if (!currentIdentity) return;

    const qrPayload: FriendQRData = {
      pubkey: currentIdentity.publicKey,
      username: currentIdentity.username,
      timestamp: Date.now(),
      signature: '', // Signature implementation deferred to Phase 2
    };

    setQrData(JSON.stringify(qrPayload));
  }, [currentIdentity]);

  // Handle username search and add
  const handleAddByUsername = async () => {
    if (!usernameQuery.trim()) {
      toast.error(t('addFriendDialog.toasts.enterUsername'));
      return;
    }

    setIsSearching(true);
    try {
      // NIP-05 search deferred to Phase 2 - currently accepts pubkey
      await addFriend(usernameQuery, 'username', friendMessage || undefined);
      toast.success(t('addFriendDialog.toasts.requestSent'));
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || t('addFriendDialog.toasts.requestSent'));
    } finally {
      setIsSearching(false);
    }
  };

  // Start QR scanner
  const startScanning = async () => {
    try {
      const html5QrCode = new Html5Qrcode(videoRef.current);
      qrScannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          setScanResult(decodedText);
          stopScanning();
          handleQRScan(decodedText);
        },
        () => {
          // Ignore scan errors (expected during continuous scanning)
        }
      );

      setIsScanning(true);
    } catch (error) {
      console.error('Failed to start QR scanner:', error);
      toast.error(t('addFriendDialog.toasts.failedToAccessCamera'));
    }
  };

  // Stop QR scanner
  const stopScanning = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current = null;
      } catch (error) {
        console.error('Failed to stop scanner:', error);
      }
    }
    setIsScanning(false);
  };

  // Handle scanned QR code
  const handleQRScan = async (data: string) => {
    try {
      const qrData: FriendQRData = JSON.parse(data);

      // Signature verification deferred to Phase 2
      if (!qrData.pubkey) {
        throw new Error(t('addFriendDialog.toasts.invalidQrCode'));
      }

      await addFriend(qrData.pubkey, 'qr', friendMessage || undefined);
      toast.success(t('addFriendDialog.toasts.requestSent'));
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || t('addFriendDialog.toasts.invalidQrCode'));
    }
  };

  // Send email invite
  const handleEmailInvite = async () => {
    if (!email.trim()) {
      toast.error(t('addFriendDialog.toasts.enterEmail'));
      return;
    }

    try {
      // Email invites require backend service (Phase 3)
      toast.info(t('addFriendDialog.toasts.emailComingSoon'));
    } catch (error: any) {
      toast.error(error.message || t('addFriendDialog.toasts.emailComingSoon'));
    }
  };

  // Generate invite link
  const handleGenerateInviteLink = async () => {
    try {
      const link = await createInviteLink(
        Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        10 // Max 10 uses
      );

      const fullLink = `${window.location.origin}/invite/${link.code}`;
      setInviteLink(fullLink);
      toast.success(t('addFriendDialog.toasts.inviteLinkCreated'));
    } catch (error: any) {
      toast.error(error.message || t('addFriendDialog.toasts.inviteLinkCreated'));
    }
  };

  // Copy invite link
  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setInviteLinkCopied(true);
    toast.success(t('addFriendDialog.toasts.linkCopied'));
    setTimeout(() => setInviteLinkCopied(false), 2000);
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('addFriendDialog.title')}</DialogTitle>
          <DialogDescription>{t('addFriendDialog.description')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="username" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="username">
              <User className="h-4 w-4 mr-1" />
              {t('addFriendDialog.tabs.username')}
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="h-4 w-4 mr-1" />
              {t('addFriendDialog.tabs.qr')}
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-1" />
              {t('addFriendDialog.tabs.email')}
            </TabsTrigger>
            <TabsTrigger value="link">
              <LinkIcon className="h-4 w-4 mr-1" />
              {t('addFriendDialog.tabs.link')}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Username Search */}
          <TabsContent value="username" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('addFriendDialog.username.label')}</Label>
              <Input
                id="username"
                placeholder={t('addFriendDialog.username.placeholder')}
                value={usernameQuery}
                onChange={(e) => setUsernameQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{t('addFriendDialog.username.messageLabel')}</Label>
              <Textarea
                id="message"
                placeholder={t('addFriendDialog.username.messagePlaceholder')}
                value={friendMessage}
                onChange={(e) => setFriendMessage(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleAddByUsername}
              disabled={isSearching}
              className="w-full"
              data-testid="send-friend-request-button"
            >
              {isSearching ? t('addFriendDialog.username.sending') : t('addFriendDialog.username.sendRequest')}
            </Button>
          </TabsContent>

          {/* Tab 2: QR Code */}
          <TabsContent value="qr" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Show QR */}
              <div className="space-y-2">
                <Label>{t('addFriendDialog.qr.yourQrCode')}</Label>
                <div className="flex justify-center p-4 bg-white rounded-lg" data-testid="user-qr-code">
                  <QRCodeSVG value={qrData} size={200} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {t('addFriendDialog.qr.letFriendScan')}
                </p>
              </div>

              {/* Scan QR */}
              <div className="space-y-2">
                <Label>{t('addFriendDialog.qr.scanFriendQr')}</Label>
                <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                  {!isScanning ? (
                    <div className="flex items-center justify-center h-full">
                      <Button onClick={startScanning} data-testid="start-qr-scan-button">
                        <Camera className="mr-2 h-4 w-4" />
                        {t('addFriendDialog.qr.startScanning')}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div id={videoRef.current} className="w-full h-full" />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={stopScanning}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                {scanResult && (
                  <p className="text-xs text-green-600">{t('addFriendDialog.qr.scannedSuccessfully')}</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Email Invite */}
          <TabsContent value="email" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('addFriendDialog.email.friendEmail')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('addFriendDialog.email.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-message">{t('addFriendDialog.email.invitationMessage')}</Label>
              <Textarea
                id="invite-message"
                placeholder={t('addFriendDialog.email.invitationPlaceholder')}
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={4}
              />
            </div>

            <Button onClick={handleEmailInvite} className="w-full">
              {t('addFriendDialog.email.sendEmailInvite')}
            </Button>
          </TabsContent>

          {/* Tab 4: Invite Link */}
          <TabsContent value="link" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              {t('addFriendDialog.link.description')}
            </p>

            {!inviteLink ? (
              <Button
                onClick={handleGenerateInviteLink}
                className="w-full"
                data-testid="generate-invite-link-button"
              >
                {t('addFriendDialog.link.generateLink')}
              </Button>
            ) : (
              <div className="space-y-2">
                <Label>{t('addFriendDialog.link.yourInviteLink')}</Label>
                <div className="flex gap-2">
                  <Input value={inviteLink} readOnly />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyInviteLink}
                    title={t('addFriendDialog.link.copyLink')}
                  >
                    {inviteLinkCopied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('addFriendDialog.link.expiresInfo')}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
