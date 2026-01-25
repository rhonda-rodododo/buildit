/**
 * Select Field Input Component
 */

import { UseFormRegister, FieldValues } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { CustomField } from '../../types';

interface SelectFieldInputProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  error?: string;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export function SelectFieldInput({ field, register, error, value, onChange }: SelectFieldInputProps) {
  const { schema, widget } = field;
  const options = widget.options || [];

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.label}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select
        disabled={widget.disabled}
        value={value as string}
        onValueChange={(val) => onChange?.(val)}
      >
        <SelectTrigger className={error ? 'border-destructive' : ''}>
          <SelectValue placeholder={widget.placeholder || 'Select an option'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" {...register(field.name)} />
      {widget.helpText && <p className="text-sm text-muted-foreground">{widget.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
