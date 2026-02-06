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
import { User, QrCode, Mail, Link as LinkIcon, Copy, Check, Camera, X, AtSign, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useFriendsStore } from '../friendsStore';
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore';
import { UsernameManager } from '@/core/username/usernameManager';
import type { FriendQRData } from '../types';
import { toast } from 'sonner';
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFriendDialog({ open, onOpenChange }: AddFriendDialogProps) {
  const { t } = useTranslation();
  const { currentIdentity } = useAuthStore();
  const { addFriend, createInviteLink } = useFriendsStore();

  // Tab 1: Username / Pubkey / NIP-05 search
  const [usernameQuery, setUsernameQuery] = useState('');
  const [friendMessage, setFriendMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // NIP-05 resolution state
  const [nip05Query, setNip05Query] = useState('');
  const [nip05Resolving, setNip05Resolving] = useState(false);
  const [nip05Result, setNip05Result] = useState<{ verified: boolean; pubkey?: string; error?: string } | null>(null);

  // Tab 2: QR code
  const [qrData, setQrData] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string>('');
  const [scanVerified, setScanVerified] = useState<boolean | null>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<string>('qr-reader');

  // Tab 3: Email invite
  const [email, setEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  // Tab 4: Invite link
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  /**
   * QR_EXPIRY_MS: Maximum age of a QR code before it is rejected (10 minutes).
   * This limits the window for replay attacks if someone photographs the QR.
   */
  const QR_EXPIRY_MS = 10 * 60 * 1000;

  /**
   * Generate a random nonce for QR payload uniqueness.
   * Uses crypto.getRandomValues for cryptographic security.
   */
  const generateNonce = (): string => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  };

  /**
   * Create the signable message from QR payload fields.
   * The signature covers pubkey + timestamp + nonce to prevent replay and tampering.
   */
  const createSignableMessage = (pubkey: string, timestamp: number, nonce: string): Uint8Array => {
    const message = `buildit-qr:${pubkey}:${timestamp}:${nonce}`;
    return sha256(new TextEncoder().encode(message));
  };

  // Generate signed QR code for current user
  useEffect(() => {
    if (!currentIdentity) return;

    const privateKey = getCurrentPrivateKey();
    const timestamp = Date.now();
    const nonce = generateNonce();

    let signature = '';

    if (privateKey) {
      try {
        // Sign the QR payload with the user's private key (Schnorr/BIP-340)
        const messageHash = createSignableMessage(
          currentIdentity.publicKey,
          timestamp,
          nonce
        );
        const sig = schnorr.sign(messageHash, privateKey);
        signature = bytesToHex(sig);
      } catch (err) {
        console.error('Failed to sign QR payload:', err);
        // Fall back to unsigned QR (will show as unverified on scan)
      }
    }

    const qrPayload: FriendQRData & { nonce: string } = {
      pubkey: currentIdentity.publicKey,
      username: currentIdentity.username,
      timestamp,
      nonce,
      signature,
    };

    setQrData(JSON.stringify(qrPayload));
  }, [currentIdentity]);

  // Handle username/pubkey search and add
  const handleAddByUsername = async () => {
    if (!usernameQuery.trim()) {
      toast.error(t('addFriendDialog.toasts.enterUsername'));
      return;
    }

    setIsSearching(true);
    try {
      // Detect if input looks like a NIP-05 identifier (contains @)
      const query = usernameQuery.trim();
      let pubkeyToAdd = query;

      if (query.includes('@')) {
        // Resolve NIP-05 identifier to pubkey
        const result = await UsernameManager.verifyNIP05(query);
        if (!result.verified || !result.pubkey) {
          toast.error(result.error || t('addFriendDialog.toasts.nip05NotFound'));
          setIsSearching(false);
          return;
        }
        pubkeyToAdd = result.pubkey;
      }

      // Validate hex pubkey format (64 char hex string)
      if (!/^[0-9a-f]{64}$/.test(pubkeyToAdd)) {
        toast.error(t('addFriendDialog.toasts.invalidPubkey'));
        setIsSearching(false);
        return;
      }

      await addFriend(pubkeyToAdd, 'username', friendMessage || undefined);
      toast.success(t('addFriendDialog.toasts.requestSent'));
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('addFriendDialog.toasts.requestFailed');
      toast.error(message);
    } finally {
      setIsSearching(false);
    }
  };

  // Resolve NIP-05 identifier
  const handleNip05Resolve = async () => {
    const query = nip05Query.trim();
    if (!query) {
      toast.error(t('addFriendDialog.toasts.enterNip05'));
      return;
    }

    if (!query.includes('@')) {
      toast.error(t('addFriendDialog.toasts.invalidNip05Format'));
      return;
    }

    setNip05Resolving(true);
    setNip05Result(null);

    try {
      const result = await UsernameManager.verifyNIP05(query);
      setNip05Result(result);

      if (result.verified && result.pubkey) {
        toast.success(t('addFriendDialog.toasts.nip05Resolved'));
      } else {
        toast.error(result.error || t('addFriendDialog.toasts.nip05NotFound'));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('addFriendDialog.toasts.nip05Failed');
      setNip05Result({ verified: false, error: message });
      toast.error(message);
    } finally {
      setNip05Resolving(false);
    }
  };

  // Add friend from NIP-05 resolved pubkey
  const handleAddFromNip05 = async () => {
    if (!nip05Result?.pubkey) return;

    setIsSearching(true);
    try {
      await addFriend(nip05Result.pubkey, 'username', friendMessage || undefined);
      toast.success(t('addFriendDialog.toasts.requestSent'));
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('addFriendDialog.toasts.requestFailed');
      toast.error(message);
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

  // Handle scanned QR code with signature verification
  const handleQRScan = async (data: string) => {
    try {
      const parsed = JSON.parse(data) as FriendQRData & { nonce?: string };

      // Validate required fields
      if (!parsed.pubkey || !/^[0-9a-f]{64}$/.test(parsed.pubkey)) {
        throw new Error(t('addFriendDialog.toasts.invalidQrCode'));
      }

      if (!parsed.timestamp || typeof parsed.timestamp !== 'number') {
        throw new Error(t('addFriendDialog.toasts.invalidQrCode'));
      }

      // SECURITY: Reject QR codes older than 10 minutes to prevent replay attacks
      const age = Date.now() - parsed.timestamp;
      if (age > QR_EXPIRY_MS) {
        setScanVerified(false);
        toast.error('QR code has expired. Ask your friend to generate a new one.');
        return;
      }

      // Also reject QR codes from the future (clock skew tolerance: 1 minute)
      if (parsed.timestamp > Date.now() + 60_000) {
        setScanVerified(false);
        toast.error('QR code timestamp is in the future. Check device clocks.');
        return;
      }

      // SECURITY: Verify the Schnorr signature if present
      let verified = false;
      if (parsed.signature && parsed.nonce) {
        try {
          const messageHash = createSignableMessage(
            parsed.pubkey,
            parsed.timestamp,
            parsed.nonce
          );
          const sigBytes = hexToBytes(parsed.signature);
          const pubkeyBytes = hexToBytes(parsed.pubkey);
          verified = schnorr.verify(sigBytes, messageHash, pubkeyBytes);
        } catch (verifyErr) {
          console.error('QR signature verification error:', verifyErr);
          verified = false;
        }
      }

      setScanVerified(verified);

      // Reject QR codes with invalid signatures when a signature was provided
      if (parsed.signature && !verified) {
        toast.error('QR code signature is invalid. This may be a forged code.');
        return;
      }

      if (!parsed.signature) {
        // QR code from older client without signing - warn but allow
        toast.warning('QR code is unsigned. Verify identity through another channel.');
      }

      await addFriend(parsed.pubkey, 'qr', friendMessage || undefined);
      toast.success(t('addFriendDialog.toasts.requestSent'));
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('addFriendDialog.toasts.invalidQrCode');
      toast.error(message);
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

          {/* Tab 1: Username / Pubkey / NIP-05 Search */}
          <TabsContent value="username" className="space-y-4 pt-4">
            {/* Direct pubkey or NIP-05 entry */}
            <div className="space-y-2">
              <Label htmlFor="username">{t('addFriendDialog.username.label')}</Label>
              <Input
                id="username"
                placeholder="npub1... or user@domain.com"
                value={usernameQuery}
                onChange={(e) => setUsernameQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter a hex pubkey or NIP-05 identifier (user@domain.com)
              </p>
            </div>

            {/* NIP-05 Lookup Section */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AtSign className="h-4 w-4" />
                NIP-05 Lookup
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="user@domain.com"
                  value={nip05Query}
                  onChange={(e) => {
                    setNip05Query(e.target.value);
                    setNip05Result(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNip05Resolve();
                  }}
                />
                <Button
                  variant="outline"
                  onClick={handleNip05Resolve}
                  disabled={nip05Resolving}
                >
                  {nip05Resolving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Resolve'
                  )}
                </Button>
              </div>

              {/* NIP-05 Result */}
              {nip05Result && (
                <div className={`rounded-md p-3 text-sm ${
                  nip05Result.verified
                    ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                }`}>
                  {nip05Result.verified ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700 dark:text-green-400">Verified</span>
                      </div>
                      <div className="font-mono text-xs break-all text-muted-foreground">
                        {nip05Result.pubkey}
                      </div>
                      <Button
                        size="sm"
                        onClick={handleAddFromNip05}
                        disabled={isSearching}
                        className="w-full"
                      >
                        {isSearching ? t('addFriendDialog.username.sending') : 'Add as Friend'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <X className="h-4 w-4" />
                      <span>{nip05Result.error || 'Verification failed'}</span>
                    </div>
                  )}
                </div>
              )}
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
                  <div className="flex items-center gap-2 text-xs">
                    {scanVerified === true ? (
                      <>
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">
                          Signature verified - identity confirmed
                        </span>
                      </>
                    ) : scanVerified === false ? (
                      <>
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                        <span className="text-red-500 font-medium">
                          Signature invalid or QR expired
                        </span>
                      </>
                    ) : (
                      <span className="text-green-600">{t('addFriendDialog.qr.scannedSuccessfully')}</span>
                    )}
                  </div>
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
