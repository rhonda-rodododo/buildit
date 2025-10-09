/**
 * BuddylistSidebar
 * Shows organized contact list with online presence (Discord style)
 */

import { FC, useState } from 'react';
import { Search, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { useFriendsStore } from '@/core/friends/friendsStore';
import { useConversationsStore } from '../conversationsStore';
import { BuddylistItem } from './BuddylistItem';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BuddylistSidebarProps {
  className?: string;
}

export const BuddylistSidebar: FC<BuddylistSidebarProps> = ({ className }) => {
  const { getFriends } = useFriendsStore();
  const { getPresence, openChatWindow, getDirectConversation, createConversation } =
    useConversationsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['favorites', 'online']));

  const friends = getFriends({ status: ['accepted'] });

  // Filter by search
  const filteredFriends = searchQuery
    ? friends.filter(
        (f) =>
          f.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : friends;

  // Organize into sections
  const favorites = filteredFriends.filter((f) => f.isFavorite);

  const onlineNow = filteredFriends.filter((f) => {
    const presence = getPresence(f.friendPubkey);
    return presence?.status === 'online';
  });

  // TODO: Group by primary group (simplified - in reality, users can be in multiple groups)
  // This would need integration with group store to show users by group

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleOpenChat = async (friendPubkey: string) => {
    // Check if DM conversation exists
    let conversation = getDirectConversation(friendPubkey);

    // Create conversation if it doesn't exist
    if (!conversation) {
      conversation = await createConversation('dm', [friendPubkey]);
    }

    // Open chat window
    openChatWindow(conversation.id);
  };

  const SectionHeader: FC<{
    id: string;
    title: string;
    count: number;
  }> = ({ id, title, count }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors rounded-md"
    >
      {expandedGroups.has(id) ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1 text-left">
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );

  return (
    <div className={cn('flex flex-col h-full bg-card border-r border-border', className)} data-testid="buddylist-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Messages</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="pl-9 h-9"
            data-testid="buddylist-search"
          />
        </div>
      </div>

      {/* Contact List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Favorites Section */}
          {favorites.length > 0 && (
            <div>
              <SectionHeader id="favorites" title="Favorites" count={favorites.length} />
              {expandedGroups.has('favorites') && (
                <div className="space-y-0.5 mt-1" data-testid="section-favorites">
                  {favorites.map((friend) => (
                    <BuddylistItem
                      key={friend.id}
                      pubkey={friend.friendPubkey}
                      username={friend.username}
                      displayName={friend.displayName}
                      presence={getPresence(friend.friendPubkey)}
                      isFavorite={friend.isFavorite}
                      onClick={() => handleOpenChat(friend.friendPubkey)}
                      data-testid={`buddylist-item-${friend.username?.toLowerCase() || friend.friendPubkey.substring(0, 8)}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Online Now Section */}
          {onlineNow.length > 0 && (
            <div>
              <SectionHeader id="online" title="Online Now" count={onlineNow.length} />
              {expandedGroups.has('online') && (
                <div className="space-y-0.5 mt-1" data-testid="section-online">
                  {onlineNow
                    .filter((f) => !favorites.some((fav) => fav.id === f.id)) // Exclude favorites
                    .map((friend) => (
                      <BuddylistItem
                        key={friend.id}
                        pubkey={friend.friendPubkey}
                        username={friend.username}
                        displayName={friend.displayName}
                        presence={getPresence(friend.friendPubkey)}
                        onClick={() => handleOpenChat(friend.friendPubkey)}
                        data-testid={`buddylist-item-${friend.username?.toLowerCase() || friend.friendPubkey.substring(0, 8)}`}
                      />
                    ))}
                </div>
              )}
            </div>
          )}

          {/* All Contacts Section */}
          <div>
            <SectionHeader id="all" title="All Contacts" count={filteredFriends.length} />
            {expandedGroups.has('all') && (
              <div className="space-y-0.5 mt-1" data-testid="section-all-contacts">
                {filteredFriends
                  .filter(
                    (f) =>
                      !favorites.some((fav) => fav.id === f.id) &&
                      !onlineNow.some((on) => on.id === f.id)
                  ) // Exclude favorites and online
                  .map((friend) => (
                    <BuddylistItem
                      key={friend.id}
                      pubkey={friend.friendPubkey}
                      username={friend.username}
                      displayName={friend.displayName}
                      presence={getPresence(friend.friendPubkey)}
                      onClick={() => handleOpenChat(friend.friendPubkey)}
                      data-testid={`buddylist-item-${friend.username?.toLowerCase() || friend.friendPubkey.substring(0, 8)}`}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* New Conversation Button */}
      <div className="p-4 border-t border-border">
        <Button className="w-full" variant="outline" data-testid="new-chat-button">
          <MessageSquare className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>
    </div>
  );
};
