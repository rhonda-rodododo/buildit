/**
 * ConversationsPage
 * Main messaging page showing all conversations
 */

import { FC, useEffect, useState } from 'react';
import { Plus, Search, Archive, Pin } from 'lucide-react';
import { useConversationsStore } from '../conversationsStore';
import { useFriendsStore } from '@/core/friends/friendsStore';
import { BuddylistSidebar } from './BuddylistSidebar';
import { ChatWindowContainer } from './ChatWindowContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getCurrentTime } from '@/lib/utils';

export const ConversationsPage: FC = () => {
  const {
    getConversations,
    getConversationStats,
    loadConversations,
    openChatWindow,
    getPresence,
  } = useConversationsStore();

  const { loadFriends } = useFriendsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');

  useEffect(() => {
    loadConversations();
    loadFriends();
  }, [loadConversations, loadFriends]);

  const stats = getConversationStats();

  // Get conversations based on selected tab
  const getFilteredConversations = () => {
    switch (selectedTab) {
      case 'dms':
        return getConversations({ type: ['dm'], isArchived: false });
      case 'groups':
        return getConversations({ type: ['group-chat', 'multi-party'], isArchived: false });
      case 'unread':
        return getConversations({ hasUnread: true, isArchived: false });
      case 'archived':
        return getConversations({ isArchived: true });
      default:
        return getConversations({ isArchived: false });
    }
  };

  const conversations = getFilteredConversations();

  const filteredConversations = searchQuery
    ? conversations.filter((c) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  // Capture time once on mount to avoid impure Date.now() during render
  const [now] = useState(getCurrentTime);

  const formatTimestamp = (timestamp: number) => {
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  };

  return (
    <div className="flex h-full">
      {/* Desktop: Buddylist Sidebar */}
      <div className="hidden lg:block w-80 border-r border-border">
        <BuddylistSidebar />
      </div>

      {/* Main Conversations List */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Messages</h1>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9"
              data-testid="search-conversations"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-4">
            <TabsTrigger value="all">
              All
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {stats.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="dms">
              DMs
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {stats.dms}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="groups">
              Groups
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {stats.groupChats + stats.multiParty}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {stats.unread > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                  {stats.unread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived">
              <Archive className="h-4 w-4 mr-2" />
              Archived
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="flex-1 m-0">
            <ScrollArea className="h-full">
              <div className="divide-y divide-border">
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <p className="text-muted-foreground mb-2">No conversations yet</p>
                    <p className="text-sm text-muted-foreground">
                      Start a new conversation to get started
                    </p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const otherParticipant =
                      conversation.type === 'dm' ? conversation.participants[0] : null;
                    const presence = otherParticipant ? getPresence(otherParticipant) : undefined;

                    const displayName = conversation.name || 'Conversation';

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => openChatWindow(conversation.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left',
                          conversation.unreadCount > 0 && 'bg-muted/30'
                        )}
                        data-testid={`conversation-item-${displayName.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <Avatar className="h-12 w-12">
                            <div className="w-full h-full bg-primary/10 flex items-center justify-center text-lg font-medium">
                              {displayName[0].toUpperCase()}
                            </div>
                          </Avatar>
                          {presence?.status === 'online' && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {conversation.isPinned && (
                              <Pin className="h-3 w-3 text-primary shrink-0" data-testid="pinned-indicator" />
                            )}
                            <p className="font-medium truncate flex-1">{displayName}</p>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatTimestamp(conversation.lastMessageAt)}
                            </span>
                          </div>
                          <p
                            className={cn(
                              'text-sm truncate',
                              conversation.unreadCount > 0
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground'
                            )}
                          >
                            {conversation.lastMessagePreview || 'No messages yet'}
                          </p>
                        </div>

                        {/* Unread badge */}
                        {conversation.unreadCount > 0 && (
                          <Badge variant="destructive" className="shrink-0" data-testid="unread-badge">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: Chat Windows */}
      <ChatWindowContainer />
    </div>
  );
};
