/**
 * Custom Fields Store
 * Zustand store for managing custom field definitions
 */

import { create } from 'zustand';
import type { CustomField, EntityType } from './types';

interface CustomFieldsState {
  // Fields by entity type and group
  fields: Map<string, CustomField[]>; // key: `${groupId}:${entityType}`

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions
  setFields: (groupId: string, entityType: EntityType, fields: CustomField[]) => void;
  addField: (field: CustomField) => void;
  updateField: (field: CustomField) => void;
  deleteField: (fieldId: string, groupId: string, entityType: EntityType) => void;

  getFields: (groupId: string, entityType: EntityType) => CustomField[];

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const getInitialState = () => ({
  fields: new Map<string, CustomField[]>(),
  loading: false,
  error: null,
});

export const useCustomFieldsStore = create<CustomFieldsState>((set, get) => ({
  ...getInitialState(),

  setFields: (groupId, entityType, fields) => {
    const key = `${groupId}:${entityType}`;
    set((state) => {
      const newFields = new Map(state.fields);
      newFields.set(key, fields.sort((a, b) => a.order - b.order));
      return { fields: newFields };
    });
  },

  addField: (field) => {
    const key = `${field.groupId}:${field.entityType}`;
    set((state) => {
      const newFields = new Map(state.fields);
      const existingFields = newFields.get(key) || [];
      newFields.set(key, [...existingFields, field].sort((a, b) => a.order - b.order));
      return { fields: newFields };
    });
  },

  updateField: (field) => {
    const key = `${field.groupId}:${field.entityType}`;
    set((state) => {
      const newFields = new Map(state.fields);
      const existingFields = newFields.get(key) || [];
      const updated = existingFields.map((f) => (f.id === field.id ? field : f));
      newFields.set(key, updated.sort((a, b) => a.order - b.order));
      return { fields: newFields };
    });
  },

  deleteField: (fieldId, groupId, entityType) => {
    const key = `${groupId}:${entityType}`;
    set((state) => {
      const newFields = new Map(state.fields);
      const existingFields = newFields.get(key) || [];
      newFields.set(
        key,
        existingFields.filter((f) => f.id !== fieldId)
      );
      return { fields: newFields };
    });
  },

  getFields: (groupId, entityType) => {
    const key = `${groupId}:${entityType}`;
    return get().fields.get(key) || [];
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set(getInitialState()),
}));
