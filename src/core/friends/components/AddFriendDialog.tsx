/**
 * AddFriendDialog Component
 * Multi-tab dialog for adding friends via username, QR, email, or invite link
 */

import { useState, useEffect, useRef } from 'react';
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
      signature: '', // TODO: Sign with private key
    };

    setQrData(JSON.stringify(qrPayload));
  }, [currentIdentity]);

  // Handle username search and add
  const handleAddByUsername = async () => {
    if (!usernameQuery.trim()) {
      toast.error('Please enter a username');
      return;
    }

    setIsSearching(true);
    try {
      // TODO: Search for user by username via Nostr NIP-05
      // For now, assume usernameQuery is a pubkey
      await addFriend(usernameQuery, 'username', friendMessage || undefined);
      toast.success('Friend request sent!');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send friend request');
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
      toast.error('Failed to access camera');
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

      // TODO: Verify signature
      if (!qrData.pubkey) {
        throw new Error('Invalid QR code');
      }

      await addFriend(qrData.pubkey, 'qr', friendMessage || undefined);
      toast.success('Friend request sent!');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Invalid QR code');
    }
  };

  // Send email invite
  const handleEmailInvite = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      // TODO: Implement email invite via backend service
      toast.info('Email invites coming soon!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send email invite');
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
      toast.success('Invite link created!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invite link');
    }
  };

  // Copy invite link
  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setInviteLinkCopied(true);
    toast.success('Link copied to clipboard!');
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
          <DialogTitle>Add Friend</DialogTitle>
          <DialogDescription>Choose how you'd like to connect with your friend</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="username" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="username">
              <User className="h-4 w-4 mr-1" />
              Username
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="h-4 w-4 mr-1" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-1" />
              Email
            </TabsTrigger>
            <TabsTrigger value="link">
              <LinkIcon className="h-4 w-4 mr-1" />
              Link
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Username Search */}
          <TabsContent value="username" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username or Public Key</Label>
              <Input
                id="username"
                placeholder="Enter username or pubkey..."
                value={usernameQuery}
                onChange={(e) => setUsernameQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Optional Message</Label>
              <Textarea
                id="message"
                placeholder="Say hello..."
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
              {isSearching ? 'Sending...' : 'Send Friend Request'}
            </Button>
          </TabsContent>

          {/* Tab 2: QR Code */}
          <TabsContent value="qr" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Show QR */}
              <div className="space-y-2">
                <Label>Your QR Code</Label>
                <div className="flex justify-center p-4 bg-white rounded-lg" data-testid="user-qr-code">
                  <QRCodeSVG value={qrData} size={200} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Let your friend scan this code
                </p>
              </div>

              {/* Scan QR */}
              <div className="space-y-2">
                <Label>Scan Friend's QR Code</Label>
                <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                  {!isScanning ? (
                    <div className="flex items-center justify-center h-full">
                      <Button onClick={startScanning} data-testid="start-qr-scan-button">
                        <Camera className="mr-2 h-4 w-4" />
                        Start Scanning
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
                  <p className="text-xs text-green-600">Scanned successfully!</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Email Invite */}
          <TabsContent value="email" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Friend's Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-message">Invitation Message</Label>
              <Textarea
                id="invite-message"
                placeholder="I'd like to connect with you on BuildIt Network..."
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={4}
              />
            </div>

            <Button onClick={handleEmailInvite} className="w-full">
              Send Email Invite
            </Button>
          </TabsContent>

          {/* Tab 4: Invite Link */}
          <TabsContent value="link" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Generate a shareable link that anyone can use to send you a friend request. Link
              expires in 7 days and can be used up to 10 times.
            </p>

            {!inviteLink ? (
              <Button
                onClick={handleGenerateInviteLink}
                className="w-full"
                data-testid="generate-invite-link-button"
              >
                Generate Invite Link
              </Button>
            ) : (
              <div className="space-y-2">
                <Label>Your Invite Link</Label>
                <div className="flex gap-2">
                  <Input value={inviteLink} readOnly />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyInviteLink}
                    title="Copy link"
                  >
                    {inviteLinkCopied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with friends. Expires in 7 days or after 10 uses.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
