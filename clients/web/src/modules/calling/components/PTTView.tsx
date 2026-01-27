/**
 * Push-to-Talk View
 * Walkie-talkie style group voice communication interface
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic,
  MicOff,
  Settings,
  Users,
  Clock,
  Volume2,
  Radio,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { pttChannelManager, PTTChannelState, PTTPriority } from '../services/pttChannelManager';
import { pttAudioManager } from '../services/pttAudioManager';

interface PTTViewProps {
  groupId: string;
  groupName: string;
  userPubkey: string;
  userName?: string;
  onClose?: () => void;
}

interface ChannelMember {
  pubkey: string;
  name?: string;
  online: boolean;
}

export const PTTView: React.FC<PTTViewProps> = ({
  groupId,
  groupName,
  userPubkey,
  userName,
  onClose,
}) => {
  const { t } = useTranslation('calling');

  // State
  const [channel, setChannel] = useState<PTTChannelState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [currentSpeaker, setCurrentSpeaker] = useState<{ pubkey: string; name?: string } | null>(null);
  const [speakQueue, setSpeakQueue] = useState<Array<{ pubkey: string; name?: string; priority: PTTPriority }>>([]);
  const [audioLevel, setAudioLevel] = useState<number>(-Infinity);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [vadEnabled, setVadEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const audioLevelInterval = useRef<ReturnType<typeof setInterval>>();
  const pttButtonRef = useRef<HTMLButtonElement>(null);

  // Initialize channel manager and audio
  useEffect(() => {
    const init = async () => {
      try {
        pttChannelManager.initialize(userPubkey, userName);
        await pttAudioManager.initialize();
        setIsInitialized(true);
      } catch (err) {
        setError(t('ptt.errors.microphoneAccess'));
        console.error('PTT initialization failed:', err);
      }
    };

    init();

    return () => {
      pttAudioManager.destroy();
      if (channel) {
        pttChannelManager.leaveChannel(channel.id);
      }
    };
  }, [userPubkey, userName, t]);

  // Set up event listeners
  useEffect(() => {
    const handleSpeakerChanged = ({ channel: ch, speaker }: { channel: PTTChannelState; speaker: { pubkey: string; name?: string } | null }) => {
      setChannel(ch);
      setCurrentSpeaker(speaker);
      setIsSpeaking(speaker?.pubkey === userPubkey);

      // Update queue position
      const pos = pttChannelManager.getQueuePosition();
      setQueuePosition(pos);
    };

    const handleQueueUpdated = ({ channel: ch, queue }: { channel: PTTChannelState; queue: Array<{ pubkey: string; displayName?: string; priority: PTTPriority }> }) => {
      setChannel(ch);
      setSpeakQueue(queue.map(q => ({ pubkey: q.pubkey, name: q.displayName, priority: q.priority })));
      const pos = pttChannelManager.getQueuePosition();
      setQueuePosition(pos);
    };

    const handleChannelJoined = (ch: PTTChannelState) => {
      setChannel(ch);
    };

    const handleChannelLeft = () => {
      setChannel(null);
      setCurrentSpeaker(null);
      setSpeakQueue([]);
      setQueuePosition(null);
    };

    const handleMemberJoined = ({ channel: ch }: { channel: PTTChannelState }) => {
      setChannel(ch);
    };

    const handleMemberLeft = ({ channel: ch }: { channel: PTTChannelState }) => {
      setChannel(ch);
    };

    pttChannelManager.on('speaker-changed', handleSpeakerChanged);
    pttChannelManager.on('queue-updated', handleQueueUpdated);
    pttChannelManager.on('channel-joined', handleChannelJoined);
    pttChannelManager.on('channel-left', handleChannelLeft);
    pttChannelManager.on('member-joined', handleMemberJoined);
    pttChannelManager.on('member-left', handleMemberLeft);

    return () => {
      pttChannelManager.off('speaker-changed', handleSpeakerChanged);
      pttChannelManager.off('queue-updated', handleQueueUpdated);
      pttChannelManager.off('channel-joined', handleChannelJoined);
      pttChannelManager.off('channel-left', handleChannelLeft);
      pttChannelManager.off('member-joined', handleMemberJoined);
      pttChannelManager.off('member-left', handleMemberLeft);
    };
  }, [userPubkey]);

  // Audio level monitoring when speaking
  useEffect(() => {
    if (isSpeaking) {
      audioLevelInterval.current = setInterval(() => {
        const level = pttAudioManager.getAudioLevel();
        setAudioLevel(level);
      }, 100);
    } else {
      if (audioLevelInterval.current) {
        clearInterval(audioLevelInterval.current);
      }
      setAudioLevel(-Infinity);
    }

    return () => {
      if (audioLevelInterval.current) {
        clearInterval(audioLevelInterval.current);
      }
    };
  }, [isSpeaking]);

  // Handle VAD events
  useEffect(() => {
    const handleVADSilence = () => {
      if (vadEnabled && isSpeaking) {
        handleRelease();
      }
    };

    pttAudioManager.on('vad-silence', handleVADSilence);

    return () => {
      pttAudioManager.off('vad-silence', handleVADSilence);
    };
  }, [vadEnabled, isSpeaking]);

  // Join or create channel
  const handleJoinChannel = useCallback(async () => {
    try {
      // For now, create a new channel for this group
      // In production, would check for existing channels first
      const ch = await pttChannelManager.createChannel(groupId, `${groupName} PTT`);
      setChannel(ch);
    } catch (err) {
      setError(t('ptt.errors.joinFailed'));
      console.error('Failed to join PTT channel:', err);
    }
  }, [groupId, groupName, t]);

  // Leave channel
  const handleLeaveChannel = useCallback(async () => {
    if (channel) {
      await pttChannelManager.leaveChannel(channel.id);
      setChannel(null);
    }
    onClose?.();
  }, [channel, onClose]);

  // Request to speak (PTT button press)
  const handlePTTPress = useCallback(async () => {
    if (!channel || isRequesting) return;

    setIsRequesting(true);
    try {
      const position = await pttChannelManager.requestSpeak('normal');
      if (position === null) {
        // Granted immediately
        await pttAudioManager.startBroadcasting();
        setIsSpeaking(true);
      } else {
        // In queue
        setQueuePosition(position);
      }
    } catch (err) {
      setError(t('ptt.errors.speakRequestFailed'));
      console.error('Speak request failed:', err);
    } finally {
      setIsRequesting(false);
    }
  }, [channel, isRequesting, t]);

  // Release speaking turn (PTT button release)
  const handleRelease = useCallback(() => {
    if (isSpeaking) {
      pttAudioManager.stopBroadcasting();
      pttChannelManager.releaseSpeak();
      setIsSpeaking(false);
    }
  }, [isSpeaking]);

  // Toggle VAD
  const handleToggleVAD = useCallback(() => {
    if (vadEnabled) {
      pttAudioManager.disableVAD();
    } else {
      pttAudioManager.enableVAD(-40);
    }
    setVadEnabled(!vadEnabled);
  }, [vadEnabled]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isSpeaking && channel) {
        e.preventDefault();
        handlePTTPress();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isSpeaking) {
        e.preventDefault();
        handleRelease();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [channel, isSpeaking, handlePTTPress, handleRelease]);

  // Get audio level as percentage for visual feedback
  const getAudioLevelPercentage = (): number => {
    if (audioLevel === -Infinity) return 0;
    // Map -60dB to 0dB to 0-100%
    return Math.max(0, Math.min(100, ((audioLevel + 60) / 60) * 100));
  };

  // Get online members count
  const getOnlineMembersCount = (): number => {
    if (!channel) return 0;
    return Array.from(channel.members.values()).filter(m => m.online).length;
  };

  // Render not initialized state
  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4" role="status">
          <span className="sr-only">{t('ptt.initializing')}</span>
        </div>
        <p className="text-muted-foreground">{t('ptt.initializing')}</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8" role="alert">
        <MicOff className="h-16 w-16 text-destructive mb-4" />
        <p className="text-destructive font-medium mb-4 text-center">{error}</p>
        <Button onClick={() => setError(null)} variant="default">
          {t('ptt.tryAgain')}
        </Button>
      </div>
    );
  }

  // Render no channel state (join prompt)
  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Radio className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{groupName}</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-sm">
          {t('ptt.joinPrompt')}
        </p>
        <Button onClick={handleJoinChannel} size="lg">
          <Radio className="mr-2 h-5 w-5" />
          {t('ptt.joinChannel')}
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold truncate">{channel.name}</h2>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{getOnlineMembersCount()} {t('ptt.membersOnline')}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMembers(!showMembers)}
                  aria-label={t('ptt.showMembers')}
                >
                  <Users className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('ptt.showMembers')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(!showSettings)}
                  aria-label={t('ptt.settings')}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('ptt.settings')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLeaveChannel}
                  className="text-destructive hover:text-destructive"
                  aria-label={t('ptt.leaveChannel')}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('ptt.leaveChannel')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
          {/* Current speaker indicator */}
          {currentSpeaker && (
            <Card className="mb-8 w-full max-w-xs">
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">{t('ptt.currentlySpeaking')}</p>
                <div className="flex items-center gap-2 justify-center">
                  <Volume2 className={cn(
                    "h-6 w-6 text-primary",
                    isSpeaking && "animate-pulse"
                  )} />
                  <span className="text-lg font-semibold truncate">
                    {currentSpeaker.name || currentSpeaker.pubkey.slice(0, 8)}
                  </span>
                </div>
                {isSpeaking && (
                  <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-100 ease-out"
                      style={{ width: `${getAudioLevelPercentage()}%` }}
                      role="progressbar"
                      aria-valuenow={getAudioLevelPercentage()}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t('ptt.audioLevel')}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* PTT Button */}
          <button
            ref={pttButtonRef}
            onMouseDown={handlePTTPress}
            onMouseUp={handleRelease}
            onMouseLeave={handleRelease}
            onTouchStart={handlePTTPress}
            onTouchEnd={handleRelease}
            disabled={isRequesting || (queuePosition !== null && !isSpeaking)}
            aria-label={isSpeaking ? t('ptt.speaking') : t('ptt.holdToSpeak')}
            aria-pressed={isSpeaking}
            className={cn(
              "w-40 h-40 sm:w-48 sm:h-48 rounded-full flex flex-col items-center justify-center",
              "transition-all duration-200 select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSpeaking && "bg-primary text-primary-foreground scale-105 shadow-xl shadow-primary/30",
              queuePosition !== null && !isSpeaking && "bg-amber-500 text-white",
              !isSpeaking && queuePosition === null && "bg-muted hover:bg-muted/80 active:scale-95",
              isRequesting && "opacity-50 cursor-wait"
            )}
          >
            {isSpeaking ? (
              <Mic className="h-12 w-12 sm:h-16 sm:w-16 mb-2 animate-pulse" />
            ) : queuePosition !== null ? (
              <Clock className="h-12 w-12 sm:h-16 sm:w-16 mb-2" />
            ) : (
              <Mic className="h-12 w-12 sm:h-16 sm:w-16 mb-2" />
            )}
            <span className="font-semibold text-base sm:text-lg text-center px-2">
              {isSpeaking
                ? t('ptt.speaking')
                : queuePosition !== null
                  ? t('ptt.inQueue', { position: queuePosition })
                  : t('ptt.holdToSpeak')
              }
            </span>
            {!isSpeaking && !queuePosition && (
              <span className="text-xs sm:text-sm mt-1 opacity-70">
                {t('ptt.spacebarHint')}
              </span>
            )}
          </button>

          {/* Queue display */}
          {speakQueue.length > 0 && (
            <Card className="mt-8 w-full max-w-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground text-center">
                  {t('ptt.queue', { count: speakQueue.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {speakQueue.slice(0, 5).map((req, index) => (
                    <div
                      key={req.pubkey}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md bg-muted/50",
                        req.pubkey === userPubkey && "ring-1 ring-primary bg-primary/5"
                      )}
                    >
                      <span className="text-muted-foreground text-sm w-6 flex-shrink-0">{index + 1}.</span>
                      <span className="flex-1 truncate text-sm">
                        {req.name || req.pubkey.slice(0, 8)}
                      </span>
                      {req.priority !== 'normal' && (
                        <Badge variant={req.priority === 'moderator' ? 'default' : 'secondary'} className="text-xs">
                          {req.priority}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {speakQueue.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center pt-1">
                      +{speakQueue.length - 5} {t('ptt.more')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-center gap-4 p-4 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={vadEnabled ? 'default' : 'outline'}
                onClick={handleToggleVAD}
                className="gap-2"
              >
                {vadEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span>{t('ptt.vad')}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('ptt.vadTooltip')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Settings Sheet */}
        <Sheet open={showSettings} onOpenChange={setShowSettings}>
          <SheetContent side="right" className="w-80 sm:w-96">
            <SheetHeader>
              <SheetTitle>{t('ptt.settings')}</SheetTitle>
            </SheetHeader>
            <div className="py-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="vad-toggle" className="text-sm font-medium">{t('ptt.vadLabel')}</Label>
                  <p className="text-sm text-muted-foreground">{t('ptt.vadDescription')}</p>
                </div>
                <Switch
                  id="vad-toggle"
                  checked={vadEnabled}
                  onCheckedChange={handleToggleVAD}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Members Sheet */}
        <Sheet open={showMembers} onOpenChange={setShowMembers}>
          <SheetContent side="right" className="w-80 sm:w-96">
            <SheetHeader>
              <SheetTitle>{t('ptt.members')}</SheetTitle>
            </SheetHeader>
            {channel && (
              <MembersPanel
                members={Array.from(channel.members.values())}
                currentSpeaker={currentSpeaker?.pubkey}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
};

// Members Panel Component (now used inside Sheet)
interface MembersPanelProps {
  members: ChannelMember[];
  currentSpeaker?: string;
}

const MembersPanel: React.FC<MembersPanelProps> = ({
  members,
  currentSpeaker,
}) => {
  const { t } = useTranslation('calling');

  const onlineMembers = members.filter(m => m.online);
  const offlineMembers = members.filter(m => !m.online);

  return (
    <div className="py-4 space-y-6">
      {onlineMembers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('ptt.online')} ({onlineMembers.length})
            </span>
          </div>
          <div className="space-y-2">
            {onlineMembers.map(member => (
              <div
                key={member.pubkey}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md",
                  member.pubkey === currentSpeaker && "bg-primary/10"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {(member.name || member.pubkey.slice(0, 2)).slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm">
                  {member.name || member.pubkey.slice(0, 8)}
                </span>
                {member.pubkey === currentSpeaker && (
                  <Volume2 className="h-4 w-4 text-primary animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {offlineMembers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {t('ptt.offline')} ({offlineMembers.length})
            </span>
          </div>
          <div className="space-y-2">
            {offlineMembers.map(member => (
              <div key={member.pubkey} className="flex items-center gap-3 p-2 rounded-md opacity-50">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {(member.name || member.pubkey.slice(0, 2)).slice(0, 2).toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm">
                  {member.name || member.pubkey.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PTTView;
