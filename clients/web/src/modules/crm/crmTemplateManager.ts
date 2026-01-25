/**
 * CRM Template Manager
 * Handles applying multi-table CRM templates and managing CRM instances
 * Supports both built-in and user-created templates
 */

import { databaseManager } from '@/modules/database/databaseManager';
import { useDatabaseStore } from '@/modules/database/databaseStore';
import type { CustomField } from '@/modules/custom-fields/types';
import type { DatabaseTable, DatabaseView, DatabaseRelationship } from '@/modules/database/types';
import type {
  CRMMultiTableTemplate,
  CRMTableDefinition,
  CRMRelationshipDefinition,
  CRMTemplateApplicationResult,
  ResolvedCRMTable,
  ResolvedCRMRelationship,
  CRMTemplateCategory,
  CRMViewTemplate,
} from './types';
import { logger } from '@/lib/logger';
import { useTemplateStore } from './templateStore';
import { builtInTemplates } from './templates/index';

/**
 * CRM Template Manager
 */
class CRMTemplateManager {
  /**
   * Get all available templates (built-in + custom for group)
   */
  getAvailableTemplates(groupId?: string): CRMMultiTableTemplate[] {
    const store = useTemplateStore.getState();
    return store.getAllTemplates(groupId);
  }

  /**
   * Get built-in templates only
   */
  getBuiltInTemplates(): CRMMultiTableTemplate[] {
    return builtInTemplates;
  }

  /**
   * Get custom templates for a group
   */
  getCustomTemplates(_groupId?: string): CRMMultiTableTemplate[] {
    const store = useTemplateStore.getState();
    const customTemplates: CRMMultiTableTemplate[] = [];
    for (const [, template] of store.customTemplates) {
      customTemplates.push(template);
    }
    return customTemplates;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: CRMTemplateCategory, groupId?: string): CRMMultiTableTemplate[] {
    return this.getAvailableTemplates(groupId).filter((t) => t.category === category);
  }

  /**
   * Get template by ID (checks both built-in and custom)
   */
  getTemplateById(templateId: string): CRMMultiTableTemplate | undefined {
    const store = useTemplateStore.getState();
    return store.getTemplateById(templateId);
  }

  /**
   * Check if a template is a custom (user-created) template
   */
  isCustomTemplate(templateId: string): boolean {
    return useTemplateStore.getState().customTemplates.has(templateId);
  }

  /**
   * Load custom templates for a group (call this on group load)
   */
  async loadCustomTemplates(groupId?: string): Promise<void> {
    await useTemplateStore.getState().loadCustomTemplates(groupId);
  }

  /**
   * Save tables as a new custom template
   */
  async saveAsTemplate(
    tables: DatabaseTable[],
    relationships: DatabaseRelationship[],
    name: string,
    description: string,
    category: CRMTemplateCategory,
    groupId: string,
    userPubkey: string,
    options?: {
      icon?: string;
      isPublic?: boolean;
      sourceTemplateId?: string;
    }
  ): Promise<string> {
    // Create template from tables
    const template = this.createTemplateFromTables(
      tables,
      relationships,
      name,
      description,
      category
    );

    // Override icon if provided
    if (options?.icon) {
      template.icon = options.icon;
    }

    // Remove the ID - the store will generate a new one
    const { id: _id, ...templateWithoutId } = template;

    // Save to store
    return useTemplateStore.getState().saveAsTemplate(
      groupId,
      templateWithoutId as Omit<CRMMultiTableTemplate, 'id'>,
      userPubkey,
      {
        sourceTemplateId: options?.sourceTemplateId,
        isPublic: options?.isPublic,
      }
    );
  }

  /**
   * Clone an existing template with optional modifications
   */
  async cloneTemplate(
    templateId: string,
    newName: string,
    groupId: string,
    userPubkey: string,
    modifications?: Partial<CRMMultiTableTemplate>
  ): Promise<string> {
    return useTemplateStore.getState().cloneTemplate(
      templateId,
      newName,
      groupId,
      userPubkey,
      modifications
    );
  }

  /**
   * Update a custom template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<CRMMultiTableTemplate>,
    userPubkey: string
  ): Promise<void> {
    return useTemplateStore.getState().updateTemplate(templateId, updates, userPubkey);
  }

  /**
   * Delete a custom template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    return useTemplateStore.getState().deleteTemplate(templateId);
  }

  /**
   * Validate a template structure
   */
  validateTemplate(template: CRMMultiTableTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!template.id) errors.push('Template ID is required');
    if (!template.name) errors.push('Template name is required');
    if (!template.tables || template.tables.length === 0) {
      errors.push('Template must have at least one table');
    }

    // Check table keys are unique
    const tableKeys = new Set<string>();
    for (const table of template.tables) {
      if (tableKeys.has(table.key)) {
        errors.push(`Duplicate table key: ${table.key}`);
      }
      tableKeys.add(table.key);
    }

    // Check relationships reference valid tables
    for (const rel of template.relationships) {
      if (!tableKeys.has(rel.sourceTable)) {
        errors.push(`Relationship references unknown source table: ${rel.sourceTable}`);
      }
      if (!tableKeys.has(rel.targetTable)) {
        errors.push(`Relationship references unknown target table: ${rel.targetTable}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Apply a multi-table template to a group
   */
  async applyTemplate(
    groupId: string,
    templateId: string,
    userPubkey: string,
    options?: {
      includeSeedData?: boolean;
      tablePrefix?: string;
    }
  ): Promise<CRMTemplateApplicationResult> {
    const template = this.getTemplateById(templateId);
    if (!template) {
      return {
        success: false,
        tables: [],
        relationships: [],
        errors: [`Template not found: ${templateId}`],
      };
    }

    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      return {
        success: false,
        tables: [],
        relationships: [],
        errors: validation.errors,
      };
    }

    const resolvedTables: ResolvedCRMTable[] = [];
    const resolvedRelationships: ResolvedCRMRelationship[] = [];
    const errors: string[] = [];
    const tableKeyToId = new Map<string, string>();

    try {
      // Step 1: Create all tables
      for (const tableDef of template.tables) {
        try {
          const tableName = options?.tablePrefix
            ? `${options.tablePrefix} ${tableDef.name}`
            : tableDef.name;

          const table = await databaseManager.createTable(
            groupId,
            userPubkey,
            tableName,
            tableDef.description,
            tableDef.icon
          );

          tableKeyToId.set(tableDef.key, table.id);

          // Add fields to the table
          const fields = await this.createFieldsForTable(
            table.id,
            groupId,
            tableDef.fields,
            userPubkey
          );

          // Update table with fields in store
          useDatabaseStore.getState().updateTable(table.id, { fields });

          // Create views
          const views = await this.createViewsForTable(
            table.id,
            groupId,
            tableDef.defaultViews || [],
            userPubkey
          );

          resolvedTables.push({
            templateKey: tableDef.key,
            table: { ...table, fields },
            views,
          });

          logger.info(`Created CRM table: ${tableName} (${tableDef.key})`);
        } catch (error) {
          errors.push(`Failed to create table ${tableDef.key}: ${error}`);
        }
      }

      // Step 2: Create relationships
      for (const relDef of template.relationships) {
        try {
          const sourceTableId = tableKeyToId.get(relDef.sourceTable);
          const targetTableId = tableKeyToId.get(relDef.targetTable);

          if (!sourceTableId || !targetTableId) {
            errors.push(
              `Cannot create relationship: missing table (${relDef.sourceTable} -> ${relDef.targetTable})`
            );
            continue;
          }

          // Add relationship field to source table
          const sourceTable = resolvedTables.find((t) => t.templateKey === relDef.sourceTable);
          if (sourceTable) {
            const relationshipField: CustomField = {
              id: crypto.randomUUID(),
              groupId,
              entityType: 'database-record',
              name: relDef.sourceField,
              label: relDef.label || this.generateRelationshipLabel(relDef),
              schema: {
                type: relDef.type === 'many-to-many' ? 'array' : 'string',
                required: relDef.required,
              },
              widget: {
                widget: 'relationship',
                relationshipTargetTable: targetTableId,
                relationshipDisplayField: relDef.targetField,
              },
              order: sourceTable.table.fields.length,
              created: Date.now(),
              createdBy: userPubkey,
              updated: Date.now(),
            };

            await databaseManager.addFieldToTable(sourceTableId, relationshipField);
          }

          // Create the database relationship
          const relationship = await databaseManager.createRelationship(
            groupId,
            userPubkey,
            sourceTableId,
            relDef.sourceField,
            targetTableId,
            relDef.targetField,
            relDef.type,
            relDef.onDelete || 'set-null'
          );

          resolvedRelationships.push({
            relationship,
            sourceTableKey: relDef.sourceTable,
            targetTableKey: relDef.targetTable,
          });

          logger.info(
            `Created CRM relationship: ${relDef.sourceTable}.${relDef.sourceField} -> ${relDef.targetTable}`
          );
        } catch (error) {
          errors.push(
            `Failed to create relationship ${relDef.sourceTable} -> ${relDef.targetTable}: ${error}`
          );
        }
      }

      // Step 3: Add seed data if requested
      if (options?.includeSeedData && template.seedData) {
        await this.applySeedData(
          template.seedData,
          tableKeyToId,
          groupId,
          userPubkey
        );
      }

      // Step 4: Record the applied template
      const tableMapping: Record<string, string> = {};
      for (const [key, id] of tableKeyToId) {
        tableMapping[key] = id;
      }

      await useTemplateStore.getState().recordAppliedTemplate(
        groupId,
        templateId,
        this.isCustomTemplate(templateId),
        userPubkey,
        tableMapping
      );

      return {
        success: errors.length === 0,
        tables: resolvedTables,
        relationships: resolvedRelationships,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error('Failed to apply CRM template:', error);
      return {
        success: false,
        tables: resolvedTables,
        relationships: resolvedRelationships,
        errors: [...errors, `Template application failed: ${error}`],
      };
    }
  }

  /**
   * Get the applied template for a group
   */
  getAppliedTemplate(groupId: string) {
    return useTemplateStore.getState().getAppliedTemplate(groupId);
  }

  /**
   * Load applied templates for a group
   */
  async loadAppliedTemplates(groupId: string): Promise<void> {
    await useTemplateStore.getState().loadAppliedTemplates(groupId);
  }

  /**
   * Create fields for a table from template definition
   */
  private async createFieldsForTable(
    tableId: string,
    groupId: string,
    fieldDefs: Partial<CustomField>[],
    userPubkey: string
  ): Promise<CustomField[]> {
    const fields: CustomField[] = [];

    for (let i = 0; i < fieldDefs.length; i++) {
      const fieldDef = fieldDefs[i];
      const field: CustomField = {
        id: crypto.randomUUID(),
        groupId,
        entityType: 'database-record',
        name: fieldDef.name || `field_${i}`,
        label: fieldDef.label || fieldDef.name || `Field ${i}`,
        schema: fieldDef.schema || { type: 'string' },
        widget: fieldDef.widget || { widget: 'text' },
        order: fieldDef.order ?? i,
        created: Date.now(),
        createdBy: userPubkey,
        updated: Date.now(),
      };

      await databaseManager.addFieldToTable(tableId, field);
      fields.push(field);
    }

    return fields;
  }

  /**
   * Create views for a table from template definition
   */
  private async createViewsForTable(
    tableId: string,
    groupId: string,
    viewDefs: CRMViewTemplate[],
    userPubkey: string
  ): Promise<DatabaseView[]> {
    const views: DatabaseView[] = [];

    for (const viewDef of viewDefs) {
      try {
        const view = await databaseManager.createView(
          tableId,
          groupId,
          userPubkey,
          viewDef.name,
          viewDef.type
        );

        // Update view with config
        if (viewDef.config || viewDef.filters || viewDef.sorts) {
          await databaseManager.updateView(view.id, {
            config: viewDef.config || {},
            // Cast filters - templates use string operators that match FilterOperator values
            filters: (viewDef.filters || []) as Array<{
              fieldName: string;
              operator: 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'starts-with' | 'ends-with' | 'is-empty' | 'is-not-empty' | 'greater-than' | 'less-than' | 'greater-or-equal' | 'less-or-equal' | 'in' | 'not-in';
              value: unknown;
            }>,
            sorts: viewDef.sorts || [],
          });
        }

        views.push(view);
      } catch (error) {
        logger.error(`Failed to create view ${viewDef.name}:`, error);
      }
    }

    return views;
  }

  /**
   * Apply seed data to created tables
   */
  private async applySeedData(
    seedData: { items: Array<{ tableKey: string; records: Array<Record<string, unknown>> }> },
    tableKeyToId: Map<string, string>,
    groupId: string,
    userPubkey: string
  ): Promise<void> {
    for (const item of seedData.items) {
      const tableId = tableKeyToId.get(item.tableKey);
      if (!tableId) {
        logger.warn(`Cannot apply seed data: table ${item.tableKey} not found`);
        continue;
      }

      for (const record of item.records) {
        try {
          await databaseManager.createRecord(tableId, groupId, userPubkey, record);
        } catch (error) {
          logger.error(`Failed to create seed record in ${item.tableKey}:`, error);
        }
      }
    }
  }

  /**
   * Generate a relationship label from the definition
   */
  private generateRelationshipLabel(rel: CRMRelationshipDefinition): string {
    // Convert snake_case to Title Case
    const targetName = rel.targetTable
      .split(/[_-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    switch (rel.type) {
      case 'many-to-one':
        return targetName;
      case 'one-to-many':
        return `${targetName}s`;
      case 'many-to-many':
        return `${targetName}s`;
      default:
        return targetName;
    }
  }

  /**
   * Create a custom template from existing tables
   */
  createTemplateFromTables(
    tables: DatabaseTable[],
    relationships: DatabaseRelationship[],
    name: string,
    description: string,
    category: CRMTemplateCategory
  ): CRMMultiTableTemplate {
    const tableDefs: CRMTableDefinition[] = tables.map((table, index) => ({
      key: table.name.toLowerCase().replace(/\s+/g, '_'),
      name: table.name,
      description: table.description,
      icon: table.icon,
      isPrimary: index === 0,
      fields: table.fields.map((field) => ({
        name: field.name,
        label: field.label,
        schema: field.schema,
        widget: field.widget,
        order: field.order,
      })),
    }));

    const tableIdToKey = new Map<string, string>();
    tables.forEach((table, index) => {
      tableIdToKey.set(table.id, tableDefs[index].key);
    });

    const relationshipDefs: CRMRelationshipDefinition[] = relationships.map((rel) => ({
      sourceTable: tableIdToKey.get(rel.sourceTableId) || rel.sourceTableId,
      sourceField: rel.sourceFieldName,
      targetTable: tableIdToKey.get(rel.targetTableId) || rel.targetTableId,
      targetField: rel.targetFieldName,
      type: rel.type,
      onDelete: rel.onDelete,
    }));

    return {
      id: `custom-${crypto.randomUUID().slice(0, 8)}`,
      name,
      description,
      icon: '📋',
      category,
      tables: tableDefs,
      relationships: relationshipDefs,
    };
  }

  /**
   * Get CRM tables for a group (tables created from CRM templates)
   */
  getCRMTablesForGroup(groupId: string): DatabaseTable[] {
    const tables = useDatabaseStore.getState().getTablesByGroup(groupId);
    // For now, return all tables - in a more advanced implementation,
    // we could track which tables were created from CRM templates
    return tables;
  }
}

export const crmTemplateManager = new CRMTemplateManager();
