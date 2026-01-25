/**
 * Text Field Input Component
 */

import { UseFormRegister, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { CustomField } from '../../types';

interface TextFieldInputProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  error?: string;
  multiline?: boolean;
}

export function TextFieldInput({ field, register, error, multiline = false }: TextFieldInputProps) {
  const { schema, widget } = field;
  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.label}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <InputComponent
        id={field.name}
        placeholder={widget.placeholder}
        disabled={widget.disabled}
        {...register(field.name)}
        className={error ? 'border-destructive' : ''}
      />
      {widget.helpText && <p className="text-sm text-muted-foreground">{widget.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
