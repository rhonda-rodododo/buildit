/**
 * CRM Template Store
 * Manages user-created templates and applied template instances
 */

import { create } from 'zustand';
import { getDB } from '@/core/storage/db';
import type { CRMMultiTableTemplate, CRMTemplateCategory } from './types';
import type { DBCustomTemplate, DBAppliedTemplate } from './schema';
import { logger } from '@/lib/logger';
import { builtInTemplates } from './templates/index';

/**
 * Template Store State
 */
interface TemplateStoreState {
  // Custom templates created by users
  customTemplates: Map<string, CRMMultiTableTemplate>;

  // Applied templates per group (groupId -> appliedTemplate)
  appliedTemplates: Map<string, DBAppliedTemplate>;

  // Loading state
  loading: boolean;
  error: string | null;

  // Actions
  loadCustomTemplates: (groupId?: string) => Promise<void>;
  loadAppliedTemplates: (groupId: string) => Promise<void>;

  // Template CRUD
  saveAsTemplate: (
    groupId: string,
    template: Omit<CRMMultiTableTemplate, 'id'>,
    userPubkey: string,
    options?: {
      sourceTemplateId?: string;
      isPublic?: boolean;
    }
  ) => Promise<string>;

  updateTemplate: (
    templateId: string,
    updates: Partial<CRMMultiTableTemplate>,
    userPubkey: string
  ) => Promise<void>;

  deleteTemplate: (templateId: string) => Promise<void>;

  cloneTemplate: (
    templateId: string,
    newName: string,
    groupId: string,
    userPubkey: string,
    modifications?: Partial<CRMMultiTableTemplate>
  ) => Promise<string>;

  // Get combined templates (built-in + custom)
  getAllTemplates: (groupId?: string) => CRMMultiTableTemplate[];
  getTemplatesByCategory: (category: CRMTemplateCategory, groupId?: string) => CRMMultiTableTemplate[];
  getTemplateById: (templateId: string) => CRMMultiTableTemplate | undefined;

  // Applied template tracking
  recordAppliedTemplate: (
    groupId: string,
    templateId: string,
    isCustom: boolean,
    userPubkey: string,
    tableMapping: Record<string, string>
  ) => Promise<void>;

  getAppliedTemplate: (groupId: string) => DBAppliedTemplate | undefined;
}

/**
 * Create template store
 */
export const useTemplateStore = create<TemplateStoreState>((set, get) => ({
  customTemplates: new Map(),
  appliedTemplates: new Map(),
  loading: false,
  error: null,

  /**
   * Load custom templates from database
   */
  loadCustomTemplates: async (groupId?: string) => {
    set({ loading: true, error: null });

    try {
      const db = getDB();
      let templates: DBCustomTemplate[];

      if (groupId) {
        // Load templates for specific group (including public ones)
        templates = await db.table('crmCustomTemplates')
          .where('groupId')
          .equals(groupId)
          .or('isPublic')
          .equals(1) // Dexie stores booleans as 0/1
          .toArray();
      } else {
        // Load all public templates
        templates = await db.table('crmCustomTemplates')
          .where('isPublic')
          .equals(1)
          .toArray();
      }

      const templateMap = new Map<string, CRMMultiTableTemplate>();

      for (const dbTemplate of templates) {
        try {
          const template: CRMMultiTableTemplate = {
            ...JSON.parse(dbTemplate.templateData),
            id: dbTemplate.id,
            name: dbTemplate.name,
            description: dbTemplate.description,
            icon: dbTemplate.icon,
            category: dbTemplate.category as CRMTemplateCategory,
          };
          templateMap.set(dbTemplate.id, template);
        } catch (parseError) {
          logger.error('Failed to parse custom template', {
            templateId: dbTemplate.id,
            error: parseError,
          });
        }
      }

      set({ customTemplates: templateMap, loading: false });
      logger.info('Loaded custom templates', { count: templateMap.size });
    } catch (error) {
      logger.error('Failed to load custom templates', { error });
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load templates',
      });
    }
  },

  /**
   * Load applied templates for a group
   */
  loadAppliedTemplates: async (groupId: string) => {
    try {
      const db = getDB();
      const applied = await db.table('crmAppliedTemplates')
        .where('groupId')
        .equals(groupId)
        .toArray();

      const appliedMap = new Map(get().appliedTemplates);

      for (const app of applied) {
        appliedMap.set(groupId, app as DBAppliedTemplate);
      }

      set({ appliedTemplates: appliedMap });
    } catch (error) {
      logger.error('Failed to load applied templates', { groupId, error });
    }
  },

  /**
   * Save tables as a new custom template
   */
  saveAsTemplate: async (
    groupId: string,
    template: Omit<CRMMultiTableTemplate, 'id'>,
    userPubkey: string,
    options = {}
  ): Promise<string> => {
    const db = getDB();
    const templateId = crypto.randomUUID();
    const now = Date.now();

    const fullTemplate: CRMMultiTableTemplate = {
      ...template,
      id: templateId,
    };

    const dbTemplate: DBCustomTemplate = {
      id: templateId,
      groupId,
      name: template.name,
      description: template.description,
      icon: template.icon,
      category: template.category,
      templateData: JSON.stringify(fullTemplate),
      createdBy: userPubkey,
      created: now,
      updated: now,
      isPublic: options.isPublic ?? false,
      sourceTemplateId: options.sourceTemplateId,
      version: '1.0.0',
    };

    await db.table('crmCustomTemplates').add(dbTemplate);

    // Update store
    const customTemplates = new Map(get().customTemplates);
    customTemplates.set(templateId, fullTemplate);
    set({ customTemplates });

    logger.info('Saved custom template', { templateId, name: template.name });
    return templateId;
  },

  /**
   * Update an existing custom template
   */
  updateTemplate: async (
    templateId: string,
    updates: Partial<CRMMultiTableTemplate>,
    _userPubkey: string
  ) => {
    const db = getDB();
    const existing = get().customTemplates.get(templateId);

    if (!existing) {
      throw new Error('Template not found');
    }

    const updated: CRMMultiTableTemplate = {
      ...existing,
      ...updates,
      id: templateId, // Ensure ID doesn't change
    };

    // Increment version
    const currentVersion = existing.version || '1.0.0';
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    const newVersion = `${major}.${minor}.${patch + 1}`;

    await db.table('crmCustomTemplates').update(templateId, {
      name: updated.name,
      description: updated.description,
      icon: updated.icon,
      category: updated.category,
      templateData: JSON.stringify(updated),
      updated: Date.now(),
      version: newVersion,
    });

    const customTemplates = new Map(get().customTemplates);
    customTemplates.set(templateId, { ...updated, version: newVersion });
    set({ customTemplates });

    logger.info('Updated custom template', { templateId, version: newVersion });
  },

  /**
   * Delete a custom template
   */
  deleteTemplate: async (templateId: string) => {
    const db = getDB();

    // Check if template exists
    if (!get().customTemplates.has(templateId)) {
      throw new Error('Template not found');
    }

    await db.table('crmCustomTemplates').delete(templateId);

    const customTemplates = new Map(get().customTemplates);
    customTemplates.delete(templateId);
    set({ customTemplates });

    logger.info('Deleted custom template', { templateId });
  },

  /**
   * Clone an existing template (built-in or custom)
   */
  cloneTemplate: async (
    templateId: string,
    newName: string,
    groupId: string,
    userPubkey: string,
    modifications = {}
  ): Promise<string> => {
    // Find template (check custom first, then built-in)
    let source = get().customTemplates.get(templateId);

    if (!source) {
      source = builtInTemplates.find((t: CRMMultiTableTemplate) => t.id === templateId);
    }

    if (!source) {
      throw new Error('Source template not found');
    }

    // Create clone with modifications
    const clonedTemplate: Omit<CRMMultiTableTemplate, 'id'> = {
      ...source,
      ...modifications,
      name: newName,
      author: userPubkey,
    };

    return get().saveAsTemplate(groupId, clonedTemplate, userPubkey, {
      sourceTemplateId: templateId,
    });
  },

  /**
   * Get all templates (built-in + custom for group)
   */
  getAllTemplates: (_groupId?: string): CRMMultiTableTemplate[] => {
    const templates: CRMMultiTableTemplate[] = [...builtInTemplates];

    // Add custom templates
    for (const [, template] of get().customTemplates) {
      templates.push(template);
    }

    return templates;
  },

  /**
   * Get templates by category
   */
  getTemplatesByCategory: (
    category: CRMTemplateCategory,
    groupId?: string
  ): CRMMultiTableTemplate[] => {
    return get()
      .getAllTemplates(groupId)
      .filter((t) => t.category === category);
  },

  /**
   * Get template by ID (custom or built-in)
   */
  getTemplateById: (templateId: string): CRMMultiTableTemplate | undefined => {
    // Check custom templates first
    const custom = get().customTemplates.get(templateId);
    if (custom) return custom;

    // Check built-in templates
    return builtInTemplates.find((t: CRMMultiTableTemplate) => t.id === templateId);
  },

  /**
   * Record that a template was applied to a group
   */
  recordAppliedTemplate: async (
    groupId: string,
    templateId: string,
    isCustom: boolean,
    userPubkey: string,
    tableMapping: Record<string, string>
  ) => {
    const db = getDB();
    const id = crypto.randomUUID();

    const record: DBAppliedTemplate = {
      id,
      groupId,
      templateId,
      isCustom,
      appliedAt: Date.now(),
      appliedBy: userPubkey,
      tableMapping: JSON.stringify(tableMapping),
    };

    // Delete any existing applied template for this group
    await db.table('crmAppliedTemplates')
      .where('groupId')
      .equals(groupId)
      .delete();

    await db.table('crmAppliedTemplates').add(record);

    const appliedTemplates = new Map(get().appliedTemplates);
    appliedTemplates.set(groupId, record);
    set({ appliedTemplates });

    logger.info('Recorded applied template', { groupId, templateId });
  },

  /**
   * Get applied template for a group
   */
  getAppliedTemplate: (groupId: string): DBAppliedTemplate | undefined => {
    return get().appliedTemplates.get(groupId);
  },
}));

export default useTemplateStore;
