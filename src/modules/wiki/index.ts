/**
 * Wiki Module
 * Collaborative knowledge base with version control
 */

import type { ModulePlugin } from '@/types/modules';
import { wikiSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';

/**
 * Wiki Module Plugin
 */
export const wikiModule: ModulePlugin = {
  metadata: {
    id: 'wiki',
    type: 'wiki',
    name: 'Wiki',
    description: 'Collaborative knowledge base with markdown editor and version control',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: 'Book',
    capabilities: [
      {
        id: 'page-creation',
        name: 'Page Creation',
        description: 'Create and edit wiki pages',
        requiresPermission: ['member'],
      },
      {
        id: 'version-control',
        name: 'Version Control',
        description: 'Track page history and revert changes',
        requiresPermission: ['member'],
      },
      {
        id: 'search',
        name: 'Search',
        description: 'Full-text search across all pages',
        requiresPermission: ['all'],
      },
    ],
    configSchema: [
      {
        key: 'allowPublicPages',
        label: 'Allow Public Pages',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow creating publicly viewable wiki pages',
      },
      {
        key: 'requireEditApproval',
        label: 'Require Edit Approval',
        type: 'boolean',
        defaultValue: false,
        description: 'Require moderator approval for page edits',
      },
      {
        key: 'maxVersionHistory',
        label: 'Max Version History',
        type: 'number',
        defaultValue: 50,
        description: 'Maximum number of versions to keep per page',
      },
    ],
    requiredPermission: 'all',
  },

  lifecycle: {
    onRegister: async () => {
      console.log('Wiki module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.log(`Wiki module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.log(`Wiki module disabled for group ${groupId}`);
    },
  },

  schema: wikiSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial wiki schema',
      migrate: async (_db: BuildItDB) => {
        console.log('Wiki migration v1: Initial schema');
      },
    },
  ],

  seeds: [
    {
      name: 'welcome-page',
      description: 'Create a welcome page',
      data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
        const now = Date.now();
        const welcomePage = {
          id: `wiki-${groupId}-welcome`,
          groupId,
          title: 'Welcome to Our Wiki',
          content: `# Welcome!

This is your group's collaborative knowledge base. Use this space to:

- Document your organizing strategies
- Share skills and resources
- Create guides and how-tos
- Build institutional knowledge

## Getting Started

Click the "New Page" button to create your first page. You can organize pages with:

- **Categories**: Group related pages together
- **Tags**: Add keywords for easy discovery
- **Links**: Connect pages with [[wiki-style links]]

Happy documenting! ✊`,
          category: 'Getting Started',
          tags: ['welcome', 'guide'],
          version: 1,
          created: now,
          updated: now,
          updatedBy: userPubkey,
        };

        await db.table('wikiPages').add(welcomePage);
      },
    },
  ],

  getDefaultConfig: () => ({
    allowPublicPages: false,
    requireEditApproval: false,
    maxVersionHistory: 50,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowPublicPages !== 'boolean') return false;
    if (typeof config.requireEditApproval !== 'boolean') return false;
    if (typeof config.maxVersionHistory !== 'number') return false;
    if (config.maxVersionHistory < 1) return false;
    return true;
  },
};

export default wikiModule;
