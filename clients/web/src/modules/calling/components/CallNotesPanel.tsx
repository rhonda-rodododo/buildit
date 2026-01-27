/**
 * Call Notes Panel
 * Panel for managing call notes, category, and priority during an active call
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save,
  Check,
  Tag,
  AlertTriangle,
  Clock,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { HotlineCallState } from '../types';
import { HotlineCallStatePriority } from '../types';

interface CallNotesPanelProps {
  call: HotlineCallState;
  categories?: string[];
  onNotesChange: (notes: string) => void;
  onCategoryChange: (category: string) => void;
  onPriorityChange: (priority: HotlineCallStatePriority) => void;
  onSave: () => void;
  autoSaveInterval?: number; // milliseconds
  isCompact?: boolean;
}

export function CallNotesPanel({
  call,
  categories = ['General', 'Emergency', 'Follow-up', 'Information', 'Complaint', 'Other'],
  onNotesChange,
  onCategoryChange,
  onPriorityChange,
  onSave,
  autoSaveInterval = 5000,
  isCompact = false,
}: CallNotesPanelProps) {
  const { t } = useTranslation('calling');
  const [notes, setNotes] = useState(call.notes || '');
  const [isSaved, setIsSaved] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-save with debounce
  useEffect(() => {
    if (isSaved) return;

    const timer = setTimeout(() => {
      onNotesChange(notes);
      onSave();
      setIsSaved(true);
      setLastSaved(new Date());
    }, autoSaveInterval);

    return () => clearTimeout(timer);
  }, [notes, isSaved, autoSaveInterval, onNotesChange, onSave]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    setIsSaved(false);
  }, []);

  const handleManualSave = useCallback(() => {
    onNotesChange(notes);
    onSave();
    setIsSaved(true);
    setLastSaved(new Date());
  }, [notes, onNotesChange, onSave]);

  const getPriorityColor = (priority: HotlineCallStatePriority) => {
    switch (priority) {
      case HotlineCallStatePriority.Urgent:
        return 'text-red-600 border-red-600';
      case HotlineCallStatePriority.High:
        return 'text-orange-600 border-orange-600';
      case HotlineCallStatePriority.Medium:
        return 'text-yellow-600 border-yellow-600';
      case HotlineCallStatePriority.Low:
        return 'text-gray-600 border-gray-600';
    }
  };

  if (isCompact) {
    return (
      <div className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder={t('addNotesPlaceholder')}
          rows={3}
          className="resize-none"
        />
        <div className="flex items-center gap-2">
          <Select value={call.category} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder={t('category')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={call.priority}
            onValueChange={(v) => onPriorityChange(v as HotlineCallStatePriority)}
          >
            <SelectTrigger className={cn('w-28', getPriorityColor(call.priority!))}>
              <SelectValue placeholder={t('priority')} />
            </SelectTrigger>
            <SelectContent>
              {Object.values(HotlineCallStatePriority).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {!isSaved && (
            <Button variant="outline" size="sm" onClick={handleManualSave}>
              <Save className="h-4 w-4 mr-1" />
              {t('save')}
            </Button>
          )}
          {isSaved && lastSaved && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t('saved')}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('callNotes')}
          </span>
          {!isSaved ? (
            <Button variant="outline" size="sm" onClick={handleManualSave}>
              <Save className="h-4 w-4 mr-2" />
              {t('save')}
            </Button>
          ) : lastSaved ? (
            <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3 text-green-500" />
              {t('autoSaved')} {lastSaved.toLocaleTimeString()}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category and Priority selectors */}
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              {t('category')}
            </label>
            <Select value={call.category} onValueChange={onCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t('priority')}
            </label>
            <Select
              value={call.priority}
              onValueChange={(v) => onPriorityChange(v as HotlineCallStatePriority)}
            >
              <SelectTrigger className={cn(getPriorityColor(call.priority!))}>
                <SelectValue placeholder={t('selectPriority')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={HotlineCallStatePriority.Urgent}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    {t('priorityUrgent')}
                  </div>
                </SelectItem>
                <SelectItem value={HotlineCallStatePriority.High}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    {t('priorityHigh')}
                  </div>
                </SelectItem>
                <SelectItem value={HotlineCallStatePriority.Medium}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    {t('priorityMedium')}
                  </div>
                </SelectItem>
                <SelectItem value={HotlineCallStatePriority.Low}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    {t('priorityLow')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notes textarea */}
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('notes')}</label>
          <Textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder={t('addNotesPlaceholder')}
            rows={6}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {t('autoSaveHint')}
          </p>
        </div>

        {/* Call metadata display */}
        {(call.queuedAt || call.answeredAt) && (
          <div className="pt-3 border-t space-y-1 text-sm text-muted-foreground">
            {call.queuedAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{t('queuedAt')}: {new Date(call.queuedAt).toLocaleTimeString()}</span>
              </div>
            )}
            {call.answeredAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{t('answeredAt')}: {new Date(call.answeredAt).toLocaleTimeString()}</span>
              </div>
            )}
            {call.queuedAt && call.answeredAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {t('waitTime')}: {Math.round((call.answeredAt - call.queuedAt) / 1000)}s
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CallNotesPanel;
