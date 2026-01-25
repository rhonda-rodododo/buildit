/**
 * CustomFieldsManagement Component
 * UI for managing custom fields in group settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { CustomFieldsManager } from '../customFieldsManager';
import { FieldEditor } from './FieldEditor';
import { getTemplatesByEntityType } from '../templates';
import type { CustomField, EntityType } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CustomFieldsManagementProps {
  groupId: string;
  entityType: EntityType;
}

export function CustomFieldsManagement({ groupId, entityType }: CustomFieldsManagementProps) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [editingField, setEditingField] = useState<CustomField | undefined>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const templates = getTemplatesByEntityType(entityType);

  const loadFields = useCallback(async () => {
    const loaded = await CustomFieldsManager.loadFields(groupId, entityType);
    setFields(loaded);
  }, [groupId, entityType]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  const handleCreateField = () => {
    setEditingField(undefined);
    setEditorOpen(true);
  };

  const handleEditField = (field: CustomField) => {
    setEditingField(field);
    setEditorOpen(true);
  };

  const handleDeleteField = async (field: CustomField) => {
    setFieldToDelete(field);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (fieldToDelete) {
      await CustomFieldsManager.deleteField(fieldToDelete.id, groupId, entityType);
      await loadFields();
      setDeleteDialogOpen(false);
      setFieldToDelete(null);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Create all fields from template
    for (const fieldData of template.fields) {
      await CustomFieldsManager.createField(
        groupId,
        entityType,
        {
          ...fieldData,
          createdBy: 'system', // Template fields created by system
        },
        'system'
      );
    }

    await loadFields();
    setSelectedTemplate('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('customFieldsManagement.title', { entityType })}</h3>
        <div className="flex gap-2">
          {templates.length > 0 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="template">{t('customFieldsManagement.applyTemplate')}</Label>
              <Select value={selectedTemplate} onValueChange={handleApplyTemplate}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t('customFieldsManagement.selectTemplate')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handleCreateField}>
            <Plus className="h-4 w-4 mr-2" />
            {t('customFieldsManagement.addField')}
          </Button>
        </div>
      </div>

      {fields.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          {t('customFieldsManagement.empty')}
        </Card>
      ) : (
        <div className="space-y-2">
          {fields.sort((a, b) => a.order - b.order).map((field) => (
            <Card key={field.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{field.label}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('customFieldsManagement.type', { widget: field.widget.widget })}
                    {field.schema.required && ` • ${t('customFieldsManagement.required')}`}
                  </p>
                  {field.widget.helpText && (
                    <p className="text-sm text-muted-foreground mt-1">{field.widget.helpText}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditField(field)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteField(field)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FieldEditor
        groupId={groupId}
        entityType={entityType}
        field={editingField}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={loadFields}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customFieldsManagement.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('customFieldsManagement.deleteDialog.description', { label: fieldToDelete?.label })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('customFieldsManagement.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('customFieldsManagement.deleteDialog.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
