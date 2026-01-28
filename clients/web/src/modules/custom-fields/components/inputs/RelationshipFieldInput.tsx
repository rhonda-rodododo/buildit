/**
 * Relationship Field Input Component
 * Links to another entity type
 */

import { UseFormRegister, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomField } from '../../types';

interface RelationshipFieldInputProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  error?: string;
}

export function RelationshipFieldInput({ field, register, error }: RelationshipFieldInputProps) {
  const { t } = useTranslation('custom-fields');
  const { schema, widget } = field;
  const relationshipLabel = widget.relationshipLabel || 'Select a related item';

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.label}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={field.name}
        placeholder={relationshipLabel}
        disabled={widget.disabled}
        {...register(field.name)}
        className={error ? 'border-destructive' : ''}
      />
      <p className="text-xs text-muted-foreground">{t('relationshipTo', { type: widget.relationshipType })}</p>
      {widget.helpText && <p className="text-sm text-muted-foreground">{widget.helpText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
