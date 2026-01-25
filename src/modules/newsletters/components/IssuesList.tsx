/**
 * IssuesList Component
 * List of newsletter issues with status and actions
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNewslettersStore } from '../newslettersStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Plus,
  FileText,
  MoreHorizontal,
  Edit,
  Trash2,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { NewsletterIssue, IssueStatus } from '../types';
import { formatDistanceToNow, format } from 'date-fns';

interface IssuesListProps {
  newsletterId: string;
  onCreateIssue: () => void;
  onEditIssue: (issue: NewsletterIssue) => void;
  onSendIssue: (issue: NewsletterIssue) => void;
  onDeleteIssue: (issueId: string) => void;
  className?: string;
}

export const IssuesList: FC<IssuesListProps> = ({
  newsletterId,
  onCreateIssue,
  onEditIssue,
  onSendIssue,
  onDeleteIssue,
  className,
}) => {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const { getNewsletterIssues } = useNewslettersStore();

  const allIssues = getNewsletterIssues(newsletterId);
  const issues =
    statusFilter === 'all'
      ? allIssues
      : allIssues.filter((i) => i.status === statusFilter);

  // Stats
  const draftCount = allIssues.filter((i) => i.status === 'draft').length;
  const scheduledCount = allIssues.filter((i) => i.status === 'scheduled').length;
  const sentCount = allIssues.filter((i) => i.status === 'sent').length;

  const getStatusBadge = (status: IssueStatus) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">{t('issuesList.statuses.draft')}</Badge>;
      case 'scheduled':
        return (
          <Badge className="bg-blue-500/20 text-blue-600">
            <Clock className="h-3 w-3 mr-1" />
            {t('issuesList.statuses.scheduled')}
          </Badge>
        );
      case 'sending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-600">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {t('issuesList.statuses.sending')}
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-green-500/20 text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('issuesList.statuses.sent')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            {t('issuesList.statuses.failed')}
          </Badge>
        );
    }
  };

  if (allIssues.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{t('issuesList.noIssuesYet')}</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-4">
            {t('issuesList.noIssuesDescription')}
          </p>
          <Button onClick={onCreateIssue}>
            <Plus className="h-4 w-4 mr-2" />
            {t('issuesList.createIssue')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">{t('issuesList.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('issuesList.stats', {
              drafts: draftCount,
              draftsPlural: draftCount !== 1 ? 's' : '',
              scheduled: scheduledCount,
              sent: sentCount
            })}
          </p>
        </div>
        <Button onClick={onCreateIssue}>
          <Plus className="h-4 w-4 mr-2" />
          {t('issuesList.newIssue')}
        </Button>
      </div>

      {/* Filters */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as IssueStatus | 'all')}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">{t('issuesList.tabs.all', { count: allIssues.length })}</TabsTrigger>
          <TabsTrigger value="draft">{t('issuesList.tabs.drafts', { count: draftCount })}</TabsTrigger>
          <TabsTrigger value="scheduled">{t('issuesList.tabs.scheduled', { count: scheduledCount })}</TabsTrigger>
          <TabsTrigger value="sent">{t('issuesList.tabs.sent', { count: sentCount })}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Issues Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('issuesList.tableHeaders.subject')}</TableHead>
              <TableHead>{t('issuesList.tableHeaders.status')}</TableHead>
              <TableHead>{t('issuesList.tableHeaders.recipients')}</TableHead>
              <TableHead>{t('issuesList.tableHeaders.created')}</TableHead>
              <TableHead className="text-right">{t('issuesList.tableHeaders.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{issue.subject || t('issuesList.untitled')}</p>
                    {issue.previewText && (
                      <p className="text-sm text-muted-foreground truncate max-w-xs">
                        {issue.previewText}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getStatusBadge(issue.status)}
                    {issue.status === 'scheduled' && issue.scheduledAt && (
                      <span className="text-xs text-muted-foreground">
                        {format(issue.scheduledAt, 'MMM d, h:mm a')}
                      </span>
                    )}
                    {issue.status === 'sent' && issue.sentAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(issue.sentAt, { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {issue.stats.totalRecipients > 0 ? (
                    <div className="text-sm">
                      <span className="text-green-600">{issue.stats.delivered}</span>
                      {issue.stats.failed > 0 && (
                        <>
                          {' / '}
                          <span className="text-red-600">{issue.stats.failed}</span>
                        </>
                      )}
                      {' / '}
                      <span>{issue.stats.totalRecipients}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(issue.createdAt, { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(issue.status === 'draft' || issue.status === 'scheduled') && (
                        <DropdownMenuItem onClick={() => onEditIssue(issue)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t('issuesList.actions.edit')}
                        </DropdownMenuItem>
                      )}
                      {issue.status === 'draft' && (
                        <DropdownMenuItem onClick={() => onSendIssue(issue)}>
                          <Send className="h-4 w-4 mr-2" />
                          {t('issuesList.actions.sendNow')}
                        </DropdownMenuItem>
                      )}
                      {issue.status === 'sent' && (
                        <DropdownMenuItem onClick={() => onEditIssue(issue)}>
                          <FileText className="h-4 w-4 mr-2" />
                          {t('issuesList.actions.view')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDeleteIssue(issue.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('issuesList.actions.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
