/**
 * Editable Cell Component
 * Inline cell editing using custom field widgets
 */

import React, { useState, useEffect, useRef } from 'react';
import type { CustomField } from '@/modules/custom-fields/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditableCellProps {
  field: CustomField;
  value: unknown;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

export function EditableCell({
  field,
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    onSave(editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(value);
      onCancel();
    }
  };

  // Display mode
  if (!isEditing) {
    return (
      <div
        className="px-2 py-1.5 min-h-[2.5rem] flex items-center cursor-text hover:bg-muted/50 rounded"
        onClick={onEdit}
      >
        {formatFieldValue(value, field)}
      </div>
    );
  }

  // Edit mode - render appropriate input widget
  const renderEditWidget = () => {
    switch (field.widget.widget) {
      case 'text':
        return (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={String(editValue ?? '')}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="h-8"
              placeholder={field.widget.placeholder}
            />
          </div>
        );

      case 'textarea':
        return (
          <div className="flex flex-col gap-1">
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={String(editValue ?? '')}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[80px]"
              placeholder={field.widget.placeholder}
            />
            <div className="flex gap-1">
              <Button size="sm" variant="default" onClick={handleSave}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              value={editValue !== null && editValue !== undefined ? Number(editValue) : ''}
              onChange={(e) => setEditValue(e.target.value ? parseFloat(e.target.value) : null)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="h-8"
              placeholder={field.widget.placeholder}
              min={field.schema.minimum}
              max={field.schema.maximum}
              step={field.schema.multipleOf}
            />
          </div>
        );

      case 'date':
      case 'datetime':
        return (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={field.widget.widget === 'datetime' ? 'datetime-local' : 'date'}
              value={
                editValue
                  ? field.widget.widget === 'datetime'
                    ? new Date(editValue as string).toISOString().slice(0, 16)
                    : new Date(editValue as string).toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) => setEditValue(e.target.value ? new Date(e.target.value).toISOString() : null)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="h-8"
            />
          </div>
        );

      case 'select':
        return (
          <Select
            value={String(editValue ?? '')}
            onValueChange={(val) => {
              setEditValue(val);
              setTimeout(() => onSave(val), 0);
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder={field.widget.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.widget.options?.map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi-select': {
        const multiValues = Array.isArray(editValue) ? editValue : [];
        return (
          <div className="flex flex-col gap-1 p-2">
            {field.widget.options?.map((option) => (
              <label key={String(option.value)} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={multiValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...multiValues, option.value]
                      : multiValues.filter((v) => v !== option.value);
                    setEditValue(newValues);
                  }}
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
            <div className="flex gap-1 mt-2">
              <Button size="sm" variant="default" onClick={handleSave}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      }

      case 'checkbox':
        return (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={Boolean(editValue)}
              onCheckedChange={(checked) => {
                setEditValue(checked);
                setTimeout(() => onSave(checked), 0);
              }}
            />
          </div>
        );

      case 'radio':
        return (
          <div className="flex flex-col gap-1 p-2">
            {field.widget.options?.map((option) => (
              <label key={String(option.value)} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.name}
                  value={String(option.value)}
                  checked={editValue === option.value}
                  onChange={() => {
                    setEditValue(option.value);
                    setTimeout(() => onSave(option.value), 0);
                  }}
                  className="h-4 w-4"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <div className="px-2 py-1 text-muted-foreground text-sm">
            Inline editing not supported for {field.widget.widget}
          </div>
        );
    }
  };

  return <div className="w-full">{renderEditWidget()}</div>;
}

/**
 * Format field value for display
 */
function formatFieldValue(value: unknown, field: CustomField): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground italic">Empty</span>;
  }

  switch (field.widget.widget) {
    case 'date':
      return new Date(value as string).toLocaleDateString();
    case 'datetime':
      return new Date(value as string).toLocaleString();
    case 'multi-select':
      return Array.isArray(value) && value.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-primary/10 rounded text-xs">
              {field.widget.options?.find((opt) => opt.value === v)?.label ?? String(v)}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground italic">Empty</span>
      );
    case 'checkbox':
      return value ? <Check className="h-4 w-4" /> : <X className="h-4 w-4 text-muted-foreground" />;
    case 'select':
    case 'radio':
      return field.widget.options?.find((opt) => opt.value === value)?.label ?? String(value);
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    default:
      return String(value);
  }
}
