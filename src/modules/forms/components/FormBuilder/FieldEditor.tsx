/**
 * Field Editor Component
 * Edit properties of a form field
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, X } from 'lucide-react';
import type { FormFieldDefinition } from './FormBuilder';

interface FieldEditorProps {
  field: FormFieldDefinition;
  onUpdate: (field: FormFieldDefinition) => void;
  onDelete: () => void;
}

export function FieldEditor({ field, onUpdate, onDelete }: FieldEditorProps) {
  const [localField, setLocalField] = useState(field);

  const handleChange = (updates: Partial<FormFieldDefinition>) => {
    const updated = { ...localField, ...updates };
    setLocalField(updated);
    onUpdate(updated);
  };

  const hasOptions = ['select', 'radio'].includes(field.type);
  const hasValidation = ['text', 'textarea', 'number', 'email', 'url', 'phone'].includes(field.type);

  return (
    <Card className="p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Field Properties</h3>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Basic Properties */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={localField.label}
            onChange={(e) => handleChange({ label: e.target.value })}
            placeholder="Field label"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="placeholder">Placeholder</Label>
          <Input
            id="placeholder"
            value={localField.placeholder || ''}
            onChange={(e) => handleChange({ placeholder: e.target.value })}
            placeholder="Placeholder text"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="helpText">Help Text</Label>
          <Textarea
            id="helpText"
            value={localField.helpText || ''}
            onChange={(e) => handleChange({ helpText: e.target.value })}
            placeholder="Additional guidance for users"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="required">Required</Label>
          <Switch
            id="required"
            checked={localField.required || false}
            onCheckedChange={(checked) => handleChange({ required: checked })}
          />
        </div>
      </div>

      {/* Options (for select, radio, checkbox) */}
      {hasOptions && (
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-2">
            {(localField.options || []).map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(localField.options || [])];
                    newOptions[index] = e.target.value;
                    handleChange({ options: newOptions });
                  }}
                  placeholder={`Option ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newOptions = (localField.options || []).filter((_, i) => i !== index);
                    handleChange({ options: newOptions });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newOptions = [...(localField.options || []), `Option ${(localField.options?.length || 0) + 1}`];
                handleChange({ options: newOptions });
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Option
            </Button>
          </div>
        </div>
      )}

      {/* Validation */}
      {hasValidation && (
        <div className="space-y-3 pt-3 border-t">
          <div className="font-medium text-sm">Validation</div>

          {(field.type === 'text' || field.type === 'textarea') && (
            <>
              <div className="space-y-1">
                <Label htmlFor="minLength">Min Length</Label>
                <Input
                  id="minLength"
                  type="number"
                  value={localField.validation?.minLength || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                    handleChange({
                      validation: { ...localField.validation, minLength: val },
                    });
                  }}
                  placeholder="Minimum character count"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxLength">Max Length</Label>
                <Input
                  id="maxLength"
                  type="number"
                  value={localField.validation?.maxLength || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                    handleChange({
                      validation: { ...localField.validation, maxLength: val },
                    });
                  }}
                  placeholder="Maximum character count"
                />
              </div>
            </>
          )}

          {field.type === 'number' && (
            <>
              <div className="space-y-1">
                <Label htmlFor="min">Minimum Value</Label>
                <Input
                  id="min"
                  type="number"
                  value={localField.validation?.min || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : undefined;
                    handleChange({
                      validation: { ...localField.validation, min: val },
                    });
                  }}
                  placeholder="Minimum value"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="max">Maximum Value</Label>
                <Input
                  id="max"
                  type="number"
                  value={localField.validation?.max || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : undefined;
                    handleChange({
                      validation: { ...localField.validation, max: val },
                    });
                  }}
                  placeholder="Maximum value"
                />
              </div>
            </>
          )}

          {(field.type === 'text' || field.type === 'url' || field.type === 'email') && (
            <div className="space-y-1">
              <Label htmlFor="pattern">Pattern (Regex)</Label>
              <Input
                id="pattern"
                value={localField.validation?.pattern || ''}
                onChange={(e) => {
                  handleChange({
                    validation: { ...localField.validation, pattern: e.target.value },
                  });
                }}
                placeholder="^[A-Za-z]+$"
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
