/**
 * ProposalFeedCard Component
 * Displays a governance proposal in the activity feed
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, format } from 'date-fns';
import { getCurrentTime } from '@/lib/utils';
import type { ProposalFeedItem } from './types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  FileText,
  MessageSquare,
  Vote,
  CheckCircle2,
  Clock,
  TrendingUp,
  XCircle,
  Ban,
} from 'lucide-react';

interface ProposalFeedCardProps {
  item: ProposalFeedItem;
  className?: string;
}

export const ProposalFeedCard: FC<ProposalFeedCardProps> = ({ item, className }) => {
  const { t } = useTranslation();
  const { data: proposal } = item;

  const getStatusBadge = () => {
    switch (proposal.status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
            <FileText className="w-3 h-3" />
            {t('proposalFeedCard.statuses.draft')}
          </span>
        );
      case 'discussion':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/10 text-blue-500 rounded">
            <MessageSquare className="w-3 h-3" />
            {t('proposalFeedCard.statuses.discussion')}
          </span>
        );
      case 'voting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 text-purple-500 rounded">
            <Vote className="w-3 h-3" />
            {t('proposalFeedCard.statuses.voting')}
          </span>
        );
      case 'passed':
      case 'implemented':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-500 rounded">
            <CheckCircle2 className="w-3 h-3" />
            {t('proposalFeedCard.statuses.decided')}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded">
            <XCircle className="w-3 h-3" />
            {t('proposalFeedCard.statuses.rejected', 'Rejected')}
          </span>
        );
      case 'withdrawn':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded">
            <Ban className="w-3 h-3" />
            {t('proposalFeedCard.statuses.cancelled')}
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
            <Clock className="w-3 h-3" />
            {t('proposalFeedCard.statuses.expired', 'Expired')}
          </span>
        );
      default:
        return null;
    }
  };

  const getVotingSystemLabel = (system: string) => {
    const systemKeys: Record<string, string> = {
      'simple-majority': 'proposalFeedCard.votingMethods.simple',
      'supermajority': 'proposalFeedCard.votingMethods.supermajority',
      'ranked-choice': 'proposalFeedCard.votingMethods.rankedChoice',
      'approval': 'proposalFeedCard.votingMethods.approval',
      'quadratic': 'proposalFeedCard.votingMethods.quadratic',
      'd-hondt': 'proposalFeedCard.votingMethods.dhondt',
      'consensus': 'proposalFeedCard.votingMethods.consensus',
      'modified-consensus': 'proposalFeedCard.votingMethods.modifiedConsensus',
    };
    return systemKeys[system] ? t(systemKeys[system]) : system;
  };

  const isVotingActive = proposal.status === 'voting';
  // Capture time once on mount to avoid impure Date.now() during render
  const [mountTime] = useState(getCurrentTime);
  const votingDeadline = proposal.votingPeriod.endsAt;
  const votingDeadlinePassed = votingDeadline < mountTime;

  return (
    <Card className={`p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Avatar */}
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${proposal.createdBy}`}
            />
            <AvatarFallback>{proposal.createdBy.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          {/* Creator info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{proposal.createdBy}</span>
              <span className="text-xs text-muted-foreground">{t('proposalFeedCard.createdProposal')}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(proposal.createdAt, { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        {getStatusBadge()}
      </div>

      {/* Proposal content */}
      <div className="space-y-3">
        {/* Type indicator */}
        <div className="flex items-center gap-2">
          <Vote className="w-5 h-5 text-purple-500" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('proposalFeedCard.governanceProposal')}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold">{proposal.title}</h3>

        {/* Description */}
        {proposal.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {proposal.description}
          </p>
        )}

        {/* Details */}
        <div className="flex items-center gap-4 text-sm flex-wrap">
          {/* Voting system */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs">{getVotingSystemLabel(proposal.votingSystem)}</span>
          </div>

          {/* Voting deadline */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-xs">
              {votingDeadlinePassed ? (
                <span className="text-destructive">{t('proposalFeedCard.votingEnded')}</span>
              ) : (
                <>
                  {t('proposalFeedCard.deadline')}{' '}
                  {formatDistanceToNow(votingDeadline, { addSuffix: true })}
                </>
              )}
            </span>
          </div>
        </div>

        {/* Voting deadline details */}
        {isVotingActive && !votingDeadlinePassed && (
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded text-sm">
            <span className="font-medium">{t('proposalFeedCard.votingEnds')}</span>{' '}
            {format(votingDeadline, 'MMM d, yyyy • h:mm a')}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {proposal.status === 'draft' && (
            <>
              <Button className="flex-1">{t('proposalFeedCard.actions.review')}</Button>
              <Button variant="outline" className="flex-1">
                {t('proposalFeedCard.actions.edit')}
              </Button>
            </>
          )}

          {proposal.status === 'discussion' && (
            <>
              <Button className="flex-1">{t('proposalFeedCard.actions.joinDiscussion')}</Button>
              <Button variant="outline" className="flex-1">
                {t('proposalFeedCard.actions.viewDetails')}
              </Button>
            </>
          )}

          {proposal.status === 'voting' && !votingDeadlinePassed && (
            <>
              <Button className="flex-1">{t('proposalFeedCard.actions.castVote')}</Button>
              <Button variant="outline" className="flex-1">
                {t('proposalFeedCard.actions.viewProposal')}
              </Button>
            </>
          )}

          {(proposal.status === 'passed' || proposal.status === 'rejected' || votingDeadlinePassed) && (
            <>
              <Button variant="outline" className="flex-1">
                {t('proposalFeedCard.actions.viewResults')}
              </Button>
              <Button variant="ghost" className="flex-1">
                {t('proposalFeedCard.actions.details')}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};
