/**
 * Caller Info Popup Component
 * Shows CRM contact info during active calls (or "Unknown Caller" with create option)
 */

import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  User,
  Phone,
  Mail,
  Clock,
  MessageSquare,
  Plus,
  ExternalLink,
  ChevronRight,
  Loader2,
  AlertCircle,
  Building,
} from 'lucide-react';
import {
  getCRMCallingIntegration,
  type CallerLookupResult,
  type CallHistoryRecord,
} from '@/modules/crm/integrations/callingIntegration';
import type { CRMContact } from '@/modules/crm/types';

interface CallerInfoPopupProps {
  phoneNumber: string;
  callDirection: 'inbound' | 'outbound';
  groupId?: string;
  hotlineId?: string;
  operatorPubkey?: string;
  onContactCreated?: (contact: CRMContact) => void;
  onViewContact?: (contactId: string) => void;
  collapsed?: boolean;
}

export const CallerInfoPopup: FC<CallerInfoPopupProps> = ({
  phoneNumber,
  callDirection,
  groupId,
  hotlineId,
  operatorPubkey,
  onContactCreated,
  onViewContact,
  collapsed = false,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [lookupResult, setLookupResult] = useState<CallerLookupResult | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallHistoryRecord[]>([]);

  // Create contact dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactNotes, setNewContactNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const integration = getCRMCallingIntegration();

  useEffect(() => {
    const lookupCaller = async () => {
      setLoading(true);
      try {
        const result = await integration.lookupByPhone(phoneNumber, groupId);
        setLookupResult(result);

        // If contact found, get recent call history
        if (result.found && result.contact) {
          const history = await integration.getContactCallHistory(
            result.contact.id,
            { limit: 3 }
          );
          setRecentCalls(history);
        }
      } catch (error) {
        console.error('Failed to lookup caller:', error);
        setLookupResult({ found: false });
      } finally {
        setLoading(false);
      }
    };

    if (phoneNumber) {
      lookupCaller();
    }
  }, [phoneNumber, groupId, integration]);

  const handleCreateContact = async () => {
    if (!groupId) return;

    setCreating(true);
    try {
      const contact = await integration.createContactFromCall(
        {
          phoneNumber,
          name: newContactName || undefined,
          notes: newContactNotes || undefined,
          hotlineId,
          operatorPubkey,
        },
        groupId
      );

      setLookupResult({
        found: true,
        contact,
        previousCalls: 0,
      });

      onContactCreated?.(contact);
      setShowCreateDialog(false);
      setNewContactName('');
      setNewContactNotes('');
    } catch (error) {
      console.error('Failed to create contact:', error);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t('calling.callerInfo.today');
    } else if (diffDays === 1) {
      return t('calling.callerInfo.yesterday');
    } else if (diffDays < 7) {
      return t('calling.callerInfo.daysAgo', { count: diffDays });
    } else {
      return date.toLocaleDateString();
    }
  };

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (loading) {
    return (
      <Card className={collapsed ? 'w-64' : 'w-80'}>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Known contact view
  if (lookupResult?.found && lookupResult.contact) {
    const contact = lookupResult.contact;

    return (
      <Card className={collapsed ? 'w-64' : 'w-80'}>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={contact.customFields?.avatar_url as string} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(contact.name || contact.full_name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">
                {contact.name || contact.full_name || t('calling.callerInfo.unknown')}
              </CardTitle>

              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {t(`calling.callerInfo.direction.${callDirection}`)}
                </Badge>

                {lookupResult.previousCalls !== undefined && lookupResult.previousCalls > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {t('calling.callerInfo.previousCalls', { count: lookupResult.previousCalls })}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Contact Details */}
          <div className="space-y-2">
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span>{contact.phone}</span>
              </div>
            )}

            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}

            {contact.customFields?.organization && (
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{contact.customFields.organization as string}</span>
              </div>
            )}
          </div>

          {/* Recent Calls */}
          {!collapsed && recentCalls.length > 0 && (
            <>
              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t('calling.callerInfo.recentCalls')}
                </p>

                <div className="space-y-1">
                  {recentCalls.map((call) => (
                    <div
                      key={call.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-muted-foreground">
                        {formatDate(call.startedAt)}
                      </span>
                      <span>
                        {Math.floor(call.duration / 60)}m {call.duration % 60}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notes Preview */}
          {!collapsed && contact.customFields?.notes && (
            <>
              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {t('calling.callerInfo.notes')}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {contact.customFields.notes as string}
                </p>
              </div>
            </>
          )}

          {/* View Contact Button */}
          {onViewContact && (
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => onViewContact(contact.id)}
            >
              {t('calling.callerInfo.viewContact')}
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Unknown caller view
  return (
    <>
      <Card className={collapsed ? 'w-64' : 'w-80'}>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-muted">
                <User className="h-6 w-6 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <CardTitle className="text-base">
                {t('calling.callerInfo.unknownCaller')}
              </CardTitle>

              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {t(`calling.callerInfo.direction.${callDirection}`)}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span>{phoneNumber}</span>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t('calling.callerInfo.notInCRM')}
            </p>
          </div>

          {groupId && (
            <Button
              className="w-full"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('calling.callerInfo.createContact')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Create Contact Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('calling.callerInfo.createDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('calling.callerInfo.createDialog.description', { phone: phoneNumber })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">
                {t('calling.callerInfo.createDialog.nameLabel')}
              </Label>
              <Input
                id="contact-name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder={t('calling.callerInfo.createDialog.namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-notes">
                {t('calling.callerInfo.createDialog.notesLabel')}
              </Label>
              <Input
                id="contact-notes"
                value={newContactNotes}
                onChange={(e) => setNewContactNotes(e.target.value)}
                placeholder={t('calling.callerInfo.createDialog.notesPlaceholder')}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{phoneNumber}</span>
              <Badge variant="secondary" className="text-xs">
                {t('calling.callerInfo.createDialog.autoAdded')}
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateContact} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('calling.callerInfo.createDialog.createButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CallerInfoPopup;
