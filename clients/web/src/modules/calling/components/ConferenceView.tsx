/**
 * Conference View
 * Main view for SFU-based conference calls with MLS E2EE
 *
 * Supports:
 * - 50+ participants via SFU topology
 * - MLS E2EE with epoch indicator
 * - Speaker and gallery layouts
 * - Waiting room management
 * - Breakout rooms
 * - Hand raising and reactions
 * - Polls
 * - Local recording
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PhoneOff,
  Grid,
  User,
  Users,
  MoreVertical,
  Lock,
  Unlock,
  Copy,
  Smile,
  MessageSquare,
  Settings,
  BarChart3,
  Radio,
  Shield,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Layers,
} from 'lucide-react';
import { getSFUConferenceManager, type SFUConferenceManager } from '../services/sfuConferenceManager';
import { ParticipantTile } from './ParticipantTile';
import { ConferenceControls } from './ConferenceControls';
import { ParticipantList } from './ParticipantList';
import { HandRaiseQueue } from './HandRaiseQueue';
import { ReactionsOverlay } from './ReactionsOverlay';
import { ReactionsPicker } from './ReactionsPicker';
import { WaitingRoomPanel } from './WaitingRoomPanel';
import { PollPanel } from './PollPanel';
import { RecordingControls } from './RecordingControls';
import type { ConferenceState, ConferenceLayout } from '../types';

interface ConferenceViewProps {
  roomId: string;
  onLeave?: () => void;
}

type SidePanel = 'participants' | 'chat' | 'polls' | 'waitingRoom' | 'breakouts' | null;

export function ConferenceView({ roomId, onLeave }: ConferenceViewProps) {
  const { t } = useTranslation('calling');
  const [manager] = useState<SFUConferenceManager>(() => getSFUConferenceManager());
  const [state, setState] = useState<ConferenceState | null>(null);
  const [layoutMode, setLayoutMode] = useState<ConferenceLayout>('speaker');
  const [callDuration, setCallDuration] = useState(0);
  const [activeSpeaker, _setActiveSpeaker] = useState<string | null>(null);
  const [activeReactions, setActiveReactions] = useState<Array<{
    id: string;
    pubkey: string;
    emoji: string;
    x: number;
    y: number;
  }>>([]);
  const [raisedHands, setRaisedHands] = useState<Map<string, number>>(new Map());
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [waitingCount, _setWaitingCount] = useState(0);
  const [filmstripPage, setFilmstripPage] = useState(0);

  // Set up event listeners
  useEffect(() => {
    const updateState = () => setState(manager.getState());

    manager.on('participant-joined', updateState);
    manager.on('participant-left', updateState);
    manager.on('participant-updated', updateState);
    manager.on('track-subscribed', updateState);
    manager.on('track-unsubscribed', updateState);
    manager.on('connection-state-changed', updateState);
    manager.on('mls-epoch-changed', updateState);
    manager.on('room-closed', (reason: string) => {
      console.log('Conference closed:', reason);
      onLeave?.();
    });

    // Initial state
    setState(manager.getState());

    return () => {
      manager.removeAllListeners();
    };
  }, [manager, onLeave]);

  // Call duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format duration as HH:MM:SS
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Control handlers
  const handleToggleMute = useCallback(() => {
    if (state) {
      manager.setAudioEnabled(state.isMuted);
      setState(manager.getState());
    }
  }, [manager, state]);

  const handleToggleVideo = useCallback(() => {
    if (state) {
      manager.setVideoEnabled(!state.isVideoEnabled);
      setState(manager.getState());
    }
  }, [manager, state]);

  const handleToggleScreenShare = useCallback(async () => {
    try {
      if (state?.isScreenSharing) {
        await manager.stopScreenShare();
      } else {
        await manager.shareScreen();
      }
      setState(manager.getState());
    } catch (error) {
      console.error('Screen share error:', error);
    }
  }, [manager, state?.isScreenSharing]);

  const handleLeave = useCallback(async () => {
    await manager.leaveConference();
    onLeave?.();
  }, [manager, onLeave]);

  const handleRaiseHand = useCallback(() => {
    // Toggle hand raise via hand raise manager (would be integrated)
    const newRaisedHands = new Map(raisedHands);
    if (state?.localPubkey) {
      if (newRaisedHands.has(state.localPubkey)) {
        newRaisedHands.delete(state.localPubkey);
      } else {
        newRaisedHands.set(state.localPubkey, Date.now());
      }
      setRaisedHands(newRaisedHands);
    }
  }, [raisedHands, state?.localPubkey]);

  const handleSendReaction = useCallback((emoji: string) => {
    // Add floating reaction animation
    const id = `${Date.now()}-${Math.random()}`;
    const x = 30 + Math.random() * 40; // 30-70% from left
    const y = 80 - Math.random() * 20; // 60-80% from top
    setActiveReactions((prev) => [...prev, { id, pubkey: state?.localPubkey || '', emoji, x, y }]);

    // Remove after animation
    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  }, [state?.localPubkey]);

  // Quality management - for future adaptive quality controls
  // manager.setPreferredQuality() can be called with QualityLayer values

  // Build participant list
  const allParticipants = useMemo(() => {
    if (!state) return [];

    const local = {
      pubkey: state.localPubkey,
      displayName: 'You',
      stream: state.localStream,
      audioEnabled: !state.isMuted,
      videoEnabled: state.isVideoEnabled,
      screenSharing: state.isScreenSharing,
      isSpeaking: false,
      isLocal: true,
      role: state.role,
      handRaised: raisedHands.has(state.localPubkey),
    };

    const remote = Array.from(state.participants.values()).map((p) => ({
      ...p,
      isSpeaking: activeSpeaker === p.pubkey,
      isLocal: false,
      handRaised: raisedHands.has(p.pubkey),
    }));

    return [local, ...remote];
  }, [state, activeSpeaker, raisedHands]);

  const participantCount = allParticipants.length;

  // Filmstrip pagination (for large conferences)
  const filmstripSize = 6;
  const totalFilmstripPages = Math.ceil(Math.max(0, participantCount - 1) / filmstripSize);
  const filmstripParticipants = useMemo(() => {
    const others = allParticipants.filter((p) => p.pubkey !== activeSpeaker && !p.isLocal);
    const start = filmstripPage * filmstripSize;
    return others.slice(start, start + filmstripSize);
  }, [allParticipants, activeSpeaker, filmstripPage, filmstripSize]);

  // Get active speaker for speaker view
  const speaker = useMemo(() => {
    if (activeSpeaker) {
      return allParticipants.find((p) => p.pubkey === activeSpeaker);
    }
    return allParticipants.find((p) => !p.isLocal) || allParticipants[0];
  }, [allParticipants, activeSpeaker]);

  // Layout calculation for grid view
  const getGridClass = (count: number): string => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    if (count <= 16) return 'grid-cols-4';
    return 'grid-cols-5';
  };

  if (!state) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <div className="text-white">{t('connecting')}</div>
        </div>
      </div>
    );
  }

  // Render speaker view layout
  const renderSpeakerLayout = () => (
    <div className="flex flex-col h-full gap-2 p-2">
      {/* Main speaker area */}
      <div className="flex-1 min-h-0">
        {speaker && (
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
        )}
      </div>

      {/* Filmstrip */}
      {participantCount > 1 && (
        <div className="h-32 flex items-center gap-2">
          {/* Previous button */}
          {totalFilmstripPages > 1 && (
            <Button
              variant="ghost"
              size="icon"
              disabled={filmstripPage === 0}
              onClick={() => setFilmstripPage((p) => Math.max(0, p - 1))}
              className="shrink-0 text-gray-400"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}

          {/* Participant tiles */}
          <div className="flex-1 flex gap-2 overflow-hidden">
            {filmstripParticipants.map((p) => (
              <div key={p.pubkey} className="w-40 shrink-0">
                <ParticipantTile
                  pubkey={p.pubkey}
                  displayName={p.displayName}
                  stream={p.stream}
                  audioEnabled={p.audioEnabled}
                  videoEnabled={p.videoEnabled}
                  isSpeaking={p.isSpeaking}
                  isLocal={p.isLocal}
                  isSmall
                />
              </div>
            ))}
          </div>

          {/* Next button */}
          {totalFilmstripPages > 1 && (
            <Button
              variant="ghost"
              size="icon"
              disabled={filmstripPage >= totalFilmstripPages - 1}
              onClick={() => setFilmstripPage((p) => Math.min(totalFilmstripPages - 1, p + 1))}
              className="shrink-0 text-gray-400"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );

  // Render gallery view layout
  const renderGalleryLayout = () => (
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
        />
      ))}
    </div>
  );

  // Render side-by-side layout
  const renderSideBySideLayout = () => {
    const screenSharer = allParticipants.find((p) => p.screenSharing);
    const mainContent = screenSharer || speaker;
    const others = allParticipants.filter((p) => p.pubkey !== mainContent?.pubkey);

    return (
      <div className="flex h-full gap-2 p-2">
        {/* Main content (screen share or speaker) */}
        <div className="flex-1">
          {mainContent && (
            <ParticipantTile
              pubkey={mainContent.pubkey}
              displayName={mainContent.displayName}
              stream={mainContent.stream}
              audioEnabled={mainContent.audioEnabled}
              videoEnabled={mainContent.videoEnabled}
              isSpeaking={mainContent.isSpeaking}
              isLocal={mainContent.isLocal}
              isLarge
            />
          )}
        </div>

        {/* Sidebar with others */}
        <div className="w-64 flex flex-col gap-2 overflow-y-auto">
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
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-medium truncate max-w-xs">
            {state.name || t('conference')}
          </span>

          {/* E2EE indicator */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="gap-1">
                  <Shield className="w-3 h-3 text-green-500" />
                  <span className="text-xs">{t('e2ee')}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {t('e2eeEnabled')} (MLS Epoch {state.mlsEpoch})
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Participant count */}
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {participantCount}
          </Badge>

          {/* Waiting room indicator */}
          {waitingCount > 0 && state.isHost && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-yellow-500 text-yellow-500"
              onClick={() => setSidePanel('waitingRoom')}
            >
              <UserPlus className="w-4 h-4" />
              {waitingCount} {t('waiting')}
            </Button>
          )}

          {/* Room locked indicator */}
          {state.settings.locked && (
            <Lock className="w-4 h-4 text-yellow-500" />
          )}

          {/* Recording indicator */}
          {state.isRecording && (
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <Radio className="w-3 h-3" />
              {t('recording')}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Duration */}
          <span className="text-gray-400 font-mono text-sm">
            {formatDuration(callDuration)}
          </span>

          {/* Layout switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                {layoutMode === 'gallery' ? (
                  <Grid className="w-5 h-5" />
                ) : layoutMode === 'speaker' ? (
                  <User className="w-5 h-5" />
                ) : (
                  <Layers className="w-5 h-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLayoutMode('speaker')}>
                <User className="w-4 h-4 mr-2" />
                {t('speakerView')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLayoutMode('gallery')}>
                <Grid className="w-4 h-4 mr-2" />
                {t('galleryView')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLayoutMode('side-by-side')}>
                <Layers className="w-4 h-4 mr-2" />
                {t('sideBySide')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Side panel toggles */}
          <div className="flex items-center gap-1 border-l border-gray-700 pl-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={sidePanel === 'participants' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="text-gray-400 hover:text-white"
                    onClick={() => setSidePanel(sidePanel === 'participants' ? null : 'participants')}
                  >
                    <Users className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('participants')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={sidePanel === 'chat' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="text-gray-400 hover:text-white"
                    onClick={() => setSidePanel(sidePanel === 'chat' ? null : 'chat')}
                  >
                    <MessageSquare className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('chat')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {state.isHost && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sidePanel === 'polls' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="text-gray-400 hover:text-white"
                      onClick={() => setSidePanel(sidePanel === 'polls' ? null : 'polls')}
                    >
                      <BarChart3 className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('polls')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* More options */}
          {state.isHost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSidePanel('waitingRoom')}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('waitingRoom')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSidePanel('breakouts')}>
                  <Layers className="w-4 h-4 mr-2" />
                  {t('breakoutRooms')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  {state.settings.locked ? (
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
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}/conference/${roomId}`)}>
                  <Copy className="w-4 h-4 mr-2" />
                  {t('copyLink')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  {t('settings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-500 focus:text-red-500">
                  <PhoneOff className="w-4 h-4 mr-2" />
                  {t('endMeetingForAll')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Video area */}
        <div className="flex-1 relative overflow-hidden">
          {layoutMode === 'speaker' && renderSpeakerLayout()}
          {layoutMode === 'gallery' && renderGalleryLayout()}
          {layoutMode === 'side-by-side' && renderSideBySideLayout()}

          {/* Reactions overlay */}
          <ReactionsOverlay reactions={activeReactions} />

          {/* Hand raise queue (floating) */}
          {raisedHands.size > 0 && (
            <div className="absolute top-4 left-4">
              <HandRaiseQueue
                raisedHands={raisedHands}
                participants={allParticipants}
                isHost={state.isHost}
                onLowerHand={(pubkey) => {
                  const newHands = new Map(raisedHands);
                  newHands.delete(pubkey);
                  setRaisedHands(newHands);
                }}
              />
            </div>
          )}
        </div>

        {/* Side panel */}
        {sidePanel && (
          <div className="w-80 border-l border-gray-700 bg-gray-800/50 overflow-hidden flex flex-col">
            {sidePanel === 'participants' && (
              <ParticipantList
                participants={allParticipants}
                isHost={state.isHost}
                onClose={() => setSidePanel(null)}
              />
            )}
            {sidePanel === 'chat' && (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                {t('chatComingSoon')}
              </div>
            )}
            {sidePanel === 'polls' && (
              <PollPanel
                roomId={roomId}
                isHost={state.isHost}
                localPubkey={state.localPubkey}
                onClose={() => setSidePanel(null)}
              />
            )}
            {sidePanel === 'waitingRoom' && (
              <WaitingRoomPanel
                roomId={roomId}
                onClose={() => setSidePanel(null)}
              />
            )}
            {sidePanel === 'breakouts' && (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                {t('breakoutsComingSoon')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 px-4 py-4 bg-gray-800/50 shrink-0">
        {/* Mute */}
        <ConferenceControls
          isMuted={state.isMuted}
          isVideoEnabled={state.isVideoEnabled}
          isScreenSharing={state.isScreenSharing}
          handRaised={raisedHands.has(state.localPubkey)}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          onRaiseHand={handleRaiseHand}
          onLeave={handleLeave}
        />

        {/* Reactions button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="w-12 h-12 rounded-full"
            >
              <Smile className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto">
            <ReactionsPicker onSelect={handleSendReaction} />
          </SheetContent>
        </Sheet>

        {/* Recording (host only) */}
        {state.isHost && (
          <RecordingControls
            roomId={roomId}
            isRecording={state.isRecording}
          />
        )}
      </div>
    </div>
  );
}

export default ConferenceView;
