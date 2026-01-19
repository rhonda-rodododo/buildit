/**
 * Relationship Field Editor
 * Select records from another table to link
 */

import { useState, useEffect, useMemo } from 'react';
import { useDatabaseStore } from '../databaseStore';
import { databaseManager } from '../databaseManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, X, Link2, Plus, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { DatabaseRecord } from '../types';

interface RelationshipFieldEditorProps {
  value: string | string[] | null | undefined;
  onChange: (value: string | string[] | null) => void;
  targetTableId: string;
  displayField?: string;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function RelationshipFieldEditor({
  value,
  onChange,
  targetTableId,
  displayField,
  multiple = false,
  placeholder,
  disabled,
  className,
}: RelationshipFieldEditorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const tables = useDatabaseStore((s) => s.tables);
  const recordsByTable = useDatabaseStore((s) => s.recordsByTable);

  // Get target table info
  const targetTable = useMemo(() => tables.get(targetTableId), [tables, targetTableId]);

  // Load records for target table if not loaded
  useEffect(() => {
    const loadRecords = async () => {
      if (!recordsByTable.has(targetTableId)) {
        setLoading(true);
        try {
          await databaseManager.loadRecordsForTable(targetTableId);
        } finally {
          setLoading(false);
        }
      }
    };
    loadRecords();
  }, [targetTableId, recordsByTable]);

  // Get available records from target table
  const availableRecords = useMemo(() => {
    const tableRecords = recordsByTable.get(targetTableId);
    if (!tableRecords) return [];
    return Array.from(tableRecords.values());
  }, [recordsByTable, targetTableId]);

  // Get currently selected records
  const selectedRecordIds = useMemo(() => {
    if (!value) return [];
    if (multiple) {
      return Array.isArray(value) ? value : [value];
    }
    return [value];
  }, [value, multiple]);

  const selectedRecords = useMemo(() => {
    const tableRecords = recordsByTable.get(targetTableId);
    if (!tableRecords) return [];
    return selectedRecordIds
      .map((id) => tableRecords.get(id as string))
      .filter((r): r is DatabaseRecord => r !== undefined);
  }, [selectedRecordIds, recordsByTable, targetTableId]);

  // Filter records based on search
  const filteredRecords = useMemo(() => {
    if (!search) return availableRecords;
    const lowerSearch = search.toLowerCase();
    return availableRecords.filter((record) => {
      // Search in display field
      if (displayField && record.customFields[displayField]) {
        if (String(record.customFields[displayField]).toLowerCase().includes(lowerSearch)) {
          return true;
        }
      }
      // Search in common fields
      const commonFields = ['name', 'title', 'full_name', 'label', 'email'];
      for (const field of commonFields) {
        if (record.customFields[field]) {
          if (String(record.customFields[field]).toLowerCase().includes(lowerSearch)) {
            return true;
          }
        }
      }
      return false;
    });
  }, [availableRecords, search, displayField]);

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
    for (const val of Object.values(record.customFields)) {
      if (val && typeof val === 'string') {
        return val.length > 30 ? val.substring(0, 30) + '...' : val;
      }
    }
    return record.id.substring(0, 8);
  };

  const handleSelect = (recordId: string) => {
    if (multiple) {
      const currentIds = selectedRecordIds as string[];
      if (currentIds.includes(recordId)) {
        // Remove
        const newIds = currentIds.filter((id) => id !== recordId);
        onChange(newIds.length > 0 ? newIds : null);
      } else {
        // Add
        onChange([...currentIds, recordId]);
      }
    } else {
      onChange(recordId);
      setOpen(false);
    }
    setSearch('');
  };

  const handleRemove = (recordId: string) => {
    if (multiple) {
      const currentIds = selectedRecordIds as string[];
      const newIds = currentIds.filter((id) => id !== recordId);
      onChange(newIds.length > 0 ? newIds : null);
    } else {
      onChange(null);
    }
  };

  const handleClear = () => {
    onChange(null);
    setSearch('');
  };

  if (disabled) {
    return (
      <div className={cn('flex flex-wrap gap-1 px-3 py-2 bg-muted rounded-md min-h-[2.5rem]', className)}>
        {selectedRecords.length > 0 ? (
          selectedRecords.map((record) => (
            <Badge key={record.id} variant="secondary">
              {getDisplayValue(record)}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground">{t('common.notLinked', 'Not linked')}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Selected records (for multiple) */}
      {multiple && selectedRecords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedRecords.map((record) => (
            <Badge
              key={record.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              {getDisplayValue(record)}
              <button
                onClick={() => handleRemove(record.id)}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Selector */}
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between h-9"
            >
              {!multiple && selectedRecords.length === 1 ? (
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span className="truncate max-w-[200px]">
                    {getDisplayValue(selectedRecords[0])}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground flex items-center gap-2">
                  {multiple ? (
                    <>
                      <Plus className="h-4 w-4" />
                      {placeholder || t('common.addLink', 'Add link...')}
                    </>
                  ) : (
                    placeholder || t('common.selectRecord', 'Select record...')
                  )}
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            {/* Search input */}
            <div className="flex items-center border-b px-3">
              <Search className="h-4 w-4 shrink-0 opacity-50" />
              <Input
                placeholder={t('common.searchRecords', 'Search records...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 focus-visible:ring-0"
              />
            </div>

            {/* Records list */}
            <ScrollArea className="h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRecords.length > 0 ? (
                <div className="p-1">
                  {targetTable && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                      {targetTable.icon} {targetTable.name}
                    </div>
                  )}
                  {filteredRecords.map((record) => {
                    const isSelected = selectedRecordIds.includes(record.id);
                    const displayValue = getDisplayValue(record);

                    return (
                      <button
                        key={record.id}
                        onClick={() => handleSelect(record.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                          'hover:bg-accent hover:text-accent-foreground',
                          isSelected && 'bg-accent'
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{displayValue}</span>
                        </div>
                        {isSelected && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6">
                  <Link2 className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t('common.noRecordsFound', 'No records found')}
                  </p>
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {!multiple && value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default RelationshipFieldEditor;
