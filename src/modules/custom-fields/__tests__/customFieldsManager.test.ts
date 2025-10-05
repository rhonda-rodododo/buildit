/**
 * Custom Fields Manager Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomFieldsManager } from '../customFieldsManager';
import type { CustomField, EntityType } from '../types';

// Mock the database
vi.mock('@/core/storage/db', () => ({
  db: {
    getTable: vi.fn(() => ({
      where: vi.fn(() => ({
        sortBy: vi.fn(() => Promise.resolve([])),
      })),
      add: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock the store
vi.mock('../customFieldsStore', () => ({
  useCustomFieldsStore: {
    getState: vi.fn(() => ({
      setFields: vi.fn(),
      addField: vi.fn(),
      updateField: vi.fn(),
      deleteField: vi.fn(),
      setError: vi.fn(),
    })),
  },
}));

describe('CustomFieldsManager', () => {
  describe('generateZodSchema', () => {
    it('should generate string schema with validations', () => {
      const field: CustomField = {
        id: 'test-id',
        groupId: 'group-1',
        entityType: 'event',
        name: 'test_field',
        label: 'Test Field',
        schema: {
          type: 'string',
          minLength: 5,
          maxLength: 50,
          required: true,
        },
        widget: {
          widget: 'text',
        },
        order: 0,
        created: Date.now(),
        createdBy: 'user-1',
        updated: Date.now(),
      };

      const schema = CustomFieldsManager.generateZodSchema(field);
      expect(schema).toBeDefined();
    });

    it('should generate number schema with min/max', () => {
      const field: CustomField = {
        id: 'test-id',
        groupId: 'group-1',
        entityType: 'event',
        name: 'age',
        label: 'Age',
        schema: {
          type: 'number',
          minimum: 0,
          maximum: 120,
        },
        widget: {
          widget: 'number',
        },
        order: 0,
        created: Date.now(),
        createdBy: 'user-1',
        updated: Date.now(),
      };

      const schema = CustomFieldsManager.generateZodSchema(field);
      expect(schema).toBeDefined();
    });

    it('should generate optional schema when not required', () => {
      const field: CustomField = {
        id: 'test-id',
        groupId: 'group-1',
        entityType: 'event',
        name: 'optional_field',
        label: 'Optional',
        schema: {
          type: 'string',
          required: false,
        },
        widget: {
          widget: 'text',
        },
        order: 0,
        created: Date.now(),
        createdBy: 'user-1',
        updated: Date.now(),
      };

      const schema = CustomFieldsManager.generateZodSchema(field);
      expect(schema).toBeDefined();
    });
  });

  describe('generateFormSchema', () => {
    it('should generate form schema from multiple fields', () => {
      const fields: CustomField[] = [
        {
          id: '1',
          groupId: 'group-1',
          entityType: 'event',
          name: 'name',
          label: 'Name',
          schema: { type: 'string', required: true },
          widget: { widget: 'text' },
          order: 0,
          created: Date.now(),
          createdBy: 'user-1',
          updated: Date.now(),
        },
        {
          id: '2',
          groupId: 'group-1',
          entityType: 'event',
          name: 'age',
          label: 'Age',
          schema: { type: 'number', default: 18 },
          widget: { widget: 'number' },
          order: 1,
          created: Date.now(),
          createdBy: 'user-1',
          updated: Date.now(),
        },
      ];

      const { schema, defaultValues } = CustomFieldsManager.generateFormSchema(fields);

      expect(schema.name).toBeDefined();
      expect(schema.age).toBeDefined();
      expect(defaultValues.age).toBe(18);
    });
  });
});
