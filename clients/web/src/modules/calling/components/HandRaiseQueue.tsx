/**
 * Hand Raise Queue
 * Shows participants who have raised their hands in FIFO order
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hand, X, ChevronDown } from 'lucide-react';

interface Participant {
  pubkey: string;
  displayName?: string;
}

interface HandRaiseQueueProps {
  raisedHands: Map<string, number>; // pubkey -> timestamp
  participants: Participant[];
  isHost: boolean;
  onLowerHand: (pubkey: string) => void;
  onLowerAllHands?: () => void;
}

export function HandRaiseQueue({
  raisedHands,
  participants,
  isHost,
  onLowerHand,
  onLowerAllHands,
}: HandRaiseQueueProps) {
  const { t } = useTranslation('calling');

  // Sort by timestamp (FIFO)
  const sortedHands = Array.from(raisedHands.entries())
    .sort(([, a], [, b]) => a - b)
    .map(([pubkey, timestamp], index) => ({
      pubkey,
      timestamp,
      position: index + 1,
      participant: participants.find((p) => p.pubkey === pubkey),
    }));

  if (sortedHands.length === 0) return null;

  const formatWaitTime = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <Card className="bg-gray-800/90 border-gray-700 w-64">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <Hand className="w-4 h-4 text-yellow-500" />
            {t('raisedHands')} ({sortedHands.length})
          </CardTitle>
          {isHost && sortedHands.length > 1 && onLowerAllHands && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-gray-400 hover:text-white"
              onClick={onLowerAllHands}
            >
              <ChevronDown className="w-3 h-3 mr-1" />
              {t('lowerAll')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <ScrollArea className="max-h-48">
          <div className="space-y-1">
            {sortedHands.map(({ pubkey, timestamp, position, participant }) => (
              <div
                key={pubkey}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50"
              >
                {/* Position badge */}
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    position === 1 ? 'bg-yellow-500 text-yellow-900' : 'bg-gray-600 text-gray-300'
                  )}
                >
                  {position}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm truncate block">
                    {participant?.displayName || pubkey.slice(0, 8)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {formatWaitTime(timestamp)}
                  </span>
                </div>

                {/* Lower hand button (host only) */}
                {isHost && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-gray-400 hover:text-white"
                    onClick={() => onLowerHand(pubkey)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default HandRaiseQueue;
