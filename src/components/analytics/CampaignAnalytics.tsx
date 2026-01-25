/**
 * Campaign Analytics Component
 * Provides analytics for campaign performance and engagement
 */

import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Calendar,
  Vote,
  MessageSquare,
  Heart,
  TrendingUp,
  Download,
  Trophy
} from 'lucide-react';

interface CampaignAnalyticsProps {
  className?: string;
}

// Demo data - in real app, this would come from database queries
const DEMO_DATA = {
  membershipGrowth: {
    total: 342,
    thisMonth: 28,
    lastMonth: 21,
    trend: '+33.3%',
    monthlyData: [
      { month: 'May', members: 286 },
      { month: 'Jun', members: 293 },
      { month: 'Jul', members: 314 },
      { month: 'Aug', members: 342 }
    ]
  },
  eventMetrics: {
    totalEvents: 12,
    avgAttendance: 45,
    rsvpRate: '78%',
    showUpRate: '67%',
    upcomingEvents: 3,
    recentEvents: [
      { name: 'Climate Rally', rsvp: 67, actual: 52, rate: '77.6%' },
      { name: 'Organizing Workshop', rsvp: 45, actual: 38, rate: '84.4%' },
      { name: 'Community Meeting', rsvp: 32, actual: 28, rate: '87.5%' }
    ]
  },
  governanceMetrics: {
    totalProposals: 18,
    activeVotes: 2,
    avgTurnout: '64%',
    consensusRate: '82%',
    recentVotes: [
      { title: 'Rent Strike Resolution', turnout: '71%', outcome: 'Passed' },
      { title: 'Profit Sharing Amendment', turnout: '58%', outcome: 'Discussion' },
      { title: 'Community Garden Purchase', turnout: '63%', outcome: 'Passed' }
    ]
  },
  engagementMetrics: {
    posts: 127,
    reactions: 842,
    comments: 315,
    avgEngagementRate: '6.8%',
    topContributors: [
      { name: 'Sarah Chen', posts: 23, reactions: 156 },
      { name: 'Marcus Johnson', posts: 18, reactions: 132 },
      { name: 'Emma Rodriguez', posts: 21, reactions: 145 }
    ]
  },
  wins: [
    {
      title: 'City Council Renewable Energy Vote',
      date: '2025-09-28',
      description: '7-2 vote to transition all municipal buildings to 100% renewable by 2025',
      impact: 'Major'
    },
    {
      title: 'Tenant Union Recognition',
      date: '2025-08-15',
      description: 'Landlord agreed to recognize tenant union and negotiate in good faith',
      impact: 'Moderate'
    },
    {
      title: 'Community Garden Secured',
      date: '2025-07-10',
      description: 'Successfully purchased vacant lot for community garden',
      impact: 'Moderate'
    }
  ]
};

export const CampaignAnalytics: FC<CampaignAnalyticsProps> = ({ className }) => {
  const { t } = useTranslation();

  const handleExportCSV = () => {
    // Generate CSV data
    const csvRows = [
      // Header
      ['Metric', 'Value'],
      ['Total Members', '342'],
      ['Member Growth (this month)', '+28'],
      ['Average Event Attendance', '45'],
      ['Show-up Rate', '67%'],
      ['Vote Turnout', '64%'],
      ['Active Votes', '2'],
      ['Engagement Rate', '6.8%'],
      ['Total Reactions', '842'],
      [''],
      ['Event', 'RSVPs', 'Show-ups', 'Show-up Rate'],
      ...DEMO_DATA.eventMetrics.recentEvents.map(event => [ // Fixed: use eventMetrics.recentEvents
        event.name,
        event.rsvp.toString(), // Fixed: use 'rsvp' not 'rsvps'
        event.actual.toString(), // Fixed: use 'actual' not 'showUps'
        event.rate // Fixed: use 'rate' not 'showUpRate'
      ]),
      [''],
      ['Vote', 'Turnout', 'Outcome'],
      ...DEMO_DATA.governanceMetrics.recentVotes.map(vote => [ // Fixed: use governanceMetrics.recentVotes
        vote.title,
        vote.turnout,
        vote.outcome
      ]),
      [''],
      ['Top Contributor', 'Posts', 'Reactions'],
      ...DEMO_DATA.engagementMetrics.topContributors.map(contributor => [ // Fixed: use engagementMetrics.topContributors
        contributor.name,
        contributor.posts.toString(),
        contributor.reactions.toString()
      ])
    ];

    // Convert to CSV string
    const csvContent = csvRows.map(row => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `campaign-analytics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('campaignAnalytics.title')}</h2>
          <p className="text-muted-foreground">
            {t('campaignAnalytics.description')}
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          {t('campaignAnalytics.exportCSV')}
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.totalMembers')}</p>
              <p className="text-2xl font-bold">{DEMO_DATA.membershipGrowth.total}</p>
              <p className="text-xs text-green-500">
                +{DEMO_DATA.membershipGrowth.thisMonth} {t('campaignAnalytics.thisMonth')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.avgEventAttendance')}</p>
              <p className="text-2xl font-bold">{DEMO_DATA.eventMetrics.avgAttendance}</p>
              <p className="text-xs text-muted-foreground">
                {DEMO_DATA.eventMetrics.showUpRate} {t('campaignAnalytics.showUpRate')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Vote className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.voteTurnout')}</p>
              <p className="text-2xl font-bold">{DEMO_DATA.governanceMetrics.avgTurnout}</p>
              <p className="text-xs text-muted-foreground">
                {DEMO_DATA.governanceMetrics.activeVotes} {t('campaignAnalytics.activeVotes')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Heart className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.engagementRate')}</p>
              <p className="text-2xl font-bold">{DEMO_DATA.engagementMetrics.avgEngagementRate}</p>
              <p className="text-xs text-muted-foreground">
                {DEMO_DATA.engagementMetrics.reactions} {t('campaignAnalytics.reactions')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Membership Growth */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {t('campaignAnalytics.membershipGrowth')}
        </h3>

        <div className="space-y-4">
          {/* Simple bar chart */}
          <div className="flex items-end gap-4 h-48">
            {DEMO_DATA.membershipGrowth.monthlyData.map((data, _index) => (
              <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-primary rounded-t transition-all duration-300 hover:bg-primary/80"
                    style={{
                      height: `${(data.members / DEMO_DATA.membershipGrowth.total) * 100}%`
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{data.month}</p>
                  <p className="text-xs text-muted-foreground">{data.members}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.thisMonth')}</p>
              <p className="text-xl font-bold text-green-500">
                +{DEMO_DATA.membershipGrowth.thisMonth}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.lastMonth')}</p>
              <p className="text-xl font-bold">+{DEMO_DATA.membershipGrowth.lastMonth}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.growth')}</p>
              <p className="text-xl font-bold text-green-500">
                {DEMO_DATA.membershipGrowth.trend}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Event Metrics */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {t('campaignAnalytics.eventAttendance')}
          </h3>

          <div className="space-y-3">
            {DEMO_DATA.eventMetrics.recentEvents.map((event) => (
              <div key={event.name} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{event.name}</span>
                  <span className="text-xs text-muted-foreground">{event.rate}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{t('campaignAnalytics.rsvp')}: {event.rsvp}</span>
                  <span>•</span>
                  <span>{t('campaignAnalytics.actual')}: {event.actual}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.rsvpRate')}</p>
              <p className="text-xl font-bold">{DEMO_DATA.eventMetrics.rsvpRate}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.showUpRateLabel')}</p>
              <p className="text-xl font-bold">{DEMO_DATA.eventMetrics.showUpRate}</p>
            </div>
          </div>
        </Card>

        {/* Governance Participation */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Vote className="w-5 h-5" />
            {t('campaignAnalytics.governanceParticipation')}
          </h3>

          <div className="space-y-3">
            {DEMO_DATA.governanceMetrics.recentVotes.map((vote) => (
              <div key={vote.title} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{vote.title}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      vote.outcome === 'Passed'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-blue-500/10 text-blue-500'
                    }`}
                  >
                    {vote.outcome === 'Passed' ? t('campaignAnalytics.passed') : t('campaignAnalytics.discussion')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t('campaignAnalytics.turnout')}: {vote.turnout}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.avgTurnout')}</p>
              <p className="text-xl font-bold">{DEMO_DATA.governanceMetrics.avgTurnout}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('campaignAnalytics.consensusRate')}</p>
              <p className="text-xl font-bold">{DEMO_DATA.governanceMetrics.consensusRate}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Engagement Trends */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {t('campaignAnalytics.engagementTrends')}
        </h3>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-3xl font-bold">{DEMO_DATA.engagementMetrics.posts}</p>
            <p className="text-sm text-muted-foreground">{t('campaignAnalytics.posts')}</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-3xl font-bold">{DEMO_DATA.engagementMetrics.reactions}</p>
            <p className="text-sm text-muted-foreground">{t('campaignAnalytics.reactions')}</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-3xl font-bold">{DEMO_DATA.engagementMetrics.comments}</p>
            <p className="text-sm text-muted-foreground">{t('campaignAnalytics.comments')}</p>
          </div>
        </div>

        <h4 className="text-sm font-semibold mb-3">{t('campaignAnalytics.topContributors')}</h4>
        <div className="space-y-2">
          {DEMO_DATA.engagementMetrics.topContributors.map((contributor, idx) => (
            <div key={contributor.name} className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-6">
                #{idx + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{contributor.name}</span>
              <span className="text-xs text-muted-foreground">
                {t('campaignAnalytics.postsReactions', { posts: contributor.posts, reactions: contributor.reactions })}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Campaign Wins */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" data-testid="trophy-icon" />
          {t('campaignAnalytics.campaignWins')}
        </h3>

        <div className="space-y-4">
          {DEMO_DATA.wins.map((win) => (
            <div key={win.title} className="border-l-4 border-yellow-500 pl-4 py-2">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h4 className="font-semibold">{win.title}</h4>
                <span
                  className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                    win.impact === 'Major'
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : 'bg-blue-500/10 text-blue-500'
                  }`}
                >
                  {win.impact === 'Major' ? t('campaignAnalytics.majorImpact') : t('campaignAnalytics.moderateImpact')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{win.description}</p>
              <p className="text-xs text-muted-foreground">{win.date}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
