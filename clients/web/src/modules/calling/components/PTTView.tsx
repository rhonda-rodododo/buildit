/**
 * Push-to-Talk View
 * Walkie-talkie style group voice communication interface
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PTTChannelManager, pttChannelManager, PTTChannelState, PTTPriority } from '../services/pttChannelManager';
import { PTTAudioManager, pttAudioManager } from '../services/pttAudioManager';

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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4" />
        <p className="text-muted-foreground">{t('ptt.initializing')}</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-destructive text-4xl mb-4">⚠️</div>
        <p className="text-destructive font-medium mb-2">{error}</p>
        <button
          onClick={() => setError(null)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          {t('ptt.tryAgain')}
        </button>
      </div>
    );
  }

  // Render no channel state (join prompt)
  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-6xl mb-4">📻</div>
        <h2 className="text-xl font-semibold mb-2">{groupName}</h2>
        <p className="text-muted-foreground mb-6 text-center">
          {t('ptt.joinPrompt')}
        </p>
        <button
          onClick={handleJoinChannel}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          {t('ptt.joinChannel')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold">{channel.name}</h2>
          <p className="text-sm text-muted-foreground">
            👥 {getOnlineMembersCount()} {t('ptt.membersOnline')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="p-2 rounded-md hover:bg-muted"
            title={t('ptt.showMembers')}
          >
            👥
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-md hover:bg-muted"
            title={t('ptt.settings')}
          >
            ⚙️
          </button>
          <button
            onClick={handleLeaveChannel}
            className="p-2 rounded-md hover:bg-muted text-destructive"
            title={t('ptt.leaveChannel')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Current speaker indicator */}
        {currentSpeaker && (
          <div className="mb-8 text-center">
            <p className="text-muted-foreground mb-2">{t('ptt.currentlySpeaking')}</p>
            <div className="flex items-center gap-2 justify-center">
              <span className="text-2xl animate-pulse">🔊</span>
              <span className="text-xl font-semibold">
                {currentSpeaker.name || currentSpeaker.pubkey.slice(0, 8)}
              </span>
            </div>
            {isSpeaking && (
              <div className="mt-2 h-2 w-48 bg-muted rounded-full overflow-hidden mx-auto">
                <div
                  className="h-full bg-primary transition-all duration-100"
                  style={{ width: `${getAudioLevelPercentage()}%` }}
                />
              </div>
            )}
          </div>
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
          className={`
            w-48 h-48 rounded-full flex flex-col items-center justify-center
            transition-all duration-200 select-none
            ${isSpeaking
              ? 'bg-primary text-primary-foreground scale-105 shadow-lg shadow-primary/30'
              : queuePosition !== null
                ? 'bg-amber-500 text-white'
                : 'bg-muted hover:bg-muted/80 active:scale-95'
            }
            ${isRequesting ? 'opacity-50 cursor-wait' : ''}
          `}
        >
          <span className="text-4xl mb-2">
            {isSpeaking ? '🎙️' : queuePosition !== null ? '⏳' : '🎤'}
          </span>
          <span className="font-semibold text-lg">
            {isSpeaking
              ? t('ptt.speaking')
              : queuePosition !== null
                ? t('ptt.inQueue', { position: queuePosition })
                : t('ptt.holdToSpeak')
            }
          </span>
          {!isSpeaking && !queuePosition && (
            <span className="text-sm mt-1 opacity-70">
              {t('ptt.spacebarHint')}
            </span>
          )}
        </button>

        {/* Queue display */}
        {speakQueue.length > 0 && (
          <div className="mt-8 w-full max-w-xs">
            <p className="text-sm text-muted-foreground mb-2 text-center">
              {t('ptt.queue', { count: speakQueue.length })}
            </p>
            <div className="space-y-2">
              {speakQueue.slice(0, 5).map((req, index) => (
                <div
                  key={req.pubkey}
                  className={`
                    flex items-center gap-2 p-2 rounded-md bg-muted
                    ${req.pubkey === userPubkey ? 'border border-primary' : ''}
                  `}
                >
                  <span className="text-muted-foreground w-6">{index + 1}.</span>
                  <span className="flex-1 truncate">
                    {req.name || req.pubkey.slice(0, 8)}
                  </span>
                  {req.priority !== 'normal' && (
                    <span className={`
                      text-xs px-2 py-0.5 rounded
                      ${req.priority === 'moderator' ? 'bg-purple-500/20 text-purple-500' : 'bg-amber-500/20 text-amber-500'}
                    `}>
                      {req.priority}
                    </span>
                  )}
                </div>
              ))}
              {speakQueue.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{speakQueue.length - 5} {t('ptt.more')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-4 p-4 border-t">
        <button
          onClick={handleToggleVAD}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md
            ${vadEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}
          `}
          title={t('ptt.vadTooltip')}
        >
          <span>{vadEnabled ? '🔇' : '🎚️'}</span>
          <span>{t('ptt.vad')}</span>
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          vadEnabled={vadEnabled}
          onToggleVAD={handleToggleVAD}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Members panel */}
      {showMembers && channel && (
        <MembersPanel
          members={Array.from(channel.members.values())}
          currentSpeaker={currentSpeaker?.pubkey}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
};

// Settings Panel Component
interface SettingsPanelProps {
  vadEnabled: boolean;
  onToggleVAD: () => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  vadEnabled,
  onToggleVAD,
  onClose,
}) => {
  const { t } = useTranslation('calling');

  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card border rounded-lg shadow-lg w-80 max-h-96 overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{t('ptt.settings')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('ptt.vadLabel')}</p>
              <p className="text-sm text-muted-foreground">{t('ptt.vadDescription')}</p>
            </div>
            <button
              onClick={onToggleVAD}
              className={`
                w-12 h-6 rounded-full transition-colors
                ${vadEnabled ? 'bg-primary' : 'bg-muted'}
              `}
            >
              <div className={`
                w-5 h-5 rounded-full bg-white shadow transition-transform
                ${vadEnabled ? 'translate-x-6' : 'translate-x-0.5'}
              `} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Members Panel Component
interface MembersPanelProps {
  members: ChannelMember[];
  currentSpeaker?: string;
  onClose: () => void;
}

const MembersPanel: React.FC<MembersPanelProps> = ({
  members,
  currentSpeaker,
  onClose,
}) => {
  const { t } = useTranslation('calling');

  const onlineMembers = members.filter(m => m.online);
  const offlineMembers = members.filter(m => !m.online);

  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card border rounded-lg shadow-lg w-80 max-h-96 overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{t('ptt.members')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">✕</button>
        </div>
        <div className="p-4">
          {onlineMembers.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">
                {t('ptt.online')} ({onlineMembers.length})
              </p>
              <div className="space-y-2">
                {onlineMembers.map(member => (
                  <div key={member.pubkey} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="flex-1 truncate">
                      {member.name || member.pubkey.slice(0, 8)}
                    </span>
                    {member.pubkey === currentSpeaker && (
                      <span className="animate-pulse">🔊</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {offlineMembers.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {t('ptt.offline')} ({offlineMembers.length})
              </p>
              <div className="space-y-2">
                {offlineMembers.map(member => (
                  <div key={member.pubkey} className="flex items-center gap-2 opacity-50">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                    <span className="flex-1 truncate">
                      {member.name || member.pubkey.slice(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PTTView;
