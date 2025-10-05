/**
 * Custom Fields Manager
 * Business logic for custom field definitions CRUD operations
 */

import { db } from '@/core/storage/db';
import { useCustomFieldsStore } from './customFieldsStore';
import type { CustomField, EntityType, JSONSchemaField, FieldWidgetConfig } from './types';
import { CustomFieldSchema } from './types';
import { v4 as uuidv4 } from 'uuid';

export class CustomFieldsManager {
  /**
   * Load fields for a specific entity type in a group
   */
  static async loadFields(groupId: string, entityType: EntityType): Promise<CustomField[]> {
    try {
      const customFieldsTable = db.getTable<any>('customFields');
      const dbFields = await customFieldsTable
        .where({ groupId, entityType })
        .sortBy('order');

      const fields: CustomField[] = dbFields.map((f) => ({
        id: f.id,
        groupId: f.groupId,
        entityType: f.entityType as EntityType,
        name: f.name,
        label: f.label,
        schema: JSON.parse(f.schema) as JSONSchemaField,
        widget: JSON.parse(f.widget) as FieldWidgetConfig,
        order: f.order,
        created: f.created,
        createdBy: f.createdBy,
        updated: f.updated,
      }));

      useCustomFieldsStore.getState().setFields(groupId, entityType, fields);
      return fields;
    } catch (error) {
      console.error('Failed to load custom fields:', error);
      useCustomFieldsStore.getState().setError('Failed to load custom fields');
      return [];
    }
  }

  /**
   * Create a new custom field
   */
  static async createField(
    groupId: string,
    entityType: EntityType,
    data: Omit<CustomField, 'id' | 'created' | 'updated' | 'groupId' | 'entityType'>,
    createdBy: string
  ): Promise<CustomField | null> {
    try {
      const field: CustomField = {
        id: uuidv4(),
        groupId,
        entityType,
        ...data,
        created: Date.now(),
        createdBy,
        updated: Date.now(),
      };

      // Validate
      CustomFieldSchema.parse(field);

      // Store in DB
      const customFieldsTable = db.getTable<any>('customFields');
      await customFieldsTable.add({
        ...field,
        schema: JSON.stringify(field.schema),
        widget: JSON.stringify(field.widget),
      });

      // Update store
      useCustomFieldsStore.getState().addField(field);

      return field;
    } catch (error) {
      console.error('Failed to create custom field:', error);
      useCustomFieldsStore.getState().setError('Failed to create custom field');
      return null;
    }
  }

  /**
   * Update an existing custom field
   */
  static async updateField(field: CustomField): Promise<boolean> {
    try {
      // Validate
      CustomFieldSchema.parse(field);

      // Update in DB
      const customFieldsTable = db.getTable<any>('customFields');
      await customFieldsTable.update(field.id, {
        ...field,
        schema: JSON.stringify(field.schema),
        widget: JSON.stringify(field.widget),
        updated: Date.now(),
      });

      // Update store
      useCustomFieldsStore.getState().updateField({ ...field, updated: Date.now() });

      return true;
    } catch (error) {
      console.error('Failed to update custom field:', error);
      useCustomFieldsStore.getState().setError('Failed to update custom field');
      return false;
    }
  }

  /**
   * Delete a custom field
   */
  static async deleteField(fieldId: string, groupId: string, entityType: EntityType): Promise<boolean> {
    try {
      // Delete field
      const customFieldsTable = db.getTable<any>('customFields');
      await customFieldsTable.delete(fieldId);

      // Update store
      useCustomFieldsStore.getState().deleteField(fieldId, groupId, entityType);

      return true;
    } catch (error) {
      console.error('Failed to delete custom field:', error);
      useCustomFieldsStore.getState().setError('Failed to delete custom field');
      return false;
    }
  }

  /**
   * Generate Zod schema from JSON Schema field
   * For use with react-hook-form
   */
  static generateZodSchema(field: CustomField) {
    const { schema } = field;

    // This would be a full JSON Schema to Zod converter
    // For now, basic implementation
    let zodSchema: any;

    switch (schema.type) {
      case 'string':
        zodSchema = z.string();
        if (schema.minLength) zodSchema = zodSchema.min(schema.minLength);
        if (schema.maxLength) zodSchema = zodSchema.max(schema.maxLength);
        if (schema.pattern) zodSchema = zodSchema.regex(new RegExp(schema.pattern));
        if (schema.enum) zodSchema = z.enum(schema.enum as any);
        break;

      case 'number':
      case 'integer':
        zodSchema = z.number();
        if (schema.minimum) zodSchema = zodSchema.min(schema.minimum);
        if (schema.maximum) zodSchema = zodSchema.max(schema.maximum);
        break;

      case 'boolean':
        zodSchema = z.boolean();
        break;

      case 'array':
        zodSchema = z.array(z.unknown());
        if (schema.minItems) zodSchema = zodSchema.min(schema.minItems);
        if (schema.maxItems) zodSchema = zodSchema.max(schema.maxItems);
        break;

      default:
        zodSchema = z.unknown();
    }

    if (!schema.required) {
      zodSchema = zodSchema.optional();
    }

    return zodSchema;
  }

  /**
   * Generate form schema for react-hook-form
   */
  static generateFormSchema(fields: CustomField[]) {
    const schema: Record<string, any> = {};
    const defaultValues: Record<string, unknown> = {};

    fields.forEach((field) => {
      schema[field.name] = this.generateZodSchema(field);
      if (field.schema.default !== undefined) {
        defaultValues[field.name] = field.schema.default;
      }
    });

    return { schema, defaultValues };
  }
}

// Import z at the top (forgot to add this)
import { z } from 'zod';
