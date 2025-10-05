import type { ModulePlugin } from '@/types/modules';
import WikiDashboard from '@/components/wiki/WikiDashboard';
import { wikiSchema } from './schema';
import { wikiMigrations } from './migrations';
import { wikiSeeds } from './seeds';

/**
 * Wiki / Knowledge Base Module
 * Collaborative documentation with version control
 */
export const WikiModule: ModulePlugin = {
  schema: wikiSchema,
  migrations: wikiMigrations,
  seeds: wikiSeeds,

  metadata: {
    id: 'wiki',
    type: 'wiki',
    name: 'Wiki / Knowledge Base',
    description: 'Collaborative wiki with markdown editor, version control, and search',
    version: '1.0.0',
    author: 'BuildN',
    icon: 'BookOpen',
    capabilities: [
      {
        id: 'pages',
        name: 'Wiki Pages',
        description: 'Create and edit wiki pages with markdown',
      },
      {
        id: 'version-control',
        name: 'Version Control',
        description: 'Track page history and revert changes',
      },
      {
        id: 'categories',
        name: 'Categories & Tags',
        description: 'Organize pages with categories and tags',
      },
      {
        id: 'search',
        name: 'Full-Text Search',
        description: 'Search across all wiki content',
      },
    ],
    configSchema: [
      {
        key: 'allowAnonymousRead',
        label: 'Allow Anonymous Reading',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow non-members to read public pages',
      },
      {
        key: 'requireApproval',
        label: 'Require Edit Approval',
        type: 'boolean',
        defaultValue: false,
        description: 'Require moderator approval for edits',
      },
      {
        key: 'maxVersions',
        label: 'Max Versions Per Page',
        type: 'number',
        defaultValue: 20,
        description: 'Maximum number of versions to keep (0 = unlimited)',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onEnable: async (groupId, config) => {
      console.log(`Wiki module enabled for group ${groupId}`, config);
    },

    onDisable: async (groupId) => {
      console.log(`Wiki module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: '/groups/:groupId/wiki',
      component: WikiDashboard,
      exact: true,
    },
  ],

  getDefaultConfig: () => ({
    allowAnonymousRead: false,
    requireApproval: false,
    maxVersions: 20,
  }),

  validateConfig: (config) => {
    if (typeof config.allowAnonymousRead !== 'boolean') {
      return false;
    }
    if (typeof config.requireApproval !== 'boolean') {
      return false;
    }
    if (typeof config.maxVersions !== 'number' || config.maxVersions < 0) {
      return false;
    }
    return true;
  },
};
