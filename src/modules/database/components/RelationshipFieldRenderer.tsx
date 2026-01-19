/**
 * Relationship Field Renderer
 * Displays a linked record from another table
 */

import { useState, useEffect } from 'react';
import { useDatabaseStore } from '../databaseStore';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ExternalLink, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { DatabaseRecord, DatabaseTable } from '../types';

interface RelationshipFieldRendererProps {
  recordId: string | string[] | null | undefined;
  targetTableId: string;
  displayField?: string;
  className?: string;
  onNavigateToRecord?: (recordId: string, tableId: string) => void;
  multiple?: boolean;
}

export function RelationshipFieldRenderer({
  recordId,
  targetTableId,
  displayField,
  className,
  onNavigateToRecord,
  multiple = false,
}: RelationshipFieldRendererProps) {
  const { t } = useTranslation();
  const tables = useDatabaseStore((s) => s.tables);
  const recordsByTable = useDatabaseStore((s) => s.recordsByTable);

  const [linkedRecords, setLinkedRecords] = useState<DatabaseRecord[]>([]);
  const [targetTable, setTargetTable] = useState<DatabaseTable | null>(null);

  useEffect(() => {
    // Get target table
    const table = tables.get(targetTableId);
    setTargetTable(table || null);

    // Get linked records
    const recordIds = recordId
      ? multiple
        ? Array.isArray(recordId)
          ? recordId
          : [recordId]
        : [recordId]
      : [];

    const tableRecords = recordsByTable.get(targetTableId);
    if (tableRecords) {
      const records = recordIds
        .map((id) => tableRecords.get(id as string))
        .filter((r): r is DatabaseRecord => r !== undefined);
      setLinkedRecords(records);
    } else {
      setLinkedRecords([]);
    }
  }, [recordId, targetTableId, tables, recordsByTable, multiple]);

  if (!recordId || linkedRecords.length === 0) {
    return (
      <span className={cn('text-muted-foreground italic text-sm', className)}>
        {t('common.notLinked', 'Not linked')}
      </span>
    );
  }

  const getDisplayValue = (record: DatabaseRecord): string => {
    if (displayField && record.customFields[displayField] !== undefined) {
      return String(record.customFields[displayField]);
    }
    // Try common display fields
    const commonFields = ['name', 'title', 'full_name', 'label', 'id'];
    for (const field of commonFields) {
      if (record.customFields[field]) {
        return String(record.customFields[field]);
      }
    }
    // Fallback to first non-empty field
    for (const value of Object.values(record.customFields)) {
      if (value && typeof value === 'string') {
        return value.length > 30 ? value.substring(0, 30) + '...' : value;
      }
    }
    return record.id.substring(0, 8);
  };

  if (linkedRecords.length === 1) {
    const record = linkedRecords[0];
    const displayValue = getDisplayValue(record);

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
              'bg-primary/10 hover:bg-primary/20 text-primary',
              'transition-colors cursor-pointer text-sm',
              className
            )}
          >
            <Link2 className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{displayValue}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <LinkedRecordPreview
            record={record}
            table={targetTable}
            onNavigate={onNavigateToRecord}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Multiple linked records
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {linkedRecords.slice(0, 3).map((record) => {
        const displayValue = getDisplayValue(record);
        return (
          <Popover key={record.id}>
            <PopoverTrigger asChild>
              <Badge
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
              >
                {displayValue}
              </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <LinkedRecordPreview
                record={record}
                table={targetTable}
                onNavigate={onNavigateToRecord}
              />
            </PopoverContent>
          </Popover>
        );
      })}
      {linkedRecords.length > 3 && (
        <Badge variant="outline">+{linkedRecords.length - 3}</Badge>
      )}
    </div>
  );
}

interface LinkedRecordPreviewProps {
  record: DatabaseRecord;
  table: DatabaseTable | null;
  onNavigate?: (recordId: string, tableId: string) => void;
}

function LinkedRecordPreview({
  record,
  table,
  onNavigate,
}: LinkedRecordPreviewProps) {
  const { t } = useTranslation();

  // Get first few fields to display
  const previewFields = table?.fields.slice(0, 4) || [];

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {table?.icon && <span>{table.icon}</span>}
          <span className="font-medium text-sm">{table?.name || t('common.record', 'Record')}</span>
        </div>
        {onNavigate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => onNavigate(record.id, record.tableId)}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            {t('common.open', 'Open')}
          </Button>
        )}
      </div>

      {/* Preview fields */}
      <div className="space-y-1 text-sm">
        {previewFields.map((field) => {
          const value = record.customFields[field.name];
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
            <div key={field.id} className="flex items-start gap-2">
              <span className="text-muted-foreground min-w-[80px] truncate">
                {field.label}:
              </span>
              <span className="truncate flex-1">{displayValue}</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground pt-1 border-t">
        {t('common.createdAt', 'Created')}: {new Date(record.created).toLocaleDateString()}
      </div>
    </div>
  );
}

export default RelationshipFieldRenderer;
