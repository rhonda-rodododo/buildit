/**
 * Call Window Page
 *
 * This component is rendered in separate Tauri windows for voice/video calls.
 * It displays the call interface with controls for:
 * - Mute/unmute
 * - Video on/off
 * - Screen sharing
 * - PiP mode (minimize/maximize)
 * - Always-on-top toggle
 * - End call
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Minimize2,
  Pin,
  PinOff,
  Shield,
  MoreVertical,
  FlipHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCalling, useCallQuality } from '@/modules/calling/hooks/useCalling';
import { useCallWindow, isTauri } from '@/hooks/useCallWindow';
import { CallStateState, CallType, HangupReason } from '@/modules/calling/types';

export function CallWindowPage() {
  const { callId } = useParams<{ callId: string }>();
  const { t } = useTranslation('calling');
  const {
    activeCall,
    endCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    switchCamera,
  } = useCalling();

  const quality = useCallQuality();
  const {
    minimizeCallWindow,
    maximizeCallWindow,
    toggleAlwaysOnTop,
    closeCallWindow,
  } = useCallWindow();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  // Update call duration
  useEffect(() => {
    if (!activeCall?.connectedAt) return;

    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - activeCall.connectedAt!) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall?.connectedAt]);

  // Set up video streams
  useEffect(() => {
    if (localVideoRef.current && activeCall?.localStream) {
      localVideoRef.current.srcObject = activeCall.localStream;
    }
    if (remoteVideoRef.current && activeCall?.remoteStream) {
      remoteVideoRef.current.srcObject = activeCall.remoteStream;
    }
  }, [activeCall?.localStream, activeCall?.remoteStream]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (!showControls || isMinimized) return;

    const timeout = setTimeout(() => {
      if (activeCall?.state === CallStateState.Connected) {
        setShowControls(false);
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [showControls, activeCall?.state, isMinimized]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateText = useCallback(() => {
    if (!activeCall) return '';
    switch (activeCall.state) {
      case CallStateState.Initiating:
        return t('initiating');
      case CallStateState.Ringing:
        return t('ringing');
      case CallStateState.Connecting:
        return t('connecting');
      case CallStateState.Connected:
        return formatDuration(callDuration);
      case CallStateState.Reconnecting:
        return t('reconnecting');
      case CallStateState.OnHold:
        return t('onHold');
      default:
        return '';
    }
  }, [activeCall, callDuration, t]);

  const getQualityColor = () => {
    if (!quality?.roundTripTime) return 'bg-gray-500';
    if (quality.roundTripTime < 100) return 'bg-green-500';
    if (quality.roundTripTime < 300) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleMinimize = async () => {
    if (callId && isTauri()) {
      try {
        await minimizeCallWindow(callId);
        setIsMinimized(true);
      } catch (error) {
        console.error('Failed to minimize:', error);
      }
    }
  };

  const handleMaximize = async () => {
    if (callId && isTauri()) {
      try {
        await maximizeCallWindow(callId);
        setIsMinimized(false);
      } catch (error) {
        console.error('Failed to maximize:', error);
      }
    }
  };

  const handleToggleAlwaysOnTop = async () => {
    if (callId && isTauri()) {
      try {
        const newValue = !isAlwaysOnTop;
        await toggleAlwaysOnTop(callId, newValue);
        setIsAlwaysOnTop(newValue);
      } catch (error) {
        console.error('Failed to toggle always on top:', error);
      }
    }
  };

  const handleEndCall = async () => {
    await endCall(HangupReason.Completed);
    if (callId && isTauri()) {
      await closeCallWindow(callId);
    }
  };

  // Show loading state if call not found
  if (!activeCall || activeCall.callId !== callId) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <p className="text-lg">{t('loadingCall', 'Loading call...')}</p>
        </div>
      </div>
    );
  }

  const isVideoCall = activeCall.callType === CallType.Video;

  // Minimized PiP view
  if (isMinimized) {
    return (
      <div
        className="h-screen w-screen bg-gray-900 overflow-hidden cursor-pointer"
        onClick={handleMaximize}
      >
        {isVideoCall && activeCall.remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg bg-gray-700">
                {activeCall.remoteName?.[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Minimal overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-xs">
            <span className="text-white truncate max-w-[60%]">
              {activeCall.remoteName ?? 'Unknown'}
            </span>
            <span className="text-gray-300">{getStateText()}</span>
          </div>
        </div>

        {/* Quick end call button */}
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            handleEndCall();
          }}
        >
          <PhoneOff className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Full window view
  return (
    <div
      className="h-screen w-screen bg-black flex flex-col"
      onMouseMove={() => setShowControls(true)}
      onClick={() => setShowControls(true)}
    >
      {/* Remote video / Audio-only display */}
      {isVideoCall && activeCall.remoteStream ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <div className="text-center">
            <Avatar className="h-28 w-28 mx-auto mb-4">
              <AvatarFallback className="text-4xl">
                {activeCall.remoteName?.[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-semibold text-white">
              {activeCall.remoteName ?? 'Unknown'}
            </h2>
            <p className="text-gray-400 mt-2">{getStateText()}</p>

            {/* Audio level indicator */}
            {activeCall.state === CallStateState.Connected && (
              <div className="flex items-center justify-center mt-4 gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-1 rounded-full transition-all duration-150',
                      quality?.audioLevel && quality.audioLevel * 5 > i
                        ? 'bg-green-500 h-5'
                        : 'bg-gray-600 h-2'
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local video preview (PiP) */}
      {isVideoCall && activeCall.localStream && activeCall.isVideoEnabled && (
        <div className="absolute top-4 right-4 w-40 h-28 rounded-lg overflow-hidden shadow-lg border-2 border-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
          />
        </div>
      )}

      {/* Top bar */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-sm">
                {activeCall.remoteName?.[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-white font-medium text-sm">
                {activeCall.remoteName ?? 'Unknown'}
              </h3>
              <p className="text-gray-300 text-xs">{getStateText()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* E2EE indicator */}
            {activeCall.isEncrypted && (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50 text-xs">
                <Shield className="h-2.5 w-2.5 mr-1" />
                {t('encrypted')}
              </Badge>
            )}

            {/* Quality indicator */}
            <div className={cn('w-1.5 h-1.5 rounded-full', getQualityColor())} />

            {/* Always on top toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={handleToggleAlwaysOnTop}
              title={isAlwaysOnTop ? t('disableAlwaysOnTop', 'Disable always on top') : t('enableAlwaysOnTop', 'Enable always on top')}
            >
              {isAlwaysOnTop ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>

            {/* Minimize to PiP */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={handleMinimize}
              title={t('minimizeToPip', 'Minimize to picture-in-picture')}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>

            {/* More options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-white/20"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={switchCamera}>
                  <FlipHorizontal className="h-4 w-4 mr-2" />
                  {t('switchCamera')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleToggleAlwaysOnTop}>
                  {isAlwaysOnTop ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                  {isAlwaysOnTop ? t('disableAlwaysOnTop', 'Disable always on top') : t('enableAlwaysOnTop', 'Enable always on top')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="flex items-center justify-center gap-3">
          {/* Mute */}
          <Button
            variant={activeCall.isMuted ? 'destructive' : 'secondary'}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={toggleMute}
            title={activeCall.isMuted ? t('unmute') : t('mute')}
          >
            {activeCall.isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          {/* Video toggle (for video calls) */}
          {isVideoCall && (
            <Button
              variant={!activeCall.isVideoEnabled ? 'destructive' : 'secondary'}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={toggleVideo}
              title={activeCall.isVideoEnabled ? t('turnOffVideo') : t('turnOnVideo')}
            >
              {activeCall.isVideoEnabled ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* Screen share */}
          <Button
            variant={activeCall.isScreenSharing ? 'default' : 'secondary'}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={activeCall.isScreenSharing ? stopScreenShare : startScreenShare}
            title={activeCall.isScreenSharing ? t('stopScreenShare') : t('startScreenShare')}
          >
            {activeCall.isScreenSharing ? (
              <MonitorOff className="h-5 w-5" />
            ) : (
              <Monitor className="h-5 w-5" />
            )}
          </Button>

          {/* End call */}
          <Button
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={handleEndCall}
            title={t('endCall')}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CallWindowPage;
