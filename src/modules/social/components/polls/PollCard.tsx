/**
 * PollCard Component
 * Display a poll with voting functionality and results
 */

import { FC, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BarChart3,
  Clock,
  Users,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Timer,
} from 'lucide-react';
import { useSocialStore } from '../../socialStore';
import type { Poll } from '../../types';
import { formatDistanceToNow, formatDistance } from 'date-fns';
import { cn } from '@/lib/utils';

interface PollCardProps {
  poll: Poll;
  className?: string;
  showAuthor?: boolean;
  compact?: boolean;
}

export const PollCard: FC<PollCardProps> = ({
  poll,
  className,
  showAuthor = false,
  compact = false,
}) => {
  const { t } = useTranslation();
  const { votePoll, hasVoted, myVotes } = useSocialStore();

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isVoting, setIsVoting] = useState(false);

  const userHasVoted = hasVoted(poll.id);
  const userVotes = myVotes.get(poll.id) || [];
  const isActive = poll.status === 'active' && poll.endsAt > Date.now();
  const showResults = userHasVoted || !isActive || poll.showResultsBeforeEnd;

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    if (!isActive) return t('pollCard.status.ended');
    return formatDistance(poll.endsAt, Date.now(), { addSuffix: true });
  }, [poll.endsAt, isActive, t]);

  // Handle option selection
  const handleOptionToggle = (optionId: string) => {
    if (userHasVoted || !isActive) return;

    if (poll.choiceType === 'single') {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  // Handle vote submission
  const handleVote = async () => {
    if (selectedOptions.length === 0) return;

    setIsVoting(true);
    try {
      await votePoll(poll.id, selectedOptions);
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  // Get percentage for an option
  const getPercentage = (voteCount: number) => {
    if (poll.totalVotes === 0) return 0;
    return Math.round((voteCount / poll.totalVotes) * 100);
  };

  // Find winning option(s)
  const maxVotes = Math.max(...poll.options.map((o) => o.voteCount));

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className={cn('pb-3', compact && 'p-3')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="font-semibold">{poll.question}</span>
          </div>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? t('pollCard.status.active') : t('pollCard.status.ended')}
          </Badge>
        </div>

        {/* Poll metadata */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {t('pollCard.voteCount', { count: poll.totalVotes })}
          </span>
          <span className="flex items-center gap-1">
            {isActive ? <Timer className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            {timeRemaining}
          </span>
          <span className="flex items-center gap-1">
            {poll.isAnonymous ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {poll.isAnonymous ? t('pollCard.anonymous') : t('pollCard.public')}
          </span>
        </div>
      </CardHeader>

      <CardContent className={cn('space-y-2', compact && 'px-3 pb-2')}>
        {poll.options.map((option) => {
          const percentage = getPercentage(option.voteCount);
          const isSelected = selectedOptions.includes(option.id);
          const isUserVote = userVotes.includes(option.id);
          const isWinner = option.voteCount === maxVotes && maxVotes > 0 && !isActive;

          return (
            <div key={option.id} className="relative">
              {/* Voting mode - clickable options */}
              {!userHasVoted && isActive && (
                <button
                  type="button"
                  onClick={() => handleOptionToggle(option.id)}
                  className={cn(
                    'w-full p-3 rounded-lg border-2 transition-colors text-left flex items-center gap-3',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  {poll.choiceType === 'single' ? (
                    <Circle
                      className={cn(
                        'w-5 h-5 flex-shrink-0',
                        isSelected && 'fill-primary text-primary'
                      )}
                    />
                  ) : (
                    <Checkbox checked={isSelected} />
                  )}
                  <span className="flex-1">{option.text}</span>
                </button>
              )}

              {/* Results mode - show percentages */}
              {showResults && (userHasVoted || !isActive) && (
                <div
                  className={cn(
                    'relative p-3 rounded-lg border overflow-hidden',
                    isUserVote && 'border-primary',
                    isWinner && 'border-green-500'
                  )}
                >
                  {/* Progress bar background */}
                  <div
                    className={cn(
                      'absolute inset-0 opacity-20',
                      isWinner ? 'bg-green-500' : 'bg-primary'
                    )}
                    style={{ width: `${percentage}%` }}
                  />

                  <div className="relative flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isUserVote && (
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                      <span className={cn(isWinner && 'font-medium')}>
                        {option.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{percentage}%</span>
                      <span className="text-muted-foreground">
                        ({option.voteCount})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Waiting for results mode */}
              {!showResults && userHasVoted && (
                <div className="p-3 rounded-lg border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isUserVote && (
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                    <span>{option.text}</span>
                  </div>
                  {isUserVote && (
                    <Badge variant="outline">{t('pollCard.yourVote')}</Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Results hidden notice */}
        {!showResults && !isActive && (
          <p className="text-sm text-muted-foreground text-center py-2">
            {t('pollCard.resultsHidden')}
          </p>
        )}
      </CardContent>

      {/* Vote button */}
      {!userHasVoted && isActive && (
        <CardFooter className={cn('pt-2', compact && 'px-3 pb-3')}>
          <Button
            onClick={handleVote}
            disabled={selectedOptions.length === 0 || isVoting}
            className="w-full"
          >
            {isVoting ? t('pollCard.voting') : t('pollCard.vote')}
          </Button>
        </CardFooter>
      )}

      {/* Show author if requested */}
      {showAuthor && (
        <CardFooter className="pt-0 text-xs text-muted-foreground">
          Created {formatDistanceToNow(poll.createdAt, { addSuffix: true })}
        </CardFooter>
      )}
    </Card>
  );
};
