/**
 * Submissions List Component
 * View and manage form submissions
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <h3 className="text-lg font-semibold">{t('submissionsList.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {submissions.length === 1
              ? t('submissionsList.totalCount', { count: submissions.length })
              : t('submissionsList.totalCount_plural', { count: submissions.length })}
          </p>
        </div>
        <Button onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          {t('submissionsList.export')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('submissionsList.searchPlaceholder')}
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
            {t('submissionsList.filters.all')}
          </Button>
          <Button
            variant={filterStatus === 'unprocessed' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('unprocessed')}
          >
            {t('submissionsList.filters.unprocessed')}
          </Button>
          <Button
            variant={filterStatus === 'spam' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('spam')}
          >
            {t('submissionsList.filters.spam')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('submissionsList.tableHeaders.submitted')}</TableHead>
              <TableHead>{t('submissionsList.tableHeaders.name')}</TableHead>
              <TableHead>{t('submissionsList.tableHeaders.email')}</TableHead>
              <TableHead>{t('submissionsList.tableHeaders.status')}</TableHead>
              <TableHead>{t('submissionsList.tableHeaders.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubmissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t('submissionsList.noSubmissions')}
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
                    {submission.submittedByName || submission.submittedBy || t('submissionsList.anonymous')}
                  </TableCell>
                  <TableCell>{submission.submittedByEmail || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {submission.flaggedAsSpam && (
                        <Badge variant="destructive">{t('submissionsList.status.spam')}</Badge>
                      )}
                      {submission.processed && (
                        <Badge variant="secondary">{t('submissionsList.status.processed')}</Badge>
                      )}
                      {!submission.processed && !submission.flaggedAsSpam && (
                        <Badge>{t('submissionsList.status.new')}</Badge>
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
                          title={t('submissionsList.actions.flagSpam')}
                        >
                          <Flag className="h-4 w-4" />
                        </Button>
                      )}
                      {!submission.processed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onMarkProcessed(submission.id)}
                          title={t('submissionsList.actions.markProcessed')}
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
