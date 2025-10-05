/**
 * File Field Input Component
 */

import { UseFormRegister, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomField } from '../../types';

interface FileFieldInputProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  error?: string;
}

export function FileFieldInput({ field, register, error }: FileFieldInputProps) {
  const { schema, widget } = field;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.label}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={field.name}
        type="file"
        accept={widget.accept}
        multiple={widget.multiple}
        disabled={widget.disabled}
        {...register(field.name)}
        className={error ? 'border-destructive' : ''}
      />
      {widget.helpText && <p className="text-sm text-muted-foreground">{widget.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
