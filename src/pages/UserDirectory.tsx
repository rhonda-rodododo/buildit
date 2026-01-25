import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
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
  const { t } = useTranslation();
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
      <PageMeta titleKey="crm.title" descriptionKey="meta.crm" path="/app/directory" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('userDirectory.title')}</CardTitle>
          <CardDescription>
            {t('userDirectory.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="directory-search-input"
              placeholder={t('userDirectory.searchPlaceholder')}
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('userDirectory.filters.allUsers')}</SelectItem>
                  <SelectItem value="verified">{t('userDirectory.filters.verifiedOnly')}</SelectItem>
                  <SelectItem value="unverified">{t('userDirectory.filters.unverifiedOnly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'username' | 'recent')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="username">{t('userDirectory.sort.username')}</SelectItem>
                  <SelectItem value="name">{t('userDirectory.sort.name')}</SelectItem>
                  <SelectItem value="recent">{t('userDirectory.sort.recent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            {filteredUsers.length === 1
              ? t('userDirectory.resultsCount', { count: filteredUsers.length })
              : t('userDirectory.resultsCount_plural', { count: filteredUsers.length })}
          </div>
        </CardContent>
      </Card>

      {/* User list */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t('userDirectory.noUsersFound')}
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
                          {t('userDirectory.verified')}
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
                      {t('userDirectory.actions.viewProfile')}
                    </Button>
                    <Button variant="default" size="sm">
                      {t('userDirectory.actions.message')}
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
