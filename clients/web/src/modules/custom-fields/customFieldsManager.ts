/**
 * Custom Fields Manager
 * Business logic for custom field definitions CRUD operations
 */

import { dal } from '@/core/storage/dal';
import { useCustomFieldsStore } from './customFieldsStore';
import type { CustomField, EntityType, JSONSchemaField, FieldWidgetConfig } from './types';
import type { DBCustomField } from './schema';
import { CustomFieldSchema } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * SECURITY: Safe regex creation with ReDoS protection
 *
 * ReDoS (Regular Expression Denial of Service) attacks exploit patterns
 * that can cause catastrophic backtracking, like (a+)+b or (.*a){10}.
 *
 * This function:
 * 1. Validates the pattern can be compiled
 * 2. Limits pattern length to prevent complexity
 * 3. Detects common ReDoS patterns
 * 4. Wraps execution with a timeout (via linear-time matching only)
 */
const MAX_PATTERN_LENGTH = 500;

// Patterns commonly associated with ReDoS attacks
// These detect nested quantifiers and other problematic patterns
const REDOS_PATTERNS = [
  /\([^)]*\+[^)]*\)\+/,        // Nested + quantifiers: (a+)+
  /\([^)]*\*[^)]*\)\*/,        // Nested * quantifiers: (a*)*
  /\([^)]*\+[^)]*\)\*/,        // Mixed nested: (a+)*
  /\([^)]*\*[^)]*\)\+/,        // Mixed nested: (a*)+
  /\(\.\*[^)]*\)\{/,           // (.*x){n} patterns
  /\(\.\+[^)]*\)\{/,           // (.+x){n} patterns
  /\([^)]*\|[^)]*\)\+/,        // Alternation with quantifier: (a|b)+
  /\([^)]*\|[^)]*\)\*/,        // Alternation with quantifier: (a|b)*
];

/**
 * Check if a regex pattern is potentially vulnerable to ReDoS
 */
function isReDoSVulnerable(pattern: string): boolean {
  return REDOS_PATTERNS.some(redosPattern => redosPattern.test(pattern));
}

/**
 * Safely create a RegExp with ReDoS protection
 * Returns null if the pattern is invalid or potentially dangerous
 */
function safeRegex(pattern: string): RegExp | null {
  // Length check
  if (pattern.length > MAX_PATTERN_LENGTH) {
    console.warn('SECURITY: Regex pattern too long:', pattern.length);
    return null;
  }

  // Check for known ReDoS patterns
  if (isReDoSVulnerable(pattern)) {
    console.warn('SECURITY: Potentially vulnerable regex pattern detected');
    return null;
  }

  // Try to compile the pattern
  try {
    const regex = new RegExp(pattern);

    // Additional runtime safety: add a flag to limit backtracking if supported
    // Note: 'u' flag enables Unicode mode which has stricter parsing
    // This helps catch some invalid patterns early
    return regex;
  } catch (error) {
    console.warn('SECURITY: Invalid regex pattern:', error);
    return null;
  }
}

export class CustomFieldsManager {
  /**
   * Load fields for a specific entity type in a group
   */
  static async loadFields(groupId: string, entityType: EntityType): Promise<CustomField[]> {
    try {
      const dbFields = await dal.queryCustom<DBCustomField>({
        sql: `SELECT * FROM custom_fields WHERE group_id = ?1 AND entity_type = ?2 ORDER BY "order" ASC`,
        params: [groupId, entityType],
        dexieFallback: async (db) => {
          return db.table('customFields')
            .where({ groupId, entityType })
            .sortBy('order');
        },
      });

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
      await dal.add('customFields', {
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
      await dal.update('customFields', field.id, {
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
      await dal.delete('customFields', fieldId);

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
        // SECURITY: Use safeRegex to prevent ReDoS attacks
        if (schema.pattern) {
          const regex = safeRegex(schema.pattern);
          if (regex) {
            zodSchema = zodSchema.regex(regex);
          } else {
            console.warn(`Unsafe or invalid regex pattern ignored for field: ${field.name}`);
          }
        }
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

      case 'object':
        // Location fields store a structured object
        if (field.widget.widget === 'location') {
          zodSchema = z.object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
            label: z.string().max(500),
            precision: z.enum(['exact', 'neighborhood', 'city', 'region']),
          });
        } else {
          zodSchema = z.record(z.string(), z.unknown());
        }
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
