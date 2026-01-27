/**
 * Incoming Call Dialog
 * Full-screen dialog for incoming calls
 */

import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CallType } from '../types';
import { useTranslation } from 'react-i18next';

interface IncomingCallDialogProps {
  open: boolean;
  incomingCall: {
    callId: string;
    remotePubkey: string;
    remoteName?: string;
    callType: CallType;
    timestamp: number;
  } | null;
  onAnswer: () => void;
  onDecline: () => void;
}

export function IncomingCallDialog({
  open,
  incomingCall,
  onAnswer,
  onDecline,
}: IncomingCallDialogProps) {
  const { t } = useTranslation('calling');
  const [ringCount, setRingCount] = useState(0);

  // Animate the ringing
  useEffect(() => {
    if (!open) {
      setRingCount(0);
      return;
    }

    const interval = setInterval(() => {
      setRingCount((c) => (c + 1) % 4);
    }, 400);

    return () => clearInterval(interval);
  }, [open]);

  if (!incomingCall) return null;

  const isVideoCall = incomingCall.callType === CallType.Video;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">
          {isVideoCall ? t('incomingVideoCall') : t('incomingCall')}
        </DialogTitle>

        <div className="bg-gradient-to-b from-primary/20 to-background p-8 text-center">
          {/* Avatar with ring animation */}
          <div className="relative inline-block mb-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-3xl bg-primary/20">
                {incomingCall.remoteName?.[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>

            {/* Ring animations */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  'absolute inset-0 rounded-full border-2 border-primary animate-ping',
                  ringCount === i ? 'opacity-75' : 'opacity-0'
                )}
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '1.2s',
                }}
              />
            ))}
          </div>

          {/* Call info */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-1">
              {incomingCall.remoteName ?? 'Unknown Caller'}
            </h2>
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              {isVideoCall ? (
                <>
                  <Video className="h-4 w-4" />
                  {t('incomingVideoCall')}
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4" />
                  {t('incomingCall')}
                </>
              )}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-8">
            {/* Decline */}
            <div className="text-center">
              <Button
                variant="destructive"
                size="icon"
                className="h-16 w-16 rounded-full mb-2"
                onClick={onDecline}
              >
                <PhoneOff className="h-7 w-7" />
              </Button>
              <p className="text-sm text-muted-foreground">{t('decline')}</p>
            </div>

            {/* Answer */}
            <div className="text-center">
              <Button
                variant="default"
                size="icon"
                className="h-16 w-16 rounded-full mb-2 bg-green-500 hover:bg-green-600"
                onClick={onAnswer}
              >
                {isVideoCall ? (
                  <Video className="h-7 w-7" />
                ) : (
                  <Phone className="h-7 w-7" />
                )}
              </Button>
              <p className="text-sm text-muted-foreground">{t('answer')}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
