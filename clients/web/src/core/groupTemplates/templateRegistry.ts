/**
 * Group Template Registry
 *
 * Manages template registration, lookup, and resolution.
 * Provides the API for applying templates during group creation.
 */

import type {
  GroupTemplate,
  TemplateSelection,
  ResolvedTemplate,
  TemplateCategory,
  TemplateModuleConfig,
} from './types';
import type { GroupModule } from '@/types/group';
import { BUILTIN_TEMPLATES } from './templates';

/**
 * Template Registry
 * Singleton class managing all available group templates
 */
class TemplateRegistry {
  private templates: Map<string, GroupTemplate> = new Map();

  constructor() {
    // Register all built-in templates
    BUILTIN_TEMPLATES.forEach((template) => this.register(template));
  }

  /**
   * Register a new template
   */
  register(template: GroupTemplate): void {
    if (this.templates.has(template.id)) {
      console.warn(`Template "${template.id}" already registered, overwriting`);
    }
    this.templates.set(template.id, template);
  }

  /**
   * Unregister a template
   */
  unregister(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Get a template by ID
   */
  get(templateId: string): GroupTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all registered templates
   */
  getAll(): GroupTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getByCategory(category: TemplateCategory): GroupTemplate[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /**
   * Get templates sorted by complexity
   */
  getByComplexity(ascending = true): GroupTemplate[] {
    const templates = this.getAll();
    return templates.sort((a, b) =>
      ascending ? a.complexity - b.complexity : b.complexity - a.complexity
    );
  }

  /**
   * Search templates by query string
   */
  search(query: string): GroupTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (template) =>
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        template.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Resolve a template selection into final configuration
   * Applies user's customizations (enhancements, overrides) to produce
   * the final list of modules and settings
   */
  resolveTemplate(selection: TemplateSelection): ResolvedTemplate {
    const template = this.get(selection.templateId);
    if (!template) {
      throw new Error(`Template not found: ${selection.templateId}`);
    }

    const enabledModules: GroupModule[] = [];
    const moduleConfigs = new Map<GroupModule, Record<string, unknown>>();
    const subTemplates = new Map<GroupModule, string>();
    const channels = [...(template.defaultChannels || [])];
    const roles = [...(template.defaultRoles || [])];
    const seeds: string[] = [];

    // Helper to process a module config
    const processModuleConfig = (modConfig: TemplateModuleConfig) => {
      const isOverridden = selection.moduleOverrides.has(modConfig.moduleId);
      const isEnabled = isOverridden
        ? selection.moduleOverrides.get(modConfig.moduleId)!
        : modConfig.enabled;

      // Required modules cannot be disabled
      if (modConfig.required || isEnabled) {
        if (!enabledModules.includes(modConfig.moduleId)) {
          enabledModules.push(modConfig.moduleId);
        }

        // Apply config with overrides
        const baseConfig = modConfig.config || {};
        const overrideConfig = selection.configOverrides.get(modConfig.moduleId) || {};
        const existingConfig = moduleConfigs.get(modConfig.moduleId) || {};
        moduleConfigs.set(modConfig.moduleId, {
          ...existingConfig,
          ...baseConfig,
          ...overrideConfig,
        });

        // Track sub-templates
        if (modConfig.subTemplate) {
          subTemplates.set(modConfig.moduleId, modConfig.subTemplate);
        }
      }
    };

    // Process base modules
    for (const modConfig of template.modules) {
      processModuleConfig(modConfig);
    }

    // Process enabled enhancements
    if (template.enhancements) {
      for (const enhancement of template.enhancements) {
        if (selection.enabledEnhancements.includes(enhancement.id)) {
          for (const modConfig of enhancement.modules) {
            processModuleConfig(modConfig);
          }
        }
      }
    }

    // Collect seeds if demo data is enabled
    if (selection.includeDemoData && template.demoData?.seeds) {
      seeds.push(...template.demoData.seeds);
    }

    return {
      enabledModules,
      moduleConfigs,
      subTemplates,
      privacy: template.defaultPrivacy,
      settings: {
        discoverable: template.defaultSettings?.discoverable ?? false,
        requireApproval: template.defaultSettings?.requireApproval ?? false,
        allowInvites: template.defaultSettings?.allowInvites ?? true,
      },
      channels,
      roles,
      seeds,
    };
  }

  /**
   * Get module count for a template (including potential enhancements)
   */
  getModuleCount(templateId: string): { base: number; max: number } {
    const template = this.get(templateId);
    if (!template) {
      return { base: 0, max: 0 };
    }

    const baseCount = template.modules.filter((m) => m.enabled).length;
    let maxCount = baseCount;

    if (template.enhancements) {
      const enhancementModules = new Set<string>();
      for (const enhancement of template.enhancements) {
        for (const mod of enhancement.modules) {
          enhancementModules.add(mod.moduleId);
        }
      }
      maxCount = baseCount + enhancementModules.size;
    }

    return { base: baseCount, max: maxCount };
  }
}

// Export singleton instance
export const templateRegistry = new TemplateRegistry();

// Convenience exports
export const getTemplate = (id: string) => templateRegistry.get(id);
export const getAllTemplates = () => templateRegistry.getAll();
export const getTemplatesByCategory = (category: TemplateCategory) =>
  templateRegistry.getByCategory(category);
export const resolveTemplate = (selection: TemplateSelection) =>
  templateRegistry.resolveTemplate(selection);
export const searchTemplates = (query: string) => templateRegistry.search(query);

export default templateRegistry;
