/**
 * Broadcast Composer
 * Create and schedule multi-channel message broadcasts
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Clock,
  Users,
  Megaphone,
  AlertTriangle,
  Globe,
  MessageSquare,
  Smartphone,
  Radio,
  Link2,
  Link2Off,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  useLinkPreviewFromText,
  LinkPreviewCard,
  LinkPreviewSkeleton,
} from '@/lib/linkPreview';
import {
  BroadcastTargetType,
  BroadcastPriority,
} from '../types';
import type { BroadcastState } from '../services/broadcastDeliveryManager';

interface BroadcastComposerProps {
  groups: Array<{ id: string; name: string; memberCount: number }>;
  contactLists: Array<{ id: string; name: string; contactCount: number }>;
  onSend: (broadcast: BroadcastDraft) => Promise<void>;
  onSchedule: (broadcast: BroadcastDraft, scheduledFor: Date) => Promise<void>;
  onSaveDraft: (broadcast: BroadcastDraft) => void;
  existingDraft?: BroadcastDraft;
}

interface BroadcastDraft {
  title: string;
  content: string;
  targetType: BroadcastTargetType;
  targetId?: string;
  priority: BroadcastPriority;
  channels: ('buildit' | 'sms' | 'rcs')[];
  recipientCount?: number;
}

const TARGET_TYPE_ICONS: Record<BroadcastTargetType, React.ReactNode> = {
  [BroadcastTargetType.Group]: <Users className="h-4 w-4" />,
  [BroadcastTargetType.ContactList]: <MessageSquare className="h-4 w-4" />,
  [BroadcastTargetType.PublicChannel]: <Globe className="h-4 w-4" />,
  [BroadcastTargetType.Emergency]: <AlertTriangle className="h-4 w-4" />,
};

const PRIORITY_CONFIG: Record<BroadcastPriority, { color: string; description: string }> = {
  [BroadcastPriority.Normal]: { color: 'bg-gray-500', description: 'Standard delivery' },
  [BroadcastPriority.High]: { color: 'bg-orange-500', description: 'Priority delivery, notifications enabled' },
  [BroadcastPriority.Emergency]: { color: 'bg-red-500', description: 'Bypasses DND, immediate delivery' },
};

export function BroadcastComposer({
  groups,
  contactLists,
  onSend,
  onSchedule,
  onSaveDraft,
  existingDraft,
}: BroadcastComposerProps) {
  const { t } = useTranslation('calling');
  const [title, setTitle] = useState(existingDraft?.title || '');
  const [content, setContent] = useState(existingDraft?.content || '');
  const [targetType, setTargetType] = useState<BroadcastTargetType>(
    existingDraft?.targetType || BroadcastTargetType.Group
  );
  const [targetId, setTargetId] = useState(existingDraft?.targetId || '');
  const [priority, setPriority] = useState<BroadcastPriority>(
    existingDraft?.priority || BroadcastPriority.Normal
  );
  const [channels, setChannels] = useState<('buildit' | 'sms' | 'rcs')[]>(
    existingDraft?.channels || ['buildit']
  );
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkPreviewsEnabled, setLinkPreviewsEnabled] = useState(true);

  // Signal-style link preview generation
  const {
    loading: previewLoading,
    previews,
    removePreview,
    clearPreviews,
  } = useLinkPreviewFromText(content, {
    autoGenerate: linkPreviewsEnabled,
    debounceMs: 800,
    maxPreviews: 3,
  });

  // Calculate recipient count
  const recipientCount = (() => {
    if (targetType === BroadcastTargetType.Group) {
      const group = groups.find((g) => g.id === targetId);
      return group?.memberCount || 0;
    }
    if (targetType === BroadcastTargetType.ContactList) {
      const list = contactLists.find((l) => l.id === targetId);
      return list?.contactCount || 0;
    }
    return 0;
  })();

  const toggleChannel = (channel: 'buildit' | 'sms' | 'rcs') => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const createDraft = (): BroadcastDraft => ({
    title,
    content,
    targetType,
    targetId,
    priority,
    channels,
    recipientCount,
  });

  const handleSend = async () => {
    if (priority === BroadcastPriority.Emergency) {
      setShowEmergencyConfirm(true);
      return;
    }
    await sendBroadcast();
  };

  const sendBroadcast = async () => {
    setIsSending(true);
    setError(null);
    try {
      await onSend(createDraft());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) return;

    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const scheduledFor = new Date(scheduleDate);
    scheduledFor.setHours(hours, minutes, 0, 0);

    setIsSending(true);
    setError(null);
    try {
      await onSchedule(createDraft(), scheduledFor);
      setShowSchedule(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const isValid = title.trim() && content.trim() && targetId && channels.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            {t('createBroadcast')}
          </CardTitle>
          <CardDescription>{t('broadcastDescription')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('broadcastTitle')}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('broadcastTitlePlaceholder')}
            />
          </div>

          {/* Target Type */}
          <div className="space-y-2">
            <Label>{t('targetType')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {([BroadcastTargetType.Group, BroadcastTargetType.ContactList, BroadcastTargetType.PublicChannel, BroadcastTargetType.Emergency] as BroadcastTargetType[]).map(
                (type) => (
                  <Button
                    key={type}
                    variant={targetType === type ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => {
                      setTargetType(type);
                      setTargetId('');
                    }}
                  >
                    {TARGET_TYPE_ICONS[type]}
                    <span className="ml-2 capitalize">{type.replace('_', ' ')}</span>
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Target Selection */}
          {(targetType === BroadcastTargetType.Group || targetType === BroadcastTargetType.ContactList) && (
            <div className="space-y-2">
              <Label>{t('selectTarget')}</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectTargetPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {targetType === BroadcastTargetType.Group &&
                    groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.memberCount} {t('members')})
                      </SelectItem>
                    ))}
                  {targetType === BroadcastTargetType.ContactList &&
                    contactLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name} ({list.contactCount} {t('contactsUnit')})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {recipientCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('estimatedRecipients')}: {recipientCount}
                </p>
              )}
            </div>
          )}

          {/* Message Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">{t('messageContent')}</Label>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 ${!linkPreviewsEnabled ? 'text-muted-foreground' : ''}`}
                onClick={() => {
                  setLinkPreviewsEnabled(!linkPreviewsEnabled);
                  if (linkPreviewsEnabled) {
                    clearPreviews();
                  }
                }}
                aria-label={linkPreviewsEnabled ? 'Disable link previews' : 'Enable link previews'}
              >
                {linkPreviewsEnabled ? (
                  <Link2 className="w-4 h-4" />
                ) : (
                  <Link2Off className="w-4 h-4" />
                )}
              </Button>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('broadcastContentPlaceholder')}
              rows={6}
            />
            <p className="text-xs text-muted-foreground text-right">
              {content.length} {t('characters')}
            </p>
            {/* Link Previews */}
            {linkPreviewsEnabled && (previews.length > 0 || previewLoading) && (
              <div className="space-y-2">
                {previewLoading && previews.length === 0 && (
                  <LinkPreviewSkeleton compact />
                )}
                {previews.map((preview) => (
                  <LinkPreviewCard
                    key={preview.url}
                    preview={preview}
                    compact
                    showRemove
                    onRemove={() => removePreview(preview.url)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Delivery Channels */}
          <div className="space-y-2">
            <Label>{t('deliveryChannels')}</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={channels.includes('buildit')}
                  onCheckedChange={() => toggleChannel('buildit')}
                />
                <MessageSquare className="h-4 w-4" />
                <span>{t('channelBuildIt')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={channels.includes('sms')}
                  onCheckedChange={() => toggleChannel('sms')}
                />
                <Smartphone className="h-4 w-4" />
                <span>{t('channelSMS')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={channels.includes('rcs')}
                  onCheckedChange={() => toggleChannel('rcs')}
                />
                <Radio className="h-4 w-4" />
                <span>{t('channelRCS')}</span>
              </label>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>{t('priority')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {([BroadcastPriority.Normal, BroadcastPriority.High, BroadcastPriority.Emergency]).map((p) => (
                <Button
                  key={p}
                  variant={priority === p ? 'default' : 'outline'}
                  className={cn(
                    'justify-start',
                    priority === p && p === BroadcastPriority.Emergency && 'bg-red-600 hover:bg-red-700'
                  )}
                  onClick={() => setPriority(p)}
                >
                  <div
                    className={cn('w-2 h-2 rounded-full mr-2', PRIORITY_CONFIG[p].color)}
                  />
                  <span className="capitalize">{p}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {PRIORITY_CONFIG[priority].description}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              {error}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={() => onSaveDraft(createDraft())}>
            {t('saveDraft')}
          </Button>

          <div className="flex gap-2">
            <Popover open={showSchedule} onOpenChange={setShowSchedule}>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={!isValid}>
                  <Clock className="h-4 w-4 mr-2" />
                  {t('schedule')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <CalendarComponent
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    disabled={(date) => date < new Date()}
                  />
                  <div className="flex items-center gap-2">
                    <Label>{t('time')}:</Label>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSchedule}
                    disabled={!scheduleDate || isSending}
                  >
                    {t('confirmSchedule')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button onClick={handleSend} disabled={!isValid || isSending}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? t('sending') : t('sendNow')}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Emergency Confirmation Dialog */}
      <Dialog open={showEmergencyConfirm} onOpenChange={setShowEmergencyConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('emergencyBroadcast')}
            </DialogTitle>
            <DialogDescription>
              {t('emergencyBroadcastWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {t('emergencyBroadcastDetails')}:
            </p>
            <ul className="list-disc list-inside text-sm mt-2 space-y-1">
              <li>{t('bypassesDND')}</li>
              <li>{t('immediateDelivery')}</li>
              <li>{t('allChannels')}</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmergencyConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowEmergencyConfirm(false);
                sendBroadcast();
              }}
            >
              {t('confirmEmergency')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Broadcast Status Card Component
export function BroadcastStatusCard({ broadcast }: { broadcast: BroadcastState }) {
  const { t } = useTranslation('calling');

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{broadcast.title}</CardTitle>
          <Badge
            variant={
              broadcast.status === 'sent'
                ? 'default'
                : broadcast.status === 'failed'
                ? 'destructive'
                : 'secondary'
            }
          >
            {broadcast.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {broadcast.status === 'sending' && (
          <div className="space-y-2">
            <Progress value={broadcast.progress} />
            <p className="text-sm text-muted-foreground">
              {broadcast.sentCount} / {broadcast.totalRecipients} {t('sent')}
            </p>
          </div>
        )}

        {broadcast.status === 'sent' && (
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{broadcast.totalRecipients}</p>
              <p className="text-xs text-muted-foreground">{t('total')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{broadcast.deliveredCount}</p>
              <p className="text-xs text-muted-foreground">{t('delivered')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{broadcast.readCount}</p>
              <p className="text-xs text-muted-foreground">{t('read')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{broadcast.failedCount}</p>
              <p className="text-xs text-muted-foreground">{t('failed')}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BroadcastComposer;
