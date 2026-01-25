/**
 * Speak as Group Toggle
 * Allows admins to switch between personal and group identity
 */

import { Users, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useGroupEntityStore } from '../groupEntityStore';

interface SpeakAsGroupToggleProps {
  groupId: string;
  disabled?: boolean;
}

export function SpeakAsGroupToggle({ groupId, disabled }: SpeakAsGroupToggleProps) {
  const { getSpeakAsMode, toggleSpeakAs } = useGroupEntityStore();
  const mode = getSpeakAsMode(groupId);

  const handleToggle = () => {
    toggleSpeakAs(groupId);
  };

  const isGroupMode = mode === 'group';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isGroupMode ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggle}
            disabled={disabled}
            className="gap-2"
          >
            {isGroupMode ? (
              <>
                <Users className="h-4 w-4" />
                <span>Speak as Group</span>
              </>
            ) : (
              <>
                <User className="h-4 w-4" />
                <span>Speak as Self</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isGroupMode
              ? 'Messages will be sent as the group entity'
              : 'Messages will be sent as your personal identity'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
