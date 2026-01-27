/**
 * Reactions Picker
 * Emoji picker for sending reactions in calls
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SUPPORTED_REACTIONS } from '../services/reactionManager';

interface ReactionsPickerProps {
  onSelect: (emoji: string) => void;
}

export function ReactionsPicker({ onSelect }: ReactionsPickerProps) {
  const { t } = useTranslation('calling');

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-center mb-4">
        {t('sendReaction')}
      </h3>
      <div className="flex flex-wrap justify-center gap-3">
        {SUPPORTED_REACTIONS.map((emoji) => (
          <Button
            key={emoji}
            variant="ghost"
            size="lg"
            className="text-3xl hover:bg-gray-100 dark:hover:bg-gray-800 w-14 h-14 p-0"
            onClick={() => onSelect(emoji)}
          >
            {emoji}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default ReactionsPicker;
