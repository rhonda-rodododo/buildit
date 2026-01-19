/**
 * Group Template System Types
 *
 * Templates pre-configure groups with sensible module defaults,
 * reducing user overwhelm during group creation.
 */

import type { GroupPrivacyLevel, GroupModule } from '@/types/group';

/**
 * Template Category
 * Organizes templates by use case for easier discovery
 */
export type TemplateCategory =
  | 'organizing'        // Union, labor organizing
  | 'civic'             // Civic engagement, activism, democracy
  | 'mutual-aid'        // Mutual aid networks
  | 'governance'        // Collective decision-making
  | 'community'         // General community building
  | 'movement-defense'; // Movement legal defense, street medics, self-defense

/**
 * Complexity Level (1-5)
 * Helps users choose templates appropriate for their needs
 *
 * 1 = Very simple, minimal modules
 * 2 = Basic, few modules
 * 3 = Moderate, balanced features
 * 4 = Full-featured, many modules
 * 5 = Comprehensive, all modules
 */
export type ComplexityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Module Configuration within a template
 * Defines how a module should be configured when template is applied
 */
export interface TemplateModuleConfig {
  /** Module ID to enable */
  moduleId: GroupModule;

  /** Whether module is enabled by default */
  enabled: boolean;

  /** If true, user cannot disable this module (core to template) */
  required?: boolean;

  /** Module-specific configuration overrides */
  config?: Record<string, unknown>;

  /**
   * Reference to a sub-template (e.g., CRM template ID)
   * Used for modules that have their own template system
   */
  subTemplate?: string;
}

/**
 * Optional Enhancement
 * Additional modules/features that users can toggle on during creation
 */
export interface TemplateEnhancement {
  /** Unique enhancement ID */
  id: string;

  /** Display name */
  name: string;

  /** Description of what this enhancement adds */
  description: string;

  /** Icon (emoji or icon name) */
  icon?: string;

  /** Modules to add when enhancement is enabled */
  modules: TemplateModuleConfig[];
}

/**
 * Default Channel Configuration
 * Pre-defined channels to create with the group
 */
export interface TemplateChannel {
  /** Channel name */
  name: string;

  /** Channel description */
  description?: string;

  /** Channel type */
  type: 'chat' | 'voice' | 'announcement';

  /** Privacy level */
  privacy: 'public' | 'members' | 'admin';
}

/**
 * Default Role Configuration
 * Pre-defined roles beyond the standard admin/moderator/member
 */
export interface TemplateRole {
  /** Role name */
  name: string;

  /** Role description */
  description?: string;

  /** Color for visual identification */
  color?: string;

  /** Permissions granted to this role */
  permissions: string[];
}

/**
 * Demo Data Configuration
 * Options for including sample data with the template
 */
export interface DemoDataOptions {
  /** Whether demo data can be included */
  available: boolean;

  /** Default state of the demo data toggle */
  enabledByDefault?: boolean;

  /** Description of what demo data includes */
  description?: string;

  /** Seed data function names to run */
  seeds?: string[];
}

/**
 * Group Template Definition
 * Complete definition of a group template
 */
export interface GroupTemplate {
  /** Unique template ID */
  id: string;

  /** Display name */
  name: string;

  /** Template description */
  description: string;

  /** Icon (emoji or icon name) */
  icon: string;

  /** Category for organization */
  category: TemplateCategory;

  /** Complexity level (1-5) */
  complexity: ComplexityLevel;

  /** Tags for filtering/search */
  tags: string[];

  /** Default privacy level for groups created with this template */
  defaultPrivacy: GroupPrivacyLevel;

  /** Core modules enabled with this template */
  modules: TemplateModuleConfig[];

  /** Optional enhancements user can add */
  enhancements?: TemplateEnhancement[];

  /** Default channels to create */
  defaultChannels?: TemplateChannel[];

  /** Default roles to create */
  defaultRoles?: TemplateRole[];

  /** Demo data configuration */
  demoData?: DemoDataOptions;

  /** Initial group settings */
  defaultSettings?: {
    discoverable?: boolean;
    requireApproval?: boolean;
    allowInvites?: boolean;
  };

  /** Localization key for i18n (optional) */
  i18nKey?: string;
}

/**
 * Template Selection State
 * Used during group creation to track user's template customization
 */
export interface TemplateSelection {
  /** Selected template ID */
  templateId: string;

  /** Enabled enhancement IDs */
  enabledEnhancements: string[];

  /** Module overrides (moduleId -> enabled state) */
  moduleOverrides: Map<GroupModule, boolean>;

  /** Config overrides (moduleId -> config) */
  configOverrides: Map<GroupModule, Record<string, unknown>>;

  /** Whether to include demo data */
  includeDemoData: boolean;
}

/**
 * Resolved Template
 * Final configuration after user selections are applied
 */
export interface ResolvedTemplate {
  /** Modules to enable */
  enabledModules: GroupModule[];

  /** Module configurations */
  moduleConfigs: Map<GroupModule, Record<string, unknown>>;

  /** Sub-templates to apply (moduleId -> sub-template ID) */
  subTemplates: Map<GroupModule, string>;

  /** Privacy level */
  privacy: GroupPrivacyLevel;

  /** Group settings */
  settings: {
    discoverable: boolean;
    requireApproval: boolean;
    allowInvites: boolean;
  };

  /** Channels to create */
  channels: TemplateChannel[];

  /** Roles to create */
  roles: TemplateRole[];

  /** Seeds to run */
  seeds: string[];
}

/**
 * Create default template selection from a template
 */
export function createDefaultSelection(template: GroupTemplate): TemplateSelection {
  return {
    templateId: template.id,
    enabledEnhancements: [],
    moduleOverrides: new Map(),
    configOverrides: new Map(),
    includeDemoData: template.demoData?.enabledByDefault ?? false,
  };
}

/**
 * Get complexity label for display
 */
export function getComplexityLabel(complexity: ComplexityLevel): string {
  const labels: Record<ComplexityLevel, string> = {
    1: 'Simple',
    2: 'Basic',
    3: 'Moderate',
    4: 'Full-featured',
    5: 'Comprehensive',
  };
  return labels[complexity];
}

/**
 * Get category label for display
 */
export function getCategoryLabel(category: TemplateCategory): string {
  const labels: Record<TemplateCategory, string> = {
    organizing: 'Labor & Organizing',
    civic: 'Civic & Activism',
    'mutual-aid': 'Mutual Aid',
    governance: 'Governance',
    community: 'Community',
    'movement-defense': 'Movement Defense',
  };
  return labels[category];
}
