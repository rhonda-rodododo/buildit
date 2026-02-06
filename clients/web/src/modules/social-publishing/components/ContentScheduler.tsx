/**
 * ContentScheduler Component
 *
 * Reusable scheduler that any module can embed for scheduling content.
 * Supports date/time picking, timezone, platform selection, per-platform
 * content preview, and recurrence options.
 *
 * Privacy: No third-party services. All scheduling goes through
 * the federation worker (pre-signed events, zero-knowledge).
 */

import { FC, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CalendarIcon,
  Repeat,
  Send,
  Globe,
  Radio,
  Rss,
  AtSign,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { ScheduleContentInput } from '../types';
import { getSocialPublishingManager } from '../socialPublishingManager';
import { useAuthStore } from '@/stores/authStore';

type PlatformId = 'nostr' | 'activitypub' | 'atproto' | 'rss';

interface PlatformConfig {
  platform: PlatformId;
  enabled: boolean;
  customContent?: string;
}

interface ContentSchedulerProps {
  /** Module that owns the content (e.g. 'publishing', 'microblogging') */
  sourceModule: string;
  /** ID of the content to schedule */
  sourceContentId: string;
  /** Default content text for cross-post previews */
  defaultContent?: string;
  /** Pre-signed Nostr event JSON (client signs before sending to scheduler) */
  signedEventJson?: string;
  /** Called after successful scheduling */
  onScheduled?: (id: string) => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Additional CSS class */
  className?: string;
}

const PLATFORM_INFO: Record<PlatformId, { label: string; icon: FC<{ className?: string }>; charLimit?: number }> = {
  nostr: { label: 'Nostr', icon: Radio },
  activitypub: { label: 'ActivityPub (Mastodon)', icon: Globe, charLimit: 500 },
  atproto: { label: 'AT Protocol (Bluesky)', icon: AtSign, charLimit: 300 },
  rss: { label: 'RSS Feed', icon: Rss },
};

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

export const ContentScheduler: FC<ContentSchedulerProps> = ({
  sourceModule,
  sourceContentId,
  defaultContent = '',
  signedEventJson,
  onScheduled,
  onCancel,
  className,
}) => {
  const { t } = useTranslation();
  const { currentIdentity } = useAuthStore();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [timeValue, setTimeValue] = useState('12:00');
  const [timezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([
    { platform: 'nostr', enabled: true },
    { platform: 'activitypub', enabled: false },
    { platform: 'atproto', enabled: false },
    { platform: 'rss', enabled: false },
  ]);
  const [recurrence, setRecurrence] = useState<string>('none');
  const [recurrenceCount, setRecurrenceCount] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const togglePlatform = useCallback((platformId: PlatformId) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.platform === platformId ? { ...p, enabled: !p.enabled } : p
      )
    );
  }, []);

  const updateCustomContent = useCallback((platformId: PlatformId, content: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.platform === platformId ? { ...p, customContent: content } : p
      )
    );
  }, []);

  const getScheduledDateTime = (): Date | null => {
    if (!selectedDate) return null;
    const [hours, minutes] = timeValue.split(':').map(Number);
    const dt = new Date(selectedDate);
    dt.setHours(hours, minutes, 0, 0);
    return dt;
  };

  const handleSchedule = async () => {
    const scheduledAt = getScheduledDateTime();
    if (!scheduledAt) {
      toast.error(t('social-publishing.scheduler.pickDateTime'));
      return;
    }

    if (scheduledAt <= new Date()) {
      toast.error('Scheduled time must be in the future');
      return;
    }

    const enabledPlatforms = platforms.filter((p) => p.enabled);
    if (enabledPlatforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }

    if (!currentIdentity?.publicKey) {
      toast.error('Not authenticated');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: ScheduleContentInput = {
        sourceModule,
        sourceContentId,
        scheduledAt,
        timezone,
        platforms: enabledPlatforms.map((p) => ({
          platform: p.platform,
          enabled: true,
          customContent: p.customContent,
        })),
        ...(recurrence !== 'none' && {
          recurrence: {
            frequency: recurrence as 'daily' | 'weekly' | 'monthly',
            ...(recurrenceCount && { count: recurrenceCount }),
          },
        }),
      };

      const manager = getSocialPublishingManager();
      const scheduled = await manager.scheduleContent(
        input,
        currentIdentity.publicKey,
        signedEventJson
      );

      toast.success(
        t('social-publishing.scheduler.title') + ': ' +
        format(scheduledAt, 'PPp')
      );
      onScheduled?.(scheduled.id);
    } catch (error) {
      toast.error('Failed to schedule content');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scheduledAt = getScheduledDateTime();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          {t('social-publishing.scheduler.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date & Time */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('social-publishing.scheduler.scheduledFor')}</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate
                    ? format(selectedDate, 'PPP')
                    : t('social-publishing.scheduler.pickDateTime')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Time</Label>
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('social-publishing.scheduler.timezone')}: {timezone}
            </p>
          </div>
        </div>

        {/* Platforms */}
        <div className="space-y-3">
          <Label>{t('social-publishing.scheduler.platforms')}</Label>
          <div className="space-y-2">
            {platforms.map((config) => {
              const info = PLATFORM_INFO[config.platform];
              const Icon = info.icon;
              return (
                <div key={config.platform} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`platform-${config.platform}`}
                      checked={config.enabled}
                      onCheckedChange={() => togglePlatform(config.platform)}
                    />
                    <label
                      htmlFor={`platform-${config.platform}`}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      {info.label}
                      {info.charLimit && (
                        <Badge variant="outline" className="text-xs">
                          {info.charLimit} {t('social-publishing.crossPost.charLimit')}
                        </Badge>
                      )}
                    </label>
                  </div>

                  {/* Per-platform custom content */}
                  {config.enabled && config.platform !== 'rss' && (
                    <div className="ml-8">
                      <Textarea
                        placeholder={defaultContent || `Custom content for ${info.label}...`}
                        value={config.customContent || ''}
                        onChange={(e) => updateCustomContent(config.platform, e.target.value)}
                        className="text-sm"
                        rows={2}
                      />
                      {info.charLimit && (
                        <p className={`text-xs mt-1 ${
                          (config.customContent || defaultContent).length > info.charLimit
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        }`}>
                          {(config.customContent || defaultContent).length}/{info.charLimit}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recurrence */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            {t('social-publishing.scheduler.recurrence')}
          </Label>
          <div className="flex gap-3">
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {recurrence !== 'none' && (
              <Input
                type="number"
                placeholder="Times"
                min={1}
                max={365}
                className="w-24"
                value={recurrenceCount ?? ''}
                onChange={(e) =>
                  setRecurrenceCount(e.target.value ? Number(e.target.value) : undefined)
                }
              />
            )}
          </div>
        </div>

        {/* Summary & Actions */}
        {scheduledAt && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <span className="font-medium">
              {t('social-publishing.scheduler.scheduledFor')}:
            </span>{' '}
            {format(scheduledAt, 'PPPp')}
            {recurrence !== 'none' && (
              <span className="ml-2 text-muted-foreground">
                ({recurrence}{recurrenceCount ? `, ${recurrenceCount}x` : ''})
              </span>
            )}
            <div className="mt-1 flex flex-wrap gap-1">
              {platforms.filter((p) => p.enabled).map((p) => (
                <Badge key={p.platform} variant="secondary" className="text-xs">
                  {PLATFORM_INFO[p.platform].label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {t('social-publishing.scheduler.cancel')}
            </Button>
          )}
          <Button onClick={handleSchedule} disabled={isSubmitting || !selectedDate}>
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? '...' : t('social-publishing.scheduler.schedule')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
