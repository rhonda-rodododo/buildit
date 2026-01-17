/**
 * SubscriberManager Component
 * Manage newsletter subscribers with import/export
 */

import { FC, useState, useMemo } from 'react';
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
        return <Badge className="bg-green-500/20 text-green-600">Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-600">Pending</Badge>;
      case 'unsubscribed':
        return <Badge variant="outline">Unsubscribed</Badge>;
    }
  };

  const getSourceBadge = (source: NewsletterSubscriber['source']) => {
    switch (source) {
      case 'manual':
        return <Badge variant="secondary">Manual</Badge>;
      case 'import':
        return <Badge variant="secondary">Import</Badge>;
      case 'self-subscribe':
        return <Badge variant="secondary">Self</Badge>;
      case 'nostr-contact-list':
        return <Badge variant="secondary">Contacts</Badge>;
    }
  };

  // Add subscriber
  const handleAddSubscriber = () => {
    if (!newPubkey.trim()) {
      toast.error('Please enter a pubkey');
      return;
    }

    // Validate pubkey format (basic check)
    if (newPubkey.length < 32) {
      toast.error('Invalid pubkey format');
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
    toast.success('Subscriber added');
  };

  // Import subscribers
  const handleImport = () => {
    const pubkeys = importPubkeys
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 32);

    if (pubkeys.length === 0) {
      toast.error('No valid pubkeys found');
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
    toast.success(`${imported.length} subscriber(s) imported`);
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
    toast.success('Subscribers exported');
  };

  // Handle unsubscribe
  const handleUnsubscribe = (subscriber: NewsletterSubscriber) => {
    unsubscribe(newsletterId, subscriber.subscriberPubkey);
    toast.success('Subscriber removed');
  };

  // Handle remove
  const handleRemove = (subscriber: NewsletterSubscriber) => {
    removeSubscriber(subscriber.id);
    toast.success('Subscriber deleted');
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Subscribers</h3>
          <p className="text-sm text-muted-foreground">
            {activeCount} active, {pendingCount} pending, {unsubscribedCount} unsubscribed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Subscriber
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
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={`cursor-pointer ${statusFilter === 'pending' ? 'border-primary' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={`cursor-pointer ${statusFilter === 'unsubscribed' ? 'border-primary' : ''}`}
          onClick={() => setStatusFilter('unsubscribed')}
        >
          <CardHeader className="pb-2">
            <CardDescription>Unsubscribed</CardDescription>
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
            placeholder="Search by pubkey..."
            className="pl-10"
          />
        </div>
        <Button
          variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
          onClick={() => setStatusFilter('all')}
        >
          All
        </Button>
      </div>

      {/* Subscribers Table */}
      {subscribers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No subscribers</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              {statusFilter === 'all'
                ? 'Add your first subscriber to get started.'
                : `No ${statusFilter} subscribers found.`}
            </p>
            {statusFilter === 'all' && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Subscriber
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pubkey</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Subscribed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                            Unsubscribe
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
                              toast.success('Subscription confirmed');
                            }}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Confirm
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemove(subscriber)}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Delete
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
            <DialogTitle>Add Subscriber</DialogTitle>
            <DialogDescription>
              Add a new subscriber by their Nostr pubkey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="pubkey">Nostr Pubkey</Label>
              <Input
                id="pubkey"
                value={newPubkey}
                onChange={(e) => setNewPubkey(e.target.value)}
                placeholder="npub... or hex pubkey"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Skip Confirmation</Label>
                <p className="text-sm text-muted-foreground">
                  Activate immediately without confirmation
                </p>
              </div>
              <Switch checked={skipConfirmation} onCheckedChange={setSkipConfirmation} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSubscriber}>Add Subscriber</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Subscribers</DialogTitle>
            <DialogDescription>
              Paste Nostr pubkeys (one per line or comma-separated).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="importPubkeys">Pubkeys</Label>
              <Textarea
                id="importPubkeys"
                value={importPubkeys}
                onChange={(e) => setImportPubkeys(e.target.value)}
                placeholder="npub1abc...\nnpub1def...\nor comma-separated"
                rows={6}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Skip Confirmation</Label>
                <p className="text-sm text-muted-foreground">
                  Activate immediately without confirmation
                </p>
              </div>
              <Switch checked={skipConfirmation} onCheckedChange={setSkipConfirmation} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
