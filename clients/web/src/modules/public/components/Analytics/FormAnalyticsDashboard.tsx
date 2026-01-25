/**
 * Form Analytics Dashboard
 * Privacy-preserving analytics for forms
 */

import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { TrendingUp, Eye, Send, BarChart } from 'lucide-react';
import type { AnalyticsSummary } from '../../types';

interface FormAnalyticsDashboardProps {
  summary: AnalyticsSummary;
}

export function FormAnalyticsDashboard({ summary }: FormAnalyticsDashboardProps) {
  const { t } = useTranslation();

  const stats = [
    {
      label: t('formAnalyticsDashboard.totalViews'),
      value: summary.views.toLocaleString(),
      icon: Eye,
      color: 'text-blue-600',
    },
    {
      label: t('formAnalyticsDashboard.submissions'),
      value: (summary.submissions || 0).toLocaleString(),
      icon: Send,
      color: 'text-green-600',
    },
    {
      label: t('formAnalyticsDashboard.conversionRate'),
      value: `${(summary.conversionRate || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t('formAnalyticsDashboard.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('formAnalyticsDashboard.subtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <h4 className="font-semibold">{t('formAnalyticsDashboard.topReferrers')}</h4>
          </div>
          <div className="space-y-2">
            {summary.topReferrers.slice(0, 5).map((referrer, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm truncate flex-1">{referrer.referrer || t('formAnalyticsDashboard.direct')}</span>
                <span className="text-sm font-medium">{referrer.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
