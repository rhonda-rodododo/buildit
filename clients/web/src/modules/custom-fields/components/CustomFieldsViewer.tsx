/**
 * CustomFieldsViewer Component
 * Generic component for displaying custom field values
 */

import { useMemo } from 'react';
import type { CustomField, CustomFieldValues } from '../types';

interface CustomFieldsViewerProps {
  fields: CustomField[];
  values: CustomFieldValues;
  className?: string;
}

export function CustomFieldsViewer({ fields, values, className = '' }: CustomFieldsViewerProps) {
  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => a.order - b.order);
  }, [fields]);

  const renderValue = (field: CustomField) => {
    const value = values[field.name];

    if (value === undefined || value === null) {
      return <span className="text-muted-foreground italic">Not set</span>;
    }

    switch (field.widget.widget) {
      case 'text':
      case 'textarea':
      case 'number':
      case 'date':
      case 'datetime':
        return <span>{String(value)}</span>;

      case 'select':
      case 'radio': {
        const option = field.widget.options?.find(opt => opt.value === value);
        return <span>{option?.label || String(value)}</span>;
      }

      case 'multi-select': {
        const selectedValues = (value as string[]) || [];
        const labels = selectedValues
          .map(val => field.widget.options?.find(opt => opt.value === val)?.label || val)
          .join(', ');
        return <span>{labels || 'None selected'}</span>;
      }

      case 'checkbox':
        return (
          <span className={value ? 'text-green-600' : 'text-gray-500'}>
            {value ? '✓ Yes' : '✗ No'}
          </span>
        );

      case 'file':
        return <span className="text-blue-600 underline">{String(value)}</span>;

      case 'relationship':
        return <span className="text-blue-600">{String(value)}</span>;

      default:
        return <span>{JSON.stringify(value)}</span>;
    }
  };

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Additional Information
      </h4>
      <dl className="grid grid-cols-1 gap-3">
        {sortedFields.map((field) => (
          <div key={field.id} className="border-b border-border pb-2 last:border-b-0">
            <dt className="text-sm font-medium text-foreground mb-1">
              {field.label}
              {field.widget.helpText && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({field.widget.helpText})
                </span>
              )}
            </dt>
            <dd className="text-sm text-muted-foreground">{renderValue(field)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
