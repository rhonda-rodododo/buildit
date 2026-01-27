/**
 * Reactions Overlay
 * Floating emoji reactions animation overlay
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Reaction {
  id: string;
  pubkey: string;
  emoji: string;
  x: number; // percentage from left
  y: number; // percentage from top
}

interface ReactionsOverlayProps {
  reactions: Reaction[];
}

export function ReactionsOverlay({ reactions }: ReactionsOverlayProps) {
  const [animatingReactions, setAnimatingReactions] = useState<Map<string, boolean>>(new Map());

  // Track animation state for each reaction
  useEffect(() => {
    reactions.forEach((r) => {
      if (!animatingReactions.has(r.id)) {
        setAnimatingReactions((prev) => new Map(prev).set(r.id, true));

        // Remove after animation
        setTimeout(() => {
          setAnimatingReactions((prev) => {
            const next = new Map(prev);
            next.delete(r.id);
            return next;
          });
        }, 3000);
      }
    });
  }, [reactions, animatingReactions]);

  if (reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className={cn(
            'absolute text-4xl',
            'animate-reaction-float'
          )}
          style={{
            left: `${reaction.x}%`,
            top: `${reaction.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {reaction.emoji}
        </div>
      ))}

      {/* CSS for reaction animation */}
      <style>{`
        @keyframes reaction-float {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.5);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
          }
          40% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -150%) scale(1);
          }
        }
        .animate-reaction-float {
          animation: reaction-float 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default ReactionsOverlay;
