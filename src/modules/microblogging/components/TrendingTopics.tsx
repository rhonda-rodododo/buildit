/**
 * Trending Topics Component
 * Epic 61: Display trending hashtags and topics
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus, Hash, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSocialFeaturesStore } from '../socialFeaturesStore';
import { usePostsStore } from '../postsStore';
import type { TrendingTopic } from '../types';

interface TrendingTopicsProps {
  limit?: number;
  onTopicClick?: (tag: string) => void;
  className?: string;
}

export function TrendingTopics({ limit = 10, onTopicClick, className }: TrendingTopicsProps) {
  const { t } = useTranslation();
  const trendingTopics = useSocialFeaturesStore((s) => s.trendingTopics);
  const refreshTrending = useSocialFeaturesStore((s) => s.refreshTrending);
  const setFeedFilter = usePostsStore((s) => s.setFeedFilter);

  useEffect(() => {
    refreshTrending();
  }, [refreshTrending]);

  const handleTopicClick = (tag: string) => {
    if (onTopicClick) {
      onTopicClick(tag);
    } else {
      // Default behavior: filter feed by hashtag
      setFeedFilter({ hashtags: [tag] });
    }
  };

  const getTrendIcon = (trend: TrendingTopic['trend']) => {
    switch (trend) {
      case 'rising':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'falling':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const displayTopics = trendingTopics.slice(0, limit);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t('trending.title', 'Trending')}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => refreshTrending()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {displayTopics.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('trending.empty', 'No trending topics yet')}
          </p>
        ) : (
          <div className="space-y-1">
            {displayTopics.map((topic, index) => (
              <button
                key={topic.tag}
                onClick={() => handleTopicClick(topic.tag)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                {/* Rank */}
                <span className="text-sm font-medium text-muted-foreground w-5">
                  {index + 1}
                </span>

                {/* Topic info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-sm truncate">{topic.tag}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {topic.recentPostCount} {t('trending.posts', 'posts')}
                  </p>
                </div>

                {/* Trend indicator */}
                {getTrendIcon(topic.trend)}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
