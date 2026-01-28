/**
 * Training Module Templates
 * Pre-built training courses for common organizer needs
 */

export { appBasicsTemplate } from './appBasics';
export { opsecBasicsTemplate } from './opsecBasics';
export { digitalSecurityTemplate } from './digitalSecurity';
export { jailSupportTemplate } from './jailSupport';

import type { CourseTemplate } from '../types';
import { appBasicsTemplate } from './appBasics';
import { opsecBasicsTemplate } from './opsecBasics';
import { digitalSecurityTemplate } from './digitalSecurity';
import { jailSupportTemplate } from './jailSupport';

/**
 * All default public training templates
 */
export const DEFAULT_TRAINING_TEMPLATES: CourseTemplate[] = [
  appBasicsTemplate,
  opsecBasicsTemplate,
  digitalSecurityTemplate,
  jailSupportTemplate,
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): CourseTemplate | undefined {
  return DEFAULT_TRAINING_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: CourseTemplate['category']): CourseTemplate[] {
  return DEFAULT_TRAINING_TEMPLATES.filter(t => t.category === category);
}
