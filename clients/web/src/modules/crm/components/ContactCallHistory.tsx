/**
 * Contact Call History Component
 * Displays call history for a CRM contact with recording playback
 */

import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  FileText,
  Clock,
  Calendar,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import {
  getCRMCallingIntegration,
  type CallHistoryRecord,
} from '../integrations/callingIntegration';

interface ContactCallHistoryProps {
  contactId: string;
  contactName?: string;
  maxHeight?: string;
  onCallClick?: (call: CallHistoryRecord) => void;
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

const CallIcon: FC<{ call: CallHistoryRecord }> = ({ call }) => {
  if (call.status === 'missed') {
    return <PhoneMissed className="h-4 w-4 text-red-500" />;
  }
  if (call.direction === 'inbound') {
    return <PhoneIncoming className="h-4 w-4 text-green-500" />;
  }
  return <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
};

const CallStatusBadge: FC<{ status: CallHistoryRecord['status'] }> = ({ status }) => {
  const { t } = useTranslation();

  const variants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
    completed: 'default',
    missed: 'destructive',
    voicemail: 'secondary',
    failed: 'outline',
  };

  return (
    <Badge variant={variants[status] || 'outline'} className="text-xs">
      {t(`crm.callHistory.status.${status}`)}
    </Badge>
  );
};

export const ContactCallHistory: FC<ContactCallHistoryProps> = ({
  contactId,
  contactName,
  maxHeight = '400px',
  onCallClick,
}) => {
  const { t } = useTranslation();
  const [calls, setCalls] = useState<CallHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalCalls: number;
    totalDuration: number;
    missedCalls: number;
  } | null>(null);

  // Notes dialog state
  const [selectedCall, setSelectedCall] = useState<CallHistoryRecord | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const integration = getCRMCallingIntegration();

  useEffect(() => {
    const loadCallHistory = async () => {
      setLoading(true);
      try {
        const [history, contactStats] = await Promise.all([
          integration.getContactCallHistory(contactId),
          integration.getContactCallStats(contactId),
        ]);
        setCalls(history);
        setStats(contactStats);
      } catch (error) {
        console.error('Failed to load call history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCallHistory();
  }, [contactId, integration]);

  const handleAddNotes = (call: CallHistoryRecord) => {
    setSelectedCall(call);
    setEditingNotes(call.notes || '');
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedCall) return;

    setSavingNotes(true);
    try {
      await integration.addCallNotes(contactId, selectedCall.id, editingNotes);

      // Update local state
      setCalls((prev) =>
        prev.map((c) =>
          c.id === selectedCall.id ? { ...c, notes: editingNotes } : c
        )
      );
      setNotesDialogOpen(false);
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {t('crm.callHistory.title')}
              </CardTitle>
              <CardDescription>
                {contactName
                  ? t('crm.callHistory.descriptionWithName', { name: contactName })
                  : t('crm.callHistory.description')}
              </CardDescription>
            </div>

            {stats && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{stats.totalCalls} {t('crm.callHistory.calls')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(stats.totalDuration)}</span>
                </div>
                {stats.missedCalls > 0 && (
                  <div className="flex items-center gap-1 text-red-500">
                    <PhoneMissed className="h-3 w-3" />
                    <span>{stats.missedCalls} {t('crm.callHistory.missed')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {calls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t('crm.callHistory.noHistory')}</p>
            </div>
          ) : (
            <ScrollArea style={{ maxHeight }}>
              <div className="space-y-2">
                {calls.map((call, index) => (
                  <div key={call.id}>
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onCallClick?.(call)}
                    >
                      <CallIcon call={call} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {call.direction === 'inbound'
                              ? t('crm.callHistory.inboundCall')
                              : t('crm.callHistory.outboundCall')}
                          </span>
                          <CallStatusBadge status={call.status} />
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(call.startedAt)}
                          </span>
                          {call.status === 'completed' && call.duration > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(call.duration)}
                            </span>
                          )}
                          {call.phoneNumber && (
                            <span>{call.phoneNumber}</span>
                          )}
                        </div>

                        {call.notes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {call.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {call.recordingUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(call.recordingUrl, '_blank');
                            }}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}

                        {call.transcriptUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(call.transcriptUrl, '_blank');
                            }}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNotes(call);
                          }}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {index < calls.length - 1 && <Separator className="my-1" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('crm.callHistory.notesDialog.title')}</DialogTitle>
            <DialogDescription>
              {selectedCall && (
                <>
                  {selectedCall.direction === 'inbound'
                    ? t('crm.callHistory.inboundCall')
                    : t('crm.callHistory.outboundCall')}{' '}
                  - {formatDate(selectedCall.startedAt)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder={t('crm.callHistory.notesDialog.placeholder')}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotesDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveNotes} disabled={savingNotes}>
              {savingNotes && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContactCallHistory;
