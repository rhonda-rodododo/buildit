/**
 * Contact Profile Component
 * Full contact view with social features and related records
 */

import { useState, useMemo } from 'react';
import { useDatabaseStore } from '@/modules/database/databaseStore';
import { useContactsStore } from '@/stores/contactsStore';
import { useFriendsStore } from '@/modules/friends/friendsStore';
import type { DatabaseRecord, RecordAttachment } from '@/modules/database/types';
import { CaseTimeline } from './CaseTimeline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  User,
  Mail,
  Phone,
  MessageSquare,
  ExternalLink,
  Link2,
  Clock,
  Copy,
  Check,
  Building,
  Tag,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useTauriShell } from '@/lib/tauri';

interface ContactProfileProps {
  recordId: string;
  tableId: string;
  groupId: string;
  userPubkey: string;
  className?: string;
  onStartDM?: (pubkey: string) => void;
  onViewProfile?: (pubkey: string) => void;
  onNavigateToRecord?: (recordId: string, tableId: string) => void;
  onPreviewAttachment?: (attachment: RecordAttachment) => void;
  onEdit?: () => void;
  onClose?: () => void;
}

interface RelatedRecordGroup {
  tableId: string;
  tableName: string;
  tableIcon?: string;
  records: DatabaseRecord[];
  relationshipFieldName: string;
}

export function ContactProfile({
  recordId,
  tableId,
  groupId,
  userPubkey,
  className,
  onStartDM,
  onViewProfile,
  onNavigateToRecord,
  onPreviewAttachment,
  onEdit,
  onClose,
}: ContactProfileProps) {
  const { t } = useTranslation();
  const { openUrl, openEmail } = useTauriShell();
  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'timeline'>('details');
  const [copied, setCopied] = useState<string | null>(null);

  const tables = useDatabaseStore((s) => s.tables);
  const recordsByTable = useDatabaseStore((s) => s.recordsByTable);
  const relationships = useDatabaseStore((s) => s.relationships);
  const profiles = useContactsStore((s) => s.profiles);
  const friends = useFriendsStore((s) => s.friends);

  // Get current table and record
  const currentTable = useMemo(() => tables.get(tableId), [tables, tableId]);
  const currentRecord = useMemo(() => {
    const tableRecords = recordsByTable.get(tableId);
    return tableRecords?.get(recordId);
  }, [recordsByTable, tableId, recordId]);

  // Get contact info from record
  const contactInfo = useMemo(() => {
    if (!currentRecord) return null;

    const fields = currentRecord.customFields;
    const pubkey = fields.pubkey as string | undefined;

    // Get profile from Nostr if pubkey exists
    const nostrProfile = pubkey ? profiles.get(pubkey) : null;
    const friend = pubkey
      ? Array.from(friends.values()).find((f) => f.friendPubkey === pubkey)
      : null;

    return {
      name: (fields.name || fields.full_name || fields.contact_name) as string || 'Unknown',
      email: fields.email as string | undefined,
      phone: fields.phone as string | undefined,
      organization: fields.organization as string | undefined,
      title: fields.title as string | undefined,
      pubkey,
      nostrProfile,
      isFriend: !!friend,
      picture: nostrProfile?.picture || (fields.avatar as string | undefined),
      nip05: nostrProfile?.nip05,
      tags: (fields.tags || fields.categories) as string[] | undefined,
      status: fields.status as string | undefined,
      notes: fields.notes as string | undefined,
    };
  }, [currentRecord, profiles, friends]);

  // Find related records (records that link to this contact)
  const relatedRecords = useMemo((): RelatedRecordGroup[] => {
    if (!currentRecord) return [];

    const groups: RelatedRecordGroup[] = [];

    // Find relationships where other tables link to this table
    const incomingRels = Array.from(relationships.values()).filter((r) => r.targetTableId === tableId);
    for (const rel of incomingRels) {
      const sourceTable = tables.get(rel.sourceTableId);
      const sourceRecords = recordsByTable.get(rel.sourceTableId);
      if (!sourceTable || !sourceRecords) continue;

      // Find records that link to this record
      const linked: DatabaseRecord[] = [];
      for (const record of sourceRecords.values()) {
        const fieldValue = record.customFields[rel.sourceFieldName];
        if (!fieldValue) continue;

        const valueIds = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
        if (valueIds.includes(recordId)) {
          linked.push(record);
        }
      }

      if (linked.length > 0) {
        groups.push({
          tableId: rel.sourceTableId,
          tableName: sourceTable.name,
          tableIcon: sourceTable.icon,
          records: linked,
          relationshipFieldName: rel.sourceFieldName,
        });
      }
    }

    return groups;
  }, [currentRecord, recordId, tableId, relationships, tables, recordsByTable]);

  // Copy to clipboard
  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!currentRecord || !contactInfo) {
    return (
      <div className={cn('text-center text-muted-foreground py-8', className)}>
        {t('crm.contactNotFound', 'Contact not found')}
      </div>
    );
  }

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      {/* Header with contact summary */}
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={contactInfo.picture} />
            <AvatarFallback className="text-lg">
              {contactInfo.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  {contactInfo.name}
                  {contactInfo.isFriend && (
                    <Badge variant="secondary" className="text-xs">
                      {t('common.friend', 'Friend')}
                    </Badge>
                  )}
                </CardTitle>
                {contactInfo.title && contactInfo.organization && (
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Briefcase className="h-3 w-3" />
                    {t('crm:titleAtOrganization', { title: contactInfo.title, organization: contactInfo.organization })}
                  </CardDescription>
                )}
                {contactInfo.nip05 && (
                  <CardDescription className="text-xs mt-1">
                    {contactInfo.nip05}
                  </CardDescription>
                )}
              </div>
              <div className="flex gap-1">
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    {t('common.edit', 'Edit')}
                  </Button>
                )}
                {onClose && (
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    {t('common.close', 'Close')}
                  </Button>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 mt-3">
              {contactInfo.pubkey && onStartDM && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onStartDM(contactInfo.pubkey!)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        {t('common.message', 'Message')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('crm.sendDirectMessage', 'Send direct message via Nostr')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {contactInfo.email && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEmail(contactInfo.email!)}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        {t('common.email', 'Email')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{contactInfo.email}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {contactInfo.phone && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUrl(`tel:${contactInfo.phone}`)}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        {t('common.call', 'Call')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{contactInfo.phone}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {contactInfo.pubkey && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUrl(`https://njump.me/${contactInfo.pubkey}`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        {t('common.nostrProfile', 'Nostr')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('crm.viewNostrProfile', 'View Nostr profile')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <Separator />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex-1 flex flex-col"
      >
        <TabsList className="mx-6 mt-4">
          <TabsTrigger value="details">
            <User className="h-4 w-4 mr-1" />
            {t('crm.details', 'Details')}
          </TabsTrigger>
          <TabsTrigger value="related">
            <Link2 className="h-4 w-4 mr-1" />
            {t('crm.related', 'Related')} ({relatedRecords.reduce((sum, g) => sum + g.records.length, 0)})
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="h-4 w-4 mr-1" />
            {t('crm.timeline', 'Timeline')}
          </TabsTrigger>
        </TabsList>

        <CardContent className="flex-1 overflow-auto pt-4">
          <TabsContent value="details" className="m-0 h-full">
            <div className="space-y-4">
              {/* Contact details */}
              <div className="grid gap-4 sm:grid-cols-2">
                {contactInfo.email && (
                  <ContactField
                    icon={<Mail className="h-4 w-4" />}
                    label={t('common.email', 'Email')}
                    value={contactInfo.email}
                    copyable
                    onCopy={() => handleCopy(contactInfo.email!, 'email')}
                    copied={copied === 'email'}
                  />
                )}
                {contactInfo.phone && (
                  <ContactField
                    icon={<Phone className="h-4 w-4" />}
                    label={t('common.phone', 'Phone')}
                    value={contactInfo.phone}
                    copyable
                    onCopy={() => handleCopy(contactInfo.phone!, 'phone')}
                    copied={copied === 'phone'}
                  />
                )}
                {contactInfo.organization && (
                  <ContactField
                    icon={<Building className="h-4 w-4" />}
                    label={t('common.organization', 'Organization')}
                    value={contactInfo.organization}
                  />
                )}
                {contactInfo.title && (
                  <ContactField
                    icon={<Briefcase className="h-4 w-4" />}
                    label={t('common.title', 'Title')}
                    value={contactInfo.title}
                  />
                )}
                {contactInfo.pubkey && (
                  <ContactField
                    icon={<User className="h-4 w-4" />}
                    label={t('common.nostrPubkey', 'Nostr Pubkey')}
                    value={`${contactInfo.pubkey.slice(0, 16)}...`}
                    copyable
                    onCopy={() => handleCopy(contactInfo.pubkey!, 'pubkey')}
                    copied={copied === 'pubkey'}
                  />
                )}
                {contactInfo.status && (
                  <ContactField
                    icon={<Tag className="h-4 w-4" />}
                    label={t('common.status', 'Status')}
                    value={contactInfo.status}
                  />
                )}
              </div>

              {/* Tags */}
              {contactInfo.tags && contactInfo.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t('common.tags', 'Tags')}</h4>
                  <div className="flex flex-wrap gap-1">
                    {contactInfo.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {contactInfo.notes && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t('common.notes', 'Notes')}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {contactInfo.notes}
                  </p>
                </div>
              )}

              {/* All custom fields */}
              <div>
                <h4 className="text-sm font-medium mb-2">{t('crm.allFields', 'All Fields')}</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {currentTable?.fields.map((field) => {
                    const value = currentRecord.customFields[field.name];
                    if (value === undefined || value === null || value === '') return null;

                    let displayValue: string;
                    if (Array.isArray(value)) {
                      displayValue = value.join(', ');
                    } else if (typeof value === 'boolean') {
                      displayValue = value ? t('common.yes', 'Yes') : t('common.no', 'No');
                    } else {
                      displayValue = String(value);
                    }

                    return (
                      <div key={field.id} className="text-sm">
                        <span className="text-muted-foreground">{field.label}:</span>{' '}
                        <span>{displayValue}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="related" className="m-0 h-full">
            {relatedRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{t('crm.noRelatedRecords', 'No related records')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {relatedRecords.map((group) => (
                  <div key={group.tableId}>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      {group.tableIcon && <span>{group.tableIcon}</span>}
                      {group.tableName} ({group.records.length})
                    </h4>
                    <div className="space-y-2">
                      {group.records.map((record) => (
                        <button
                          key={record.id}
                          onClick={() => onNavigateToRecord?.(record.id, group.tableId)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-lg',
                            'bg-muted/50 hover:bg-muted transition-colors text-left'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {getRecordDisplayValue(record)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(record.created).toLocaleDateString()}
                            </div>
                          </div>
                          {record.customFields.status !== undefined && record.customFields.status !== null && (
                            <Badge variant="outline" className="shrink-0">
                              {String(record.customFields.status)}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="m-0 h-full">
            <CaseTimeline
              recordId={recordId}
              tableId={tableId}
              groupId={groupId}
              userPubkey={userPubkey}
              onStartDM={onStartDM}
              onViewProfile={onViewProfile}
              onNavigateToRecord={onNavigateToRecord}
              onPreviewAttachment={onPreviewAttachment}
              className="border-0 shadow-none"
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

interface ContactFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}

function ContactField({ icon, label, value, copyable, onCopy, copied }: ContactFieldProps) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
      {copyable && onCopy && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}

function getRecordDisplayValue(record: DatabaseRecord): string {
  const fields = record.customFields;

  // Try common display fields
  const displayFields = ['name', 'title', 'full_name', 'label', 'case_number', 'subject'];
  for (const field of displayFields) {
    if (fields[field]) {
      return String(fields[field]);
    }
  }

  // Fallback to first non-empty string field
  for (const value of Object.values(fields)) {
    if (value && typeof value === 'string' && value.length < 100) {
      return value;
    }
  }

  return record.id.substring(0, 8);
}

export default ContactProfile;
