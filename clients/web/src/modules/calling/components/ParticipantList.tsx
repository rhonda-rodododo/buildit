/**
 * Participant List
 * Side panel showing all conference participants
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  X,
  MicOff,
  VideoOff,
  ScreenShare,
  MoreVertical,
  Hand,
  Crown,
  Shield,
  VolumeX,
  UserMinus,
  UserCog,
} from 'lucide-react';

interface Participant {
  pubkey: string;
  displayName?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing?: boolean;
  isLocal: boolean;
  role?: string;
  handRaised?: boolean;
}

interface ParticipantListProps {
  participants: Participant[];
  isHost: boolean;
  onClose: () => void;
  onRequestMute?: (pubkey: string) => void;
  onRemove?: (pubkey: string) => void;
  onPromote?: (pubkey: string, role: string) => void;
}

export function ParticipantList({
  participants,
  isHost,
  onClose,
  onRequestMute,
  onRemove,
  onPromote,
}: ParticipantListProps) {
  const { t } = useTranslation('calling');

  // Sort: hosts first, then by name
  const sortedParticipants = [...participants].sort((a, b) => {
    const roleOrder: Record<string, number> = { host: 0, co_host: 1, moderator: 2, participant: 3, viewer: 4 };
    const aOrder = roleOrder[a.role || 'participant'] ?? 3;
    const bOrder = roleOrder[b.role || 'participant'] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.displayName || a.pubkey).localeCompare(b.displayName || b.pubkey);
  });

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'host':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'co_host':
        return <Crown className="w-4 h-4 text-blue-500" />;
      case 'moderator':
        return <Shield className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getInitials = (name?: string, pubkey?: string): string => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return (pubkey || '??').slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (key: string): string => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
      'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
    ];
    const index = parseInt(key.slice(0, 8), 16) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-white font-medium">
          {t('participants')} ({participants.length})
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-white"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedParticipants.map((p) => (
            <div
              key={p.pubkey}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700/50"
            >
              {/* Avatar */}
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm',
                  getAvatarColor(p.pubkey)
                )}
              >
                {getInitials(p.displayName, p.pubkey)}
              </div>

              {/* Name and status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm truncate">
                    {p.displayName || p.pubkey.slice(0, 8)}
                    {p.isLocal && ' (You)'}
                  </span>
                  {getRoleIcon(p.role)}
                  {p.handRaised && <Hand className="w-4 h-4 text-yellow-500" />}
                </div>

                {/* Media status */}
                <div className="flex items-center gap-2 mt-0.5">
                  {!p.audioEnabled && (
                    <MicOff className="w-3 h-3 text-red-500" />
                  )}
                  {!p.videoEnabled && (
                    <VideoOff className="w-3 h-3 text-gray-400" />
                  )}
                  {p.screenSharing && (
                    <ScreenShare className="w-3 h-3 text-blue-400" />
                  )}
                </div>
              </div>

              {/* Actions */}
              {isHost && !p.isLocal && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-gray-400 hover:text-white"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {p.audioEnabled && onRequestMute && (
                      <DropdownMenuItem onClick={() => onRequestMute(p.pubkey)}>
                        <VolumeX className="w-4 h-4 mr-2" />
                        {t('requestMute')}
                      </DropdownMenuItem>
                    )}
                    {onPromote && (
                      <DropdownMenuItem onClick={() => onPromote(p.pubkey, 'co_host')}>
                        <UserCog className="w-4 h-4 mr-2" />
                        {t('makeCoHost')}
                      </DropdownMenuItem>
                    )}
                    {onRemove && (
                      <DropdownMenuItem
                        onClick={() => onRemove(p.pubkey)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <UserMinus className="w-4 h-4 mr-2" />
                        {t('remove')}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ParticipantList;
