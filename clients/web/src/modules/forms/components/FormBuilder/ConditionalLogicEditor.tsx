/**
 * Conditional Logic Editor Component
 * Edit conditional logic for form fields (show/hide based on other fields)
 * Uses JSON Schema if/then/else for conditional logic
 */

import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        <h4 className="font-medium text-sm">{t('conditionalLogicEditor.title')}</h4>
        {field.conditional ? (
          <Button variant="ghost" size="sm" onClick={handleRemoveRule}>
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleAddRule}>
            <Plus className="h-4 w-4 mr-2" />
            {t('conditionalLogicEditor.addRule')}
          </Button>
        )}
      </div>

      {field.conditional ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t('conditionalLogicEditor.whenField')}</Label>
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
            <Label>{t('conditionalLogicEditor.is')}</Label>
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
                <SelectItem value="equals">{t('conditionalLogicEditor.operators.equals')}</SelectItem>
                <SelectItem value="notEquals">{t('conditionalLogicEditor.operators.notEquals')}</SelectItem>
                <SelectItem value="contains">{t('conditionalLogicEditor.operators.contains')}</SelectItem>
                <SelectItem value="greaterThan">{t('conditionalLogicEditor.operators.greaterThan')}</SelectItem>
                <SelectItem value="lessThan">{t('conditionalLogicEditor.operators.lessThan')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>{t('conditionalLogicEditor.value')}</Label>
            <Input
              value={field.conditional.value.toString()}
              onChange={(e) => {
                const updated = {
                  ...field,
                  conditional: { ...field.conditional!, value: e.target.value },
                };
                onUpdate(updated);
              }}
              placeholder={t('conditionalLogicEditor.valuePlaceholder')}
            />
          </div>

          <div className="space-y-1">
            <Label>{t('conditionalLogicEditor.then')}</Label>
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
                <SelectItem value="show">{t('conditionalLogicEditor.actions.show')}</SelectItem>
                <SelectItem value="hide">{t('conditionalLogicEditor.actions.hide')}</SelectItem>
                <SelectItem value="require">{t('conditionalLogicEditor.actions.require')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-4">
          {t('conditionalLogicEditor.noLogic')}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {t('conditionalLogicEditor.note')}
      </div>
    </Card>
  );
}
