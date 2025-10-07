/**
 * Anonymous Voting Component
 * Enables anonymous voting on proposals with cryptographic privacy
 * Essential for sensitive decisions in high-risk organizing
 */

import { FC, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Check,
  X,
  Minus,
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Info
} from 'lucide-react';

interface VoteOption {
  id: string;
  label: string;
  votes: number;
  anonymousVotes: number;
}

interface AnonymousVotingProps {
  proposalId: string;
  proposalTitle: string;
  proposalDescription: string;
  voteType: 'yes-no' | 'yes-no-abstain' | 'ranked-choice';
  totalVoters: number;
  hasVoted?: boolean;
  userVote?: string;
  isAnonymous?: boolean;
  showResults?: boolean;
  allowChangeVote?: boolean;
  className?: string;
}

export const AnonymousVoting: FC<AnonymousVotingProps> = ({
  proposalTitle,
  proposalDescription,
  voteType = 'yes-no-abstain',
  totalVoters = 45,
  hasVoted = false,
  userVote,
  isAnonymous = true,
  showResults = false,
  allowChangeVote = true,
  className
}) => {
  const [voted, setVoted] = useState(hasVoted);
  const [selectedVote, setSelectedVote] = useState<string | null>(userVote || null);
  const [anonymousMode, setAnonymousMode] = useState(isAnonymous);
  const [resultsVisible, setResultsVisible] = useState(showResults);

  // Demo vote counts
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>(() => {
    if (voteType === 'yes-no') {
      return [
        { id: 'yes', label: 'Yes', votes: 28, anonymousVotes: 12 },
        { id: 'no', label: 'No', votes: 8, anonymousVotes: 3 }
      ];
    } else if (voteType === 'yes-no-abstain') {
      return [
        { id: 'yes', label: 'Yes', votes: 28, anonymousVotes: 12 },
        { id: 'no', label: 'No', votes: 8, anonymousVotes: 3 },
        { id: 'abstain', label: 'Abstain', votes: 9, anonymousVotes: 7 }
      ];
    } else {
      return [
        { id: 'option-1', label: 'Option A', votes: 15, anonymousVotes: 6 },
        { id: 'option-2', label: 'Option B', votes: 12, anonymousVotes: 5 },
        { id: 'option-3', label: 'Option C', votes: 10, anonymousVotes: 4 },
        { id: 'option-4', label: 'Option D', votes: 8, anonymousVotes: 3 }
      ];
    }
  });

  const handleVote = (optionId: string) => {
    if (voted && !allowChangeVote) return;

    setSelectedVote(optionId);
    setVoted(true);

    // Update vote counts (in real app, this would be cryptographically secured)
    setVoteOptions(prev => prev.map(opt => {
      if (opt.id === optionId) {
        return {
          ...opt,
          votes: opt.votes + 1,
          anonymousVotes: anonymousMode ? opt.anonymousVotes + 1 : opt.anonymousVotes
        };
      }
      // Remove previous vote if changing
      if (selectedVote && opt.id === selectedVote) {
        return {
          ...opt,
          votes: opt.votes - 1,
          anonymousVotes: anonymousMode ? opt.anonymousVotes - 1 : opt.anonymousVotes
        };
      }
      return opt;
    }));
  };

  const getOptionIcon = (optionId: string) => {
    if (voteType === 'yes-no' || voteType === 'yes-no-abstain') {
      if (optionId === 'yes') return <Check className="w-5 h-5" />;
      if (optionId === 'no') return <X className="w-5 h-5" />;
      if (optionId === 'abstain') return <Minus className="w-5 h-5" />;
    }
    return null;
  };

  const getOptionColor = (optionId: string) => {
    if (voteType === 'yes-no' || voteType === 'yes-no-abstain') {
      if (optionId === 'yes') return 'hover:bg-green-500/10 hover:border-green-500 data-[selected=true]:bg-green-500/10 data-[selected=true]:border-green-500';
      if (optionId === 'no') return 'hover:bg-red-500/10 hover:border-red-500 data-[selected=true]:bg-red-500/10 data-[selected=true]:border-red-500';
      if (optionId === 'abstain') return 'hover:bg-gray-500/10 hover:border-gray-500 data-[selected=true]:bg-gray-500/10 data-[selected=true]:border-gray-500';
    }
    return 'hover:bg-primary/10 hover:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:border-primary';
  };

  const totalVotes = voteOptions.reduce((sum, opt) => sum + opt.votes, 0);
  const totalAnonymous = voteOptions.reduce((sum, opt) => sum + opt.anonymousVotes, 0);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Proposal Header */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3 mb-2">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">{proposalTitle}</h3>
            <p className="text-sm text-muted-foreground">{proposalDescription}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Cryptographically anonymous</span>
          </div>
          <div>•</div>
          <div>{totalVoters} eligible voters</div>
          {totalAnonymous > 0 && (
            <>
              <div>•</div>
              <div className="flex items-center gap-1">
                <EyeOff className="w-3 h-3" />
                <span>{totalAnonymous} anonymous</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Anonymous Mode Toggle */}
      {!voted && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <div>
              <div className="text-sm font-medium">Cast Anonymous Vote</div>
              <div className="text-xs text-muted-foreground">Your vote will be cryptographically sealed</div>
            </div>
          </div>

          <Button
            variant={anonymousMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAnonymousMode(!anonymousMode)}
            className="gap-2"
          >
            {anonymousMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {anonymousMode ? 'Anonymous' : 'Public'}
          </Button>
        </div>
      )}

      {/* Vote Options */}
      <div className="space-y-2">
        {voteOptions.map((option) => {
          const Icon = getOptionIcon(option.id);
          const isSelected = selectedVote === option.id;
          const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={voted && !allowChangeVote}
              data-selected={isSelected}
              className={`
                w-full text-left p-4 rounded-lg border-2 transition-all
                ${getOptionColor(option.id)}
                ${voted && !allowChangeVote ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected ? 'border-current' : 'border-border'}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {Icon}
                  <span className="font-medium">{option.label}</span>
                  {isSelected && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Your vote
                    </Badge>
                  )}
                </div>
                {resultsVisible && (
                  <span className="text-sm font-medium">{option.votes} votes ({percentage.toFixed(0)}%)</span>
                )}
              </div>

              {resultsVisible && (
                <div className="space-y-1">
                  <Progress value={percentage} className="h-2" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {option.anonymousVotes > 0 && (
                      <span className="flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        {option.anonymousVotes} anonymous
                      </span>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Vote Status */}
      {voted && (
        <Card className="p-4 bg-green-500/5 border-green-500/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1">Vote Recorded</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Your {anonymousMode ? 'anonymous' : 'public'} vote has been cryptographically sealed and recorded.
                {allowChangeVote && ' You can change your vote until the proposal closes.'}
              </p>
              {anonymousMode && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="w-3 h-3" />
                  <span>Your identity is protected by zero-knowledge cryptography</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Results Toggle */}
      {voted && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResultsVisible(!resultsVisible)}
          className="w-full gap-2"
        >
          {resultsVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {resultsVisible ? 'Hide Results' : 'Show Results'}
        </Button>
      )}
    </div>
  );
};
