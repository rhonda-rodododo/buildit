/**
 * ContentCalendar Component
 *
 * Full content scheduling calendar with month/week/day views,
 * time-slot grid, drag-to-reschedule, and entry management.
 * Designed for desktop-first use (Tauri), responsive for smaller screens.
 */

import { FC, useState, useMemo, useCallback, useRef, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  GripVertical,
  Radio,
  Globe,
  AtSign,
  Rss,
  X,
  LayoutGrid,
  Columns,
  Rows,
} from 'lucide-react';
import {
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  eachDayOfInterval,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from 'date-fns';
import { useSocialPublishingStore } from '../socialPublishingStore';
import { getSocialPublishingManager } from '../socialPublishingManager';
import type { ContentCalendarEntry, ScheduledContent } from '../types';
import { toast } from 'sonner';

type ViewMode = 'month' | 'week' | 'day';

interface ContentCalendarProps {
  groupId?: string;
  className?: string;
}

// ── Constants ──────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WORK_HOURS_START = 6;
const WORK_HOURS_END = 22;

const MODULE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  publishing:    { bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', border: 'border-l-purple-500' },
  microblogging: { bg: 'bg-sky-500/15',    text: 'text-sky-700 dark:text-sky-300',       border: 'border-l-sky-500' },
  events:        { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-l-emerald-500' },
  newsletters:   { bg: 'bg-orange-500/15',  text: 'text-orange-700 dark:text-orange-300', border: 'border-l-orange-500' },
  marketplace:   { bg: 'bg-pink-500/15',    text: 'text-pink-700 dark:text-pink-300',     border: 'border-l-pink-500' },
  wiki:          { bg: 'bg-indigo-500/15',  text: 'text-indigo-700 dark:text-indigo-300', border: 'border-l-indigo-500' },
};

const PLATFORM_ICONS: Record<string, FC<{ className?: string }>> = {
  nostr: Radio,
  activitypub: Globe,
  atproto: AtSign,
  rss: Rss,
};

const STATUS_CONFIG: Record<string, { icon: FC<{ className?: string }>; color: string }> = {
  pending:   { icon: Clock,        color: 'text-yellow-600 dark:text-yellow-400' },
  publishing:{ icon: Clock,        color: 'text-blue-600 dark:text-blue-400' },
  published: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
  failed:    { icon: XCircle,      color: 'text-red-600 dark:text-red-400' },
  cancelled: { icon: AlertCircle,  color: 'text-gray-500' },
};

function getModuleStyle(module: string) {
  return MODULE_COLORS[module] || { bg: 'bg-gray-500/15', text: 'text-gray-700 dark:text-gray-300', border: 'border-l-gray-500' };
}

// ── Main Component ─────────────────────────────────────────────────

export const ContentCalendar: FC<ContentCalendarProps> = ({ className }) => {
  const { t } = useTranslation();
  const store = useSocialPublishingStore();
  const manager = getSocialPublishingManager();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEntry, setSelectedEntry] = useState<ContentCalendarEntry | null>(null);
  const [dragEntryId, setDragEntryId] = useState<string | null>(null);

  // ── Date range computation ───────────────────────────────────────

  const { rangeStart, rangeEnd, days } = useMemo(() => {
    let start: Date, end: Date;
    if (viewMode === 'month') {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      start = startOfWeek(ms, { weekStartsOn: 0 });
      end = endOfWeek(me, { weekStartsOn: 0 });
    } else if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 0 });
      end = endOfWeek(currentDate, { weekStartsOn: 0 });
    } else {
      start = currentDate;
      end = currentDate;
    }
    return {
      rangeStart: start,
      rangeEnd: end,
      days: eachDayOfInterval({ start, end }),
    };
  }, [viewMode, currentDate]);

  // ── Entries in range ─────────────────────────────────────────────

  const entries = useMemo(() => {
    const startUnix = Math.floor(rangeStart.getTime() / 1000);
    const endUnix = Math.floor(rangeEnd.getTime() / 1000) + 86400;
    return store.getCalendarEntriesInRange(startUnix, endUnix);
  }, [store, rangeStart, rangeEnd]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, ContentCalendarEntry[]>();
    for (const entry of entries) {
      const key = format(new Date(entry.scheduledAt * 1000), 'yyyy-MM-dd');
      const arr = map.get(key) || [];
      arr.push(entry);
      map.set(key, arr);
    }
    return map;
  }, [entries]);

  // ── Navigation ───────────────────────────────────────────────────

  const navigate = useCallback((direction: 'prev' | 'next') => {
    const fn = direction === 'next'
      ? viewMode === 'month' ? addMonths
        : viewMode === 'week' ? addWeeks : addDays
      : viewMode === 'month' ? subMonths
        : viewMode === 'week' ? subWeeks : subDays;
    setCurrentDate((d) => fn(d, 1));
  }, [viewMode]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  // ── Drag-to-reschedule ───────────────────────────────────────────

  const handleDragStart = useCallback((e: DragEvent, entryId: string) => {
    setDragEntryId(entryId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entryId);
  }, []);

  const handleDrop = useCallback((e: DragEvent, targetDate: Date, targetHour?: number) => {
    e.preventDefault();
    const entryId = e.dataTransfer.getData('text/plain') || dragEntryId;
    if (!entryId) return;

    const entry = entries.find((en) => en.id === entryId);
    if (!entry) return;

    // Preserve original time if dropping on a day (month view)
    let newDate = targetDate;
    if (targetHour !== undefined) {
      const origDate = new Date(entry.scheduledAt * 1000);
      newDate = setHours(setMinutes(targetDate, getMinutes(origDate)), targetHour);
    } else {
      const origDate = new Date(entry.scheduledAt * 1000);
      newDate = setHours(setMinutes(targetDate, getMinutes(origDate)), getHours(origDate));
    }

    manager.rescheduleEntry(entryId, newDate);
    setDragEntryId(null);
    toast.success(`Rescheduled to ${format(newDate, 'PPp')}`);
  }, [dragEntryId, entries, manager]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // ── Cancel entry ─────────────────────────────────────────────────

  const handleCancel = useCallback(async (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    const scheduled = store.scheduledContent.find(
      (s) => s.sourceModule === entry.sourceModule && s.sourceContentId === entry.sourceContentId
    );
    if (scheduled) {
      await manager.cancelSchedule(scheduled.id);
    }
    store.updateCalendarEntry(entryId, { status: 'cancelled' });
    setSelectedEntry(null);
    toast.success('Scheduled content cancelled');
  }, [entries, store, manager]);

  // ── Title ────────────────────────────────────────────────────────

  const title = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return isSameMonth(ws, we)
        ? `${format(ws, 'MMM d')} – ${format(we, 'd, yyyy')}`
        : `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  }, [viewMode, currentDate]);

  return (
    <Card className={className}>
      {/* Toolbar */}
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={goToToday}>
            Today
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[180px]">{title}</h2>
        </div>

        <div className="flex items-center gap-1 border rounded-lg p-0.5">
          <Button
            size="sm"
            variant={viewMode === 'month' ? 'secondary' : 'ghost'}
            className="h-7 px-2.5 text-xs"
            onClick={() => setViewMode('month')}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1" />
            {t('social-publishing.calendar.month', 'Month')}
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'week' ? 'secondary' : 'ghost'}
            className="h-7 px-2.5 text-xs"
            onClick={() => setViewMode('week')}
          >
            <Columns className="h-3.5 w-3.5 mr-1" />
            {t('social-publishing.calendar.week', 'Week')}
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'day' ? 'secondary' : 'ghost'}
            className="h-7 px-2.5 text-xs"
            onClick={() => setViewMode('day')}
          >
            <Rows className="h-3.5 w-3.5 mr-1" />
            {t('social-publishing.calendar.day', 'Day')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <TooltipProvider delayDuration={200}>
          {viewMode === 'month' ? (
            <MonthGrid
              days={days}
              currentDate={currentDate}
              entriesByDay={entriesByDay}
              onSelectDay={(d) => { setCurrentDate(d); setViewMode('day'); }}
              onSelectEntry={setSelectedEntry}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            />
          ) : (
            <TimeGrid
              days={days}
              viewMode={viewMode}
              entriesByDay={entriesByDay}
              onSelectEntry={setSelectedEntry}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            />
          )}
        </TooltipProvider>

        {/* Module legend */}
        <div className="flex flex-wrap gap-3 px-4 py-3 border-t">
          {Object.entries(MODULE_COLORS).map(([module, style]) => (
            <div key={module} className="flex items-center gap-1.5 text-xs">
              <div className={`h-2.5 w-2.5 rounded-sm ${style.bg} ${style.border} border-l-2`} />
              <span className="capitalize text-muted-foreground">{module}</span>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Entry detail dialog */}
      {selectedEntry && (
        <EntryDetailDialog
          entry={selectedEntry}
          scheduledContent={store.scheduledContent.find(
            (s) => s.sourceModule === selectedEntry.sourceModule &&
              s.sourceContentId === selectedEntry.sourceContentId
          )}
          open={!!selectedEntry}
          onOpenChange={(open) => { if (!open) setSelectedEntry(null); }}
          onCancel={() => handleCancel(selectedEntry.id)}
        />
      )}
    </Card>
  );
};

// ── Month Grid ─────────────────────────────────────────────────────

const MonthGrid: FC<{
  days: Date[];
  currentDate: Date;
  entriesByDay: Map<string, ContentCalendarEntry[]>;
  onSelectDay: (d: Date) => void;
  onSelectEntry: (e: ContentCalendarEntry) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDrop: (e: DragEvent, date: Date) => void;
  onDragOver: (e: DragEvent) => void;
}> = ({ days, currentDate, entriesByDay, onSelectDay, onSelectEntry, onDragStart, onDrop, onDragOver }) => {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="border-t">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayEntries = entriesByDay.get(key) || [];
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);

            return (
              <div
                key={key}
                className={`min-h-[100px] border-r last:border-r-0 p-1 transition-colors
                  ${!inMonth ? 'bg-muted/30' : ''}
                  ${today ? 'bg-primary/5' : ''}
                  ${dayEntries.length > 0 ? 'hover:bg-muted/50' : ''}
                `}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, day)}
              >
                {/* Day number */}
                <button
                  className={`w-6 h-6 rounded-full text-xs flex items-center justify-center mb-0.5
                    ${today ? 'bg-primary text-primary-foreground font-bold' : ''}
                    ${!inMonth ? 'text-muted-foreground' : ''}
                    hover:bg-muted
                  `}
                  onClick={() => onSelectDay(day)}
                >
                  {format(day, 'd')}
                </button>

                {/* Entries */}
                <div className="space-y-0.5">
                  {dayEntries.slice(0, 3).map((entry) => (
                    <MonthEntryChip
                      key={entry.id}
                      entry={entry}
                      onClick={() => onSelectEntry(entry)}
                      onDragStart={onDragStart}
                    />
                  ))}
                  {dayEntries.length > 3 && (
                    <button
                      className="text-[10px] text-muted-foreground pl-1 hover:underline"
                      onClick={() => onSelectDay(day)}
                    >
                      +{dayEntries.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const MonthEntryChip: FC<{
  entry: ContentCalendarEntry;
  onClick: () => void;
  onDragStart: (e: DragEvent, id: string) => void;
}> = ({ entry, onClick, onDragStart }) => {
  const style = getModuleStyle(entry.sourceModule);
  const time = format(new Date(entry.scheduledAt * 1000), 'h:mma').toLowerCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] truncate border-l-2
            ${style.bg} ${style.text} ${style.border}
            hover:ring-1 hover:ring-ring/30 cursor-grab active:cursor-grabbing
          `}
          draggable
          onDragStart={(e) => onDragStart(e, entry.id)}
          onClick={onClick}
        >
          <span className="font-medium">{time}</span>{' '}
          <span className="opacity-80">{entry.title || entry.sourceContentId}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs max-w-[200px]">
        <p className="font-medium">{entry.title || entry.sourceContentId}</p>
        <p className="text-muted-foreground">{entry.sourceModule} · {entry.status}</p>
        {entry.platforms && entry.platforms.length > 0 && (
          <p className="text-muted-foreground">{entry.platforms.join(', ')}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

// ── Week / Day Time Grid ───────────────────────────────────────────

const TimeGrid: FC<{
  days: Date[];
  viewMode: 'week' | 'day';
  entriesByDay: Map<string, ContentCalendarEntry[]>;
  onSelectEntry: (e: ContentCalendarEntry) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDrop: (e: DragEvent, date: Date, hour?: number) => void;
  onDragOver: (e: DragEvent) => void;
}> = ({ days, viewMode, entriesByDay, onSelectEntry, onDragStart, onDrop, onDragOver }) => {
  const gridRef = useRef<HTMLDivElement>(null);

  // Current time indicator position
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const topPercent = ((nowMinutes - WORK_HOURS_START * 60) / ((WORK_HOURS_END - WORK_HOURS_START) * 60)) * 100;

  const visibleHours = HOURS.filter((h) => h >= WORK_HOURS_START && h < WORK_HOURS_END);

  return (
    <div className="border-t overflow-auto max-h-[600px]" ref={gridRef}>
      {/* Day headers */}
      <div
        className="grid border-b sticky top-0 z-10 bg-background"
        style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}
      >
        <div className="border-r p-2 text-xs text-muted-foreground" />
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`p-2 text-center border-r last:border-r-0 ${today ? 'bg-primary/5' : ''}`}
            >
              <div className="text-xs text-muted-foreground">
                {format(day, viewMode === 'week' ? 'EEE' : 'EEEE')}
              </div>
              <div className={`text-sm font-semibold ${today ? 'text-primary' : ''}`}>
                {format(day, viewMode === 'week' ? 'd' : 'MMMM d')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slots */}
      <div
        className="grid relative"
        style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}
      >
        {/* Time labels + rows */}
        {visibleHours.map((hour) => (
          <div key={hour} className="contents">
            {/* Time label */}
            <div className="border-r border-b px-2 py-0 h-16 flex items-start justify-end">
              <span className="text-[10px] text-muted-foreground -translate-y-2">
                {format(setHours(new Date(), hour), 'h a')}
              </span>
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEntries = (entriesByDay.get(key) || []).filter((e) => {
                const h = getHours(new Date(e.scheduledAt * 1000));
                return h === hour;
              });

              return (
                <div
                  key={`${key}-${hour}`}
                  className={`border-r border-b last:border-r-0 h-16 p-0.5 relative
                    ${isToday(day) ? 'bg-primary/[0.02]' : ''}
                    hover:bg-muted/30 transition-colors
                  `}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, day, hour)}
                >
                  {dayEntries.map((entry) => (
                    <TimeGridEntry
                      key={entry.id}
                      entry={entry}
                      onClick={() => onSelectEntry(entry)}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}

        {/* Now indicator line */}
        {topPercent >= 0 && topPercent <= 100 && days.some((d) => isToday(d)) && (
          <div
            className="absolute left-[60px] right-0 z-20 pointer-events-none"
            style={{ top: `${topPercent}%` }}
          >
            <div className="flex items-center">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 h-[2px] bg-red-500/60" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TimeGridEntry: FC<{
  entry: ContentCalendarEntry;
  onClick: () => void;
  onDragStart: (e: DragEvent, id: string) => void;
}> = ({ entry, onClick, onDragStart }) => {
  const style = getModuleStyle(entry.sourceModule);
  const time = format(new Date(entry.scheduledAt * 1000), 'h:mm');
  const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`w-full text-left px-1.5 py-1 rounded text-[11px] border-l-2 mb-0.5
            ${style.bg} ${style.text} ${style.border}
            hover:ring-1 hover:ring-ring/30 cursor-grab active:cursor-grabbing
            flex items-center gap-1
          `}
          draggable
          onDragStart={(e) => onDragStart(e, entry.id)}
          onClick={onClick}
        >
          <GripVertical className="h-3 w-3 opacity-40 shrink-0" />
          <StatusIcon className={`h-3 w-3 shrink-0 ${statusCfg.color}`} />
          <span className="truncate">
            <span className="font-medium">{time}</span>{' '}
            {entry.title || entry.sourceContentId}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs max-w-[220px]">
        <p className="font-medium">{entry.title || entry.sourceContentId}</p>
        <p className="text-muted-foreground capitalize">{entry.sourceModule} · {entry.status}</p>
        {entry.platforms && entry.platforms.length > 0 && (
          <div className="flex gap-1 mt-1">
            {entry.platforms.map((p) => {
              const Icon = PLATFORM_ICONS[p];
              return Icon ? <Icon key={p} className="h-3 w-3" /> : null;
            })}
          </div>
        )}
        <p className="text-muted-foreground mt-1">Drag to reschedule</p>
      </TooltipContent>
    </Tooltip>
  );
};

// ── Entry Detail Dialog ────────────────────────────────────────────

const EntryDetailDialog: FC<{
  entry: ContentCalendarEntry;
  scheduledContent?: ScheduledContent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
}> = ({ entry, scheduledContent, open, onOpenChange, onCancel }) => {
  const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const style = getModuleStyle(entry.sourceModule);
  const scheduledDate = new Date(entry.scheduledAt * 1000);
  const isPast = scheduledDate < new Date();
  const canCancel = entry.status === 'pending' && !isPast;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-sm border-l-2 ${style.border} ${style.bg}`} />
            {entry.title || entry.sourceContentId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Timing */}
          <div className="flex items-center gap-3 text-sm">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{format(scheduledDate, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-muted-foreground">{format(scheduledDate, 'h:mm a')}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 text-sm">
            <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
            <span className="capitalize">{entry.status}</span>
            {isPast && entry.status === 'pending' && (
              <Badge variant="destructive" className="text-xs">Overdue</Badge>
            )}
          </div>

          {/* Source */}
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="capitalize">{entry.sourceModule}</Badge>
            <span className="text-muted-foreground text-xs font-mono truncate">
              {entry.sourceContentId}
            </span>
          </div>

          {/* Platforms */}
          {entry.platforms && entry.platforms.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Platforms</p>
              <div className="flex gap-2">
                {entry.platforms.map((p) => {
                  const Icon = PLATFORM_ICONS[p] || Globe;
                  return (
                    <Badge key={p} variant="secondary" className="text-xs gap-1">
                      <Icon className="h-3 w-3" />
                      {p}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cross-post status */}
          {scheduledContent?.crossPostConfig?.platforms && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Cross-post delivery</p>
              <div className="space-y-1">
                {scheduledContent.crossPostConfig.platforms
                  .filter((p) => p.enabled)
                  .map((p) => {
                    const pStatus = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                    const PIcon = pStatus.icon;
                    return (
                      <div key={p.platform} className="flex items-center gap-2 text-xs">
                        <PIcon className={`h-3 w-3 ${pStatus.color}`} />
                        <span className="capitalize">{p.platform}</span>
                        <span className="text-muted-foreground">— {p.status}</span>
                        {p.publishedUrl && (
                          <a
                            href={p.publishedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            View
                          </a>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Retry info */}
          {scheduledContent && scheduledContent.retryCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Retried {scheduledContent.retryCount} time{scheduledContent.retryCount > 1 ? 's' : ''}
              {scheduledContent.errorMessage && (
                <span className="text-destructive"> — {scheduledContent.errorMessage}</span>
              )}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canCancel && (
              <Button variant="destructive" size="sm" onClick={onCancel}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel Schedule
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
