/**
 * Poll Display Component
 * Epic 61: Display polls with voting and live results
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, Users, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSocialFeaturesStore } from '../socialFeaturesStore';
import type { Poll, PollOption } from '../types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PollDisplayProps {
  poll: Poll;
  className?: string;
}

export function PollDisplay({ poll, className }: PollDisplayProps) {
  const { t } = useTranslation();
  const votePoll = useSocialFeaturesStore((s) => s.votePoll);
  const hasVoted = useSocialFeaturesStore((s) => s.hasVoted);
  const getMyVote = useSocialFeaturesStore((s) => s.getMyVote);

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isVoting, setIsVoting] = useState(false);

  const myVote = getMyVote(poll.id);
  const voted = hasVoted(poll.id);
  const isEnded = poll.isEnded || Date.now() > poll.endsAt;
  const showResults = voted || isEnded || !poll.hideResultsUntilEnded;

  const timeRemaining = useMemo(() => {
    if (isEnded) return t('polls.ended', 'Poll ended');
    return formatDistanceToNow(poll.endsAt, { addSuffix: true });
  }, [poll.endsAt, isEnded, t]);

  const handleOptionClick = (optionId: string) => {
    if (voted || isEnded) return;

    if (poll.pollType === 'single') {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0 || isVoting) return;

    setIsVoting(true);
    try {
      await votePoll(poll.id, selectedOptions);
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const getOptionPercentage = (option: PollOption): number => {
    if (poll.totalVotes === 0) return 0;
    return Math.round((option.voteCount / poll.totalVotes) * 100);
  };

  const getWinningOption = (): string | null => {
    if (poll.options.length === 0) return null;
    const maxVotes = Math.max(...poll.options.map((o) => o.voteCount));
    if (maxVotes === 0) return null;
    const winner = poll.options.find((o) => o.voteCount === maxVotes);
    return winner?.id || null;
  };

  const winningOptionId = isEnded ? getWinningOption() : null;

  return (
    <div className={cn('rounded-lg border p-4 space-y-4', className)}>
      {/* Question */}
      <div className="flex items-start gap-2">
        <BarChart2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="font-medium">{poll.question}</p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const percentage = getOptionPercentage(option);
          const isSelected = selectedOptions.includes(option.id);
          const isMyVote = myVote?.optionIds.includes(option.id);
          const isWinner = option.id === winningOptionId;

          return (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option.id)}
              disabled={voted || isEnded}
              className={cn(
                'w-full relative rounded-lg border p-3 text-left transition-all',
                !voted && !isEnded && 'hover:border-primary cursor-pointer',
                isSelected && 'border-primary bg-primary/5',
                isMyVote && 'border-primary',
                isWinner && 'border-green-500 bg-green-500/5',
                (voted || isEnded) && 'cursor-default'
              )}
            >
              {/* Background progress bar */}
              {showResults && (
                <div
                  className={cn(
                    'absolute inset-0 rounded-lg transition-all',
                    isWinner ? 'bg-green-500/20' : 'bg-muted'
                  )}
                  style={{ width: `${percentage}%` }}
                />
              )}

              {/* Content */}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Selection indicator */}
                  {!voted && !isEnded && (
                    <div
                      className={cn(
                        'h-4 w-4 rounded-full border-2 shrink-0',
                        poll.pollType === 'single' ? 'rounded-full' : 'rounded',
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/50'
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                  )}

                  {/* My vote indicator */}
                  {isMyVote && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}

                  <span className={cn('text-sm', isWinner && 'font-medium')}>
                    {option.text}
                  </span>
                </div>

                {/* Results */}
                {showResults && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{option.voteCount} {t('polls.votes', 'votes')}</span>
                    <span className="font-medium">{percentage}%</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Vote button */}
      {!voted && !isEnded && (
        <Button
          onClick={handleVote}
          disabled={selectedOptions.length === 0 || isVoting}
          className="w-full"
        >
          {isVoting ? t('polls.voting', 'Voting...') : t('polls.vote', 'Vote')}
        </Button>
      )}

      {/* Footer stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {poll.voterCount} {t('polls.voters', 'voters')}
          </span>
          <span className="flex items-center gap-1">
            <BarChart2 className="h-4 w-4" />
            {poll.totalVotes} {t('polls.totalVotes', 'total votes')}
          </span>
        </div>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {timeRemaining}
        </span>
      </div>

      {/* Poll type indicator */}
      <p className="text-xs text-muted-foreground">
        {poll.pollType === 'single'
          ? t('polls.singleChoiceHint', 'Select one option')
          : t('polls.multipleChoiceHint', 'Select one or more options')}
      </p>
    </div>
  );
}
