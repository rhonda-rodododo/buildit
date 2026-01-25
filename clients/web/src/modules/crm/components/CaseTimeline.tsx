/**
 * Case Timeline Component
 * CRM-specific timeline wrapper with case-focused styling and features
 */

import { useState, useMemo } from 'react';
import { RecordTimeline } from '@/modules/database/components/RecordTimeline';
import { useDatabaseStore } from '@/modules/database/databaseStore';
import type { DatabaseRecord, RecordAttachment } from '@/modules/database/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  MessageSquare,
  Link2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface CaseTimelineProps {
  recordId: string;
  tableId: string;
  groupId: string;
  userPubkey: string;
  className?: string;
  onStartDM?: (pubkey: string) => void;
  onViewProfile?: (pubkey: string) => void;
  onNavigateToRecord?: (recordId: string, tableId: string) => void;
  onPreviewAttachment?: (attachment: RecordAttachment) => void;
}

interface LinkedRecordInfo {
  id: string;
  tableId: string;
  tableName: string;
  tableIcon?: string;
  displayValue: string;
}

export function CaseTimeline({
  recordId,
  tableId,
  groupId,
  userPubkey,
  className,
  onStartDM,
  onViewProfile,
  onNavigateToRecord,
  onPreviewAttachment,
}: CaseTimelineProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'all' | 'activity' | 'linked'>('all');

  const tables = useDatabaseStore((s) => s.tables);
  const recordsByTable = useDatabaseStore((s) => s.recordsByTable);
  const relationships = useDatabaseStore((s) => s.relationships);

  // Get current record
  const currentRecord = useMemo(() => {
    const tableRecords = recordsByTable.get(tableId);
    return tableRecords?.get(recordId);
  }, [recordsByTable, tableId, recordId]);

  // Get current table
  const currentTable = useMemo(() => tables.get(tableId), [tables, tableId]);

  // Find linked records from relationships
  const linkedRecords = useMemo((): LinkedRecordInfo[] => {
    if (!currentRecord || !currentTable) return [];

    const linked: LinkedRecordInfo[] = [];

    // Check relationships where this table is the source
    const sourceRels = Array.from(relationships.values()).filter((r) => r.sourceTableId === tableId);
    for (const rel of sourceRels) {
      const fieldValue = currentRecord.customFields[rel.sourceFieldName];
      if (!fieldValue) continue;

      const targetTable = tables.get(rel.targetTableId);
      const targetRecords = recordsByTable.get(rel.targetTableId);
      if (!targetTable || !targetRecords) continue;

      // Handle single or multiple values
      const valueIds = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
      for (const valueId of valueIds) {
        const linkedRecord = targetRecords.get(valueId as string);
        if (linkedRecord) {
          linked.push({
            id: linkedRecord.id,
            tableId: rel.targetTableId,
            tableName: targetTable.name,
            tableIcon: targetTable.icon,
            displayValue: getRecordDisplayValue(linkedRecord, rel.targetFieldName),
          });
        }
      }
    }

    // Check relationships where this table is the target (reverse lookup)
    const targetRels = Array.from(relationships.values()).filter((r) => r.targetTableId === tableId);
    for (const rel of targetRels) {
      const sourceTable = tables.get(rel.sourceTableId);
      const sourceRecords = recordsByTable.get(rel.sourceTableId);
      if (!sourceTable || !sourceRecords) continue;

      // Find records that link to this record
      for (const record of sourceRecords.values()) {
        const fieldValue = record.customFields[rel.sourceFieldName];
        if (!fieldValue) continue;

        const valueIds = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
        if (valueIds.includes(recordId)) {
          linked.push({
            id: record.id,
            tableId: rel.sourceTableId,
            tableName: sourceTable.name,
            tableIcon: sourceTable.icon,
            displayValue: getRecordDisplayValue(record),
          });
        }
      }
    }

    return linked;
  }, [currentRecord, currentTable, tableId, recordId, relationships, tables, recordsByTable]);

  // Get status field if exists
  const statusField = useMemo(() => {
    if (!currentTable) return null;
    return currentTable.fields.find(
      (f) => f.name === 'status' || f.name.includes('_status')
    );
  }, [currentTable]);

  const currentStatus = statusField
    ? (currentRecord?.customFields[statusField.name] as string)
    : null;

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('crm.caseTimeline', 'Case Timeline')}
          </CardTitle>
          {currentStatus && (
            <StatusBadge status={currentStatus} />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="px-6 border-b">
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {t('crm.all', 'All')}
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                {t('crm.activity', 'Activity')}
              </TabsTrigger>
              <TabsTrigger value="linked" className="text-xs">
                <Link2 className="h-3 w-3 mr-1" />
                {t('crm.linked', 'Linked')} ({linkedRecords.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="m-0">
            <div className="p-6">
              <RecordTimeline
                recordId={recordId}
                tableId={tableId}
                groupId={groupId}
                userPubkey={userPubkey}
                onStartDM={onStartDM}
                onViewProfile={onViewProfile}
                onNavigateToRecord={onNavigateToRecord}
                onPreviewAttachment={onPreviewAttachment}
              />
            </div>
          </TabsContent>

          <TabsContent value="activity" className="m-0">
            <div className="p-6">
              <RecordTimeline
                recordId={recordId}
                tableId={tableId}
                groupId={groupId}
                userPubkey={userPubkey}
                onStartDM={onStartDM}
                onViewProfile={onViewProfile}
                onNavigateToRecord={onNavigateToRecord}
                onPreviewAttachment={onPreviewAttachment}
              />
            </div>
          </TabsContent>

          <TabsContent value="linked" className="m-0">
            <div className="p-6">
              {linkedRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('crm.noLinkedRecords', 'No linked records')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedRecords.map((linked) => (
                    <button
                      key={`${linked.tableId}-${linked.id}`}
                      onClick={() => onNavigateToRecord?.(linked.id, linked.tableId)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg',
                        'bg-muted/50 hover:bg-muted transition-colors text-left'
                      )}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                        {linked.tableIcon ? (
                          <span>{linked.tableIcon}</span>
                        ) : (
                          <Link2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {linked.displayValue}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {linked.tableName}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusLower = status.toLowerCase();

  // Determine badge variant based on common status patterns
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
  let Icon = Clock;

  if (statusLower.includes('closed') || statusLower.includes('resolved') || statusLower.includes('complete')) {
    variant = 'default';
    Icon = CheckCircle2;
  } else if (statusLower.includes('urgent') || statusLower.includes('critical') || statusLower.includes('overdue')) {
    variant = 'destructive';
    Icon = AlertCircle;
  } else if (statusLower.includes('pending') || statusLower.includes('waiting')) {
    variant = 'outline';
    Icon = Clock;
  }

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function getRecordDisplayValue(record: DatabaseRecord, displayField?: string): string {
  if (displayField && record.customFields[displayField] !== undefined) {
    return String(record.customFields[displayField]);
  }

  // Try common display fields
  const commonFields = ['name', 'title', 'full_name', 'label', 'case_number', 'subject'];
  for (const field of commonFields) {
    if (record.customFields[field]) {
      return String(record.customFields[field]);
    }
  }

  // Fallback to first non-empty string field
  for (const value of Object.values(record.customFields)) {
    if (value && typeof value === 'string' && value.length < 100) {
      return value;
    }
  }

  return record.id.substring(0, 8);
}

export default CaseTimeline;
