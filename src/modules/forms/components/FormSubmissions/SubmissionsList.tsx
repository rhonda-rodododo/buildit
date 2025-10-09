/**
 * Submissions List Component
 * View and manage form submissions
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Flag, Check } from 'lucide-react';
import { format } from 'date-fns';
import type { FormSubmission } from '../../types';

interface SubmissionsListProps {
  submissions: FormSubmission[];
  onViewDetails: (submission: FormSubmission) => void;
  onFlagSpam: (submissionId: string) => void;
  onMarkProcessed: (submissionId: string) => void;
  onExport: () => void;
}

export function SubmissionsList({
  submissions,
  onViewDetails,
  onFlagSpam,
  onMarkProcessed,
  onExport,
}: SubmissionsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unprocessed' | 'spam'>('all');

  const filteredSubmissions = submissions.filter(submission => {
    // Filter by search
    const matchesSearch = !searchQuery ||
      submission.submittedByName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.submittedByEmail?.toLowerCase().includes(searchQuery.toLowerCase());

    // Filter by status
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'unprocessed' && !submission.processed) ||
      (filterStatus === 'spam' && submission.flaggedAsSpam);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Form Submissions</h3>
          <p className="text-sm text-muted-foreground">
            {submissions.length} total submission{submissions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            onClick={() => setFilterStatus('all')}
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'unprocessed' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('unprocessed')}
          >
            Unprocessed
          </Button>
          <Button
            variant={filterStatus === 'spam' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('spam')}
          >
            Spam
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submitted</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubmissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No submissions found
                </TableCell>
              </TableRow>
            ) : (
              filteredSubmissions.map((submission) => (
                <TableRow
                  key={submission.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onViewDetails(submission)}
                >
                  <TableCell>
                    {format(submission.submittedAt, 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell>
                    {submission.submittedByName || submission.submittedBy || 'Anonymous'}
                  </TableCell>
                  <TableCell>{submission.submittedByEmail || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {submission.flaggedAsSpam && (
                        <Badge variant="destructive">Spam</Badge>
                      )}
                      {submission.processed && (
                        <Badge variant="secondary">Processed</Badge>
                      )}
                      {!submission.processed && !submission.flaggedAsSpam && (
                        <Badge>New</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {!submission.flaggedAsSpam && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onFlagSpam(submission.id)}
                          title="Flag as spam"
                        >
                          <Flag className="h-4 w-4" />
                        </Button>
                      )}
                      {!submission.processed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onMarkProcessed(submission.id)}
                          title="Mark as processed"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
