/**
 * Database Calendar View Component
 * Calendar view for date-based records
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { DatabaseRecord, DatabaseTable, DatabaseView } from '../types';

interface CalendarViewProps {
  table: DatabaseTable;
  view: DatabaseView;
  records: DatabaseRecord[];
  onRecordClick?: (record: DatabaseRecord) => void;
}

export function CalendarView({ table, view, records, onRecordClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  // Get the date field from view config
  const dateField = view.config.calendarDateField || table.fields.find((f) => f.widget.widget === 'date')?.name;

  // Generate calendar days (hook must be called unconditionally)
  const { days, monthName, year } = React.useMemo(() => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = new Date(firstDay);
    startDay.setDate(startDay.getDate() - startDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDay);

    while (current <= lastDay || current.getDay() !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
      if (days.length > 42) break; // Max 6 weeks
    }

    return {
      days,
      monthName: firstDay.toLocaleDateString('default', { month: 'long' }),
      year: firstDay.getFullYear(),
    };
  }, [currentDate]);

  // Group records by date (hook must be called unconditionally)
  const recordsByDate = React.useMemo(() => {
    if (!dateField) return new Map<string, DatabaseRecord[]>();

    const map = new Map<string, DatabaseRecord[]>();
    records.forEach((record) => {
      const dateValue = record.customFields[dateField];
      if (dateValue) {
        const date = new Date(dateValue as string);
        const key = date.toDateString();
        const existing = map.get(key) || [];
        existing.push(record);
        map.set(key, existing);
      }
    });
    return map;
  }, [records, dateField]);

  // Handle missing date field after hooks
  if (!dateField) {
    return <div className="p-4 text-muted-foreground">No date field configured</div>;
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {monthName} {year}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="px-3 py-1 border rounded hover:bg-muted"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 border rounded hover:bg-muted"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="px-3 py-1 border rounded hover:bg-muted"
          >
            Next
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center font-semibold text-sm py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, index) => {
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = day.toDateString() === new Date().toDateString();
          const dayRecords = recordsByDate.get(day.toDateString()) || [];

          return (
            <div
              key={index}
              className={`min-h-24 border p-1 ${
                isCurrentMonth ? 'bg-background' : 'bg-muted/30'
              } ${isToday ? 'border-primary border-2' : ''}`}
            >
              <div className="text-right text-sm font-medium mb-1">
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayRecords.slice(0, 3).map((record) => (
                  <Card
                    key={record.id}
                    className="cursor-pointer hover:bg-muted p-1"
                    onClick={() => onRecordClick?.(record)}
                  >
                    <CardContent className="p-1 text-xs truncate">
                      {String(record.customFields[table.fields[0]?.name] || 'Untitled')}
                    </CardContent>
                  </Card>
                ))}
                {dayRecords.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{dayRecords.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
