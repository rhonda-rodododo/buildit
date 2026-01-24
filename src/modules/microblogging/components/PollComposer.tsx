/**
 * Poll Composer Component
 * Epic 61: Create polls with multiple options and duration settings
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, BarChart2, Clock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useSocialFeaturesStore } from '../socialFeaturesStore';
import type { PollType, PostVisibility } from '../types';

interface PollComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibility: PostVisibility;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 6, label: '6 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '1 day' },
  { value: 72, label: '3 days' },
  { value: 168, label: '1 week' },
];

export function PollComposer({ open, onOpenChange, visibility, onSuccess }: PollComposerProps) {
  const { t } = useTranslation();
  const createPoll = useSocialFeaturesStore((s) => s.createPoll);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [pollType, setPollType] = useState<PollType>('single');
  const [durationHours, setDurationHours] = useState(24);
  const [hideResultsUntilEnded, setHideResultsUntilEnded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const isValid = () => {
    return (
      question.trim().length > 0 &&
      options.filter((o) => o.trim().length > 0).length >= 2
    );
  };

  const handleSubmit = async () => {
    if (!isValid() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createPoll({
        question: question.trim(),
        options: options.filter((o) => o.trim().length > 0),
        pollType,
        durationHours,
        hideResultsUntilEnded,
        visibility,
      });

      // Reset form
      setQuestion('');
      setOptions(['', '']);
      setPollType('single');
      setDurationHours(24);
      setHideResultsUntilEnded(false);

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create poll:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setQuestion('');
    setOptions(['', '']);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5" />
            {t('polls.create', 'Create Poll')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question */}
          <div className="space-y-2">
            <Label htmlFor="poll-question">{t('polls.question', 'Question')}</Label>
            <Textarea
              id="poll-question"
              placeholder={t('polls.questionPlaceholder', 'Ask a question...')}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[80px] resize-none"
              maxLength={280}
            />
            <p className="text-xs text-muted-foreground text-right">
              {question.length}/280
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label>{t('polls.options', 'Options')}</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={t('polls.optionPlaceholder', 'Option {{n}}', { n: index + 1 })}
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(index)}
                      aria-label={t('polls.removeOption', 'Remove option')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <Button variant="outline" size="sm" onClick={addOption} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {t('polls.addOption', 'Add Option')}
              </Button>
            )}
          </div>

          {/* Poll Type */}
          <div className="space-y-2">
            <Label>{t('polls.type', 'Poll Type')}</Label>
            <Select value={pollType} onValueChange={(v) => setPollType(v as PollType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">
                  {t('polls.singleChoice', 'Single choice')}
                </SelectItem>
                <SelectItem value="multiple">
                  {t('polls.multipleChoice', 'Multiple choice')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('polls.duration', 'Duration')}
            </Label>
            <Select
              value={durationHours.toString()}
              onValueChange={(v) => setDurationHours(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hide results */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hideResultsUntilEnded ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              <Label htmlFor="hide-results" className="font-normal">
                {t('polls.hideResults', 'Hide results until poll ends')}
              </Label>
            </div>
            <Switch
              id="hide-results"
              checked={hideResultsUntilEnded}
              onCheckedChange={setHideResultsUntilEnded}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid() || isSubmitting}>
            {isSubmitting
              ? t('common.creating', 'Creating...')
              : t('polls.createPoll', 'Create Poll')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
