/**
 * OutreachDashboard Component
 *
 * Privacy-preserving analytics dashboard showing share link performance,
 * cross-post delivery status, and scheduled content queue.
 *
 * Analytics are session-based (random ID per visit) — no user identification,
 * no cookies, no fingerprinting.
 */

import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Link2,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  MousePointer,
  Activity,
} from 'lucide-react';
import { useSocialPublishingStore } from '../socialPublishingStore';

interface OutreachDashboardProps {
  className?: string;
}

export const OutreachDashboard: FC<OutreachDashboardProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  const store = useSocialPublishingStore();

  const summary = useMemo(() => store.getOutreachSummary(), [store]);
  const pendingContent = useMemo(() => store.getPendingScheduled(), [store]);

  const totalScheduled =
    summary.scheduledPending +
    summary.scheduledPublished +
    summary.scheduledFailed;
  const publishRate =
    totalScheduled > 0
      ? Math.round((summary.scheduledPublished / totalScheduled) * 100)
      : 0;

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Link2}
          label={t('social-publishing.outreach.activeLinks')}
          value={summary.activeShareLinks}
          subtitle={`${summary.totalShareLinks} total`}
        />
        <StatCard
          icon={MousePointer}
          label={t('social-publishing.outreach.totalClicks')}
          value={summary.totalClicks}
          subtitle="Privacy-preserving"
        />
        <StatCard
          icon={Clock}
          label={t('social-publishing.outreach.scheduled')}
          value={summary.scheduledPending}
          subtitle="Pending"
        />
        <StatCard
          icon={CheckCircle2}
          label={t('social-publishing.outreach.published')}
          value={summary.scheduledPublished}
          subtitle={`${publishRate}% success rate`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              {t('social-publishing.outreach.topLinks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.topLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No share links yet
              </p>
            ) : (
              <div className="space-y-3">
                {summary.topLinks.map((link, index) => (
                  <div
                    key={link.slug}
                    className="flex items-center gap-3"
                  >
                    <span className="text-sm font-mono text-muted-foreground w-6 text-right">
                      {index + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {link.title}
                        </p>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <MousePointer className="h-3 w-3 mr-1" />
                          {link.clickCount}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        /s/{link.slug}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Publishing Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              Publishing Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingContent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No scheduled content
              </p>
            ) : (
              <div className="space-y-3">
                {pendingContent.slice(0, 8).map((item) => {
                  const scheduledDate = new Date(item.scheduledAt * 1000);
                  const isOverdue = scheduledDate < new Date();
                  const platformCount =
                    item.crossPostConfig?.platforms.filter(
                      (p) => p.enabled
                    ).length ?? 0;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-lg border"
                    >
                      <div
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isOverdue ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {item.sourceModule}/{item.sourceContentId}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {scheduledDate.toLocaleString()}
                          {platformCount > 0 && (
                            <span>
                              {platformCount} platform{platformCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={isOverdue ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {isOverdue ? 'Overdue' : 'Pending'}
                      </Badge>
                    </div>
                  );
                })}
                {pendingContent.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{pendingContent.length - 8} more
                  </p>
                )}
              </div>
            )}

            {/* Delivery stats */}
            {summary.scheduledFailed > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  {summary.scheduledFailed} failed delivery{summary.scheduledFailed > 1 ? 's' : ''}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/** Small stat card for dashboard metrics */
const StatCard: FC<{
  icon: FC<{ className?: string }>;
  label: string;
  value: number;
  subtitle: string;
}> = ({ icon: Icon, label, value, subtitle }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);
