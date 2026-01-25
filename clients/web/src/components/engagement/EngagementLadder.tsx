/**
 * Engagement Ladder Component
 * Shows current engagement level, next steps, and milestones in organizing journey
 * Implements Spectrum of Support methodology
 */

import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  CheckCircle2,
  Circle,
  ArrowRight,
  Target,
  Users,
  Calendar,
  MessageSquare,
  Award,
  Sparkles
} from 'lucide-react';

interface EngagementLevel {
  level: 'Neutral' | 'Passive Support' | 'Active Support' | 'Core Organizer';
  percentage: number;
  color: string;
  description: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  points: number;
}

interface NextStep {
  id: string;
  title: string;
  description: string;
  actionText: string;
  icon: typeof Calendar;
  estimatedTime: string;
}

interface EngagementLadderProps {
  currentLevel: EngagementLevel['level'];
  completedMilestones: string[];
  className?: string;
}

const ENGAGEMENT_LEVELS: Record<EngagementLevel['level'], EngagementLevel> = {
  'Neutral': {
    level: 'Neutral',
    percentage: 30,
    color: 'bg-gray-500',
    description: 'You\'re exploring and learning about our movement'
  },
  'Passive Support': {
    level: 'Passive Support',
    percentage: 40,
    color: 'bg-blue-500',
    description: 'You support our cause and stay informed'
  },
  'Active Support': {
    level: 'Active Support',
    percentage: 70,
    color: 'bg-green-500',
    description: 'You actively participate in events and actions'
  },
  'Core Organizer': {
    level: 'Core Organizer',
    percentage: 100,
    color: 'bg-purple-500',
    description: 'You help lead and organize our movement'
  }
};

const MILESTONES: Record<string, Milestone[]> = {
  'Neutral': [
    {
      id: 'attend-first-event',
      title: 'Attend Your First Event',
      description: 'Come to a community gathering or workshop',
      completed: false,
      points: 10
    },
    {
      id: 'join-group',
      title: 'Join a Working Group',
      description: 'Connect with others around a specific issue',
      completed: false,
      points: 15
    },
    {
      id: 'share-post',
      title: 'Share Our Content',
      description: 'Help spread awareness by sharing posts',
      completed: false,
      points: 5
    }
  ],
  'Passive Support': [
    {
      id: 'attend-three-events',
      title: 'Attend 3 Events',
      description: 'Build consistency in your participation',
      completed: false,
      points: 20
    },
    {
      id: 'take-action',
      title: 'Take Direct Action',
      description: 'Join a rally, protest, or direct action',
      completed: false,
      points: 25
    },
    {
      id: 'invite-friend',
      title: 'Bring a Friend',
      description: 'Invite someone to join the movement',
      completed: false,
      points: 15
    }
  ],
  'Active Support': [
    {
      id: 'volunteer-role',
      title: 'Take on a Volunteer Role',
      description: 'Commit to a regular organizing responsibility',
      completed: false,
      points: 30
    },
    {
      id: 'lead-outreach',
      title: 'Lead an Outreach',
      description: 'Organize a table, flyering, or phone bank',
      completed: false,
      points: 35
    },
    {
      id: 'complete-training',
      title: 'Complete Leadership Training',
      description: 'Develop your organizing skills',
      completed: false,
      points: 25
    }
  ],
  'Core Organizer': [
    {
      id: 'mentor',
      title: 'Mentor New Members',
      description: 'Guide and support new folks in the movement',
      completed: false,
      points: 40
    },
    {
      id: 'lead-campaign',
      title: 'Lead a Campaign',
      description: 'Take strategic leadership on an initiative',
      completed: false,
      points: 50
    },
    {
      id: 'develop-leaders',
      title: 'Develop Other Leaders',
      description: 'Help build the next generation of organizers',
      completed: false,
      points: 45
    }
  ]
};

const NEXT_STEPS: Record<string, NextStep[]> = {
  'Neutral': [
    {
      id: 'browse-events',
      title: 'Explore Upcoming Events',
      description: 'Find an event that interests you',
      actionText: 'Browse Events',
      icon: Calendar,
      estimatedTime: '5 min'
    },
    {
      id: 'read-wiki',
      title: 'Learn About Our Work',
      description: 'Read our wiki to understand our campaigns',
      actionText: 'Read Wiki',
      icon: MessageSquare,
      estimatedTime: '10 min'
    }
  ],
  'Passive Support': [
    {
      id: 'rsvp-event',
      title: 'RSVP to an Event',
      description: 'Commit to attending an upcoming action',
      actionText: 'See Events',
      icon: Calendar,
      estimatedTime: '2 min'
    },
    {
      id: 'join-working-group',
      title: 'Join a Working Group',
      description: 'Get involved with a specific campaign',
      actionText: 'View Groups',
      icon: Users,
      estimatedTime: '5 min'
    }
  ],
  'Active Support': [
    {
      id: 'volunteer-signup',
      title: 'Sign Up for a Role',
      description: 'Take on a regular responsibility',
      actionText: 'See Opportunities',
      icon: Target,
      estimatedTime: '10 min'
    },
    {
      id: 'leadership-training',
      title: 'Take Leadership Training',
      description: 'Build your organizing skills',
      actionText: 'Enroll Now',
      icon: Award,
      estimatedTime: '1 hour'
    }
  ],
  'Core Organizer': [
    {
      id: 'mentor-signup',
      title: 'Become a Mentor',
      description: 'Support new members in their journey',
      actionText: 'Sign Up',
      icon: Users,
      estimatedTime: '15 min'
    },
    {
      id: 'propose-campaign',
      title: 'Propose a Campaign',
      description: 'Start a new initiative',
      actionText: 'Submit Proposal',
      icon: Target,
      estimatedTime: '30 min'
    }
  ]
};

export const EngagementLadder: FC<EngagementLadderProps> = ({
  currentLevel,
  completedMilestones,
  className
}) => {
  const { t } = useTranslation();
  const currentLevelData = ENGAGEMENT_LEVELS[currentLevel];
  const milestones = MILESTONES[currentLevel].map(m => ({
    ...m,
    completed: completedMilestones.includes(m.id)
  }));
  const nextSteps = NEXT_STEPS[currentLevel];

  const completedCount = milestones.filter(m => m.completed).length;
  const totalCount = milestones.length;
  const progressPercentage = (completedCount / totalCount) * 100;

  // Calculate next level
  const levels: EngagementLevel['level'][] = ['Neutral', 'Passive Support', 'Active Support', 'Core Organizer'];
  const currentIndex = levels.indexOf(currentLevel);
  const nextLevel = currentIndex < levels.length - 1 ? ENGAGEMENT_LEVELS[levels[currentIndex + 1]] : null;

  return (
    <div className={`space-y-6 ${className}`} data-testid="engagement-ladder">
      {/* Current Level Card */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20" data-testid="current-level-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">{t('engagementLadder.title')}</h3>
            </div>
            <Badge className={`${currentLevelData.color} text-white text-sm px-3 py-1`} data-testid="engagement-level-badge">
              {currentLevel} ({currentLevelData.percentage}%)
            </Badge>
          </div>
          <TrendingUp className="w-8 h-8 text-primary" />
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {currentLevelData.description}
        </p>

        {/* Progress to Next Level */}
        {nextLevel && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('engagementLadder.progressTo', { level: nextLevel.level })}</span>
              <span className="font-medium">{t('engagementLadder.milestones', { completed: completedCount, total: totalCount })}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        )}

        {!nextLevel && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
            <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
              {t('engagementLadder.maxLevel')}
            </p>
          </div>
        )}
      </Card>

      {/* Next Steps */}
      <div data-testid="suggested-next-steps">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          {t('engagementLadder.nextSteps')}
        </h4>
        <div className="grid gap-3">
          {nextSteps.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.id} className="p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-sm mb-1">{step.title}</h5>
                    <p className="text-xs text-muted-foreground mb-2">{step.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">~{step.estimatedTime}</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        {step.actionText}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Milestones */}
      <div data-testid="milestones-section">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          {t('engagementLadder.milestonesFor', { level: currentLevel })}
        </h4>
        <div className="space-y-2">
          {milestones.map((milestone) => (
            <Card
              key={milestone.id}
              className={`p-4 ${milestone.completed ? 'bg-green-500/5 border-green-500/20' : ''}`}
            >
              <div className="flex items-start gap-3">
                {milestone.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className={`font-medium text-sm ${milestone.completed ? 'text-green-700 dark:text-green-300' : ''}`}>
                      {milestone.title}
                    </h5>
                    <Badge variant="outline" className="text-xs">
                      {t('engagementLadder.points', { points: milestone.points })}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{milestone.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Level Ladder Overview */}
      <Card className="p-4 bg-muted/30" data-testid="engagement-ladder-overview">
        <h4 className="font-semibold text-sm mb-3">{t('engagementLadder.ladderTitle')}</h4>
        <div className="space-y-2">
          {levels.map((level, index) => {
            const levelData = ENGAGEMENT_LEVELS[level];
            const isCurrent = level === currentLevel;
            const isPast = index < currentIndex;

            return (
              <div
                key={level}
                className={`flex items-center gap-3 p-2 rounded ${isCurrent ? 'bg-primary/10' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full ${levelData.color} ${!isCurrent && !isPast ? 'opacity-30' : ''}`} />
                <div className="flex-1">
                  <div className="text-xs font-medium">{level}</div>
                  <div className="text-xs text-muted-foreground">{levelData.percentage}%</div>
                </div>
                {isCurrent && (
                  <Badge variant="outline" className="text-xs">{t('engagementLadder.youAreHere')}</Badge>
                )}
                {isPast && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
