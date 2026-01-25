/**
 * SubscriberList Component
 * Displays and manages publication subscribers
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePublishingStore } from '../publishingStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Search,
  Users,
  MoreHorizontal,
  Mail,
  UserX,
  Download,
  ArrowLeft,
  Crown,
  User,
} from 'lucide-react';
import type { SubscriptionTier, SubscriptionStatus } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface SubscriberListProps {
  publicationId: string;
  onBack: () => void;
  className?: string;
}

export const SubscriberList: FC<SubscriberListProps> = ({
  publicationId,
  onBack,
  className,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<SubscriptionTier | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('active');

  const { getPublicationSubscriptions, unsubscribe } = usePublishingStore();

  const subscribers = useMemo(() => {
    let result = getPublicationSubscriptions(publicationId);

    // Filter by tier
    if (tierFilter !== 'all') {
      result = result.filter((sub) => sub.tier === tierFilter);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((sub) => sub.status === statusFilter);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (sub) =>
          sub.subscriberPubkey.toLowerCase().includes(query) ||
          sub.subscriberEmail?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [publicationId, getPublicationSubscriptions, tierFilter, statusFilter, searchQuery]);

  // Stats
  const allSubscribers = getPublicationSubscriptions(publicationId);
  const activeCount = allSubscribers.filter((s) => s.status === 'active').length;
  const freeCount = allSubscribers.filter((s) => s.status === 'active' && s.tier === 'free').length;
  const paidCount = allSubscribers.filter((s) => s.status === 'active' && s.tier === 'paid').length;

  const getTierBadge = (tier: SubscriptionTier) => {
    if (tier === 'paid') {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-600">
          <Crown className="h-3 w-3 mr-1" />
          {t('subscriberList.paid')}
        </Badge>
      );
    }
    return <Badge variant="secondary">{t('subscriberList.free')}</Badge>;
  };

  const getStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-600">{t('subscriberList.active')}</Badge>;
      case 'cancelled':
        return <Badge variant="outline">{t('subscriberList.cancelled')}</Badge>;
      case 'expired':
        return <Badge variant="destructive">{t('subscriberList.expired')}</Badge>;
    }
  };

  const handleExport = () => {
    const csv = [
      ['Pubkey', 'Email', 'Tier', 'Status', 'Subscribed At'].join(','),
      ...subscribers.map((sub) =>
        [
          sub.subscriberPubkey,
          sub.subscriberEmail || '',
          sub.tier,
          sub.status,
          new Date(sub.subscribedAt).toISOString(),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('subscriberList.exportedToast'));
  };

  const handleRemoveSubscriber = (subscriptionId: string) => {
    unsubscribe(subscriptionId);
    toast.success(t('subscriberList.removedToast'));
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold">{t('subscriberList.title')}</h2>
            <p className="text-muted-foreground">
              {t('subscriberList.description')}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          {t('subscriberList.exportCSV')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('subscriberList.totalActive')}</CardDescription>
            <CardTitle className="text-2xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('subscriberList.freeSubscribers')}</CardDescription>
            <CardTitle className="text-2xl">{freeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('subscriberList.paidSubscribers')}</CardDescription>
            <CardTitle className="text-2xl">{paidCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('subscriberList.searchPlaceholder')}
            className="pl-10"
          />
        </div>
        <Select
          value={tierFilter}
          onValueChange={(v) => setTierFilter(v as SubscriptionTier | 'all')}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t('subscriberList.tierPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('subscriberList.allTiers')}</SelectItem>
            <SelectItem value="free">{t('subscriberList.free')}</SelectItem>
            <SelectItem value="paid">{t('subscriberList.paid')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as SubscriptionStatus | 'all')}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('subscriberList.statusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('subscriberList.allStatus')}</SelectItem>
            <SelectItem value="active">{t('subscriberList.active')}</SelectItem>
            <SelectItem value="cancelled">{t('subscriberList.cancelled')}</SelectItem>
            <SelectItem value="expired">{t('subscriberList.expired')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subscribers Table */}
      {subscribers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('subscriberList.noSubscribers')}</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {t('subscriberList.noSubscribersDesc')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subscriberList.subscriber')}</TableHead>
                <TableHead>{t('subscriberList.tier')}</TableHead>
                <TableHead>{t('subscriberList.status')}</TableHead>
                <TableHead>{t('subscriberList.notifications')}</TableHead>
                <TableHead>{t('subscriberList.subscribed')}</TableHead>
                <TableHead className="text-right">{t('subscriberList.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-mono text-sm">
                          {sub.subscriberPubkey.slice(0, 8)}...{sub.subscriberPubkey.slice(-8)}
                        </p>
                        {sub.subscriberEmail && (
                          <p className="text-sm text-muted-foreground">{sub.subscriberEmail}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getTierBadge(sub.tier)}</TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {sub.preferences.nostrNotifications && (
                        <Badge variant="outline" className="text-xs">{t('subscriberList.nostr')}</Badge>
                      )}
                      {sub.preferences.emailNotifications && (
                        <Badge variant="outline" className="text-xs">{t('subscriberList.email')}</Badge>
                      )}
                      {!sub.preferences.nostrNotifications && !sub.preferences.emailNotifications && (
                        <span className="text-muted-foreground text-sm">{t('subscriberList.none')}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(sub.subscribedAt, { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {sub.subscriberEmail && (
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            {t('subscriberList.sendEmail')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemoveSubscriber(sub.id)}
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          {t('subscriberList.removeSubscriber')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
