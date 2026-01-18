/**
 * PollComposer Component
 * Create polls with multiple options, duration, and privacy settings
 */

import { FC, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  BarChart3,
  Clock,
  Eye,
  EyeOff,
  ListChecks,
  CircleDot,
} from 'lucide-react';
import { useSocialStore } from '../../socialStore';
import type { CreatePollInput, PollChoiceType } from '../../types';

interface PollComposerProps {
  onPollCreated?: () => void;
  onCancel?: () => void;
  className?: string;
}

const DURATION_OPTIONS = [
  { value: '60', label: '1 hour' },
  { value: '360', label: '6 hours' },
  { value: '720', label: '12 hours' },
  { value: '1440', label: '1 day' },
  { value: '2880', label: '2 days' },
  { value: '4320', label: '3 days' },
  { value: '10080', label: '1 week' },
];

export const PollComposer: FC<PollComposerProps> = ({
  onPollCreated,
  onCancel,
  className,
}) => {
  const { createPoll } = useSocialStore();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [choiceType, setChoiceType] = useState<PollChoiceType>('single');
  const [durationMinutes, setDurationMinutes] = useState('1440');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [showResultsBeforeEnd, setShowResultsBeforeEnd] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    // Validation
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    const filledOptions = options.filter((opt) => opt.trim());
    if (filledOptions.length < 2) {
      toast.error('Please add at least 2 options');
      return;
    }

    setIsSubmitting(true);

    try {
      const input: CreatePollInput = {
        question: question.trim(),
        options: filledOptions,
        choiceType,
        durationMinutes: parseInt(durationMinutes),
        isAnonymous,
        showResultsBeforeEnd,
      };

      await createPoll(input);
      toast.success('Poll created successfully');

      // Reset form
      setQuestion('');
      setOptions(['', '']);
      setChoiceType('single');
      setDurationMinutes('1440');
      setIsAnonymous(true);
      setShowResultsBeforeEnd(true);

      onPollCreated?.();
    } catch (error) {
      console.error('Failed to create poll:', error);
      toast.error('Failed to create poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Create Poll
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question */}
        <div className="space-y-2">
          <Label htmlFor="poll-question">Question</Label>
          <Input
            id="poll-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you want to ask?"
            disabled={isSubmitting}
            maxLength={280}
          />
          <p className="text-xs text-muted-foreground text-right">
            {question.length}/280
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <Label>Options</Label>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-6">
                {index + 1}.
              </span>
              <Input
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                disabled={isSubmitting}
                maxLength={100}
              />
              {options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveOption(index)}
                  disabled={isSubmitting}
                  aria-label={`Remove option ${index + 1}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              disabled={isSubmitting}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Option
            </Button>
          )}
        </div>

        {/* Poll Settings */}
        <div className="grid grid-cols-2 gap-4">
          {/* Choice Type */}
          <div className="space-y-2">
            <Label>Choice Type</Label>
            <Select
              value={choiceType}
              onValueChange={(value) => setChoiceType(value as PollChoiceType)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">
                  <div className="flex items-center gap-2">
                    <CircleDot className="w-4 h-4" />
                    Single Choice
                  </div>
                </SelectItem>
                <SelectItem value="multiple">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4" />
                    Multiple Choice
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select
              value={durationMinutes}
              onValueChange={setDurationMinutes}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="anonymous-votes" className="flex items-center gap-2">
                {isAnonymous ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                Anonymous Voting
              </Label>
              <p className="text-xs text-muted-foreground">
                {isAnonymous
                  ? 'Voters will remain anonymous'
                  : 'Voters will be visible to poll creator'}
              </p>
            </div>
            <Switch
              id="anonymous-votes"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-results" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Show Results Before End
              </Label>
              <p className="text-xs text-muted-foreground">
                {showResultsBeforeEnd
                  ? 'Results visible while voting is open'
                  : 'Results hidden until poll ends'}
              </p>
            </div>
            <Switch
              id="show-results"
              checked={showResultsBeforeEnd}
              onCheckedChange={setShowResultsBeforeEnd}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !question.trim() || options.filter((o) => o.trim()).length < 2}
          >
            {isSubmitting ? 'Creating...' : 'Create Poll'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
