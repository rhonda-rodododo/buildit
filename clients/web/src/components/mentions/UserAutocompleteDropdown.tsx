import { FC } from 'react';
import { Card } from '@/components/ui/card';
import type { MentionableUser } from '@/lib/autocomplete/mentionService';

interface UserAutocompleteDropdownProps {
  users: MentionableUser[];
  selectedIndex: number;
  onSelect: (user: MentionableUser) => void;
  position: { top: number; left: number };
}

export const UserAutocompleteDropdown: FC<UserAutocompleteDropdownProps> = ({
  users,
  selectedIndex,
  onSelect,
  position,
}) => {
  return (
    <Card
      className="absolute z-50 w-64 max-h-60 overflow-y-auto"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="p-1">
        {users.map((user, index) => (
          <button
            key={user.id}
            onClick={() => onSelect(user)}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm
              transition-colors cursor-pointer
              ${index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}
            `}
          >
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.pubkey}`}
              alt={user.displayName}
              className="w-8 h-8 rounded-full bg-muted flex-shrink-0"
            />
            <div className="flex-1 min-w-0 text-left">
              <div className="font-medium truncate">{user.displayName}</div>
              {user.nip05 && (
                <div className="text-xs text-muted-foreground truncate">{user.nip05}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
};
