/**
 * Waiting Room Panel
 * Manage participants waiting to be admitted to conference
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Check, UserMinus, Users } from 'lucide-react';
import { createWaitingRoomManager, type WaitingRoomManager, type WaitingParticipant } from '../services/waitingRoomManager';

interface WaitingRoomPanelProps {
  roomId: string;
  onClose: () => void;
}

export function WaitingRoomPanel({ roomId, onClose }: WaitingRoomPanelProps) {
  const { t } = useTranslation('calling');
  const [manager] = useState<WaitingRoomManager>(() => createWaitingRoomManager(roomId));
  const [waitingList, setWaitingList] = useState<WaitingParticipant[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    const handleQueueUpdated = (queue: WaitingParticipant[]) => {
      setWaitingList(queue);
    };

    manager.on('queue-updated', handleQueueUpdated);
    setWaitingList(manager.getWaitingList());
    setIsEnabled(manager.isWaitingRoomEnabled());

    return () => {
      manager.off('queue-updated', handleQueueUpdated);
    };
  }, [manager]);

  const handleAdmit = async (pubkey: string) => {
    await manager.admitParticipant(pubkey);
  };

  const handleDeny = async (pubkey: string) => {
    await manager.denyParticipant(pubkey);
  };

  const handleAdmitAll = async () => {
    await manager.admitAll();
  };

  const handleToggleEnabled = () => {
    manager.setEnabled(!isEnabled);
    setIsEnabled(!isEnabled);
  };

  const formatWaitTime = (joinedAt: number): string => {
    const seconds = Math.floor((Date.now() - joinedAt) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
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
    ];
    const index = parseInt(key.slice(0, 8), 16) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" />
          <h3 className="text-white font-medium">
            {t('waitingRoom')} ({waitingList.length})
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-white"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Settings */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">
            {t('waitingRoomEnabled')}
          </span>
          <Button
            variant={isEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleEnabled}
          >
            {isEnabled ? t('enabled') : t('disabled')}
          </Button>
        </div>
      </div>

      {/* Admit all button */}
      {waitingList.length > 0 && (
        <div className="p-4 border-b border-gray-700">
          <Button
            className="w-full"
            onClick={handleAdmitAll}
          >
            <Check className="w-4 h-4 mr-2" />
            {t('admitAll')} ({waitingList.length})
          </Button>
        </div>
      )}

      {/* Waiting list */}
      <ScrollArea className="flex-1">
        {waitingList.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {t('noOneWaiting')}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {waitingList.map((p) => (
              <div
                key={p.pubkey}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50"
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

                {/* Name and wait time */}
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm truncate block">
                    {p.displayName || p.pubkey.slice(0, 8)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {t('waiting')} {formatWaitTime(p.joinedAt)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => handleAdmit(p.pubkey)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => handleDeny(p.pubkey)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default WaitingRoomPanel;
