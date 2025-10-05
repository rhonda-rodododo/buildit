/**
 * FieldRenderer Component
 * Renders a custom field based on its type and configuration
 */

import { useMemo } from 'react';
import { UseFormRegister, FieldValues, FieldErrors } from 'react-hook-form';
import type { CustomField } from '../types';
import { TextFieldInput } from './inputs/TextFieldInput';
import { NumberFieldInput } from './inputs/NumberFieldInput';
import { DateFieldInput } from './inputs/DateFieldInput';
import { SelectFieldInput } from './inputs/SelectFieldInput';
import { MultiSelectFieldInput } from './inputs/MultiSelectFieldInput';
import { CheckboxFieldInput } from './inputs/CheckboxFieldInput';
import { RadioFieldInput } from './inputs/RadioFieldInput';
import { FileFieldInput } from './inputs/FileFieldInput';
import { RelationshipFieldInput } from './inputs/RelationshipFieldInput';

interface FieldRendererProps {
  field: CustomField;
  register: UseFormRegister<FieldValues>;
  errors: FieldErrors<FieldValues>;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export function FieldRenderer({ field, register, errors, value, onChange }: FieldRendererProps) {
  const error = errors[field.name];
  const errorMessage = error?.message as string | undefined;

  const commonProps = {
    field,
    register,
    error: errorMessage,
    value,
    onChange,
  };

  const inputComponent = useMemo(() => {
    switch (field.widget.widget) {
      case 'text':
        return <TextFieldInput {...commonProps} />;
      case 'textarea':
        return <TextFieldInput {...commonProps} multiline />;
      case 'number':
        return <NumberFieldInput {...commonProps} />;
      case 'date':
        return <DateFieldInput {...commonProps} />;
      case 'datetime':
        return <DateFieldInput {...commonProps} withTime />;
      case 'select':
        return <SelectFieldInput {...commonProps} />;
      case 'multi-select':
        return <MultiSelectFieldInput {...commonProps} />;
      case 'checkbox':
        return <CheckboxFieldInput {...commonProps} />;
      case 'radio':
        return <RadioFieldInput {...commonProps} />;
      case 'file':
        return <FileFieldInput {...commonProps} />;
      case 'relationship':
        return <RelationshipFieldInput {...commonProps} />;
      default:
        return <div className="text-sm text-muted-foreground">Unknown field type: {field.widget.widget}</div>;
    }
  }, [field.widget.widget, commonProps]);

  return (
    <div className={field.widget.className || ''} style={{ gridColumn: field.widget.gridColumn }}>
      {inputComponent}
    </div>
  );
}
