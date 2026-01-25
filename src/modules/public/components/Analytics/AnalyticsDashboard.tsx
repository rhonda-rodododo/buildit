/**
 * Analytics Dashboard
 * Privacy-preserving analytics for all public resources
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  Eye,
  Send,
  DollarSign,
  MousePointer,
  Share2,
  BarChart,
  Calendar,
} from 'lucide-react';
import type { AnalyticsSummary, AnalyticsResource } from '../../types';
import { usePublicStore } from '../../publicStore';

interface AnalyticsDashboardProps {
  resourceType: AnalyticsResource;
  resourceId: string;
}

export function AnalyticsDashboard({ resourceType, resourceId }: AnalyticsDashboardProps) {
  const { t } = useTranslation();
  const [timeframe, setTimeframe] = useState<AnalyticsSummary['timeframe']>('week');

  const getSummary = usePublicStore((state) => state.getAnalyticsSummary);
  const summary = getSummary(resourceType, resourceId, timeframe);

  if (!summary) {
    return (
      <Card className="p-12 text-center">
        <BarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('analyticsDashboard.empty.title')}</h3>
        <p className="text-muted-foreground">
          {t('analyticsDashboard.empty.description')}
        </p>
      </Card>
    );
  }

  const stats = [
    {
      label: t('analyticsDashboard.stats.totalViews'),
      value: summary.views.toLocaleString(),
      icon: Eye,
      color: 'text-blue-600',
      show: true,
    },
    {
      label: t('analyticsDashboard.stats.submissions'),
      value: (summary.submissions || 0).toLocaleString(),
      icon: Send,
      color: 'text-green-600',
      show: resourceType === 'form',
    },
    {
      label: t('analyticsDashboard.stats.donations'),
      value: (summary.donations || 0).toLocaleString(),
      icon: DollarSign,
      color: 'text-emerald-600',
      show: resourceType === 'campaign',
    },
    {
      label: t('analyticsDashboard.stats.totalRaised'),
      value: summary.totalRaised
        ? `$${(summary.totalRaised / 100).toLocaleString()}`
        : '$0',
      icon: DollarSign,
      color: 'text-emerald-600',
      show: resourceType === 'campaign',
    },
    {
      label: t('analyticsDashboard.stats.clicks'),
      value: (summary.clicks || 0).toLocaleString(),
      icon: MousePointer,
      color: 'text-orange-600',
      show: summary.clicks !== undefined,
    },
    {
      label: t('analyticsDashboard.stats.shares'),
      value: (summary.shares || 0).toLocaleString(),
      icon: Share2,
      color: 'text-pink-600',
      show: summary.shares !== undefined,
    },
    {
      label: t('analyticsDashboard.stats.conversionRate'),
      value: `${(summary.conversionRate || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      show: summary.conversionRate !== undefined,
    },
  ].filter((stat) => stat.show);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('analyticsDashboard.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('analyticsDashboard.description')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={timeframe}
            onValueChange={(v) => setTimeframe(v as AnalyticsSummary['timeframe'])}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('analyticsDashboard.timeframes.day')}</SelectItem>
              <SelectItem value="week">{t('analyticsDashboard.timeframes.week')}</SelectItem>
              <SelectItem value="month">{t('analyticsDashboard.timeframes.month')}</SelectItem>
              <SelectItem value="year">{t('analyticsDashboard.timeframes.year')}</SelectItem>
              <SelectItem value="all">{t('analyticsDashboard.timeframes.all')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Top Referrers */}
      {summary.topReferrers && summary.topReferrers.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart className="h-5 w-5 text-muted-foreground" />
            <h4 className="font-semibold">{t('analyticsDashboard.topReferrers.title')}</h4>
            <span className="text-sm text-muted-foreground ml-auto">
              {t('analyticsDashboard.topReferrers.privacyNote')}
            </span>
          </div>
          <div className="space-y-3">
            {summary.topReferrers.slice(0, 10).map((referrer, index) => {
              const domain = referrer.referrer || t('analyticsDashboard.topReferrers.direct');
              const percentage = summary.views > 0
                ? ((referrer.count / summary.views) * 100).toFixed(1)
                : '0.0';

              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate flex-1 font-medium">{domain}</span>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-sm text-muted-foreground">{percentage}%</span>
                      <span className="text-sm font-medium w-12 text-right">
                        {referrer.count}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Privacy Notice */}
      <Card className="p-4 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          <strong>{t('analyticsDashboard.privacyNotice.title')}</strong> {t('analyticsDashboard.privacyNotice.description')}
        </p>
      </Card>

      {/* Last Updated */}
      <div className="text-xs text-muted-foreground text-center">
        {t('analyticsDashboard.lastUpdated', { date: new Date(summary.computedAt).toLocaleString() })}
      </div>
    </div>
  );
}
