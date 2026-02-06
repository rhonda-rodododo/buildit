/**
 * ContactsPage Component
 * Main page for managing friends and contacts
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Search, Users, Inbox, Archive, MessageSquare, Shield, Star, CheckCircle } from 'lucide-react';
import { useFriendsStore } from '../friendsStore';
import { useMessagingStore } from '@/stores/messagingStore';
import { useGroupsStore } from '@/stores/groupsStore';
import { ContactCard } from './ContactCard';
import { FriendRequestCard } from './FriendRequestCard';
import { AddFriendDialog } from './AddFriendDialog';
import type { DBFriend, FriendStatus, TrustTier, FriendFilter } from '../types';
import { toast } from 'sonner';

export function ContactsPage() {
  const { t } = useTranslation();
  const {
    loadFriends,
    getFriends,
    getIncomingRequests,
    getOutgoingRequests,
    getFriendStats,
  } = useFriendsStore();

  const { setActiveConversation, addConversation, conversations } = useMessagingStore();
  const { groups } = useGroupsStore();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus] = useState<FriendStatus[]>(['accepted']);
  const [filterTrustTier, setFilterTrustTier] = useState<TrustTier[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  // Message dialog state
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageFriend, setMessageFriend] = useState<DBFriend | null>(null);
  const [messageText, setMessageText] = useState('');

  // Profile dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileFriend, setProfileFriend] = useState<DBFriend | null>(null);

  // Load friends on mount
  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // Get filtered friends
  const filter: FriendFilter = {
    status: filterStatus,
    trustTiers: filterTrustTier.length > 0 ? filterTrustTier : undefined,
    favorites: showFavorites ? true : undefined,
    searchQuery: searchQuery || undefined,
    sortBy: 'recent',
  };

  const handleOpenMessage = useCallback((friend: DBFriend) => {
    setMessageFriend(friend);
    setMessageText('');
    setMessageDialogOpen(true);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!messageFriend || !messageText.trim()) return;

    // Find or create conversation for this friend
    const existingConversation = conversations.find(
      (conv) => conv.participants.includes(messageFriend.friendPubkey)
    );

    if (existingConversation) {
      setActiveConversation(existingConversation.id);
    } else {
      // Create a new conversation
      const newConversation = {
        id: `dm-${messageFriend.friendPubkey}-${Date.now()}`,
        participants: [messageFriend.friendPubkey],
        type: 'dm' as const,
        createdAt: Date.now(),
        unreadCount: 0,
        displayName: messageFriend.displayName || messageFriend.username || messageFriend.friendPubkey.slice(0, 8),
      };
      addConversation(newConversation);
      setActiveConversation(newConversation.id);
    }

    toast.success(t('friends.messageSent', 'Message conversation opened'));
    setMessageDialogOpen(false);
    setMessageText('');
  }, [messageFriend, messageText, conversations, setActiveConversation, addConversation, t]);

  const handleOpenProfile = useCallback((friend: DBFriend) => {
    setProfileFriend(friend);
    setProfileDialogOpen(true);
  }, []);

  // Get shared groups for a friend
  const getSharedGroups = useCallback((friendPubkey: string) => {
    return groups.filter((group) =>
      group.adminPubkeys.includes(friendPubkey)
    );
  }, [groups]);

  const filteredFriends = getFriends(filter);
  const incomingRequests = getIncomingRequests();
  const outgoingRequests = getOutgoingRequests();
  const stats = getFriendStats();

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('friends.title')}</h1>
          <p className="text-muted-foreground">
            {t('friends.subtitle')}
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} data-testid="add-friend-button">
          <UserPlus className="mr-2 h-4 w-4" />
          {t('friends.addFriend')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="friends-stats">
        <div className="p-4 rounded-lg border bg-card" data-testid="stat-friends">
          <div className="text-2xl font-bold">{stats.accepted}</div>
          <div className="text-sm text-muted-foreground">{t('friends.friends')}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card" data-testid="stat-verified">
          <div className="text-2xl font-bold">{stats.verified}</div>
          <div className="text-sm text-muted-foreground">{t('friends.verified')}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card" data-testid="stat-favorites">
          <div className="text-2xl font-bold">{stats.favorites}</div>
          <div className="text-sm text-muted-foreground">{t('friends.favorites')}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card" data-testid="stat-pending">
          <div className="text-2xl font-bold">{incomingRequests.length}</div>
          <div className="text-sm text-muted-foreground">{t('friends.pendingRequests')}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('friends.searchFriends')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="search-friends-input"
          />
        </div>

        <Select
          value={filterTrustTier[0] || 'all'}
          onValueChange={(value) =>
            setFilterTrustTier(value === 'all' ? [] : [value as TrustTier])
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('friends.trustLevel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('friends.allTrustLevels')}</SelectItem>
            <SelectItem value="friend">{t('friends.friend')}</SelectItem>
            <SelectItem value="verified">{t('friends.verified')}</SelectItem>
            <SelectItem value="trusted">{t('friends.trusted')}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={showFavorites ? 'default' : 'outline'}
          onClick={() => setShowFavorites(!showFavorites)}
          data-testid="filter-favorites-button"
        >
          <Archive className="mr-2 h-4 w-4" />
          {t('friends.favorites')}
        </Button>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            <Users className="mr-2 h-4 w-4" />
            {t('friends.allFriends')}
            <Badge variant="secondary" className="ml-2">
              {stats.accepted}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Inbox className="mr-2 h-4 w-4" />
            {t('friends.requests')}
            {incomingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {incomingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* All Friends Tab */}
        <TabsContent value="all" className="space-y-4 mt-6">
          {filteredFriends.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('friends.noFriendsFound')}</p>
              <p className="text-sm">{t('friends.noFriendsHint')}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredFriends.map((friend) => (
                <ContactCard
                  key={friend.id}
                  friend={friend}
                  onMessage={() => handleOpenMessage(friend)}
                  onViewProfile={() => handleOpenProfile(friend)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-6 mt-6">
          {/* Incoming Requests */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t('friends.incomingRequests')}</h2>
              <Badge variant="secondary">{incomingRequests.length}</Badge>
            </div>

            {incomingRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('friends.noIncomingRequests')}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {incomingRequests.map((request) => (
                  <FriendRequestCard key={request.id} request={request} type="incoming" />
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t('friends.sentRequests')}</h2>
              <Badge variant="secondary">{outgoingRequests.length}</Badge>
            </div>

            {outgoingRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t('friends.noSentRequests')}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {outgoingRequests.map((request) => (
                  <FriendRequestCard key={request.id} request={request} type="outgoing" />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Friend Dialog */}
      <AddFriendDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('friends.messageDialog.title', 'Send Message')}
              </div>
            </DialogTitle>
            <DialogDescription>
              {t('friends.messageDialog.description', 'Start a conversation with {{name}}', {
                name: messageFriend?.displayName || messageFriend?.username || messageFriend?.friendPubkey.slice(0, 8),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('friends.messageDialog.messageLabel', 'Message')}</Label>
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={t('friends.messageDialog.messagePlaceholder', 'Type your message...')}
                rows={4}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSendMessage();
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {t('friends.messageDialog.hint', 'Press Ctrl+Enter to send')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSendMessage} disabled={!messageText.trim()}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('friends.messageDialog.send', 'Open Conversation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile View Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('friends.profileDialog.title', 'Contact Profile')}</DialogTitle>
          </DialogHeader>
          {profileFriend && (
            <div className="space-y-6 py-4">
              {/* Avatar and basic info */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {(profileFriend.displayName || profileFriend.username || 'U').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {profileFriend.displayName || profileFriend.username || profileFriend.friendPubkey.slice(0, 12)}
                  </h3>
                  {profileFriend.username && (
                    <p className="text-sm text-muted-foreground">@{profileFriend.username}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={profileFriend.trustTier === 'trusted' ? 'default' : 'outline'}>
                      <Shield className="h-3 w-3 mr-1" />
                      {t(`friends.trustTier.${profileFriend.trustTier}`, profileFriend.trustTier)}
                    </Badge>
                    {profileFriend.verifiedInPerson && (
                      <Badge variant="secondary">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('friends.verifiedInPerson', 'Verified')}
                      </Badge>
                    )}
                    {profileFriend.isFavorite && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Details */}
              <Card className="p-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">{t('friends.profileDialog.pubkey', 'Public Key')}</Label>
                  <p className="text-sm font-mono break-all">{profileFriend.friendPubkey}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('friends.profileDialog.addedAt', 'Added')}</Label>
                  <p className="text-sm">{new Date(profileFriend.addedAt).toLocaleDateString()}</p>
                </div>
                {profileFriend.tags.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('friends.profileDialog.tags', 'Tags')}</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profileFriend.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {profileFriend.notes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('friends.profileDialog.notes', 'Notes')}</Label>
                    <p className="text-sm">{profileFriend.notes}</p>
                  </div>
                )}
              </Card>

              {/* Shared Groups */}
              {(() => {
                const sharedGroups = getSharedGroups(profileFriend.friendPubkey);
                if (sharedGroups.length === 0) return null;
                return (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('friends.profileDialog.sharedGroups', 'Shared Groups')}</Label>
                    <div className="mt-1 space-y-1">
                      {sharedGroups.map((group) => (
                        <Card key={group.id} className="p-2 flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{group.name}</span>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>
              {t('common.close', 'Close')}
            </Button>
            <Button onClick={() => {
              if (profileFriend) {
                handleOpenMessage(profileFriend);
                setProfileDialogOpen(false);
              }
            }}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('friends.profileDialog.sendMessage', 'Send Message')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
