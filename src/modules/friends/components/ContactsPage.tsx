/**
 * ContactsPage Component
 * Main page for managing friends and contacts
 */

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { UserPlus, Search, Users, Inbox, Archive } from 'lucide-react';
import { useFriendsStore } from '../friendsStore';
import { ContactCard } from './ContactCard';
import { FriendRequestCard } from './FriendRequestCard';
import { AddFriendDialog } from './AddFriendDialog';
import type { FriendStatus, TrustTier, FriendFilter } from '../types';

export function ContactsPage() {
  const {
    loadFriends,
    getFriends,
    getIncomingRequests,
    getOutgoingRequests,
    getFriendStats,
  } = useFriendsStore();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus] = useState<FriendStatus[]>(['accepted']);
  const [filterTrustTier, setFilterTrustTier] = useState<TrustTier[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

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

  const filteredFriends = getFriends(filter);
  const incomingRequests = getIncomingRequests();
  const outgoingRequests = getOutgoingRequests();
  const stats = getFriendStats();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Friends & Contacts</h1>
          <p className="text-muted-foreground">
            Manage your connections and friend requests
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} data-testid="add-friend-button">
          <UserPlus className="mr-2 h-4 w-4" />
          Add Friend
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="friends-stats">
        <div className="p-4 rounded-lg border bg-card" data-testid="stat-friends">
          <div className="text-2xl font-bold">{stats.accepted}</div>
          <div className="text-sm text-muted-foreground">Friends</div>
        </div>
        <div className="p-4 rounded-lg border bg-card" data-testid="stat-verified">
          <div className="text-2xl font-bold">{stats.verified}</div>
          <div className="text-sm text-muted-foreground">Verified</div>
        </div>
        <div className="p-4 rounded-lg border bg-card" data-testid="stat-favorites">
          <div className="text-2xl font-bold">{stats.favorites}</div>
          <div className="text-sm text-muted-foreground">Favorites</div>
        </div>
        <div className="p-4 rounded-lg border bg-card" data-testid="stat-pending">
          <div className="text-2xl font-bold">{incomingRequests.length}</div>
          <div className="text-sm text-muted-foreground">Pending Requests</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search friends..."
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
            <SelectValue placeholder="Trust Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trust Levels</SelectItem>
            <SelectItem value="friend">Friend</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="trusted">Trusted</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={showFavorites ? 'default' : 'outline'}
          onClick={() => setShowFavorites(!showFavorites)}
          data-testid="filter-favorites-button"
        >
          <Archive className="mr-2 h-4 w-4" />
          Favorites
        </Button>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            <Users className="mr-2 h-4 w-4" />
            All Friends
            <Badge variant="secondary" className="ml-2">
              {stats.accepted}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Inbox className="mr-2 h-4 w-4" />
            Requests
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
              <p>No friends found</p>
              <p className="text-sm">Try adjusting your filters or add some friends!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredFriends.map((friend) => (
                <ContactCard
                  key={friend.id}
                  friend={friend}
                  onMessage={() => {
                    // TODO: Open message dialog
                    console.info('Message friend:', friend.friendPubkey);
                  }}
                  onViewProfile={() => {
                    // TODO: Open profile view
                    console.info('View profile:', friend.friendPubkey);
                  }}
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
              <h2 className="text-xl font-semibold">Incoming Requests</h2>
              <Badge variant="secondary">{incomingRequests.length}</Badge>
            </div>

            {incomingRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No incoming requests</p>
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
              <h2 className="text-xl font-semibold">Sent Requests</h2>
              <Badge variant="secondary">{outgoingRequests.length}</Badge>
            </div>

            {outgoingRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No sent requests</p>
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
    </div>
  );
}
