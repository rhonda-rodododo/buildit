/**
 * Anonymous Reactions Component
 * Allows users to react anonymously to posts and proposals
 * Critical for high-risk organizing where public support can be dangerous
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ThumbsUp,
  Heart,
  Lightbulb,
  Flag,
  Eye,
  EyeOff,
  Shield} from 'lucide-react';

interface Reaction {
  type: 'like' | 'love' | 'idea' | 'concern';
  count: number;
  userReacted: boolean;
  anonymous: boolean;
}

interface AnonymousReactionsProps {
  postId: string;
  initialReactions?: Reaction[];
  allowAnonymous?: boolean;
  defaultAnonymous?: boolean;
  showAnonymousCounts?: boolean;
  className?: string;
}

export const AnonymousReactions: FC<AnonymousReactionsProps> = ({
  initialReactions = [
    { type: 'like', count: 12, userReacted: false, anonymous: false },
    { type: 'love', count: 5, userReacted: false, anonymous: false },
    { type: 'idea', count: 3, userReacted: false, anonymous: false },
    { type: 'concern', count: 1, userReacted: false, anonymous: false }
  ],
  allowAnonymous = true,
  defaultAnonymous = false,
  showAnonymousCounts = true,
  className
}) => {
  const { t } = useTranslation();
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions);
  const [isAnonymousMode, setIsAnonymousMode] = useState(defaultAnonymous);

  const getReactionIcon = (type: Reaction['type']) => {
    switch (type) {
      case 'like': return <ThumbsUp className="w-4 h-4" />;
      case 'love': return <Heart className="w-4 h-4" />;
      case 'idea': return <Lightbulb className="w-4 h-4" />;
      case 'concern': return <Flag className="w-4 h-4" />;
    }
  };

  const getReactionLabel = (type: Reaction['type']) => {
    switch (type) {
      case 'like': return t('anonymousReactions.reactions.support');
      case 'love': return t('anonymousReactions.reactions.solidarity');
      case 'idea': return t('anonymousReactions.reactions.greatIdea');
      case 'concern': return t('anonymousReactions.reactions.concern');
    }
  };

  const getReactionColor = (type: Reaction['type']) => {
    switch (type) {
      case 'like': return 'hover:bg-blue-500/10 hover:text-blue-500 data-[active=true]:bg-blue-500/10 data-[active=true]:text-blue-500';
      case 'love': return 'hover:bg-red-500/10 hover:text-red-500 data-[active=true]:bg-red-500/10 data-[active=true]:text-red-500';
      case 'idea': return 'hover:bg-yellow-500/10 hover:text-yellow-500 data-[active=true]:bg-yellow-500/10 data-[active=true]:text-yellow-500';
      case 'concern': return 'hover:bg-orange-500/10 hover:text-orange-500 data-[active=true]:bg-orange-500/10 data-[active=true]:text-orange-500';
    }
  };

  const handleReaction = (type: Reaction['type']) => {
    setReactions(prev => prev.map(r => {
      if (r.type === type) {
        return {
          ...r,
          count: r.userReacted ? r.count - 1 : r.count + 1,
          userReacted: !r.userReacted,
          anonymous: isAnonymousMode
        };
      }
      // Remove other reactions if user already reacted
      if (r.userReacted) {
        return { ...r, count: r.count - 1, userReacted: false };
      }
      return r;
    }));
  };

  const userReaction = reactions.find(r => r.userReacted);
  const anonymousCount = reactions.reduce((sum, r) => sum + (r.anonymous ? r.count : 0), 0);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Anonymous Mode Toggle */}
      {allowAnonymous && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <div>
              <div className="text-sm font-medium">{t('anonymousReactions.anonymousMode')}</div>
              <div className="text-xs text-muted-foreground">{t('anonymousReactions.anonymousModeDesc')}</div>
            </div>
          </div>

          <Button
            variant={isAnonymousMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsAnonymousMode(!isAnonymousMode)}
            className="gap-2"
          >
            {isAnonymousMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isAnonymousMode ? t('anonymousReactions.anonymous') : t('anonymousReactions.public')}
          </Button>
        </div>
      )}

      {/* Reactions */}
      <div className="flex items-center gap-2 flex-wrap">
        {reactions.map((reaction) => {
          const Icon = getReactionIcon(reaction.type);
          return (
            <button
              key={reaction.type}
              onClick={() => handleReaction(reaction.type)}
              data-active={reaction.userReacted}
              title={getReactionLabel(reaction.type)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border
                transition-colors
                ${getReactionColor(reaction.type)}
                ${reaction.userReacted ? 'border-current' : 'border-border'}
              `}
            >
              {Icon}
              <span className="text-sm font-medium">{reaction.count}</span>
            </button>
          );
        })}
      </div>

      {/* Privacy Info */}
      {showAnonymousCounts && anonymousCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <EyeOff className="w-3 h-3" />
          <span>{t('anonymousReactions.anonymousCount', { count: anonymousCount })}</span>
        </div>
      )}

      {userReaction && userReaction.anonymous && (
        <Badge variant="outline" className="gap-1 text-xs">
          <Shield className="w-3 h-3" />
          {t('anonymousReactions.yourReactionAnonymous')}
        </Badge>
      )}
    </div>
  );
};
