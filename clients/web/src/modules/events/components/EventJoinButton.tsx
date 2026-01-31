/**
 * Event Join Button Component
 * Join button for virtual/hybrid events with conference integration
 */

import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Video,
  VideoOff,
  ExternalLink,
  Clock,
  Shield,
  Mic,
  AlertTriangle,
} from 'lucide-react';
import type { Event, EventVirtualConfig } from '../types';
import {
  getEventCallingIntegration,
  type EventConferenceRoom,
} from '../integrations/callingIntegration';

interface EventJoinButtonProps {
  event: Event;
  virtualConfig?: EventVirtualConfig;
  userPubkey?: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

type JoinState = 'not-started' | 'waiting-room' | 'can-join' | 'ended' | 'unavailable';

export const EventJoinButton: FC<EventJoinButtonProps> = ({
  event,
  virtualConfig,
  userPubkey,
  variant = 'default',
  size = 'default',
  className,
}) => {
  const { t } = useTranslation();
  const [joinState, setJoinState] = useState<JoinState>('unavailable');
  const [, setConferenceRoom] = useState<EventConferenceRoom | null>(null);
  const [timeUntilStart, setTimeUntilStart] = useState<number | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [joining, setJoining] = useState(false);

  const integration = getEventCallingIntegration();

  // Calculate join state and time until start
  useEffect(() => {
    if (!virtualConfig?.enabled) {
      setJoinState('unavailable');
      return;
    }

    const updateState = () => {
      const now = Date.now();
      const startTime = event.startTime;
      const endTime = event.endTime || (startTime + 2 * 60 * 60 * 1000); // Default 2 hours
      const autoStartTime = startTime - (virtualConfig.autoStartMinutes * 60 * 1000);

      if (now > endTime) {
        setJoinState('ended');
        setTimeUntilStart(null);
      } else if (now >= autoStartTime) {
        // Check if conference is active
        const room = integration.getConferenceRoom(event.id);
        setConferenceRoom(room);

        if (room?.isActive) {
          if (virtualConfig.waitingRoomEnabled && now < startTime) {
            setJoinState('waiting-room');
          } else {
            setJoinState('can-join');
          }
        } else {
          setJoinState('can-join'); // Conference should be starting
        }
        setTimeUntilStart(null);
      } else {
        setJoinState('not-started');
        setTimeUntilStart(autoStartTime - now);
      }
    };

    updateState();
    const interval = setInterval(updateState, 1000);

    return () => clearInterval(interval);
  }, [event, virtualConfig, integration]);

  const formatTimeUntil = (ms: number): string => {
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) {
      return t('events.joinButton.minutesUntil', { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    return t('events.joinButton.hoursUntil', { count: hours });
  };

  const handleJoinClick = () => {
    if (virtualConfig?.recordingEnabled && virtualConfig?.recordingConsentRequired) {
      setShowConsentDialog(true);
    } else {
      doJoin();
    }
  };

  const doJoin = async () => {
    if (!userPubkey) {
      // User not logged in
      return;
    }

    setJoining(true);

    try {
      // Track that user is joining
      await integration.trackVirtualAttendee(event.id, userPubkey, 'join');

      // Get join URL
      const joinUrl = integration.getJoinUrl(event.id);

      if (joinUrl) {
        // Open conference in new tab or navigate
        window.open(joinUrl, '_blank');
      } else {
        // Conference might not be started yet, start it
        const room = await integration.startEventConference(event, virtualConfig!);
        window.open(room.joinUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to join conference:', error);
    } finally {
      setJoining(false);
      setShowConsentDialog(false);
    }
  };

  // Don't render if virtual is not enabled
  if (!virtualConfig?.enabled) {
    return null;
  }

  const renderButton = () => {
    switch (joinState) {
      case 'not-started':
        return (
          <Button
            variant="outline"
            size={size}
            className={className}
            disabled
          >
            <Clock className="h-4 w-4 mr-2" />
            {timeUntilStart ? formatTimeUntil(timeUntilStart) : t('events.joinButton.notStarted')}
          </Button>
        );

      case 'waiting-room':
        return (
          <Button
            variant={variant}
            size={size}
            className={className}
            onClick={handleJoinClick}
            disabled={joining}
          >
            <Video className="h-4 w-4 mr-2" />
            {t('events.joinButton.joinWaitingRoom')}
          </Button>
        );

      case 'can-join':
        return (
          <Button
            variant={variant}
            size={size}
            className={className}
            onClick={handleJoinClick}
            disabled={joining}
          >
            <Video className="h-4 w-4 mr-2" />
            {joining ? t('events.joinButton.joining') : t('events.joinButton.joinNow')}
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        );

      case 'ended':
        return (
          <Button
            variant="outline"
            size={size}
            className={className}
            disabled
          >
            <VideoOff className="h-4 w-4 mr-2" />
            {t('events.joinButton.eventEnded')}
          </Button>
        );

      case 'unavailable':
      default:
        return null;
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {renderButton()}

        {/* Show security badges */}
        {joinState !== 'unavailable' && joinState !== 'ended' && (
          <div className="flex items-center gap-1">
            {virtualConfig.e2eeRequired && (
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                E2EE
              </Badge>
            )}
            {virtualConfig.recordingEnabled && (
              <Badge variant="outline" className="text-xs text-orange-600">
                <Mic className="h-3 w-3 mr-1" />
                {t('events.joinButton.recording')}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Recording Consent Dialog */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {t('events.joinButton.consentDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('events.joinButton.consentDialog.description', { eventTitle: event.title })}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="recording-consent"
                checked={recordingConsent}
                onCheckedChange={(checked) => setRecordingConsent(checked === true)}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="recording-consent"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {t('events.joinButton.consentDialog.checkboxLabel')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('events.joinButton.consentDialog.checkboxDescription')}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConsentDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={doJoin}
              disabled={!recordingConsent || joining}
            >
              {joining ? t('events.joinButton.joining') : t('events.joinButton.consentDialog.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EventJoinButton;
