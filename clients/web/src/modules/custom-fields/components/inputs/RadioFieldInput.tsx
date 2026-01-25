/**
 * Radio Field Input Component
 */

import { UseFormRegister, FieldValues } from 'react-hook-form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { CustomField } from '../../types';

interface RadioFieldInputProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  error?: string;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export function RadioFieldInput({ field, register, error, value, onChange }: RadioFieldInputProps) {
  const { schema, widget } = field;
  const options = widget.options || [];

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <RadioGroup
        value={value as string}
        onValueChange={(val) => onChange?.(val)}
        disabled={widget.disabled}
      >
        {options.map((option) => (
          <div key={String(option.value)} className="flex items-center space-x-2">
            <RadioGroupItem value={String(option.value)} id={`${field.name}-${option.value}`} />
            <Label htmlFor={`${field.name}-${option.value}`}>{option.label}</Label>
          </div>
        ))}
      </RadioGroup>
      <input type="hidden" {...register(field.name)} />
      {widget.helpText && <p className="text-sm text-muted-foreground">{widget.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
