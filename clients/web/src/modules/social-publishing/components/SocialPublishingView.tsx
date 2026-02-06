/**
 * SocialPublishingView
 *
 * Main view for the Social Publishing module. Provides tabbed access to
 * the content calendar, outreach dashboard, share links, and scheduled queue.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  CalendarIcon,
  BarChart2,
  Link2,
  Clock,
} from 'lucide-react';
import { ContentCalendar } from './ContentCalendar';
import { OutreachDashboard } from './OutreachDashboard';
import { useSocialPublishingStore } from '../socialPublishingStore';

interface SocialPublishingViewProps {
  groupId?: string;
}

export function SocialPublishingView({ groupId }: SocialPublishingViewProps) {
  const { t } = useTranslation();
  const store = useSocialPublishingStore();
  const [activeTab, setActiveTab] = useState('calendar');

  const pendingCount = store.getPendingScheduled().length;
  const activeLinksCount = store.getActiveShareLinks().length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t('social-publishing.name', 'Social Publishing')}
        </h2>
        <p className="text-muted-foreground">
          {t('social-publishing.description', 'Schedule, share, and cross-post content across platforms')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('social-publishing.calendar.title', 'Calendar')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="outreach" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('social-publishing.outreach.dashboard', 'Dashboard')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="links" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('social-publishing.outreach.activeLinks', 'Active Links')}
            </span>
            {activeLinksCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeLinksCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('social-publishing.outreach.scheduled', 'Scheduled')}
            </span>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <ContentCalendar groupId={groupId} />
        </TabsContent>

        <TabsContent value="outreach" className="mt-6">
          <OutreachDashboard />
        </TabsContent>

        <TabsContent value="links" className="mt-6">
          <ShareLinksListView />
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <ScheduledQueueView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Active share links list */
function ShareLinksListView() {
  const store = useSocialPublishingStore();
  const activeLinks = store.getActiveShareLinks();

  if (activeLinks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Link2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p>No active share links</p>
        <p className="text-sm">
          Share links are created when you share content from any module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeLinks.map((link) => (
        <div
          key={link.id}
          className="flex items-center gap-3 p-4 rounded-lg border"
        >
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono truncate">
              /s/{link.slug}
            </p>
            <p className="text-xs text-muted-foreground">
              {link.sourceModule} — {link.clickCount ?? 0} clicks
            </p>
          </div>
          <div className="flex gap-1">
            {link.trackClicks && (
              <Badge variant="secondary" className="text-xs">Tracking</Badge>
            )}
            {link.expiresAt && (
              <Badge variant="outline" className="text-xs">
                Expires {new Date(link.expiresAt * 1000).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Scheduled content queue */
function ScheduledQueueView() {
  const { t } = useTranslation();
  const store = useSocialPublishingStore();
  const scheduled = store.scheduledContent
    .filter((s) => s.status === 'pending' || s.status === 'publishing')
    .sort((a, b) => a.scheduledAt - b.scheduledAt);

  if (scheduled.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p>No scheduled content</p>
        <p className="text-sm">
          Schedule content from any module to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scheduled.map((item) => {
        const scheduledDate = new Date(item.scheduledAt * 1000);
        const isOverdue = scheduledDate < new Date();
        const platforms = item.crossPostConfig?.platforms.filter((p) => p.enabled) ?? [];

        return (
          <div
            key={item.id}
            className="flex items-start gap-3 p-4 rounded-lg border"
          >
            <div
              className={`h-3 w-3 rounded-full mt-1 shrink-0 ${
                isOverdue ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
            />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-medium truncate">
                {item.sourceModule}/{item.sourceContentId}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {scheduledDate.toLocaleString()}
              </div>
              {platforms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {platforms.map((p) => (
                    <Badge key={p.platform} variant="outline" className="text-xs">
                      {p.platform}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Badge
              variant={isOverdue ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {item.status === 'publishing'
                ? t('social-publishing.status.publishing', 'Publishing')
                : isOverdue
                  ? 'Overdue'
                  : t('social-publishing.status.pending', 'Pending')}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
