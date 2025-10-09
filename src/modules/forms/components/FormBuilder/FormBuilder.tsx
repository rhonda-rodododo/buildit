/**
 * Form Builder Component
 * Visual drag-and-drop form builder using JSON Schema
 */

import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { JSONSchema7 } from 'json-schema';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Save, Settings } from 'lucide-react';
import { FieldPalette } from './FieldPalette';
import { FormCanvas } from './FormCanvas';
import { FieldEditor } from './FieldEditor';
import { FormPreview } from './FormPreview';
// import { ConditionalLogicEditor } from './ConditionalLogicEditor';
import type { Form } from '../../types';

export interface FormFieldDefinition {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[]; // for select, radio, checkbox
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    format?: string; // email, url, date, etc.
  };
  conditional?: {
    fieldId: string;
    operator: 'equals' | 'notEquals' | 'contains';
    value: string | number | boolean;
  };
  page?: number; // for multi-page forms
}

interface FormBuilderProps {
  form?: Form;
  onSave: (formData: {
    title: string;
    description?: string;
    schema: JSONSchema7;
    uiSchema?: Record<string, unknown>;
    fields: FormFieldDefinition[];
  }) => void;
  onCancel: () => void;
}

export function FormBuilder({ form, onSave, onCancel }: FormBuilderProps) {
  const [formTitle, setFormTitle] = useState(form?.title || '');
  const [formDescription, setFormDescription] = useState(form?.description || '');
  const [fields, setFields] = useState<FormFieldDefinition[]>([]);
  const [selectedField, setSelectedField] = useState<FormFieldDefinition | null>(null);
  const [activeTab, setActiveTab] = useState<'build' | 'preview' | 'settings'>('build');
  const [multiPage, setMultiPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [draggedField, setDraggedField] = useState<FormFieldDefinition | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const field = active.data.current as FormFieldDefinition;
    setDraggedField(field);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedField(null);

    if (!over) return;

    // If dropping from palette, create new field
    if (active.data.current?.fromPalette) {
      const fieldType = active.data.current.type as string;
      const newField: FormFieldDefinition = {
        id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: fieldType,
        label: `${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} Field`,
        required: false,
        page: multiPage ? currentPage : undefined,
      };

      // Add type-specific defaults
      if (fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox') {
        newField.options = ['Option 1', 'Option 2', 'Option 3'];
      }

      setFields([...fields, newField]);
      setSelectedField(newField);
    }
    // If reordering existing fields
    else if (over.data.current?.index !== undefined) {
      const activeIndex = fields.findIndex(f => f.id === active.id);
      const overIndex = over.data.current.index as number;

      if (activeIndex !== -1 && activeIndex !== overIndex) {
        const newFields = [...fields];
        const [removed] = newFields.splice(activeIndex, 1);
        newFields.splice(overIndex, 0, removed);
        setFields(newFields);
      }
    }
  };

  const handleFieldUpdate = (updatedField: FormFieldDefinition) => {
    setFields(fields.map(f => f.id === updatedField.id ? updatedField : f));
    setSelectedField(updatedField);
  };

  const handleFieldDelete = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  };

  const convertToJSONSchema = (): { schema: JSONSchema7; uiSchema: Record<string, unknown> } => {
    const properties: Record<string, JSONSchema7> = {};
    const required: string[] = [];
    const uiSchema: Record<string, unknown> = {};

    fields.forEach(field => {
      const prop: JSONSchema7 = {
        title: field.label,
        description: field.helpText,
      };

      // Set type and format based on field type
      switch (field.type) {
        case 'text':
        case 'textarea':
          prop.type = 'string';
          if (field.validation?.minLength) prop.minLength = field.validation.minLength;
          if (field.validation?.maxLength) prop.maxLength = field.validation.maxLength;
          if (field.validation?.pattern) prop.pattern = field.validation.pattern;
          break;
        case 'email':
          prop.type = 'string';
          prop.format = 'email';
          break;
        case 'url':
          prop.type = 'string';
          prop.format = 'uri';
          break;
        case 'phone':
          prop.type = 'string';
          prop.pattern = '^[0-9]{10,15}$';
          break;
        case 'number':
          prop.type = 'number';
          if (field.validation?.min !== undefined) prop.minimum = field.validation.min;
          if (field.validation?.max !== undefined) prop.maximum = field.validation.max;
          break;
        case 'date':
          prop.type = 'string';
          prop.format = 'date';
          break;
        case 'checkbox':
          prop.type = 'boolean';
          break;
        case 'select':
        case 'radio':
          prop.type = 'string';
          if (field.options) prop.enum = field.options;
          break;
        case 'file':
          prop.type = 'string';
          prop.format = 'data-url';
          break;
      }

      properties[field.id] = prop;

      if (field.required) {
        required.push(field.id);
      }

      // UI Schema for rendering hints
      uiSchema[field.id] = {
        'ui:placeholder': field.placeholder,
        'ui:widget': field.type === 'textarea' ? 'textarea' : field.type,
      };
    });

    const schema: JSONSchema7 = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };

    return { schema, uiSchema };
  };

  const handleSave = () => {
    const { schema, uiSchema } = convertToJSONSchema();
    onSave({
      title: formTitle,
      description: formDescription,
      schema,
      uiSchema,
      fields,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1 flex-1 mr-4">
            <Input
              placeholder="Form Title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="text-xl font-semibold border-none px-0 focus-visible:ring-0"
            />
            <Input
              placeholder="Form description (optional)"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="text-sm text-muted-foreground border-none px-0 focus-visible:ring-0"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formTitle || fields.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              Save Form
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="build" className="flex-1 flex mt-0 p-4 gap-4">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* Field Palette */}
            <div className="w-64 flex-shrink-0">
              <FieldPalette />
            </div>

            {/* Form Canvas */}
            <div className="flex-1 overflow-auto">
              <FormCanvas
                fields={fields}
                selectedFieldId={selectedField?.id}
                onFieldSelect={setSelectedField}
                onFieldDelete={handleFieldDelete}
              />
            </div>

            {/* Field Editor */}
            <div className="w-80 flex-shrink-0">
              {selectedField ? (
                <FieldEditor
                  field={selectedField}
                  onUpdate={handleFieldUpdate}
                  onDelete={() => handleFieldDelete(selectedField.id)}
                />
              ) : (
                <Card className="p-6 text-center text-muted-foreground">
                  <p>Select a field to edit its properties</p>
                </Card>
              )}
            </div>

            <DragOverlay>
              {draggedField ? (
                <Card className="p-3 bg-background border-primary shadow-lg">
                  <div className="font-medium">{draggedField.label}</div>
                  <div className="text-xs text-muted-foreground">{draggedField.type}</div>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="preview" className="flex-1 mt-0 p-4">
          <FormPreview
            schema={convertToJSONSchema().schema}
            uiSchema={convertToJSONSchema().uiSchema}
          />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 mt-0 p-4">
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Multi-Page Form</Label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={multiPage}
                  onChange={(e) => setMultiPage(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Enable multi-page form</span>
              </div>
            </div>

            {multiPage && (
              <div className="space-y-2">
                <Label>Current Page</Label>
                <Input
                  type="number"
                  min={1}
                  value={currentPage}
                  onChange={(e) => setCurrentPage(parseInt(e.target.value) || 1)}
                />
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
