/**
 * ProposalFeedCard Component
 * Displays a governance proposal in the activity feed
 */

import { FC } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
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
} from 'lucide-react';

interface ProposalFeedCardProps {
  item: ProposalFeedItem;
  className?: string;
}

export const ProposalFeedCard: FC<ProposalFeedCardProps> = ({ item, className }) => {
  const { data: proposal } = item;

  const getStatusBadge = () => {
    switch (proposal.status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
            <FileText className="w-3 h-3" />
            Draft
          </span>
        );
      case 'discussion':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/10 text-blue-500 rounded">
            <MessageSquare className="w-3 h-3" />
            Discussion
          </span>
        );
      case 'voting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 text-purple-500 rounded">
            <Vote className="w-3 h-3" />
            Voting
          </span>
        );
      case 'decided':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-500 rounded">
            <CheckCircle2 className="w-3 h-3" />
            Decided
          </span>
        );
    }
  };

  const getVotingMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      simple: 'Simple Majority',
      'ranked-choice': 'Ranked Choice',
      quadratic: 'Quadratic Voting',
      dhondt: "D'Hondt Method",
      consensus: 'Consensus',
    };
    return labels[method] || method;
  };

  const getVotingMethodIcon = () => {
    return <TrendingUp className="w-4 h-4 text-muted-foreground" />;
  };

  const isVotingActive = proposal.status === 'voting';
  const votingDeadlinePassed =
    proposal.votingDeadline && proposal.votingDeadline < Date.now();

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
              <span className="text-xs text-muted-foreground">created a proposal</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(proposal.created, { addSuffix: true })}
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
            Governance Proposal
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold">{proposal.title}</h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {proposal.description}
        </p>

        {/* Details */}
        <div className="flex items-center gap-4 text-sm flex-wrap">
          {/* Voting method */}
          <div className="flex items-center gap-1 text-muted-foreground">
            {getVotingMethodIcon()}
            <span className="text-xs">{getVotingMethodLabel(proposal.votingMethod)}</span>
          </div>

          {/* Voting deadline */}
          {proposal.votingDeadline && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-xs">
                {votingDeadlinePassed ? (
                  <span className="text-destructive">Voting ended</span>
                ) : (
                  <>
                    Deadline:{' '}
                    {formatDistanceToNow(proposal.votingDeadline, { addSuffix: true })}
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Voting deadline details */}
        {proposal.votingDeadline && isVotingActive && !votingDeadlinePassed && (
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded text-sm">
            <span className="font-medium">Voting ends:</span>{' '}
            {format(proposal.votingDeadline, 'MMM d, yyyy • h:mm a')}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {proposal.status === 'draft' && (
            <>
              <Button className="flex-1">Review</Button>
              <Button variant="outline" className="flex-1">
                Edit
              </Button>
            </>
          )}

          {proposal.status === 'discussion' && (
            <>
              <Button className="flex-1">Join Discussion</Button>
              <Button variant="outline" className="flex-1">
                View Details
              </Button>
            </>
          )}

          {proposal.status === 'voting' && !votingDeadlinePassed && (
            <>
              <Button className="flex-1">Cast Vote</Button>
              <Button variant="outline" className="flex-1">
                View Proposal
              </Button>
            </>
          )}

          {(proposal.status === 'decided' || votingDeadlinePassed) && (
            <>
              <Button variant="outline" className="flex-1">
                View Results
              </Button>
              <Button variant="ghost" className="flex-1">
                Details
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};
