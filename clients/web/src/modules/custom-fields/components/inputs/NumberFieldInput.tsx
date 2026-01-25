/**
 * Number Field Input Component
 */

import { UseFormRegister, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomField } from '../../types';

interface NumberFieldInputProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  error?: string;
}

export function NumberFieldInput({ field, register, error }: NumberFieldInputProps) {
  const { schema, widget } = field;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.label}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={field.name}
        type="number"
        placeholder={widget.placeholder}
        disabled={widget.disabled}
        min={schema.minimum}
        max={schema.maximum}
        step={schema.multipleOf}
        {...register(field.name, { valueAsNumber: true })}
        className={error ? 'border-destructive' : ''}
      />
      {widget.helpText && <p className="text-sm text-muted-foreground">{widget.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
