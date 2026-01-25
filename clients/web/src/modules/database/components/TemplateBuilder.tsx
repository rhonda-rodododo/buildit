/**
 * Database Template Builder
 * Create and edit database templates with multiple tables, fields, and relationships
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';
import {
  DatabaseTemplate,
  DatabaseTableTemplate,
  DatabaseRelationshipTemplate,
} from '../types';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Edit, Table as TableIcon, Link2, Save } from 'lucide-react';
import { TableBuilder } from './TableBuilder';

interface TemplateBuilderProps {
  template?: DatabaseTemplate;
  onSave: (template: DatabaseTemplate) => void;
  onCancel: () => void;
}

export function TemplateBuilder({ template, onSave, onCancel }: TemplateBuilderProps) {
  const { t } = useTranslation();
  const isEditing = !!template;

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState<'general' | 'crm' | 'project' | 'inventory' | 'custom'>(
    template?.category || 'general'
  );
  const [tables, setTables] = useState<DatabaseTableTemplate[]>(template?.tables || []);
  const [relationships, setRelationships] = useState<DatabaseRelationshipTemplate[]>(
    template?.relationships || []
  );

  // UI state
  const [activeTab, setActiveTab] = useState<'tables' | 'relationships'>('tables');
  const [editingTableIndex, setEditingTableIndex] = useState<number | null>(null);
  const [showTableBuilder, setShowTableBuilder] = useState(false);
  const [showRelationshipDialog, setShowRelationshipDialog] = useState(false);
  const [editingRelationshipIndex, setEditingRelationshipIndex] = useState<number | null>(null);

  // Handlers
  const handleSaveTemplate = () => {
    if (!name.trim()) {
      alert(t('templateBuilder.enterName'));
      return;
    }

    if (tables.length === 0) {
      alert(t('templateBuilder.addTableFirst'));
      return;
    }

    const now = Date.now();
    const templateData: DatabaseTemplate = {
      id: template?.id || nanoid(),
      name: name.trim(),
      description: description.trim(),
      category,
      tables,
      relationships,
      isBuiltIn: template?.isBuiltIn || false,
      groupId: template?.groupId,
      created: template?.created || now,
      createdBy: template?.createdBy,
      updated: now,
    };

    onSave(templateData);
  };

  const handleAddTable = () => {
    setEditingTableIndex(null);
    setShowTableBuilder(true);
  };

  const handleEditTable = (index: number) => {
    setEditingTableIndex(index);
    setShowTableBuilder(true);
  };

  const handleDeleteTable = (index: number) => {
    if (confirm(t('templateBuilder.deleteTable'))) {
      const tableName = tables[index].name;
      setTables(tables.filter((_, i) => i !== index));
      // Also remove any relationships involving this table
      setRelationships(
        relationships.filter(
          (rel) => rel.sourceTableName !== tableName && rel.targetTableName !== tableName
        )
      );
    }
  };

  const handleSaveTable = (table: DatabaseTableTemplate) => {
    if (editingTableIndex !== null) {
      const oldTableName = tables[editingTableIndex].name;
      const newTables = [...tables];
      newTables[editingTableIndex] = table;
      setTables(newTables);

      // Update relationships if table name changed
      if (oldTableName !== table.name) {
        setRelationships(
          relationships.map((rel) => ({
            ...rel,
            sourceTableName: rel.sourceTableName === oldTableName ? table.name : rel.sourceTableName,
            targetTableName: rel.targetTableName === oldTableName ? table.name : rel.targetTableName,
          }))
        );
      }
    } else {
      setTables([...tables, table]);
    }
    setShowTableBuilder(false);
  };

  const handleAddRelationship = () => {
    setEditingRelationshipIndex(null);
    setShowRelationshipDialog(true);
  };

  const handleEditRelationship = (index: number) => {
    setEditingRelationshipIndex(index);
    setShowRelationshipDialog(true);
  };

  const handleDeleteRelationship = (index: number) => {
    setRelationships(relationships.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Template Info */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="template-name">{t('templateBuilder.templateName')}</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('templateBuilder.templateNamePlaceholder')}
          />
        </div>

        <div>
          <Label htmlFor="template-description">{t('templateBuilder.description')}</Label>
          <Textarea
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('templateBuilder.descriptionPlaceholder')}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="template-category">{t('templateBuilder.category')}</Label>
          <Select value={category} onValueChange={(val) => setCategory(val as any)}>
            <SelectTrigger id="template-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">{t('templateBuilder.categories.general')}</SelectItem>
              <SelectItem value="crm">{t('templateBuilder.categories.crm')}</SelectItem>
              <SelectItem value="project">{t('templateBuilder.categories.project')}</SelectItem>
              <SelectItem value="inventory">{t('templateBuilder.categories.inventory')}</SelectItem>
              <SelectItem value="custom">{t('templateBuilder.categories.custom')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs for Tables and Relationships */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tables">
            <TableIcon className="h-4 w-4 mr-2" />
            {t('templateBuilder.tables')} ({tables.length})
          </TabsTrigger>
          <TabsTrigger value="relationships">
            <Link2 className="h-4 w-4 mr-2" />
            {t('templateBuilder.relationships')} ({relationships.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {t('templateBuilder.tablesDesc')}
            </p>
            <Button onClick={handleAddTable}>
              <Plus className="h-4 w-4 mr-2" />
              {t('templateBuilder.addTable')}
            </Button>
          </div>

          <div className="space-y-3">
            {tables.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    {t('templateBuilder.noTables')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              tables.map((table, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{table.name}</CardTitle>
                        {table.description && (
                          <CardDescription>{table.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTable(index)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteTable(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {table.fields.length} {table.fields.length === 1 ? t('templateBuilder.field') : t('templateBuilder.fields')}
                      {table.defaultViews && table.defaultViews.length > 0 &&
                        ` • ${table.defaultViews.length} ${table.defaultViews.length === 1 ? t('templateBuilder.view') : t('templateBuilder.views')}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {table.fields.slice(0, 5).map((field) => (
                        <span
                          key={field.name}
                          className="text-xs px-2 py-1 bg-secondary rounded"
                        >
                          {field.label} ({field.widget.widget})
                        </span>
                      ))}
                      {table.fields.length > 5 && (
                        <span className="text-xs px-2 py-1 bg-muted rounded">
                          {t('templateBuilder.more', { count: table.fields.length - 5 })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="relationships" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {t('templateBuilder.relationshipsDesc')}
            </p>
            <Button onClick={handleAddRelationship} disabled={tables.length < 2}>
              <Plus className="h-4 w-4 mr-2" />
              {t('templateBuilder.addRelationship')}
            </Button>
          </div>

          <div className="space-y-3">
            {relationships.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    {t('templateBuilder.noRelationships')} {tables.length < 2 ? t('templateBuilder.noRelationshipsNeedTables') : t('templateBuilder.noRelationshipsConnect')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              relationships.map((rel, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rel.sourceTableName}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{rel.targetTableName}</span>
                        <span className="text-xs px-2 py-1 bg-secondary rounded">
                          {rel.type}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRelationship(index)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteRelationship(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSaveTemplate}>
          <Save className="h-4 w-4 mr-2" />
          {isEditing ? t('templateBuilder.updateTemplate') : t('templateBuilder.createTemplate')}
        </Button>
      </div>

      {/* Table Builder Dialog */}
      {showTableBuilder && (
        <Dialog open={showTableBuilder} onOpenChange={setShowTableBuilder}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <TableBuilder
              table={editingTableIndex !== null ? tables[editingTableIndex] : undefined}
              onSave={handleSaveTable}
              onCancel={() => setShowTableBuilder(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Relationship Builder Dialog */}
      {showRelationshipDialog && (
        <RelationshipBuilder
          tables={tables}
          relationship={
            editingRelationshipIndex !== null
              ? relationships[editingRelationshipIndex]
              : undefined
          }
          onSave={(rel) => {
            if (editingRelationshipIndex !== null) {
              const newRels = [...relationships];
              newRels[editingRelationshipIndex] = rel;
              setRelationships(newRels);
            } else {
              setRelationships([...relationships, rel]);
            }
            setShowRelationshipDialog(false);
          }}
          onCancel={() => setShowRelationshipDialog(false)}
        />
      )}
    </div>
  );
}

/**
 * Relationship Builder Sub-Component
 */
interface RelationshipBuilderProps {
  tables: DatabaseTableTemplate[];
  relationship?: DatabaseRelationshipTemplate;
  onSave: (relationship: DatabaseRelationshipTemplate) => void;
  onCancel: () => void;
}

function RelationshipBuilder({
  tables,
  relationship,
  onSave,
  onCancel,
}: RelationshipBuilderProps) {
  const { t } = useTranslation();
  const [sourceTableName, setSourceTableName] = useState(relationship?.sourceTableName || '');
  const [sourceFieldName, setSourceFieldName] = useState(relationship?.sourceFieldName || '');
  const [targetTableName, setTargetTableName] = useState(relationship?.targetTableName || '');
  const [targetFieldName, setTargetFieldName] = useState(relationship?.targetFieldName || '');
  const [relationType, setRelationType] = useState<'one-to-many' | 'many-to-many' | 'many-to-one'>(
    relationship?.type || 'one-to-many'
  );
  const [onDelete, setOnDelete] = useState<'cascade' | 'set-null' | 'restrict'>(
    relationship?.onDelete || 'set-null'
  );

  const sourceTable = tables.find((t) => t.name === sourceTableName);
  const targetTable = tables.find((t) => t.name === targetTableName);

  const handleSave = () => {
    if (!sourceTableName || !sourceFieldName || !targetTableName || !targetFieldName) {
      alert(t('templateBuilder.relationship.fillFields'));
      return;
    }

    onSave({
      sourceTableName,
      sourceFieldName,
      targetTableName,
      targetFieldName,
      type: relationType,
      onDelete,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{relationship ? t('templateBuilder.relationship.edit') : t('templateBuilder.relationship.add')} {t('templateBuilder.relationship.title')}</DialogTitle>
          <DialogDescription>
            {t('templateBuilder.relationship.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t('templateBuilder.relationship.sourceTable')}</Label>
            <Select value={sourceTableName} onValueChange={setSourceTableName}>
              <SelectTrigger>
                <SelectValue placeholder={t('templateBuilder.relationship.selectTable')} />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.name} value={table.name}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceTable && (
            <div>
              <Label>{t('templateBuilder.relationship.sourceField')}</Label>
              <Select value={sourceFieldName} onValueChange={setSourceFieldName}>
                <SelectTrigger>
                  <SelectValue placeholder={t('templateBuilder.relationship.selectField')} />
                </SelectTrigger>
                <SelectContent>
                  {sourceTable.fields.map((field) => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>{t('templateBuilder.relationship.type')}</Label>
            <Select value={relationType} onValueChange={(val) => setRelationType(val as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-to-many">{t('templateBuilder.relationship.oneToMany')}</SelectItem>
                <SelectItem value="many-to-one">{t('templateBuilder.relationship.manyToOne')}</SelectItem>
                <SelectItem value="many-to-many">{t('templateBuilder.relationship.manyToMany')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('templateBuilder.relationship.targetTable')}</Label>
            <Select value={targetTableName} onValueChange={setTargetTableName}>
              <SelectTrigger>
                <SelectValue placeholder={t('templateBuilder.relationship.selectTable')} />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.name} value={table.name}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetTable && (
            <div>
              <Label>{t('templateBuilder.relationship.targetField')}</Label>
              <Select value={targetFieldName} onValueChange={setTargetFieldName}>
                <SelectTrigger>
                  <SelectValue placeholder={t('templateBuilder.relationship.selectField')} />
                </SelectTrigger>
                <SelectContent>
                  {targetTable.fields.map((field) => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>{t('templateBuilder.relationship.onDelete')}</Label>
            <Select value={onDelete} onValueChange={(val) => setOnDelete(val as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cascade">{t('templateBuilder.relationship.cascade')}</SelectItem>
                <SelectItem value="set-null">{t('templateBuilder.relationship.setNull')}</SelectItem>
                <SelectItem value="restrict">{t('templateBuilder.relationship.restrict')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('templateBuilder.relationship.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
