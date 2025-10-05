/**
 * FieldEditor Component
 * Create and edit custom field definitions
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FIELD_TYPE_DEFINITIONS, type CustomField, type FieldType, type EntityType } from '../types';
import { CustomFieldsManager } from '../customFieldsManager';
import { useAuthStore } from '@/stores/authStore';

interface FieldEditorProps {
  groupId: string;
  entityType: EntityType;
  field?: CustomField;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const fieldFormSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/, 'Field name must be lowercase alphanumeric with underscores'),
  label: z.string().min(1, 'Label is required').max(100),
  widget: z.enum(['text', 'textarea', 'number', 'date', 'datetime', 'select', 'multi-select', 'checkbox', 'radio', 'file', 'relationship']),
  required: z.boolean(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.string().optional(), // JSON string of options
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
});

type FieldFormData = z.infer<typeof fieldFormSchema>;

export function FieldEditor({ groupId, entityType, field, open, onOpenChange, onSave }: FieldEditorProps) {
  const { currentIdentity } = useAuthStore();
  const [selectedWidget, setSelectedWidget] = useState<FieldType>(field?.widget.widget || 'text');
  const isEditing = !!field;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FieldFormData>({
    resolver: zodResolver(fieldFormSchema),
    defaultValues: field
      ? {
          name: field.name,
          label: field.label,
          widget: field.widget.widget,
          required: field.schema.required || false,
          placeholder: field.widget.placeholder,
          helpText: field.widget.helpText,
          options: field.widget.options ? JSON.stringify(field.widget.options) : '',
          minimum: field.schema.minimum,
          maximum: field.schema.maximum,
          minLength: field.schema.minLength,
          maxLength: field.schema.maxLength,
          pattern: field.schema.pattern,
        }
      : undefined,
  });

  const onSubmit = async (data: FieldFormData) => {
    if (!currentIdentity) return;

    const fieldTypeDef = FIELD_TYPE_DEFINITIONS[data.widget];

    // Parse options if present
    let options: Array<{ value: string | number; label: string }> | undefined;
    if (data.options) {
      try {
        options = JSON.parse(data.options);
      } catch (e) {
        console.error('Invalid options JSON:', e);
        return;
      }
    }

    const fieldData: Omit<CustomField, 'id' | 'groupId' | 'entityType' | 'created' | 'updated'> = {
      name: data.name,
      label: data.label,
      createdBy: currentIdentity.publicKey,
      schema: {
        type: fieldTypeDef.jsonSchemaType,
        required: data.required,
        minLength: data.minLength,
        maxLength: data.maxLength,
        pattern: data.pattern,
        minimum: data.minimum,
        maximum: data.maximum,
      },
      widget: {
        widget: data.widget,
        placeholder: data.placeholder,
        helpText: data.helpText,
        options,
      },
      order: field?.order || 0,
    };

    if (isEditing && field) {
      await CustomFieldsManager.updateField({
        ...field,
        ...fieldData,
      });
    } else {
      await CustomFieldsManager.createField(groupId, entityType, fieldData, currentIdentity.publicKey);
    }

    reset();
    onSave();
    onOpenChange(false);
  };

  const widgetDef = FIELD_TYPE_DEFINITIONS[selectedWidget];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Field' : 'Create Custom Field'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Field Name</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g., dietary_preferences"
              disabled={isEditing}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input id="label" {...register('label')} placeholder="e.g., Dietary Preferences" />
            {errors.label && <p className="text-sm text-destructive">{errors.label.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="widget">Field Type</Label>
            <Select
              value={selectedWidget}
              onValueChange={(value) => setSelectedWidget(value as FieldType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(FIELD_TYPE_DEFINITIONS).map((def) => (
                  <SelectItem key={def.widget} value={def.widget}>
                    {def.label} - {def.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('widget')} value={selectedWidget} />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="required" {...register('required')} />
            <Label htmlFor="required">Required field</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="placeholder">Placeholder</Label>
            <Input id="placeholder" {...register('placeholder')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="helpText">Help Text</Label>
            <Input id="helpText" {...register('helpText')} />
          </div>

          {widgetDef.supportsOptions && (
            <div className="space-y-2">
              <Label htmlFor="options">Options (JSON)</Label>
              <Input
                id="options"
                {...register('options')}
                placeholder='[{"value": "vegan", "label": "Vegan"}, {"value": "vegetarian", "label": "Vegetarian"}]'
              />
              {errors.options && <p className="text-sm text-destructive">{errors.options.message}</p>}
            </div>
          )}

          {widgetDef.jsonSchemaType === 'string' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minLength">Min Length</Label>
                  <Input
                    id="minLength"
                    type="number"
                    {...register('minLength', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLength">Max Length</Label>
                  <Input
                    id="maxLength"
                    type="number"
                    {...register('maxLength', { valueAsNumber: true })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pattern">Pattern (regex)</Label>
                <Input id="pattern" {...register('pattern')} />
              </div>
            </>
          )}

          {widgetDef.jsonSchemaType === 'number' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minimum">Minimum</Label>
                <Input id="minimum" type="number" {...register('minimum', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maximum">Maximum</Label>
                <Input id="maximum" type="number" {...register('maximum', { valueAsNumber: true })} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
