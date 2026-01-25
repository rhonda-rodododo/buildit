/**
 * Intake Form Component
 * Dynamic form to create CRM records based on table fields
 * Supports sectioned layouts, multi-column forms, and collapsible sections
 */

import { useState, useMemo, useCallback } from 'react';
import { useDatabaseStore } from '@/modules/database/databaseStore';
import { databaseManager } from '@/modules/database/databaseManager';
import type { DatabaseRecord, FormSection } from '@/modules/database/types';
import type { CustomField, CustomFieldValues } from '@/modules/custom-fields/types';
import {
  evaluateFieldVisibility,
  evaluateFieldRequired,
  validateRequiredFields,
} from '@/modules/custom-fields/visibilityUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Plus,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface IntakeFormProps {
  tableId: string;
  groupId: string;
  userPubkey: string;
  className?: string;
  onSuccess?: (record: DatabaseRecord) => void;
  onCancel?: () => void;
  // Optional linking
  linkToRecordId?: string;
  linkToTableId?: string;
  linkFieldName?: string;
  // Optional initial values
  initialValues?: Record<string, unknown>;
  // Mode: inline form or dialog
  mode?: 'inline' | 'dialog';
  dialogOpen?: boolean;
  onDialogOpenChange?: (open: boolean) => void;
}

interface FormValues {
  [key: string]: unknown;
}

export function IntakeForm({
  tableId,
  groupId,
  userPubkey,
  className,
  onSuccess,
  onCancel,
  linkToRecordId,
  linkToTableId: _linkToTableId,
  linkFieldName,
  initialValues = {},
  mode = 'inline',
  dialogOpen,
  onDialogOpenChange,
}: IntakeFormProps) {
  // Reserved for future cross-table linking validation
  void _linkToTableId;
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(() => ({
    ...initialValues,
    ...(linkToRecordId && linkFieldName ? { [linkFieldName]: linkToRecordId } : {}),
  }));

  const tables = useDatabaseStore((s) => s.tables);

  // Get table configuration
  const table = useMemo(() => tables.get(tableId), [tables, tableId]);

  // Get fields sorted by order
  const formFields = useMemo(() => {
    if (!table) return [];
    return [...table.fields].sort((a, b) => a.order - b.order);
  }, [table]);

  // Build field lookup map
  const fieldsByName = useMemo(() => {
    const map = new Map<string, CustomField>();
    for (const field of formFields) {
      map.set(field.name, field);
    }
    return map;
  }, [formFields]);

  // Get form sections - use layout if defined, otherwise create default section
  const formSections = useMemo((): FormSection[] => {
    if (table?.formLayout?.sections) {
      return table.formLayout.sections;
    }
    // Default: single section with all fields
    return [{
      id: 'default',
      label: t('crm.formFields', 'Fields'),
      fields: formFields.map((f) => f.name),
      columns: 1,
    }];
  }, [table, formFields, t]);

  // Track collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const collapsed = new Set<string>();
    for (const section of (table?.formLayout?.sections || [])) {
      if (section.defaultCollapsed) {
        collapsed.add(section.id);
      }
    }
    return collapsed;
  });

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Handle field value change
  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
    setError(null);
  }, []);

  // Validate form (considering visibility and dynamic required)
  const validateForm = useCallback((): boolean => {
    const errors = validateRequiredFields(formFields, formValues as CustomFieldValues);
    const errorKeys = Object.keys(errors);

    if (errorKeys.length > 0) {
      // Get the first error to display
      const firstField = formFields.find((f) => f.name === errorKeys[0]);
      setError(t('crm.fieldRequired', '{{field}} is required', {
        field: firstField?.label || errorKeys[0],
      }));
      return false;
    }
    return true;
  }, [formFields, formValues, t]);

  // Submit form
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);

    try {
      const record = await databaseManager.createRecord(
        tableId,
        groupId,
        userPubkey,
        formValues
      );

      if (record) {
        // Reset form
        setFormValues({
          ...(linkToRecordId && linkFieldName ? { [linkFieldName]: linkToRecordId } : {}),
        });
        onSuccess?.(record);
        onDialogOpenChange?.(false);
      } else {
        throw new Error('Failed to create record');
      }
    } catch (err) {
      console.error('Failed to create record:', err);
      setError(t('crm.createRecordError', 'Failed to create record. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Render fields for a section (with visibility filtering)
  const renderSectionFields = (section: FormSection) => {
    const sectionFields = section.fields
      .map((fieldName) => fieldsByName.get(fieldName))
      .filter((f): f is CustomField => f !== undefined)
      // Filter out fields that should be hidden based on visibility rules
      .filter((f) => evaluateFieldVisibility(f, formValues as CustomFieldValues));

    // Don't render section if all fields are hidden
    if (sectionFields.length === 0) {
      return null;
    }

    const columns = section.columns || 1;
    const gridClass = columns === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : columns === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1';

    return (
      <div className={cn('grid gap-4', gridClass)}>
        {sectionFields.map((field) => (
          <FormField
            key={field.id}
            field={field}
            value={formValues[field.name]}
            onChange={(value) => handleFieldChange(field.name, value)}
            disabled={submitting}
            groupId={groupId}
            isRequired={evaluateFieldRequired(field, formValues as CustomFieldValues)}
          />
        ))}
      </div>
    );
  };

  // Form content
  const formContent = (
    <form onSubmit={handleSubmit}>
      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-6 p-1">
          {formSections.map((section, index) => {
            const isCollapsed = collapsedSections.has(section.id);
            const showSectionNumber = table?.formLayout?.showSectionNumbers;

            // If section is collapsible, render with Collapsible component
            if (section.collapsible) {
              return (
                <Collapsible
                  key={section.id}
                  open={!isCollapsed}
                  onOpenChange={() => toggleSection(section.id)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          <span className="font-medium">
                            {showSectionNumber && `${index + 1}. `}
                            {section.label}
                          </span>
                        </div>
                        {section.description && (
                          <span className="text-sm text-muted-foreground hidden sm:block">
                            {section.description}
                          </span>
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4">
                        {renderSectionFields(section)}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            }

            // Non-collapsible section - show as labeled group
            if (formSections.length > 1) {
              return (
                <div key={section.id} className="space-y-3">
                  <div className="border-b pb-2">
                    <h3 className="font-medium">
                      {showSectionNumber && `${index + 1}. `}
                      {section.label}
                    </h3>
                    {section.description && (
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    )}
                  </div>
                  {renderSectionFields(section)}
                </div>
              );
            }

            // Single section - no header needed
            return (
              <div key={section.id}>
                {renderSectionFields(section)}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2 mt-6">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {table?.formLayout?.cancelLabel || t('common.cancel', 'Cancel')}
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('common.creating', 'Creating...')}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              {table?.formLayout?.submitLabel || t('crm.createRecord', 'Create Record')}
            </>
          )}
        </Button>
      </div>
    </form>
  );

  if (!table) {
    return (
      <div className={cn('text-center text-muted-foreground py-8', className)}>
        {t('crm.tableNotFound', 'Table not found')}
      </div>
    );
  }

  // Dialog mode
  if (mode === 'dialog') {
    return (
      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {table.icon && <span>{table.icon}</span>}
              {t('crm.newRecord', 'New {{table}}', { table: table.name })}
            </DialogTitle>
            <DialogDescription>
              {table.description || t('crm.fillFieldsBelow', 'Fill in the fields below to create a new record.')}
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Inline mode
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {table.icon && <span>{table.icon}</span>}
          {t('crm.newRecord', 'New {{table}}', { table: table.name })}
        </CardTitle>
        {table.description && (
          <CardDescription>{table.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
}

interface FormFieldProps {
  field: CustomField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  groupId: string;
  isRequired?: boolean; // Dynamic required based on visibility rules
}

function FormField({ field, value, onChange, disabled, groupId: _groupId, isRequired }: FormFieldProps) {
  // Reserved for relationship field lookups scoped to group
  void _groupId;
  const { t } = useTranslation();
  const widgetType = field.widget.widget;

  // Use dynamic required if provided, otherwise fall back to schema required
  const required = isRequired !== undefined ? isRequired : field.schema.required;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="flex items-center gap-1">
        {field.label}
        {required && <span className="text-destructive">*</span>}
      </Label>

      {widgetType === 'text' && (
        <Input
          id={field.id}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.widget.placeholder}
          disabled={disabled}
        />
      )}

      {widgetType === 'textarea' && (
        <Textarea
          id={field.id}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.widget.placeholder}
          disabled={disabled}
          rows={3}
        />
      )}

      {widgetType === 'number' && (
        <Input
          id={field.id}
          type="number"
          value={(value as number) || ''}
          onChange={(e) => onChange(e.target.valueAsNumber || null)}
          placeholder={field.widget.placeholder}
          disabled={disabled}
          min={field.schema.minimum}
          max={field.schema.maximum}
        />
      )}

      {widgetType === 'date' && (
        <Input
          id={field.id}
          type="date"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {widgetType === 'datetime' && (
        <Input
          id={field.id}
          type="datetime-local"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {widgetType === 'checkbox' && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={(value as boolean) || false}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
          />
          <Label htmlFor={field.id} className="font-normal">
            {field.widget.helpText || field.label}
          </Label>
        </div>
      )}

      {(widgetType === 'select' || widgetType === 'radio') && field.widget.options && (
        <Select
          value={(value as string) || ''}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.widget.placeholder || t('common.select', 'Select...')} />
          </SelectTrigger>
          <SelectContent>
            {field.widget.options.map((option) => {
              const optValue = typeof option === 'object' ? String(option.value) : String(option);
              const optLabel = typeof option === 'object' ? option.label : String(option);
              return (
                <SelectItem key={optValue} value={optValue}>
                  {optLabel}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      {widgetType === 'multi-select' && field.widget.options && (
        <MultiSelectField
          field={field}
          value={value as string[]}
          onChange={onChange}
          disabled={disabled}
        />
      )}

      {field.widget.helpText && widgetType !== 'checkbox' && (
        <p className="text-xs text-muted-foreground">{field.widget.helpText}</p>
      )}
    </div>
  );
}

interface MultiSelectFieldProps {
  field: CustomField;
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

function MultiSelectField({ field, value = [], onChange, disabled }: MultiSelectFieldProps) {
  const options = field.widget.options || [];

  const toggleOption = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  return (
    <div className="border rounded-md p-2 space-y-1">
      {options.map((option) => {
        const optValue = typeof option === 'object' ? String(option.value) : String(option);
        const optLabel = typeof option === 'object' ? option.label : String(option);
        const isSelected = value.includes(optValue);

        return (
          <button
            key={optValue}
            type="button"
            onClick={() => toggleOption(optValue)}
            disabled={disabled}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-left',
              'hover:bg-muted transition-colors',
              isSelected && 'bg-primary/10'
            )}
          >
            <div
              className={cn(
                'w-4 h-4 rounded border flex items-center justify-center',
                isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
              )}
            >
              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

export default IntakeForm;
