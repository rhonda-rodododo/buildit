/**
 * Group Call View
 * Main view for mesh topology group calls with grid and speaker layouts
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Grid,
  User,
  MoreVertical,
  Lock,
  Unlock,
  Copy,
} from 'lucide-react';
import { getMeshCallManager, type MeshCallManager } from '../services/meshCallManager';
import { ParticipantTile } from './ParticipantTile';
import type { GroupCallState } from '../types';

interface GroupCallViewProps {
  roomId: string;
  onLeave?: () => void;
}

type LayoutMode = 'grid' | 'speaker';

export function GroupCallView({ roomId, onLeave }: GroupCallViewProps) {
  const { t } = useTranslation('calling');
  const [manager] = useState<MeshCallManager>(() => getMeshCallManager());
  const [state, setState] = useState<GroupCallState | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [dominantSpeaker, setDominantSpeaker] = useState<string | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isRoomLocked, setIsRoomLocked] = useState(false);

  // Set up event listeners
  useEffect(() => {
    const handleParticipantJoined = () => {
      setState(manager.getState());
    };

    const handleParticipantLeft = () => {
      setState(manager.getState());
    };

    const handleParticipantStateChanged = () => {
      setState(manager.getState());
    };

    const handleRemoteTrack = () => {
      setState(manager.getState());
    };

    const handleActiveSpeakersChanged = (speakers: string[]) => {
      setActiveSpeakers(speakers);
    };

    const handleDominantSpeakerChanged = (speaker: string | null) => {
      setDominantSpeaker(speaker);
    };

    const handleRoomClosed = (reason: string) => {
      console.log('Room closed:', reason);
      onLeave?.();
    };

    manager.on('participant-joined', handleParticipantJoined);
    manager.on('participant-left', handleParticipantLeft);
    manager.on('participant-state-changed', handleParticipantStateChanged);
    manager.on('remote-track', handleRemoteTrack);
    manager.on('active-speakers-changed', handleActiveSpeakersChanged);
    manager.on('dominant-speaker-changed', handleDominantSpeakerChanged);
    manager.on('room-closed', handleRoomClosed);

    // Initial state
    setState(manager.getState());

    return () => {
      manager.off('participant-joined', handleParticipantJoined);
      manager.off('participant-left', handleParticipantLeft);
      manager.off('participant-state-changed', handleParticipantStateChanged);
      manager.off('remote-track', handleRemoteTrack);
      manager.off('active-speakers-changed', handleActiveSpeakersChanged);
      manager.off('dominant-speaker-changed', handleDominantSpeakerChanged);
      manager.off('room-closed', handleRoomClosed);
    };
  }, [manager, onLeave]);

  // Call duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Control handlers
  const handleToggleMute = useCallback(() => {
    manager.toggleMute();
    setState(manager.getState());
  }, [manager]);

  const handleToggleVideo = useCallback(() => {
    manager.toggleVideo();
    setState(manager.getState());
  }, [manager]);

  const handleToggleScreenShare = useCallback(async () => {
    try {
      if (state?.isScreenSharing) {
        await manager.stopScreenShare();
      } else {
        await manager.startScreenShare();
      }
      setState(manager.getState());
    } catch (error) {
      console.error('Screen share error:', error);
    }
  }, [manager, state?.isScreenSharing]);

  const handleLeave = useCallback(async () => {
    await manager.leaveRoom();
    onLeave?.();
  }, [manager, onLeave]);

  const handleEndCall = useCallback(async () => {
    if (state?.isHost) {
      await manager.endCall();
    }
    onLeave?.();
  }, [manager, state?.isHost, onLeave]);

  const handleToggleLock = useCallback(() => {
    if (isRoomLocked) {
      manager.unlockRoom();
    } else {
      manager.lockRoom();
    }
    setIsRoomLocked(!isRoomLocked);
  }, [manager, isRoomLocked]);

  const handleCopyRoomLink = useCallback(() => {
    const link = `${window.location.origin}/call/${roomId}`;
    navigator.clipboard.writeText(link);
  }, [roomId]);

  const handleRequestMute = useCallback((pubkey: string) => {
    manager.requestMute(pubkey);
  }, [manager]);

  const handleRemoveParticipant = useCallback((pubkey: string) => {
    manager.removeParticipant(pubkey);
  }, [manager]);

  // Layout calculation
  const getGridClass = (participantCount: number): string => {
    switch (participantCount) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
      case 4:
        return 'grid-cols-2 grid-rows-2';
      case 5:
      case 6:
        return 'grid-cols-3 grid-rows-2';
      case 7:
      case 8:
        return 'grid-cols-4 grid-rows-2';
      default:
        return 'grid-cols-2';
    }
  };

  if (!state) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">{t('connecting')}</div>
      </div>
    );
  }

  const allParticipants = [
    // Local participant
    {
      pubkey: state.localPubkey,
      displayName: 'You',
      stream: state.localStream,
      audioEnabled: !state.isMuted,
      videoEnabled: state.isVideoEnabled,
      isSpeaking: false,
      isLocal: true,
    },
    // Remote participants
    ...Array.from(state.participants.values()).map((p) => ({
      ...p,
      isSpeaking: activeSpeakers.includes(p.pubkey),
      isLocal: false,
    })),
  ];

  const participantCount = allParticipants.length;

  // Speaker layout: dominant speaker large, others in sidebar
  const renderSpeakerLayout = () => {
    const speaker = dominantSpeaker
      ? allParticipants.find((p) => p.pubkey === dominantSpeaker) || allParticipants[0]
      : allParticipants[0];
    const others = allParticipants.filter((p) => p.pubkey !== speaker.pubkey);

    return (
      <div className="flex h-full gap-2 p-2">
        {/* Main speaker */}
        <div className="flex-1">
          <ParticipantTile
            pubkey={speaker.pubkey}
            displayName={speaker.displayName}
            stream={speaker.stream}
            audioEnabled={speaker.audioEnabled}
            videoEnabled={speaker.videoEnabled}
            isSpeaking={speaker.isSpeaking}
            isLocal={speaker.isLocal}
            isLarge
          />
        </div>

        {/* Sidebar with other participants */}
        {others.length > 0 && (
          <div className="w-48 flex flex-col gap-2 overflow-y-auto">
            {others.map((p) => (
              <ParticipantTile
                key={p.pubkey}
                pubkey={p.pubkey}
                displayName={p.displayName}
                stream={p.stream}
                audioEnabled={p.audioEnabled}
                videoEnabled={p.videoEnabled}
                isSpeaking={p.isSpeaking}
                isLocal={p.isLocal}
                isSmall
                onRequestMute={state.isHost && !p.isLocal ? () => handleRequestMute(p.pubkey) : undefined}
                onRemove={state.isHost && !p.isLocal ? () => handleRemoveParticipant(p.pubkey) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Grid layout: all participants in a grid
  const renderGridLayout = () => {
    return (
      <div className={cn('grid gap-2 p-2 h-full', getGridClass(participantCount))}>
        {allParticipants.map((p) => (
          <ParticipantTile
            key={p.pubkey}
            pubkey={p.pubkey}
            displayName={p.displayName}
            stream={p.stream}
            audioEnabled={p.audioEnabled}
            videoEnabled={p.videoEnabled}
            isSpeaking={p.isSpeaking}
            isLocal={p.isLocal}
            onRequestMute={state.isHost && !p.isLocal ? () => handleRequestMute(p.pubkey) : undefined}
            onRemove={state.isHost && !p.isLocal ? () => handleRemoveParticipant(p.pubkey) : undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">
            {t('groupCall')}
          </span>
          <span className="text-gray-400 text-sm">
            {participantCount} {t('participants')}
          </span>
          {isRoomLocked && (
            <Lock className="w-4 h-4 text-yellow-500" />
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-gray-400 font-mono">
            {formatDuration(callDuration)}
          </span>

          {/* Layout toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLayoutMode(layoutMode === 'grid' ? 'speaker' : 'grid')}
                  className="text-gray-400 hover:text-white"
                >
                  {layoutMode === 'grid' ? (
                    <User className="w-5 h-5" />
                  ) : (
                    <Grid className="w-5 h-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {layoutMode === 'grid' ? t('speakerView') : t('gridView')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Host controls */}
          {state.isHost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleToggleLock}>
                  {isRoomLocked ? (
                    <>
                      <Unlock className="w-4 h-4 mr-2" />
                      {t('unlockRoom')}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      {t('lockRoom')}
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyRoomLink}>
                  <Copy className="w-4 h-4 mr-2" />
                  {t('copyLink')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleEndCall}
                  className="text-red-500 focus:text-red-500"
                >
                  <PhoneOff className="w-4 h-4 mr-2" />
                  {t('endCallForAll')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 overflow-hidden">
        {layoutMode === 'speaker' ? renderSpeakerLayout() : renderGridLayout()}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 bg-gray-800/50">
        {/* Mute */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={state.isMuted ? 'destructive' : 'secondary'}
                size="icon"
                className="w-12 h-12 rounded-full"
                onClick={handleToggleMute}
              >
                {state.isMuted ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {state.isMuted ? t('unmute') : t('mute')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Video */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={state.isVideoEnabled ? 'secondary' : 'destructive'}
                size="icon"
                className="w-12 h-12 rounded-full"
                onClick={handleToggleVideo}
              >
                {state.isVideoEnabled ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <VideoOff className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {state.isVideoEnabled ? t('stopVideo') : t('startVideo')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Screen share */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={state.isScreenSharing ? 'default' : 'secondary'}
                size="icon"
                className="w-12 h-12 rounded-full"
                onClick={handleToggleScreenShare}
              >
                {state.isScreenSharing ? (
                  <ScreenShareOff className="w-5 h-5" />
                ) : (
                  <ScreenShare className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {state.isScreenSharing ? t('stopScreenShare') : t('shareScreen')}
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
                onClick={handleLeave}
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('leaveCall')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export default GroupCallView;
