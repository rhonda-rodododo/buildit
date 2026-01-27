/**
 * Broadcasts View
 * Create and manage message broadcasts/blasts
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Calendar,
  Users,
  FileText,
  Plus,
  BarChart2,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCallingStore } from '../callingStore';
import {
  BroadcastStatus,
  BroadcastPriority,
  BroadcastTargetType,
  type Broadcast,
} from '../types';
import { formatDistanceToNow, format } from 'date-fns';

export function BroadcastsView() {
  const { t } = useTranslation('calling');
  const { broadcasts, addBroadcast, updateBroadcast, removeBroadcast } = useCallingStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBroadcast, setNewBroadcast] = useState({
    title: '',
    content: '',
    targetType: BroadcastTargetType.Group as BroadcastTargetType,
    priority: BroadcastPriority.Normal as BroadcastPriority,
    scheduledAt: '',
  });

  const draftBroadcasts = broadcasts.filter((b) => b.status === BroadcastStatus.Draft);
  const scheduledBroadcasts = broadcasts.filter((b) => b.status === BroadcastStatus.Scheduled);
  const sentBroadcasts = broadcasts.filter(
    (b) => b.status === BroadcastStatus.Sent || b.status === BroadcastStatus.Sending
  );

  const getStatusIcon = (status?: BroadcastStatus) => {
    switch (status) {
      case BroadcastStatus.Draft:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case BroadcastStatus.Scheduled:
        return <Clock className="h-4 w-4 text-blue-500" />;
      case BroadcastStatus.Sending:
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case BroadcastStatus.Sent:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case BroadcastStatus.Failed:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status?: BroadcastStatus) => {
    switch (status) {
      case BroadcastStatus.Draft:
        return <Badge variant="secondary">{t('draft')}</Badge>;
      case BroadcastStatus.Scheduled:
        return <Badge variant="outline" className="text-blue-500">{t('scheduled')}</Badge>;
      case BroadcastStatus.Sending:
        return <Badge variant="outline" className="text-yellow-500">{t('sending')}</Badge>;
      case BroadcastStatus.Sent:
        return <Badge variant="outline" className="text-green-500">{t('sent')}</Badge>;
      case BroadcastStatus.Failed:
        return <Badge variant="destructive">{t('failed')}</Badge>;
      default:
        return null;
    }
  };

  const handleCreateBroadcast = () => {
    const broadcast: Broadcast = {
      _v: '1.0.0',
      broadcastId: `broadcast-${Date.now()}`,
      content: newBroadcast.content,
      title: newBroadcast.title || undefined,
      targetType: newBroadcast.targetType,
      createdBy: 'current-user', // TODO: Get from auth
      status: newBroadcast.scheduledAt ? BroadcastStatus.Scheduled : BroadcastStatus.Draft,
      priority: newBroadcast.priority,
      scheduledAt: newBroadcast.scheduledAt
        ? new Date(newBroadcast.scheduledAt).getTime()
        : undefined,
    };

    addBroadcast(broadcast);
    setShowCreateDialog(false);
    setNewBroadcast({
      title: '',
      content: '',
      targetType: BroadcastTargetType.Group,
      priority: BroadcastPriority.Normal,
      scheduledAt: '',
    });
  };

  const handleSendNow = (broadcastId: string) => {
    updateBroadcast(broadcastId, {
      status: BroadcastStatus.Sending,
      sentAt: Date.now(),
    });

    // Simulate sending
    setTimeout(() => {
      updateBroadcast(broadcastId, {
        status: BroadcastStatus.Sent,
        analytics: {
          totalRecipients: Math.floor(Math.random() * 100) + 10,
          delivered: Math.floor(Math.random() * 90) + 10,
          read: Math.floor(Math.random() * 50),
          replied: Math.floor(Math.random() * 10),
        },
      });
    }, 2000);
  };

  const BroadcastCard = ({ broadcast }: { broadcast: Broadcast }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(broadcast.status)}
              <h3 className="font-medium truncate">
                {broadcast.title || t('untitledBroadcast')}
              </h3>
              {getStatusBadge(broadcast.status)}
              {broadcast.priority === BroadcastPriority.Emergency && (
                <Badge variant="destructive">{t('emergency')}</Badge>
              )}
              {broadcast.priority === BroadcastPriority.High && (
                <Badge>{t('highPriority')}</Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {broadcast.content}
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {broadcast.targetType === BroadcastTargetType.Group
                  ? t('targetGroup')
                  : broadcast.targetType === BroadcastTargetType.ContactList
                  ? t('targetContactList')
                  : broadcast.targetType === BroadcastTargetType.Emergency
                  ? t('emergency')
                  : t('targetPublicChannel')}
              </span>

              {broadcast.scheduledAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(broadcast.scheduledAt, 'MMM d, h:mm a')}
                </span>
              )}

              {broadcast.sentAt && (
                <span>{t('sentTimeAgo', { time: formatDistanceToNow(broadcast.sentAt, { addSuffix: true }) })}</span>
              )}
            </div>

            {/* Analytics for sent broadcasts */}
            {broadcast.status === BroadcastStatus.Sent && broadcast.analytics && (
              <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-semibold">
                    {broadcast.analytics.totalRecipients ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('recipients')}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-green-500">
                    {broadcast.analytics.delivered ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('delivered')}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-blue-500">
                    {broadcast.analytics.read ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('read')}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-purple-500">
                    {broadcast.analytics.replied ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('replied')}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {(broadcast.status === BroadcastStatus.Draft ||
              broadcast.status === BroadcastStatus.Scheduled) && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleSendNow(broadcast.broadcastId)}
                >
                  <Send className="h-4 w-4 mr-1" />
                  {t('sendNow')}
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBroadcast(broadcast.broadcastId)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send className="h-6 w-6" />
            {t('broadcasts')}
          </h1>
          <p className="text-muted-foreground">
            {t('broadcastsDescription')}
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('createBroadcast')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('createBroadcast')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('broadcastTitle')}</Label>
                <Input
                  id="title"
                  value={newBroadcast.title}
                  onChange={(e) =>
                    setNewBroadcast({ ...newBroadcast, title: e.target.value })
                  }
                  placeholder="Optional title for your broadcast"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">{t('broadcastContent')} *</Label>
                <Textarea
                  id="content"
                  value={newBroadcast.content}
                  onChange={(e) =>
                    setNewBroadcast({ ...newBroadcast, content: e.target.value })
                  }
                  placeholder="Write your message..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('targetAudience')}</Label>
                  <Select
                    value={newBroadcast.targetType}
                    onValueChange={(v) =>
                      setNewBroadcast({
                        ...newBroadcast,
                        targetType: v as BroadcastTargetType,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BroadcastTargetType.Group}>
                        {t('targetGroup')}
                      </SelectItem>
                      <SelectItem value={BroadcastTargetType.ContactList}>
                        {t('targetContactList')}
                      </SelectItem>
                      <SelectItem value={BroadcastTargetType.PublicChannel}>
                        {t('targetPublicChannel')}
                      </SelectItem>
                      <SelectItem value={BroadcastTargetType.Emergency}>
                        {t('emergencyBroadcast')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('priority')}</Label>
                  <Select
                    value={newBroadcast.priority}
                    onValueChange={(v) =>
                      setNewBroadcast({
                        ...newBroadcast,
                        priority: v as BroadcastPriority,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BroadcastPriority.Normal}>{t('priorityNormal')}</SelectItem>
                      <SelectItem value={BroadcastPriority.High}>{t('priorityHigh')}</SelectItem>
                      <SelectItem value={BroadcastPriority.Emergency}>{t('emergency')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule">{t('scheduleOptional')}</Label>
                <Input
                  id="schedule"
                  type="datetime-local"
                  value={newBroadcast.scheduledAt}
                  onChange={(e) =>
                    setNewBroadcast({ ...newBroadcast, scheduledAt: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleCreateBroadcast}
                disabled={!newBroadcast.content.trim()}
              >
                {newBroadcast.scheduledAt ? t('scheduleBroadcast') : t('saveDraft')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="drafts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="drafts">
            <FileText className="h-4 w-4 mr-2" />
            {t('drafts')}
            {draftBroadcasts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {draftBroadcasts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            <Calendar className="h-4 w-4 mr-2" />
            {t('scheduled')}
            {scheduledBroadcasts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {scheduledBroadcasts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent">
            <BarChart2 className="h-4 w-4 mr-2" />
            {t('sent')}
            {sentBroadcasts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {sentBroadcasts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="space-y-4">
          {draftBroadcasts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {t('noDraftBroadcasts')}
              </CardContent>
            </Card>
          ) : (
            draftBroadcasts.map((broadcast) => (
              <BroadcastCard key={broadcast.broadcastId} broadcast={broadcast} />
            ))
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          {scheduledBroadcasts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {t('noScheduledBroadcasts')}
              </CardContent>
            </Card>
          ) : (
            scheduledBroadcasts.map((broadcast) => (
              <BroadcastCard key={broadcast.broadcastId} broadcast={broadcast} />
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          {sentBroadcasts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {t('noSentBroadcasts')}
              </CardContent>
            </Card>
          ) : (
            sentBroadcasts.map((broadcast) => (
              <BroadcastCard key={broadcast.broadcastId} broadcast={broadcast} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
