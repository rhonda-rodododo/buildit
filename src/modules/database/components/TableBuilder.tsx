/**
 * Table Builder Component
 * Build and edit database tables with custom fields
 */

import { useState } from 'react';
import { nanoid } from 'nanoid';
import type { DatabaseTableTemplate } from '../types';
import type { CustomField, FieldType, FieldWidgetConfig, JSONSchemaField } from '@/modules/custom-fields/types';
import { FIELD_TYPE_DEFINITIONS } from '@/modules/custom-fields/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Edit, GripVertical, Save } from 'lucide-react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

interface TableBuilderProps {
  table?: DatabaseTableTemplate;
  onSave: (table: DatabaseTableTemplate) => void;
  onCancel: () => void;
}

export function TableBuilder({ table, onSave, onCancel }: TableBuilderProps) {
  const [name, setName] = useState(table?.name || '');
  const [description, setDescription] = useState(table?.description || '');
  const [fields, setFields] = useState<CustomField[]>(table?.fields || []);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

  const handleSaveTable = () => {
    if (!name.trim()) {
      alert('Please enter a table name');
      return;
    }

    if (fields.length === 0) {
      alert('Please add at least one field');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      fields,
    });
  };

  const handleAddField = () => {
    setEditingFieldIndex(null);
    setShowFieldEditor(true);
  };

  const handleEditField = (index: number) => {
    setEditingFieldIndex(index);
    setShowFieldEditor(true);
  };

  const handleDeleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSaveField = (field: CustomField) => {
    if (editingFieldIndex !== null) {
      const newFields = [...fields];
      newFields[editingFieldIndex] = field;
      setFields(newFields);
    } else {
      setFields([...fields, { ...field, order: fields.length }]);
    }
    setShowFieldEditor(false);
  };

  const handleReorderFields = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(fields);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);

    // Update order
    const reorderedFields = items.map((field, index) => ({ ...field, order: index }));
    setFields(reorderedFields);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{table ? 'Edit' : 'Create'} Table</DialogTitle>
        <DialogDescription>
          Define the structure and fields for this table
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Table Info */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="table-name">Table Name</Label>
            <Input
              id="table-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Contacts, Projects, Tasks"
            />
          </div>

          <div>
            <Label htmlFor="table-description">Description (optional)</Label>
            <Textarea
              id="table-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this table for?"
              rows={2}
            />
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Fields</Label>
            <Button onClick={handleAddField} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </div>

          {fields.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground text-sm">
                  No fields yet. Add your first field to define the table structure.
                </p>
              </CardContent>
            </Card>
          ) : (
            <DragDropContext onDragEnd={handleReorderFields}>
              <Droppable droppableId="fields">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {fields.map((field, index) => (
                      <Draggable key={field.id || field.name} draggableId={field.id || field.name} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-center gap-2 p-3 border rounded-lg bg-card"
                          >
                            <div {...provided.dragHandleProps}>
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{field.label}</div>
                              <div className="text-sm text-muted-foreground">
                                {field.name} • {FIELD_TYPE_DEFINITIONS[field.widget.widget]?.label}
                                {field.schema.required && ' • Required'}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditField(index)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteField(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSaveTable}>
          <Save className="h-4 w-4 mr-2" />
          Save Table
        </Button>
      </DialogFooter>

      {/* Field Editor Dialog */}
      {showFieldEditor && (
        <FieldEditor
          field={editingFieldIndex !== null ? fields[editingFieldIndex] : undefined}
          existingFieldNames={fields.map((f) => f.name)}
          onSave={handleSaveField}
          onCancel={() => setShowFieldEditor(false)}
        />
      )}
    </>
  );
}

/**
 * Field Editor Sub-Component
 */
interface FieldEditorProps {
  field?: CustomField;
  existingFieldNames: string[];
  onSave: (field: CustomField) => void;
  onCancel: () => void;
}

function FieldEditor({ field, existingFieldNames, onSave, onCancel }: FieldEditorProps) {
  const isEditing = !!field;

  const [name, setName] = useState(field?.name || '');
  const [label, setLabel] = useState(field?.label || '');
  const [fieldType, setFieldType] = useState<FieldType>(field?.widget.widget || 'text');
  const [required, setRequired] = useState(field?.schema.required || false);
  const [helpText, setHelpText] = useState(field?.widget.helpText || '');
  const [placeholder, setPlaceholder] = useState(field?.widget.placeholder || '');
  const [options, setOptions] = useState<Array<{ value: string | number; label: string }>>(
    field?.widget.options || []
  );

  const fieldDef = FIELD_TYPE_DEFINITIONS[fieldType];

  const generateFieldName = (labelText: string) => {
    return labelText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel);
    if (!isEditing && !name) {
      setName(generateFieldName(newLabel));
    }
  };

  const handleSave = () => {
    if (!label.trim()) {
      alert('Please enter a field label');
      return;
    }

    if (!name.trim()) {
      alert('Please enter a field name');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(name)) {
      alert('Field name can only contain lowercase letters, numbers, and underscores');
      return;
    }

    if (!isEditing && existingFieldNames.includes(name)) {
      alert('A field with this name already exists');
      return;
    }

    if (fieldDef.supportsOptions && options.length === 0) {
      alert('Please add at least one option');
      return;
    }

    // Build JSON schema
    const schema: JSONSchemaField = {
      type: fieldDef.jsonSchemaType === 'array' ? 'array' : fieldDef.jsonSchemaType === 'integer' || fieldDef.jsonSchemaType === 'number' ? 'number' : fieldDef.jsonSchemaType === 'boolean' ? 'boolean' : 'string',
      title: label,
      required,
    };

    if (fieldDef.supportsOptions) {
      schema.enum = options.map((o) => o.value);
      schema.enumLabels = options.map((o) => o.label);
    }

    // Build widget config
    const widget: FieldWidgetConfig = {
      widget: fieldType,
      placeholder,
      helpText,
    };

    if (fieldDef.supportsOptions) {
      widget.options = options;
    }

    const customField: CustomField = {
      id: field?.id || nanoid(),
      groupId: field?.groupId || '', // Will be set when template is instantiated
      entityType: 'database-record',
      name,
      label,
      schema,
      widget,
      order: field?.order || 0,
      created: field?.created || Date.now(),
      createdBy: field?.createdBy || '',
      updated: Date.now(),
    };

    onSave(customField);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Field</DialogTitle>
          <DialogDescription>
            Configure the field properties and validation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="field-label">Label *</Label>
            <Input
              id="field-label"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="e.g., Full Name, Email Address"
            />
          </div>

          <div>
            <Label htmlFor="field-name">Field Name * (used in code)</Label>
            <Input
              id="field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., full_name, email_address"
              disabled={isEditing}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lowercase letters, numbers, and underscores only
            </p>
          </div>

          <div>
            <Label htmlFor="field-type">Field Type *</Label>
            <Select
              value={fieldType}
              onValueChange={(val) => setFieldType(val as FieldType)}
              disabled={isEditing}
            >
              <SelectTrigger id="field-type">
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
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="field-required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="field-required">Required field</Label>
          </div>

          <div>
            <Label htmlFor="field-placeholder">Placeholder (optional)</Label>
            <Input
              id="field-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="Placeholder text"
            />
          </div>

          <div>
            <Label htmlFor="field-help">Help Text (optional)</Label>
            <Textarea
              id="field-help"
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              placeholder="Additional guidance for users"
              rows={2}
            />
          </div>

          {/* Options for select/multi-select/radio */}
          {fieldDef.supportsOptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions([...options, { value: '', label: '' }])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Option
                </Button>
              </div>
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Label"
                    value={option.label}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index].label = e.target.value;
                      newOptions[index].value = e.target.value.toLowerCase().replace(/\s+/g, '-');
                      setOptions(newOptions);
                    }}
                  />
                  <Input
                    placeholder="Value"
                    value={option.value}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index].value = e.target.value;
                      setOptions(newOptions);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOptions(options.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Field</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
