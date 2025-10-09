/**
 * Donors List Component
 * Manage donors and donations for a campaign
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Search } from 'lucide-react';
import { useFundraisingStore } from '../../fundraisingStore';
import type { Campaign, Donation } from '../../types';

interface DonorsListProps {
  campaign: Campaign;
}

export function DonorsList({ campaign }: DonorsListProps) {
  const getDonationsByCampaign = useFundraisingStore((state) => state.getDonationsByCampaign);
  const getTotalRaised = useFundraisingStore((state) => state.getTotalRaised);

  const donations = getDonationsByCampaign(campaign.id);
  const totalRaised = getTotalRaised(campaign.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Donation['status'] | 'all'>('all');

  const filteredDonations = donations.filter((donation) => {
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = donation.donorName?.toLowerCase().includes(query);
      const matchesEmail = donation.donorEmail?.toLowerCase().includes(query);
      if (!matchesName && !matchesEmail) return false;
    }

    // Filter by status
    if (filterStatus !== 'all' && donation.status !== filterStatus) {
      return false;
    }

    return true;
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: campaign.currency,
    }).format(cents / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleExportCSV = () => {
    // Create CSV content
    const headers = ['Date', 'Name', 'Email', 'Amount', 'Status', 'Payment Method', 'Message'];
    const rows = donations.map((donation) => [
      formatDate(donation.created),
      donation.isAnonymous ? 'Anonymous' : (donation.donorName || 'N/A'),
      donation.isAnonymous ? 'N/A' : (donation.donorEmail || 'N/A'),
      formatCurrency(donation.amount),
      donation.status,
      donation.paymentMethod,
      donation.message || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign.slug}-donors-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<Donation['status'], string> = {
    pending: 'secondary',
    completed: 'default',
    failed: 'destructive',
    refunded: 'outline',
    cancelled: 'outline',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Donors & Donations</h2>
        <p className="text-muted-foreground">
          Manage donations for {campaign.title}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Raised</p>
            <p className="text-3xl font-bold">{formatCurrency(totalRaised)}</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Donations</p>
            <p className="text-3xl font-bold">{donations.length}</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Completed Donations</p>
            <p className="text-3xl font-bold">
              {donations.filter((d) => d.status === 'completed').length}
            </p>
          </div>
        </Card>
      </div>

      {/* Filters & Export */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('completed')}
            >
              Completed
            </Button>
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('pending')}
            >
              Pending
            </Button>
          </div>

          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Donations Table */}
      <Card>
        {filteredDonations.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p>No donations yet</p>
            {searchQuery && <p className="text-sm mt-2">Try adjusting your search filters</p>}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDonations.map((donation) => (
                <TableRow key={donation.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(donation.created)}
                  </TableCell>
                  <TableCell>
                    {donation.isAnonymous ? (
                      <span className="text-muted-foreground">Anonymous</span>
                    ) : (
                      <div>
                        <div className="font-medium">{donation.donorName || 'N/A'}</div>
                        {donation.donorEmail && (
                          <div className="text-xs text-muted-foreground">
                            {donation.donorEmail}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(donation.amount)}
                    {donation.isRecurring && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Recurring
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[donation.status] as any}>
                      {donation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{donation.paymentMethod}</TableCell>
                  <TableCell>
                    {donation.message ? (
                      <div className="max-w-xs truncate text-sm text-muted-foreground">
                        {donation.message}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
