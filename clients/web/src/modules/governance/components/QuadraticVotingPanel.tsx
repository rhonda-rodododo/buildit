import { FC, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Calculator, Vote } from 'lucide-react';
import type { VoteOption, QuadraticBallot, QuadraticVotingConfig } from '../schema';

interface QuadraticVotingPanelProps {
  options: VoteOption[];
  config: QuadraticVotingConfig;
  onSubmit: (ballot: QuadraticBallot) => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}

/**
 * QuadraticVotingPanel renders token allocation controls for quadratic voting.
 *
 * Each voter has a token budget. Allocating tokens to an option yields
 * effective votes = sqrt(tokens). This means the cost of N votes is N^2 tokens,
 * encouraging voters to spread allocations across multiple options rather than
 * concentrating on one.
 */
export const QuadraticVotingPanel: FC<QuadraticVotingPanelProps> = ({
  options,
  config,
  onSubmit,
  disabled = false,
  isSubmitting = false,
}) => {
  const { t } = useTranslation();
  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const option of options) {
      initial[option.id] = 0;
    }
    return initial;
  });

  const totalUsed = useMemo(
    () => Object.values(allocations).reduce((sum, tokens) => sum + tokens, 0),
    [allocations]
  );

  const remaining = config.tokenBudget - totalUsed;
  const budgetPercentUsed = (totalUsed / config.tokenBudget) * 100;

  const effectiveVotes = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [optionId, tokens] of Object.entries(allocations)) {
      result[optionId] = tokens > 0 ? Math.round(Math.sqrt(tokens) * 1000) / 1000 : 0;
    }
    return result;
  }, [allocations]);

  const handleAllocationChange = useCallback((optionId: string, value: number) => {
    const clamped = Math.max(0, Math.floor(value));
    const maxForOption = config.maxTokensPerOption
      ? Math.min(config.maxTokensPerOption, config.tokenBudget)
      : config.tokenBudget;

    // Don't let the user exceed budget
    const otherAllocations = Object.entries(allocations)
      .filter(([id]) => id !== optionId)
      .reduce((sum, [, tokens]) => sum + tokens, 0);

    const maxAllowable = Math.min(maxForOption, config.tokenBudget - otherAllocations);
    const finalValue = Math.min(clamped, maxAllowable);

    setAllocations(prev => ({
      ...prev,
      [optionId]: finalValue,
    }));
  }, [allocations, config.tokenBudget, config.maxTokensPerOption]);

  const handleSubmit = useCallback(() => {
    // Filter out zero allocations for cleaner ballot
    const nonZeroAllocations: Record<string, number> = {};
    for (const [optionId, tokens] of Object.entries(allocations)) {
      if (tokens > 0) {
        nonZeroAllocations[optionId] = tokens;
      }
    }

    const ballot: QuadraticBallot = {
      allocations: nonZeroAllocations,
      totalTokens: totalUsed,
    };

    onSubmit(ballot);
  }, [allocations, totalUsed, onSubmit]);

  const hasAnyAllocation = totalUsed > 0;

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [options]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          {t('governance.quadratic.title', 'Quadratic Voting')}
        </CardTitle>
        <CardDescription>
          {t(
            'governance.quadratic.description',
            'Allocate tokens across options. The cost of N effective votes is N\u00B2 tokens. Spread your tokens to maximize influence.'
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Token Budget Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {t('governance.quadratic.tokenBudget', 'Token Budget')}
            </span>
            <span className={remaining < 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}>
              {totalUsed} / {config.tokenBudget}{' '}
              {t('governance.quadratic.tokensUsed', 'used')}
              {remaining > 0 && (
                <span className="ml-1">
                  ({remaining} {t('governance.quadratic.remaining', 'remaining')})
                </span>
              )}
            </span>
          </div>
          <Progress value={Math.min(budgetPercentUsed, 100)} className="h-3" />
        </div>

        {/* Cost Curve Explanation */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>{t('governance.quadratic.howItWorks', 'How it works')}:</strong>{' '}
            {t(
              'governance.quadratic.costExplanation',
              '1 token = 1 vote, 4 tokens = 2 votes, 9 tokens = 3 votes, 16 tokens = 4 votes. This prevents any single issue from dominating.'
            )}
          </p>
        </div>

        {/* Option Allocation Controls */}
        <div className="space-y-4">
          {sortedOptions.map(option => {
            const tokens = allocations[option.id] ?? 0;
            const votes = effectiveVotes[option.id] ?? 0;
            const maxForOption = config.maxTokensPerOption
              ? Math.min(config.maxTokensPerOption, config.tokenBudget)
              : config.tokenBudget;

            return (
              <div key={option.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">{option.label}</Label>
                    {option.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-primary">
                      {votes.toFixed(2)} {t('governance.quadratic.votes', 'votes')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tokens} {t('governance.quadratic.tokens', 'tokens')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleAllocationChange(option.id, tokens - 1)}
                    disabled={disabled || tokens <= 0}
                  >
                    -
                  </Button>

                  <Input
                    type="number"
                    min={0}
                    max={maxForOption}
                    value={tokens}
                    onChange={(e) => handleAllocationChange(option.id, parseInt(e.target.value) || 0)}
                    className="h-8 text-center w-20"
                    disabled={disabled}
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleAllocationChange(option.id, tokens + 1)}
                    disabled={disabled || remaining <= 0}
                  >
                    +
                  </Button>

                  <div className="flex-1">
                    <Progress
                      value={maxForOption > 0 ? (tokens / maxForOption) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                </div>

                {/* Quick allocation buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 4, 9, 16, 25].filter(v => v <= config.tokenBudget).map(preset => (
                    <Button
                      key={preset}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleAllocationChange(option.id, preset)}
                      disabled={disabled}
                    >
                      {preset}t = {Math.sqrt(preset).toFixed(1)}v
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Validation Warning */}
        {remaining < 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t(
                'governance.quadratic.overBudget',
                'You have exceeded your token budget. Please reduce your allocations.'
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || !hasAnyAllocation || remaining < 0}
          className="w-full"
        >
          <Vote className="h-4 w-4 mr-2" />
          {isSubmitting
            ? t('governance.quadratic.submitting', 'Submitting...')
            : t('governance.quadratic.submitBallot', 'Submit Quadratic Ballot')
          }
        </Button>
      </CardContent>
    </Card>
  );
};
