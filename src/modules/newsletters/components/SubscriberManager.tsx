/**
 * SubscriberManager Component
 * Manage newsletter subscribers with import/export
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNewslettersStore } from '../newslettersStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Users,
  Search,
  Download,
  Upload,
  MoreHorizontal,
  UserMinus,
  UserCheck,
} from 'lucide-react';
import type { NewsletterSubscriber, SubscriberStatus } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface SubscriberManagerProps {
  newsletterId: string;
  className?: string;
}

export const SubscriberManager: FC<SubscriberManagerProps> = ({
  newsletterId,
  className,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriberStatus | 'all'>('active');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [newPubkey, setNewPubkey] = useState('');
  const [importPubkeys, setImportPubkeys] = useState('');
  const [skipConfirmation, setSkipConfirmation] = useState(true);

  const {
    getNewsletterSubscribers,
    addSubscriber,
    removeSubscriber,
    unsubscribe,
    importSubscribers,
    exportSubscribers,
  } = useNewslettersStore();

  const allSubscribers = getNewsletterSubscribers(newsletterId);

  // Filter subscribers
  const subscribers = useMemo(() => {
    let result = allSubscribers;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.subscriberPubkey.toLowerCase().includes(query)
      );
    }

    return result;
  }, [allSubscribers, statusFilter, searchQuery]);

  // Stats
  const activeCount = allSubscribers.filter((s) => s.status === 'active').length;
  const pendingCount = allSubscribers.filter((s) => s.status === 'pending').length;
  const unsubscribedCount = allSubscribers.filter(
    (s) => s.status === 'unsubscribed'
  ).length;

  const getStatusBadge = (status: SubscriberStatus) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-600">{t('subscribers.active')}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-600">{t('subscribers.pending')}</Badge>;
      case 'unsubscribed':
        return <Badge variant="outline">{t('subscribers.unsubscribed')}</Badge>;
    }
  };

  const getSourceBadge = (source: NewsletterSubscriber['source']) => {
    switch (source) {
      case 'manual':
        return <Badge variant="secondary">{t('subscribers.sourceManual')}</Badge>;
      case 'import':
        return <Badge variant="secondary">{t('subscribers.sourceImport')}</Badge>;
      case 'self-subscribe':
        return <Badge variant="secondary">{t('subscribers.sourceSelf')}</Badge>;
      case 'nostr-contact-list':
        return <Badge variant="secondary">{t('subscribers.sourceContacts')}</Badge>;
    }
  };

  // Add subscriber
  const handleAddSubscriber = () => {
    if (!newPubkey.trim()) {
      toast.error(t('subscribers.toastEnterPubkey'));
      return;
    }

    // Validate pubkey format (basic check)
    if (newPubkey.length < 32) {
      toast.error(t('subscribers.toastInvalidPubkey'));
      return;
    }

    addSubscriber({
      newsletterId,
      subscriberPubkey: newPubkey.trim(),
      source: 'manual',
      skipConfirmation,
    });

    setNewPubkey('');
    setShowAddDialog(false);
    toast.success(t('subscribers.toastSubscriberAdded'));
  };

  // Import subscribers
  const handleImport = () => {
    const pubkeys = importPubkeys
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 32);

    if (pubkeys.length === 0) {
      toast.error(t('subscribers.toastNoValidPubkeys'));
      return;
    }

    const imported = importSubscribers({
      newsletterId,
      pubkeys,
      source: 'import',
      skipConfirmation,
    });

    setImportPubkeys('');
    setShowImportDialog(false);
    toast.success(t('subscribers.toastImported', { count: imported.length }));
  };

  // Export subscribers
  const handleExport = () => {
    const csv = exportSubscribers(newsletterId);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('subscribers.toastExported'));
  };

  // Handle unsubscribe
  const handleUnsubscribe = (subscriber: NewsletterSubscriber) => {
    unsubscribe(newsletterId, subscriber.subscriberPubkey);
    toast.success(t('subscribers.toastRemoved'));
  };

  // Handle remove
  const handleRemove = (subscriber: NewsletterSubscriber) => {
    removeSubscriber(subscriber.id);
    toast.success(t('subscribers.toastDeleted'));
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">{t('subscribers.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('subscribers.stats', { active: activeCount, pending: pendingCount, unsubscribed: unsubscribedCount })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {t('subscribers.import')}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t('subscribers.export')}
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('subscribers.addSubscriber')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card
          className={`cursor-pointer ${statusFilter === 'active' ? 'border-primary' : ''}`}
          onClick={() => setStatusFilter('active')}
        >
          <CardHeader className="pb-2">
            <CardDescription>{t('subscribers.active')}</CardDescription>
            <CardTitle className="text-2xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={`cursor-pointer ${statusFilter === 'pending' ? 'border-primary' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <CardHeader className="pb-2">
            <CardDescription>{t('subscribers.pending')}</CardDescription>
            <CardTitle className="text-2xl">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={`cursor-pointer ${statusFilter === 'unsubscribed' ? 'border-primary' : ''}`}
          onClick={() => setStatusFilter('unsubscribed')}
        >
          <CardHeader className="pb-2">
            <CardDescription>{t('subscribers.unsubscribed')}</CardDescription>
            <CardTitle className="text-2xl">{unsubscribedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('subscribers.searchPlaceholder')}
            className="pl-10"
          />
        </div>
        <Button
          variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
          onClick={() => setStatusFilter('all')}
        >
          {t('subscribers.all')}
        </Button>
      </div>

      {/* Subscribers Table */}
      {subscribers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('subscribers.noSubscribers')}</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              {statusFilter === 'all'
                ? t('subscribers.addFirstSubscriber')
                : t('subscribers.noStatusSubscribers', { status: statusFilter })}
            </p>
            {statusFilter === 'all' && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('subscribers.addSubscriber')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subscribers.tablePubkey')}</TableHead>
                <TableHead>{t('subscribers.tableStatus')}</TableHead>
                <TableHead>{t('subscribers.tableSource')}</TableHead>
                <TableHead>{t('subscribers.tableSubscribed')}</TableHead>
                <TableHead className="text-right">{t('subscribers.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell>
                    <p className="font-mono text-sm">
                      {subscriber.subscriberPubkey.slice(0, 8)}...
                      {subscriber.subscriberPubkey.slice(-8)}
                    </p>
                  </TableCell>
                  <TableCell>{getStatusBadge(subscriber.status)}</TableCell>
                  <TableCell>{getSourceBadge(subscriber.source)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(subscriber.subscribedAt, { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {subscriber.status === 'active' && (
                          <DropdownMenuItem
                            onClick={() => handleUnsubscribe(subscriber)}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            {t('subscribers.unsubscribe')}
                          </DropdownMenuItem>
                        )}
                        {subscriber.status === 'pending' && (
                          <DropdownMenuItem
                            onClick={() => {
                              // Confirm subscription
                              addSubscriber({
                                newsletterId,
                                subscriberPubkey: subscriber.subscriberPubkey,
                                skipConfirmation: true,
                              });
                              toast.success(t('subscribers.toastConfirmed'));
                            }}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            {t('subscribers.confirm')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemove(subscriber)}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          {t('subscribers.delete')}
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

      {/* Add Subscriber Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscribers.addDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('subscribers.addDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="pubkey">{t('subscribers.nostrPubkey')}</Label>
              <Input
                id="pubkey"
                value={newPubkey}
                onChange={(e) => setNewPubkey(e.target.value)}
                placeholder={t('subscribers.pubkeyPlaceholder')}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('subscribers.skipConfirmation')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('subscribers.skipConfirmationDesc')}
                </p>
              </div>
              <Switch checked={skipConfirmation} onCheckedChange={setSkipConfirmation} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddSubscriber}>{t('subscribers.addSubscriber')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscribers.importDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('subscribers.importDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="importPubkeys">{t('subscribers.pubkeys')}</Label>
              <Textarea
                id="importPubkeys"
                value={importPubkeys}
                onChange={(e) => setImportPubkeys(e.target.value)}
                placeholder={t('subscribers.importPlaceholder')}
                rows={6}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('subscribers.skipConfirmation')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('subscribers.skipConfirmationDesc')}
                </p>
              </div>
              <Switch checked={skipConfirmation} onCheckedChange={setSkipConfirmation} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleImport}>
              <Upload className="h-4 w-4 mr-2" />
              {t('subscribers.import')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
