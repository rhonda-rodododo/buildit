/**
 * Group Templates Module
 *
 * Provides pre-configured group templates (Airtable-style) to help users
 * create groups with sensible module defaults and optional demo data.
 *
 * @example
 * ```tsx
 * import { templateRegistry, getTemplate, resolveTemplate } from '@/core/groupTemplates';
 *
 * // Get all templates
 * const templates = templateRegistry.getAll();
 *
 * // Get a specific template
 * const unionTemplate = getTemplate('union-chapter');
 *
 * // Resolve user's selection into final config
 * const resolved = resolveTemplate({
 *   templateId: 'union-chapter',
 *   enabledEnhancements: ['public-presence'],
 *   moduleOverrides: new Map(),
 *   configOverrides: new Map(),
 *   includeDemoData: true,
 * });
 * ```
 */

// Types
export type {
  GroupTemplate,
  TemplateCategory,
  ComplexityLevel,
  TemplateModuleConfig,
  TemplateEnhancement,
  TemplateChannel,
  TemplateRole,
  DemoDataOptions,
  TemplateSelection,
  ResolvedTemplate,
} from './types';

// Type utilities
export {
  createDefaultSelection,
  getComplexityLabel,
  getCategoryLabel,
} from './types';

// Registry
export {
  templateRegistry,
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  resolveTemplate,
  searchTemplates,
} from './templateRegistry';

// Built-in templates
export {
  BUILTIN_TEMPLATES,
  TEMPLATES_BY_CATEGORY,
  SIMPLE_GROUP_TEMPLATE,
  MUTUAL_AID_NETWORK_TEMPLATE,
  UNION_CHAPTER_TEMPLATE,
  ACTIVIST_COLLECTIVE_TEMPLATE,
  COMMUNITY_HUB_TEMPLATE,
  getDefaultTemplate,
  getTemplatesByComplexity,
  getTemplatesForCategory,
} from './templates';

// Default export is the registry
export { templateRegistry as default } from './templateRegistry';
