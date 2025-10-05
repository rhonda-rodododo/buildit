/**
 * Multi-Select Field Input Component
 */

import { UseFormRegister, FieldValues } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { CustomField } from '../../types';

interface MultiSelectFieldInputProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  error?: string;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export function MultiSelectFieldInput({ field, register, error, value, onChange }: MultiSelectFieldInputProps) {
  const { schema, widget } = field;
  const options = widget.options || [];
  const selectedValues = (value as string[]) || [];

  const handleToggle = (optionValue: string | number) => {
    const valueStr = String(optionValue);
    const newValues = selectedValues.includes(valueStr)
      ? selectedValues.filter((v) => v !== valueStr)
      : [...selectedValues, valueStr];
    onChange?.(newValues);
  };

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="space-y-2">
        {options.map((option) => (
          <div key={String(option.value)} className="flex items-center space-x-2">
            <Checkbox
              id={`${field.name}-${option.value}`}
              checked={selectedValues.includes(String(option.value))}
              onCheckedChange={() => handleToggle(option.value)}
              disabled={widget.disabled}
            />
            <label
              htmlFor={`${field.name}-${option.value}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {option.label}
            </label>
          </div>
        ))}
      </div>
      <input type="hidden" {...register(field.name)} />
      {widget.helpText && <p className="text-sm text-muted-foreground">{widget.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
