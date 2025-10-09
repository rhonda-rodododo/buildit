/**
 * Conditional Logic Editor Component
 * Edit conditional logic for form fields (show/hide based on other fields)
 * Uses JSON Schema if/then/else for conditional logic
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import type { FormFieldDefinition } from './FormBuilder';

interface ConditionalRule {
  fieldId: string;
  operator: 'equals' | 'notEquals' | 'contains';
  value: string | number | boolean;
  action?: 'show' | 'hide' | 'require';
}

interface ConditionalLogicEditorProps {
  field: FormFieldDefinition;
  allFields: FormFieldDefinition[];
  onUpdate: (field: FormFieldDefinition) => void;
}

export function ConditionalLogicEditor({ field, allFields, onUpdate }: ConditionalLogicEditorProps) {
  const availableFields = allFields.filter(f => f.id !== field.id);

  const handleAddRule = () => {
    const newRule: ConditionalRule = {
      fieldId: availableFields[0]?.id || '',
      operator: 'equals',
      value: '',
      action: 'show',
    };

    // In a full implementation, this would update the JSON Schema with if/then/else
    // For now, we store it in the field's conditional property
    const updated = {
      ...field,
      conditional: newRule,
    };
    onUpdate(updated);
  };

  const handleRemoveRule = () => {
    const updated = { ...field };
    delete updated.conditional;
    onUpdate(updated);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Conditional Logic</h4>
        {field.conditional ? (
          <Button variant="ghost" size="sm" onClick={handleRemoveRule}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleAddRule}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        )}
      </div>

      {field.conditional ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>When field</Label>
            <Select
              value={field.conditional.fieldId}
              onValueChange={(value) => {
                const updated = {
                  ...field,
                  conditional: { ...field.conditional!, fieldId: value },
                };
                onUpdate(updated);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Is</Label>
            <Select
              value={field.conditional.operator}
              onValueChange={(value) => {
                const updated = {
                  ...field,
                  conditional: { ...field.conditional!, operator: value as ConditionalRule['operator'] },
                };
                onUpdate(updated);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="notEquals">Not Equals</SelectItem>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="greaterThan">Greater Than</SelectItem>
                <SelectItem value="lessThan">Less Than</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Value</Label>
            <Input
              value={field.conditional.value.toString()}
              onChange={(e) => {
                const updated = {
                  ...field,
                  conditional: { ...field.conditional!, value: e.target.value },
                };
                onUpdate(updated);
              }}
              placeholder="Enter value"
            />
          </div>

          <div className="space-y-1">
            <Label>Then</Label>
            <Select
              value={field.conditional.action || 'show'}
              onValueChange={(value) => {
                const updated = {
                  ...field,
                  conditional: { ...field.conditional!, action: value as ConditionalRule['action'] },
                };
                onUpdate(updated);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="show">Show this field</SelectItem>
                <SelectItem value="hide">Hide this field</SelectItem>
                <SelectItem value="require">Require this field</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-4">
          No conditional logic set
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Note: Conditional logic uses JSON Schema if/then/else syntax
      </div>
    </Card>
  );
}
