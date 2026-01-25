import { FC } from 'react';
import { EmojiPicker as FrimousseEmojiPicker } from 'frimousse';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  triggerButton?: React.ReactNode;
  className?: string;
}

/**
 * Privacy-Safe Emoji Picker using Frimousse
 *
 * Features:
 * - No external API calls
 * - Locally cached emoji data
 * - Native emoji rendering
 * - Composable and lightweight
 */
export const EmojiPicker: FC<EmojiPickerProps> = ({
  onEmojiSelect,
  triggerButton,
  className = '',
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {triggerButton || (
          <Button variant="ghost" size="icon" className={className}>
            <Smile className="h-5 w-5" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[352px] p-0" align="start" sideOffset={5}>
        <FrimousseEmojiPicker.Root
          className="flex flex-col w-full"
          onEmojiSelect={(emoji) => onEmojiSelect(emoji.emoji)}
        >
          <div className="p-2 border-b border-border">
            <FrimousseEmojiPicker.Search
              placeholder="Search emoji..."
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
            />
          </div>
          <FrimousseEmojiPicker.Viewport className="h-[300px] p-2">
            <FrimousseEmojiPicker.Loading>
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Loading emojis...
              </div>
            </FrimousseEmojiPicker.Loading>
            <FrimousseEmojiPicker.Empty>
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No emoji found.
              </div>
            </FrimousseEmojiPicker.Empty>
            <FrimousseEmojiPicker.List />
          </FrimousseEmojiPicker.Viewport>
        </FrimousseEmojiPicker.Root>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Inline Emoji Picker (for message composer)
 */
export const InlineEmojiPicker: FC<{
  onEmojiSelect: (emoji: string) => void;
  position?: { top: number; left: number };
  onClose?: () => void;
}> = ({ onEmojiSelect, position, onClose }) => {
  return (
    <div
      className="absolute z-50 bg-popover border border-border rounded-lg shadow-lg w-[352px]"
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      <FrimousseEmojiPicker.Root
        className="flex flex-col w-full"
        onEmojiSelect={(emoji) => {
          onEmojiSelect(emoji.emoji);
          onClose?.();
        }}
      >
        <div className="p-2 border-b border-border">
          <FrimousseEmojiPicker.Search
            placeholder="Search emoji..."
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
          />
        </div>
        <FrimousseEmojiPicker.Viewport className="h-[250px] p-2">
          <FrimousseEmojiPicker.Loading>
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Loading...
            </div>
          </FrimousseEmojiPicker.Loading>
          <FrimousseEmojiPicker.Empty>
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No emoji found.
            </div>
          </FrimousseEmojiPicker.Empty>
          <FrimousseEmojiPicker.List />
        </FrimousseEmojiPicker.Viewport>
      </FrimousseEmojiPicker.Root>
    </div>
  );
};

/**
 * Emoji shortcode parser
 * Converts :emoji_name: to actual emoji
 */
export function parseEmojiShortcodes(text: string): string {
  // Common emoji shortcodes mapping
  const shortcodes: Record<string, string> = {
    ':smile:': '😊',
    ':laughing:': '😆',
    ':heart:': '❤️',
    ':fire:': '🔥',
    ':rocket:': '🚀',
    ':thumbsup:': '👍',
    ':thumbsdown:': '👎',
    ':wave:': '👋',
    ':raised_hands:': '🙌',
    ':clap:': '👏',
    ':eyes:': '👀',
    ':thinking:': '🤔',
    ':tada:': '🎉',
    ':sparkles:': '✨',
    ':star:': '⭐',
  };

  let result = text;
  for (const [code, emoji] of Object.entries(shortcodes)) {
    result = result.replace(new RegExp(code, 'g'), emoji);
  }
  return result;
}

/**
 * Extract emojis from text
 */
export function extractEmojis(text: string): string[] {
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  return text.match(emojiRegex) || [];
}

/**
 * Count emojis in text
 */
export function countEmojis(text: string): number {
  return extractEmojis(text).length;
}
