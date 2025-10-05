/**
 * Database Template Builder
 * Create and edit database templates with multiple tables, fields, and relationships
 */

import { useState } from 'react';
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
      alert('Please enter a template name');
      return;
    }

    if (tables.length === 0) {
      alert('Please add at least one table');
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
    if (confirm('Are you sure you want to delete this table?')) {
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
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., CRM Contact Database, Project Tracker"
          />
        </div>

        <div>
          <Label htmlFor="template-description">Description</Label>
          <Textarea
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this template is for and what it includes..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="template-category">Category</Label>
          <Select value={category} onValueChange={(val) => setCategory(val as any)}>
            <SelectTrigger id="template-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="crm">CRM</SelectItem>
              <SelectItem value="project">Project Management</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs for Tables and Relationships */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tables">
            <TableIcon className="h-4 w-4 mr-2" />
            Tables ({tables.length})
          </TabsTrigger>
          <TabsTrigger value="relationships">
            <Link2 className="h-4 w-4 mr-2" />
            Relationships ({relationships.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Define the tables and fields in this database template
            </p>
            <Button onClick={handleAddTable}>
              <Plus className="h-4 w-4 mr-2" />
              Add Table
            </Button>
          </div>

          <div className="space-y-3">
            {tables.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No tables yet. Add your first table to get started.
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
                      {table.fields.length} field{table.fields.length !== 1 ? 's' : ''}
                      {table.defaultViews && table.defaultViews.length > 0 &&
                        ` • ${table.defaultViews.length} view${table.defaultViews.length !== 1 ? 's' : ''}`}
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
                          +{table.fields.length - 5} more
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
              Define relationships between tables
            </p>
            <Button onClick={handleAddRelationship} disabled={tables.length < 2}>
              <Plus className="h-4 w-4 mr-2" />
              Add Relationship
            </Button>
          </div>

          <div className="space-y-3">
            {relationships.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No relationships yet. {tables.length < 2 ? 'Add at least 2 tables first.' : 'Add a relationship to connect your tables.'}
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
          Cancel
        </Button>
        <Button onClick={handleSaveTemplate}>
          <Save className="h-4 w-4 mr-2" />
          {isEditing ? 'Update Template' : 'Create Template'}
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
      alert('Please fill in all fields');
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
          <DialogTitle>{relationship ? 'Edit' : 'Add'} Relationship</DialogTitle>
          <DialogDescription>
            Define how tables relate to each other
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Source Table</Label>
            <Select value={sourceTableName} onValueChange={setSourceTableName}>
              <SelectTrigger>
                <SelectValue placeholder="Select table" />
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
              <Label>Source Field</Label>
              <Select value={sourceFieldName} onValueChange={setSourceFieldName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
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
            <Label>Relationship Type</Label>
            <Select value={relationType} onValueChange={(val) => setRelationType(val as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-to-many">One to Many</SelectItem>
                <SelectItem value="many-to-one">Many to One</SelectItem>
                <SelectItem value="many-to-many">Many to Many</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Target Table</Label>
            <Select value={targetTableName} onValueChange={setTargetTableName}>
              <SelectTrigger>
                <SelectValue placeholder="Select table" />
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
              <Label>Target Field</Label>
              <Select value={targetFieldName} onValueChange={setTargetFieldName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
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
            <Label>On Delete</Label>
            <Select value={onDelete} onValueChange={(val) => setOnDelete(val as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cascade">Cascade (delete related records)</SelectItem>
                <SelectItem value="set-null">Set Null (clear relationship)</SelectItem>
                <SelectItem value="restrict">Restrict (prevent deletion)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Relationship</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
