/**
 * Built-in Group Templates
 *
 * All templates available out of the box for creating groups.
 * Templates are ordered by complexity for easier navigation.
 */

import type { GroupTemplate, TemplateCategory } from '../types';
import { SIMPLE_GROUP_TEMPLATE } from './simpleGroup';
import { MUTUAL_AID_NETWORK_TEMPLATE } from './mutualAidNetwork';
import { UNION_CHAPTER_TEMPLATE } from './unionChapter';
import { ACTIVIST_COLLECTIVE_TEMPLATE } from './activistCollective';
import { COMMUNITY_HUB_TEMPLATE } from './communityHub';

// Re-export individual templates
export { SIMPLE_GROUP_TEMPLATE } from './simpleGroup';
export { MUTUAL_AID_NETWORK_TEMPLATE } from './mutualAidNetwork';
export { UNION_CHAPTER_TEMPLATE } from './unionChapter';
export { ACTIVIST_COLLECTIVE_TEMPLATE } from './activistCollective';
export { COMMUNITY_HUB_TEMPLATE } from './communityHub';

/**
 * All built-in templates, ordered by complexity
 */
export const BUILTIN_TEMPLATES: GroupTemplate[] = [
  SIMPLE_GROUP_TEMPLATE,        // Complexity: 1
  MUTUAL_AID_NETWORK_TEMPLATE,  // Complexity: 2
  COMMUNITY_HUB_TEMPLATE,       // Complexity: 3
  ACTIVIST_COLLECTIVE_TEMPLATE, // Complexity: 3
  UNION_CHAPTER_TEMPLATE,       // Complexity: 4
];

/**
 * Templates organized by category
 */
export const TEMPLATES_BY_CATEGORY: Record<TemplateCategory, GroupTemplate[]> = {
  community: [SIMPLE_GROUP_TEMPLATE, COMMUNITY_HUB_TEMPLATE],
  'mutual-aid': [MUTUAL_AID_NETWORK_TEMPLATE],
  organizing: [UNION_CHAPTER_TEMPLATE],
  civic: [ACTIVIST_COLLECTIVE_TEMPLATE],
  governance: [], // Could add dedicated governance templates later
};

/**
 * Get the default/recommended template
 */
export function getDefaultTemplate(): GroupTemplate {
  return SIMPLE_GROUP_TEMPLATE;
}

/**
 * Get templates sorted by complexity (ascending)
 */
export function getTemplatesByComplexity(): GroupTemplate[] {
  return [...BUILTIN_TEMPLATES].sort((a, b) => a.complexity - b.complexity);
}

/**
 * Get templates for a specific category
 */
export function getTemplatesForCategory(category: TemplateCategory): GroupTemplate[] {
  return TEMPLATES_BY_CATEGORY[category] || [];
}

/**
 * Search templates by name, description, or tags
 */
export function searchTemplates(query: string): GroupTemplate[] {
  const lowerQuery = query.toLowerCase();
  return BUILTIN_TEMPLATES.filter(
    (template) =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

export default BUILTIN_TEMPLATES;
