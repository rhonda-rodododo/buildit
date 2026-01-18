/**
 * CustomFieldsStore Tests
 * Tests for custom field definitions management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCustomFieldsStore } from '../customFieldsStore';
import type { CustomField, EntityType } from '../types';

describe('customFieldsStore', () => {
  beforeEach(() => {
    // Reset store state using the store's reset method
    useCustomFieldsStore.getState().reset();
  });

  const createMockField = (
    overrides: Partial<CustomField> = {}
  ): CustomField => ({
    id: `field-${Date.now()}-${Math.random()}`,
    groupId: 'group-1',
    entityType: 'event' as EntityType,
    name: 'Test Field',
    label: 'Test Label',
    type: 'text',
    order: 0,
    required: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useCustomFieldsStore.getState();
      expect(state.fields.size).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setFields', () => {
    it('should set fields for a group/entity combination', () => {
      const { setFields, getFields } = useCustomFieldsStore.getState();

      const fields: CustomField[] = [
        createMockField({ id: 'field-1', order: 1 }),
        createMockField({ id: 'field-2', order: 0 }),
      ];

      setFields('group-1', 'event', fields);

      const result = getFields('group-1', 'event');
      expect(result).toHaveLength(2);
      // Should be sorted by order
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
    });

    it('should store fields under the correct key', () => {
      const { setFields } = useCustomFieldsStore.getState();

      const eventFields = [createMockField({ id: 'event-field', entityType: 'event' })];
      const aidFields = [createMockField({ id: 'aid-field', entityType: 'mutual_aid' })];

      setFields('group-1', 'event', eventFields);
      setFields('group-1', 'mutual_aid', aidFields);

      const { fields } = useCustomFieldsStore.getState();
      expect(fields.get('group-1:event')).toHaveLength(1);
      expect(fields.get('group-1:mutual_aid')).toHaveLength(1);
    });
  });

  describe('addField', () => {
    it('should add a field to the correct group/entity', () => {
      const { addField, getFields } = useCustomFieldsStore.getState();

      const field = createMockField({ id: 'new-field', groupId: 'group-1', entityType: 'event' });

      addField(field);

      const fields = getFields('group-1', 'event');
      expect(fields).toHaveLength(1);
      expect(fields[0].id).toBe('new-field');
    });

    it('should maintain sort order when adding fields', () => {
      const { addField, getFields } = useCustomFieldsStore.getState();

      addField(createMockField({ id: 'field-1', order: 2 }));
      addField(createMockField({ id: 'field-2', order: 0 }));
      addField(createMockField({ id: 'field-3', order: 1 }));

      const fields = getFields('group-1', 'event');
      expect(fields[0].id).toBe('field-2');
      expect(fields[1].id).toBe('field-3');
      expect(fields[2].id).toBe('field-1');
    });

    it('should create new array if group/entity has no fields', () => {
      const { addField, getFields } = useCustomFieldsStore.getState();

      const field = createMockField({ groupId: 'new-group', entityType: 'profile' });

      addField(field);

      const fields = getFields('new-group', 'profile');
      expect(fields).toHaveLength(1);
    });
  });

  describe('updateField', () => {
    it('should update an existing field', () => {
      const { setFields, updateField, getFields } = useCustomFieldsStore.getState();

      const originalField = createMockField({ id: 'field-1', name: 'Original Name' });
      setFields('group-1', 'event', [originalField]);

      updateField({ ...originalField, name: 'Updated Name' });

      const fields = getFields('group-1', 'event');
      expect(fields[0].name).toBe('Updated Name');
    });

    it('should maintain sort order after update', () => {
      const { setFields, updateField, getFields } = useCustomFieldsStore.getState();

      const fields = [
        createMockField({ id: 'field-1', order: 0 }),
        createMockField({ id: 'field-2', order: 1 }),
        createMockField({ id: 'field-3', order: 2 }),
      ];
      setFields('group-1', 'event', fields);

      // Update field-3 to have order 0
      updateField({ ...fields[2], order: -1 });

      const result = getFields('group-1', 'event');
      expect(result[0].id).toBe('field-3');
    });

    it('should not affect other fields when updating', () => {
      const { setFields, updateField, getFields } = useCustomFieldsStore.getState();

      const fields = [
        createMockField({ id: 'field-1', name: 'Field 1' }),
        createMockField({ id: 'field-2', name: 'Field 2' }),
      ];
      setFields('group-1', 'event', fields);

      updateField({ ...fields[0], name: 'Updated Field 1' });

      const result = getFields('group-1', 'event');
      expect(result.find((f) => f.id === 'field-2')?.name).toBe('Field 2');
    });
  });

  describe('deleteField', () => {
    it('should remove a field', () => {
      const { setFields, deleteField, getFields } = useCustomFieldsStore.getState();

      const fields = [
        createMockField({ id: 'field-1' }),
        createMockField({ id: 'field-2' }),
      ];
      setFields('group-1', 'event', fields);

      deleteField('field-1', 'group-1', 'event');

      const result = getFields('group-1', 'event');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('field-2');
    });

    it('should handle deletion of non-existent field', () => {
      const { setFields, deleteField, getFields } = useCustomFieldsStore.getState();

      const fields = [createMockField({ id: 'field-1' })];
      setFields('group-1', 'event', fields);

      // Should not throw
      deleteField('non-existent', 'group-1', 'event');

      const result = getFields('group-1', 'event');
      expect(result).toHaveLength(1);
    });

    it('should handle deletion from empty fields', () => {
      const { deleteField, getFields } = useCustomFieldsStore.getState();

      // Should not throw
      deleteField('any-field', 'group-1', 'event');

      const result = getFields('group-1', 'event');
      expect(result).toHaveLength(0);
    });
  });

  describe('getFields', () => {
    it('should return empty array for non-existent group/entity', () => {
      const { getFields } = useCustomFieldsStore.getState();

      const fields = getFields('non-existent', 'event');
      expect(fields).toEqual([]);
    });

    it('should return fields for correct group/entity', () => {
      const { setFields, getFields } = useCustomFieldsStore.getState();

      setFields('group-1', 'event', [createMockField({ id: 'event-1', entityType: 'event' })]);
      setFields('group-1', 'profile', [createMockField({ id: 'profile-1', entityType: 'profile' })]);
      setFields('group-2', 'event', [createMockField({ id: 'event-2', entityType: 'event', groupId: 'group-2' })]);

      expect(getFields('group-1', 'event')).toHaveLength(1);
      expect(getFields('group-1', 'event')[0].id).toBe('event-1');

      expect(getFields('group-1', 'profile')).toHaveLength(1);
      expect(getFields('group-1', 'profile')[0].id).toBe('profile-1');

      expect(getFields('group-2', 'event')).toHaveLength(1);
      expect(getFields('group-2', 'event')[0].id).toBe('event-2');
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { setLoading } = useCustomFieldsStore.getState();

      setLoading(true);
      expect(useCustomFieldsStore.getState().loading).toBe(true);

      setLoading(false);
      expect(useCustomFieldsStore.getState().loading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error state', () => {
      const { setError } = useCustomFieldsStore.getState();

      setError('Something went wrong');
      expect(useCustomFieldsStore.getState().error).toBe('Something went wrong');

      setError(null);
      expect(useCustomFieldsStore.getState().error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const { setFields, setLoading, setError, reset } = useCustomFieldsStore.getState();

      // Set some state
      setFields('group-1', 'event', [createMockField()]);
      setLoading(true);
      setError('error');

      // Reset
      reset();

      const state = useCustomFieldsStore.getState();
      expect(state.fields.size).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('field types', () => {
    it('should handle different field types', () => {
      const { addField, getFields } = useCustomFieldsStore.getState();

      const textField = createMockField({ id: 'text-field', type: 'text' });
      const numberField = createMockField({ id: 'number-field', type: 'number', order: 1 });
      const dateField = createMockField({ id: 'date-field', type: 'date', order: 2 });
      const selectField = createMockField({
        id: 'select-field',
        type: 'select',
        order: 3,
        options: [
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
        ],
      });

      addField(textField);
      addField(numberField);
      addField(dateField);
      addField(selectField);

      const fields = getFields('group-1', 'event');
      expect(fields).toHaveLength(4);
      expect(fields.map((f) => f.type)).toEqual(['text', 'number', 'date', 'select']);
    });
  });

  describe('multiple groups', () => {
    it('should isolate fields between groups', () => {
      const { addField, getFields } = useCustomFieldsStore.getState();

      addField(createMockField({ id: 'g1-field', groupId: 'group-1' }));
      addField(createMockField({ id: 'g2-field', groupId: 'group-2' }));

      expect(getFields('group-1', 'event')).toHaveLength(1);
      expect(getFields('group-2', 'event')).toHaveLength(1);
      expect(getFields('group-1', 'event')[0].id).toBe('g1-field');
      expect(getFields('group-2', 'event')[0].id).toBe('g2-field');
    });
  });
});
