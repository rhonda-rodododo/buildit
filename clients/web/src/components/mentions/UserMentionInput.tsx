import { FC, useState, useRef, useMemo, KeyboardEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { MentionService, type MentionableUser } from '@/lib/autocomplete/mentionService';
import { UserAutocompleteDropdown } from './UserAutocompleteDropdown';

interface UserMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  groupId?: string;
  className?: string;
  rows?: number;
}

export const UserMentionInput: FC<UserMentionInputProps> = ({
  value,
  onChange,
  placeholder,
  groupId,
  className,
  rows = 3,
}) => {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(-1);

  // Derive suggestions from query - no state needed since it's computed
  const suggestions = useMemo(
    () => MentionService.searchUsers(autocompleteQuery, groupId),
    [autocompleteQuery, groupId]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;

    onChange(newValue);

    // Check if we're typing an @mention
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setAutocompleteQuery(query);
      setSelectedIndex(0); // Reset selection when query changes
      mentionStartRef.current = cursorPosition - query.length - 1;

      // Calculate position for dropdown
      const textarea = textareaRef.current;
      if (textarea) {
        const { top, left } = textarea.getBoundingClientRect();
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        setAutocompletePosition({
          top: top + lineHeight,
          left: left,
        });
      }

      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
      mentionStartRef.current = -1;
    }
  };

  const insertMention = (user: MentionableUser) => {
    if (mentionStartRef.current === -1) return;

    const before = value.slice(0, mentionStartRef.current);
    const after = value.slice(textareaRef.current?.selectionStart || 0);
    const mention = `@${user.displayName} `;

    const newValue = before + mention + after;
    onChange(newValue);

    // Set cursor position after mention
    setTimeout(() => {
      const newCursorPosition = before.length + mention.length;
      textareaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      textareaRef.current?.focus();
    }, 0);

    setShowAutocomplete(false);
    mentionStartRef.current = -1;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
      case 'Tab':
        if (showAutocomplete) {
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowAutocomplete(false);
        break;
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={rows}
      />
      {showAutocomplete && suggestions.length > 0 && (
        <UserAutocompleteDropdown
          users={suggestions}
          selectedIndex={selectedIndex}
          onSelect={insertMention}
          position={autocompletePosition}
        />
      )}
    </div>
  );
};
