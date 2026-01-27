/**
 * Participant Tile
 * Individual video/audio tile for a call participant
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MicOff,
  VideoOff,
  MoreVertical,
  VolumeX,
  UserMinus,
  Pin,
  PinOff,
} from 'lucide-react';

interface ParticipantTileProps {
  pubkey: string;
  displayName?: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
  isLarge?: boolean;
  isSmall?: boolean;
  isPinned?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  onRequestMute?: () => void;
  onRemove?: () => void;
}

export function ParticipantTile({
  pubkey,
  displayName,
  stream,
  audioEnabled,
  videoEnabled,
  isSpeaking,
  isLocal,
  isLarge = false,
  isSmall = false,
  isPinned = false,
  onPin,
  onUnpin,
  onRequestMute,
  onRemove,
}: ParticipantTileProps) {
  const { t } = useTranslation('calling');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(false);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Generate initials for avatar
  const getInitials = (name?: string): string => {
    if (!name) return pubkey.slice(0, 2).toUpperCase();
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Generate avatar background color from pubkey
  const getAvatarColor = (key: string): string => {
    const colors = [
      'bg-red-500',
      'bg-orange-500',
      'bg-amber-500',
      'bg-yellow-500',
      'bg-lime-500',
      'bg-green-500',
      'bg-emerald-500',
      'bg-teal-500',
      'bg-cyan-500',
      'bg-sky-500',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-violet-500',
      'bg-purple-500',
      'bg-fuchsia-500',
      'bg-pink-500',
    ];
    const index = parseInt(key.slice(0, 8), 16) % colors.length;
    return colors[index];
  };

  const hasVideo = videoEnabled && stream?.getVideoTracks().some((t) => t.enabled);

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden bg-gray-800',
        isSpeaking && 'ring-2 ring-green-500 ring-offset-2 ring-offset-gray-900',
        isLarge && 'h-full',
        isSmall && 'h-32',
        !isLarge && !isSmall && 'aspect-video'
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video or Avatar */}
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            'w-full h-full object-cover',
            isLocal && 'transform -scale-x-100' // Mirror local video
          )}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'flex items-center justify-center rounded-full text-white font-bold',
              getAvatarColor(pubkey),
              isLarge && 'w-32 h-32 text-4xl',
              isSmall && 'w-12 h-12 text-lg',
              !isLarge && !isSmall && 'w-20 h-20 text-2xl'
            )}
          >
            {getInitials(displayName)}
          </div>
        </div>
      )}

      {/* Audio indicator (hidden video element for audio-only) */}
      {!hasVideo && stream && (
        <audio
          ref={(el) => {
            if (el && stream) {
              el.srcObject = stream;
            }
          }}
          autoPlay
          muted={isLocal}
          className="hidden"
        />
      )}

      {/* Name and status overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div className="flex items-center gap-2">
          {/* Mute indicator */}
          {!audioEnabled && (
            <MicOff className="w-4 h-4 text-red-500" />
          )}

          {/* Video off indicator */}
          {!videoEnabled && (
            <VideoOff className="w-4 h-4 text-gray-400" />
          )}

          {/* Name */}
          <span className={cn(
            'text-white truncate',
            isSmall && 'text-xs',
            !isSmall && 'text-sm'
          )}>
            {displayName || pubkey.slice(0, 8)}
            {isLocal && ' (You)'}
          </span>

          {/* Pin indicator */}
          {isPinned && (
            <Pin className="w-3 h-3 text-blue-400" />
          )}
        </div>
      </div>

      {/* Speaking indicator ring animation */}
      {isSpeaking && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -inset-1 rounded-lg border-2 border-green-500 animate-pulse" />
        </div>
      )}

      {/* Hover controls */}
      {showControls && !isLocal && (onRequestMute || onRemove || onPin || onUnpin) && (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="w-8 h-8 bg-black/50 hover:bg-black/70"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onPin && !isPinned && (
                <DropdownMenuItem onClick={onPin}>
                  <Pin className="w-4 h-4 mr-2" />
                  {t('pin')}
                </DropdownMenuItem>
              )}
              {onUnpin && isPinned && (
                <DropdownMenuItem onClick={onUnpin}>
                  <PinOff className="w-4 h-4 mr-2" />
                  {t('unpin')}
                </DropdownMenuItem>
              )}
              {onRequestMute && audioEnabled && (
                <DropdownMenuItem onClick={onRequestMute}>
                  <VolumeX className="w-4 h-4 mr-2" />
                  {t('requestMute')}
                </DropdownMenuItem>
              )}
              {onRemove && (
                <DropdownMenuItem onClick={onRemove} className="text-red-500 focus:text-red-500">
                  <UserMinus className="w-4 h-4 mr-2" />
                  {t('remove')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

export default ParticipantTile;
