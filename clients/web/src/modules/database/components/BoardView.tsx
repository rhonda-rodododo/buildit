/**
 * Database Board View Component
 * Kanban-style board view
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DatabaseRecord, DatabaseTable, DatabaseView } from '../types';

interface BoardViewProps {
  table: DatabaseTable;
  view: DatabaseView;
  records: DatabaseRecord[];
  onRecordClick?: (record: DatabaseRecord) => void;
}

export function BoardView({ table, view, records, onRecordClick }: BoardViewProps) {
  const { t } = useTranslation('database');
  // Get the grouping field from view config
  const groupByField = view.config.boardGroupBy || table.fields[0]?.name;
  const cardFields = view.config.boardCardFields || table.fields.slice(0, 3).map((f) => f.name);

  // Find the field definition
  const groupField = table.fields.find((f) => f.name === groupByField);

  // Group records by the grouping field (hook must be called unconditionally)
  const groups = React.useMemo(() => {
    if (!groupField) return new Map<string, DatabaseRecord[]>();

    const groupMap = new Map<string, DatabaseRecord[]>();

    // Get all possible values for the grouping field
    let possibleValues: string[] = [];
    if (groupField.schema.enum) {
      possibleValues = groupField.schema.enum.map(String);
    } else {
      // Extract unique values from records
      const values = new Set<string>();
      records.forEach((record) => {
        const value = String(record.customFields[groupByField] || 'Uncategorized');
        values.add(value);
      });
      possibleValues = Array.from(values);
    }

    // Initialize groups
    possibleValues.forEach((value) => {
      groupMap.set(value, []);
    });

    // Add "Uncategorized" group if needed
    if (!groupMap.has('Uncategorized')) {
      groupMap.set('Uncategorized', []);
    }

    // Distribute records into groups
    records.forEach((record) => {
      const value = String(record.customFields[groupByField] || 'Uncategorized');
      const group = groupMap.get(value) || [];
      group.push(record);
      groupMap.set(value, group);
    });

    return groupMap;
  }, [records, groupByField, groupField]);

  // Handle missing group field after hooks
  if (!groupField) {
    return <div className="p-4 text-muted-foreground">{t('noGroupingField')}</div>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from(groups.entries()).map(([groupName, groupRecords]) => (
        <div key={groupName} className="flex-shrink-0 w-80">
          <div className="mb-3">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">
              {groupName}
              <span className="ml-2 text-xs">({groupRecords.length})</span>
            </h3>
          </div>
          <div className="space-y-2">
            {groupRecords.map((record) => (
              <Card
                key={record.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onRecordClick?.(record)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    {String(record.customFields[cardFields[0]] || 'Untitled')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  {cardFields.slice(1).map((fieldName) => {
                    const field = table.fields.find((f) => f.name === fieldName);
                    const value = record.customFields[fieldName];
                    if (!field || !value) return null;
                    return (
                      <div key={fieldName} className="text-muted-foreground">
                        <span className="font-medium">{field.label}:</span> {String(value)}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
            {groupRecords.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                {t('noRecords')}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
