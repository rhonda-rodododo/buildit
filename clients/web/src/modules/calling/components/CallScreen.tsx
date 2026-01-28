/**
 * Call Screen
 * Full-screen view for an active voice/video call
 *
 * Features:
 * - Full screen call view
 * - Minimized PiP mode within app
 * - Popout to separate window (Tauri desktop only)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  FlipHorizontal,
  Shield,
  Minimize2,
  Maximize2,
  MoreVertical,
  ExternalLink,
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
import { useCalling, useCallQuality } from '../hooks/useCalling';
import { CallStateState, CallType, HangupReason } from '../types';
import { useCallWindow, isTauri } from '@/hooks/useCallWindow';
import { getDesktopCallManager } from '../services/desktopCallManager';

export interface CallScreenProps {
  /** If true, the call is displayed in a popout window (Tauri desktop) */
  isPopout?: boolean;
  /** Callback when user clicks minimize to PiP in popout mode */
  onMinimize?: () => void;
  /** Callback when user toggles always-on-top in popout mode */
  onToggleAlwaysOnTop?: (onTop: boolean) => void;
}

export function CallScreen({ isPopout = false, onMinimize, onToggleAlwaysOnTop }: CallScreenProps) {
  const { t } = useTranslation('calling');
  const {
    activeCall,
    endCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    switchCamera,
    setCallMinimized,
  } = useCalling();

  const quality = useCallQuality();
  // Hook is used for isTauri check
  useCallWindow();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

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
    if (!showControls) return;

    const timeout = setTimeout(() => {
      if (activeCall?.state === CallStateState.Connected) {
        setShowControls(false);
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [showControls, activeCall?.state]);

  if (!activeCall) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateText = () => {
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
  };

  const getQualityColor = () => {
    if (!quality?.roundTripTime) return 'bg-gray-500';
    if (quality.roundTripTime < 100) return 'bg-green-500';
    if (quality.roundTripTime < 300) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const isVideoCall = activeCall.callType === CallType.Video;

  const handleMinimize = () => {
    if (isPopout && onMinimize) {
      onMinimize();
    } else {
      setIsMinimized(true);
      setCallMinimized(true);
    }
  };

  const handleMaximize = () => {
    setIsMinimized(false);
    setCallMinimized(false);
  };

  const handleToggleAlwaysOnTop = useCallback(() => {
    const newValue = !isAlwaysOnTop;
    setIsAlwaysOnTop(newValue);
    if (onToggleAlwaysOnTop) {
      onToggleAlwaysOnTop(newValue);
    }
  }, [isAlwaysOnTop, onToggleAlwaysOnTop]);

  /**
   * Open the call in a separate window (Tauri desktop only)
   */
  const handlePopoutCall = useCallback(async () => {
    if (!activeCall || !isTauri()) return;

    try {
      const desktopManager = getDesktopCallManager();
      await desktopManager.initialize();
      await desktopManager.startCallInWindow({
        callId: activeCall.callId,
        callType: activeCall.callType,
        remotePubkey: activeCall.remotePubkey,
        remoteName: activeCall.remoteName,
      });

      // Minimize the in-app view since the call is now in a separate window
      setIsMinimized(true);
      setCallMinimized(true);
    } catch (error) {
      console.error('Failed to open call in new window:', error);
    }
  }, [activeCall, setCallMinimized]);

  // Minimized view (picture-in-picture style)
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 w-80 h-48 bg-background rounded-lg shadow-2xl overflow-hidden z-50 border">
        {isVideoCall && activeCall.remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-2xl">
                {activeCall.remoteName?.[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Overlay controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent">
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <span className="text-white text-sm font-medium">
              {activeCall.remoteName ?? 'Unknown'}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={handleMaximize}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8"
                onClick={() => endCall()}
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full screen view
  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
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
            <Avatar className="h-32 w-32 mx-auto mb-4">
              <AvatarFallback className="text-5xl">
                {activeCall.remoteName?.[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-semibold text-white">
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
                        ? 'bg-green-500 h-6'
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
        <div className="absolute top-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border-2 border-white/20">
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
          'absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {activeCall.remoteName?.[0]?.toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-white font-medium">
                {activeCall.remoteName ?? 'Unknown'}
              </h3>
              <p className="text-gray-300 text-sm">{getStateText()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* E2EE indicator */}
            {activeCall.isEncrypted && (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                <Shield className="h-3 w-3 mr-1" />
                {t('encrypted')}
              </Badge>
            )}

            {/* Quality indicator */}
            <div className={cn('w-2 h-2 rounded-full', getQualityColor())} />

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleMinimize}
            >
              <Minimize2 className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={switchCamera}>
                  <FlipHorizontal className="h-4 w-4 mr-2" />
                  {t('switchCamera')}
                </DropdownMenuItem>
                {/* Popout to separate window (Tauri desktop only) */}
                {isTauri() && !isPopout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handlePopoutCall}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {t('popOutCall', 'Pop out call')}
                    </DropdownMenuItem>
                  </>
                )}
                {/* Always on top toggle (only in popout mode) */}
                {isPopout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleToggleAlwaysOnTop}>
                      <Shield className="h-4 w-4 mr-2" />
                      {isAlwaysOnTop ? t('disableAlwaysOnTop', 'Disable always on top') : t('enableAlwaysOnTop', 'Enable always on top')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="flex items-center justify-center gap-4">
          {/* Mute */}
          <Button
            variant={activeCall.isMuted ? 'destructive' : 'secondary'}
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={toggleMute}
          >
            {activeCall.isMuted ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>

          {/* Video toggle (for video calls) */}
          {isVideoCall && (
            <Button
              variant={!activeCall.isVideoEnabled ? 'destructive' : 'secondary'}
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={toggleVideo}
            >
              {activeCall.isVideoEnabled ? (
                <Video className="h-6 w-6" />
              ) : (
                <VideoOff className="h-6 w-6" />
              )}
            </Button>
          )}

          {/* Screen share */}
          <Button
            variant={activeCall.isScreenSharing ? 'default' : 'secondary'}
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={activeCall.isScreenSharing ? stopScreenShare : startScreenShare}
          >
            {activeCall.isScreenSharing ? (
              <MonitorOff className="h-6 w-6" />
            ) : (
              <Monitor className="h-6 w-6" />
            )}
          </Button>

          {/* End call */}
          <Button
            variant="destructive"
            size="icon"
            className="h-16 w-16 rounded-full"
            onClick={() => endCall(HangupReason.Completed)}
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
        </div>
      </div>
    </div>
  );
}
