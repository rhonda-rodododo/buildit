import { FC, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/core/storage/db';
import type { DBIdentity } from '@/core/storage/db';
import { UserHandle } from '@/components/user/UserHandle';
import { Search, ShieldCheck } from 'lucide-react';

export const UserDirectory: FC = () => {
  const [users, setUsers] = useState<DBIdentity[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<DBIdentity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'username' | 'recent'>('username');
  const [loading, setLoading] = useState(true);

  // Load users from database
  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Get all identities with usernames
        const allIdentities = await db.identities.toArray();

        // Filter users based on privacy settings
        const visibleUsers: DBIdentity[] = [];

        for (const identity of allIdentities) {
          // Only show users with usernames
          if (!identity.username) continue;

          // Check privacy settings
          const settings = await db.usernameSettings.get(identity.publicKey);

          // Show if:
          // 1. No settings (defaults to public)
          // 2. showInDirectory is true
          // 3. allowUsernameSearch is true
          if (!settings || (settings.showInDirectory && settings.allowUsernameSearch)) {
            visibleUsers.push(identity);
          }
        }

        setUsers(visibleUsers);
        setFilteredUsers(visibleUsers);
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  // Filter and sort users
  useEffect(() => {
    let filtered = [...users];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        user =>
          user.username?.toLowerCase().includes(query) ||
          user.displayName?.toLowerCase().includes(query) ||
          user.name.toLowerCase().includes(query)
      );
    }

    // Verification filter
    if (filterVerified === 'verified') {
      filtered = filtered.filter(user => user.nip05Verified);
    } else if (filterVerified === 'unverified') {
      filtered = filtered.filter(user => !user.nip05Verified);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'username') {
        return (a.username || '').localeCompare(b.username || '');
      } else if (sortBy === 'name') {
        return (a.displayName || a.username || a.name).localeCompare(
          b.displayName || b.username || b.name
        );
      } else if (sortBy === 'recent') {
        return b.lastUsed - a.lastUsed;
      }
      return 0;
    });

    setFilteredUsers(filtered);
  }, [users, searchQuery, filterVerified, sortBy]);

  const getInitials = (user: DBIdentity) => {
    if (user.displayName) {
      return user.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return user.publicKey.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
          <CardDescription>
            Browse and connect with other users on BuildIt Network
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="directory-search-input"
              placeholder="Search by username or name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Select value={filterVerified} onValueChange={(v) => setFilterVerified(v as 'all' | 'verified' | 'unverified')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by verification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="verified">Verified only</SelectItem>
                  <SelectItem value="unverified">Unverified only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'username' | 'recent')}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="username">Username (A-Z)</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="recent">Recently active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
          </div>
        </CardContent>
      </Card>

      {/* User list */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No users found matching your search
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map(user => (
            <Card key={user.publicKey} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(user)}</AvatarFallback>
                  </Avatar>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <UserHandle
                        pubkey={user.publicKey}
                        format="full"
                        showBadge={false}
                        className="font-medium"
                      />
                      {user.nip05Verified && (
                        <Badge variant="default" className="bg-green-600">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    {user.nip05 && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {user.nip05}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      View Profile
                    </Button>
                    <Button variant="default" size="sm">
                      Message
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
