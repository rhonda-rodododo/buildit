/**
 * Checkbox Field Input Component
 */

import { UseFormRegister, FieldValues } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { CustomField } from '../../types';

interface CheckboxFieldInputProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  error?: string;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export function CheckboxFieldInput({ field, register, error, value, onChange }: CheckboxFieldInputProps) {
  const { widget } = field;

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id={field.name}
          checked={value as boolean}
          onCheckedChange={(checked) => onChange?.(checked)}
          disabled={widget.disabled}
        />
        <Label
          htmlFor={field.name}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {field.label}
        </Label>
      </div>
      <input type="hidden" {...register(field.name)} />
      {widget.helpText && <p className="text-sm text-muted-foreground">{widget.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
