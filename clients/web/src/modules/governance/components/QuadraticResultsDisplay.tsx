import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Trophy } from 'lucide-react';
import type { QuadraticResults } from '../types';
import type { VoteOption } from '../schema';

interface QuadraticResultsDisplayProps {
  results: QuadraticResults;
  options: VoteOption[];
}

/**
 * Displays the results of a quadratic voting round,
 * showing effective votes (sqrt-weighted), raw tokens, and voter counts.
 */
export const QuadraticResultsDisplay: FC<QuadraticResultsDisplayProps> = ({
  results,
  options,
}) => {
  const { t } = useTranslation();

  const maxEffectiveVotes = useMemo(
    () => Math.max(...Object.values(results.options).map(o => o.effectiveVotes), 0.001),
    [results.options]
  );

  const sortedOptions = useMemo(() => {
    return [...options]
      .map(option => ({
        option,
        result: results.options[option.id] ?? { totalTokens: 0, effectiveVotes: 0, voterCount: 0 },
      }))
      .sort((a, b) => b.result.effectiveVotes - a.result.effectiveVotes);
  }, [options, results.options]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t('governance.quadratic.results', 'Quadratic Voting Results')}
        </CardTitle>
        <CardDescription>
          {t(
            'governance.quadratic.resultsDescription',
            'Results weighted by square root of tokens allocated'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedOptions.map(({ option, result }, index) => {
          const isWinner = option.id === results.winner;
          const barPercentage = maxEffectiveVotes > 0
            ? (result.effectiveVotes / maxEffectiveVotes) * 100
            : 0;

          return (
            <div
              key={option.id}
              className={`rounded-lg border p-3 ${isWinner ? 'border-primary bg-primary/5' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isWinner && <Trophy className="h-4 w-4 text-primary" />}
                  <span className={`font-medium ${isWinner ? 'text-primary' : ''}`}>
                    {index + 1}. {option.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">
                    {result.effectiveVotes.toFixed(2)}{' '}
                    {t('governance.quadratic.effectiveVotes', 'effective votes')}
                  </span>
                </div>
              </div>

              <Progress value={barPercentage} className="h-2 mb-2" />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {result.totalTokens} {t('governance.quadratic.tokensAllocated', 'tokens allocated')}
                </span>
                <span>
                  {result.voterCount}{' '}
                  {result.voterCount === 1
                    ? t('governance.quadratic.voter', 'voter')
                    : t('governance.quadratic.voters', 'voters')
                  }
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
