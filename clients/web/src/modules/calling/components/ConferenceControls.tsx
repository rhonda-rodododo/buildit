/**
 * Conference Controls
 * Media controls for conference calls
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Hand,
} from 'lucide-react';

interface ConferenceControlsProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  handRaised: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onRaiseHand: () => void;
  onLeave: () => void;
}

export function ConferenceControls({
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  handRaised,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onRaiseHand,
  onLeave,
}: ConferenceControlsProps) {
  const { t } = useTranslation('calling');

  return (
    <>
      {/* Mute */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isMuted ? 'destructive' : 'secondary'}
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={onToggleMute}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isMuted ? t('unmute') : t('mute')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Video */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isVideoEnabled ? 'secondary' : 'destructive'}
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={onToggleVideo}
            >
              {isVideoEnabled ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isVideoEnabled ? t('stopVideo') : t('startVideo')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Screen share */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isScreenSharing ? 'default' : 'secondary'}
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={onToggleScreenShare}
            >
              {isScreenSharing ? (
                <ScreenShareOff className="w-5 h-5" />
              ) : (
                <ScreenShare className="w-5 h-5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isScreenSharing ? t('stopScreenShare') : t('shareScreen')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Raise hand */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={handRaised ? 'default' : 'secondary'}
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={onRaiseHand}
            >
              <Hand className={`w-5 h-5 ${handRaised ? 'text-yellow-400' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {handRaised ? t('lowerHand') : t('raiseHand')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Leave */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={onLeave}
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t('leaveCall')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}

export default ConferenceControls;
