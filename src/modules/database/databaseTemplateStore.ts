/**
 * Database Template Store
 * Manages database templates (built-in and custom)
 */

import { create } from 'zustand';
import { DatabaseTemplate } from './types';
import { BUILT_IN_TEMPLATES } from './templates/builtInTemplates';
import { CRM_TEMPLATES } from '../crm/templates/crmTemplates';

interface DatabaseTemplateStore {
  // State
  templates: DatabaseTemplate[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadTemplates: () => Promise<void>;
  getTemplate: (templateId: string) => DatabaseTemplate | undefined;
  getTemplatesByCategory: (category: string) => DatabaseTemplate[];
  createTemplate: (template: DatabaseTemplate) => Promise<void>;
  updateTemplate: (templateId: string, updates: Partial<DatabaseTemplate>) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
}

export const useDatabaseTemplateStore = create<DatabaseTemplateStore>((set, get) => ({
  templates: [],
  isLoading: false,
  error: null,

  loadTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, this would load from IndexedDB and merge with built-in templates
      // For now, we just use built-in templates and CRM templates
      const allTemplates = [...BUILT_IN_TEMPLATES, ...CRM_TEMPLATES];
      set({ templates: allTemplates, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load templates', isLoading: false });
    }
  },

  getTemplate: (templateId: string) => {
    return get().templates.find((t) => t.id === templateId);
  },

  getTemplatesByCategory: (category: string) => {
    return get().templates.filter((t) => t.category === category);
  },

  createTemplate: async (template: DatabaseTemplate) => {
    set({ isLoading: true, error: null });
    try {
      // In a real app, this would save to IndexedDB
      const { templates } = get();
      set({ templates: [...templates, template], isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create template', isLoading: false });
      throw error;
    }
  },

  updateTemplate: async (templateId: string, updates: Partial<DatabaseTemplate>) => {
    set({ isLoading: true, error: null });
    try {
      const { templates } = get();
      const template = templates.find((t) => t.id === templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      if (template.isBuiltIn) {
        throw new Error('Cannot modify built-in templates');
      }

      const updatedTemplates = templates.map((t) =>
        t.id === templateId ? { ...t, ...updates, updated: Date.now() } : t
      );

      set({ templates: updatedTemplates, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update template', isLoading: false });
      throw error;
    }
  },

  deleteTemplate: async (templateId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { templates } = get();
      const template = templates.find((t) => t.id === templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      if (template.isBuiltIn) {
        throw new Error('Cannot delete built-in templates');
      }

      const updatedTemplates = templates.filter((t) => t.id !== templateId);
      set({ templates: updatedTemplates, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete template', isLoading: false });
      throw error;
    }
  },
}));
