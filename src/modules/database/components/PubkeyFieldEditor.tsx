/**
 * Pubkey Field Editor
 * Select a Nostr pubkey from group members, friends, or enter manually
 */

import { useState, useMemo } from 'react';
import { useFriendsStore } from '@/modules/friends/friendsStore';
import { useGroupsStore } from '@/stores/groupsStore';
import { useContactsStore } from '@/stores/contactsStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Users, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface PubkeyFieldEditorProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  groupId?: string;
  source?: 'group_members' | 'friends' | 'any';
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface UserOption {
  pubkey: string;
  displayName: string;
  username?: string;
  picture?: string;
  source: 'group' | 'friend' | 'contact';
}

export function PubkeyFieldEditor({
  value,
  onChange,
  groupId,
  source = 'any',
  disabled,
  placeholder,
  className,
}: PubkeyFieldEditorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualEntry, setManualEntry] = useState('');

  // Get friends from store
  const friends = useFriendsStore((s) => s.friends);

  // Get group members from the store
  const groupMembers = useGroupsStore((s) =>
    groupId ? s.groupMembers.get(groupId) : undefined
  );

  // Get profile metadata from contacts store
  const profiles = useContactsStore((s) => s.profiles);

  // Build list of available users
  const availableUsers = useMemo(() => {
    const users: UserOption[] = [];
    const seenPubkeys = new Set<string>();

    // Add group members
    if ((source === 'group_members' || source === 'any') && groupMembers) {
      for (const member of groupMembers) {
        if (!seenPubkeys.has(member.pubkey)) {
          const profile = profiles.get(member.pubkey);
          users.push({
            pubkey: member.pubkey,
            displayName: profile?.name || profile?.display_name || member.pubkey.slice(0, 8),
            username: profile?.nip05,
            picture: profile?.picture,
            source: 'group',
          });
          seenPubkeys.add(member.pubkey);
        }
      }
    }

    // Add friends
    if ((source === 'friends' || source === 'any') && friends) {
      for (const friend of friends.values()) {
        if (!seenPubkeys.has(friend.friendPubkey)) {
          const profile = profiles.get(friend.friendPubkey);
          users.push({
            pubkey: friend.friendPubkey,
            displayName: friend.displayName || profile?.name || friend.friendPubkey.slice(0, 8),
            username: profile?.nip05,
            picture: profile?.picture,
            source: 'friend',
          });
          seenPubkeys.add(friend.friendPubkey);
        }
      }
    }

    return users;
  }, [source, groupMembers, friends, profiles]);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!search) return availableUsers;
    const lower = search.toLowerCase();
    return availableUsers.filter(
      (user) =>
        user.displayName.toLowerCase().includes(lower) ||
        user.username?.toLowerCase().includes(lower) ||
        user.pubkey.toLowerCase().includes(lower)
    );
  }, [availableUsers, search]);

  // Get selected user info
  const selectedUser = useMemo(() => {
    if (!value) return null;
    const found = availableUsers.find((u) => u.pubkey === value);
    if (found) return found;
    // If not found in lists, use pubkey directly
    const profile = profiles.get(value);
    return {
      pubkey: value,
      displayName: profile?.name || value.slice(0, 8),
      username: profile?.nip05,
      picture: profile?.picture,
      source: 'contact' as const,
    };
  }, [value, availableUsers, profiles]);

  const handleSelect = (pubkey: string) => {
    onChange(pubkey);
    setOpen(false);
    setSearch('');
  };

  const handleManualSubmit = () => {
    if (manualEntry.trim()) {
      // Basic validation - pubkey should be 64 hex chars
      const cleaned = manualEntry.trim().replace(/^npub1/, '');
      if (/^[0-9a-f]{64}$/i.test(cleaned)) {
        onChange(cleaned);
        setOpen(false);
        setManualEntry('');
      }
    }
  };

  const handleClear = () => {
    onChange(null);
  };

  if (disabled) {
    return (
      <div className={cn('text-sm', className)}>
        {selectedUser ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={selectedUser.picture} />
              <AvatarFallback>
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span>{selectedUser.displayName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground italic">
            {t('common.notSet', 'Not set')}
          </span>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          {selectedUser ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedUser.picture} />
                <AvatarFallback>
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedUser.displayName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              {placeholder || t('common.selectUser', 'Select user...')}
            </span>
          )}
          {value && (
            <X
              className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        {/* Search input */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder={t('common.searchUsers', 'Search users...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0"
          />
        </div>

        {/* User list */}
        <ScrollArea className="h-[200px]">
          {filteredUsers.length > 0 ? (
            <div className="p-1">
              {filteredUsers.map((user) => (
                <button
                  key={user.pubkey}
                  onClick={() => handleSelect(user.pubkey)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    value === user.pubkey && 'bg-accent'
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.picture} />
                    <AvatarFallback>
                      {user.source === 'group' ? (
                        <Users className="h-3 w-3" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{user.displayName}</div>
                    {user.username && (
                      <div className="text-xs text-muted-foreground">
                        {user.username}
                      </div>
                    )}
                  </div>
                  {value === user.pubkey && (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('common.noUsersFound', 'No users found')}
            </div>
          )}
        </ScrollArea>

        {/* Manual entry */}
        {source === 'any' && (
          <div className="border-t p-2">
            <div className="text-xs text-muted-foreground mb-1">
              {t('common.orEnterPubkey', 'Or enter pubkey manually:')}
            </div>
            <div className="flex gap-1">
              <Input
                placeholder="npub1... or hex"
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)}
                className="text-xs"
              />
              <Button size="sm" onClick={handleManualSubmit}>
                {t('common.add', 'Add')}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default PubkeyFieldEditor;
