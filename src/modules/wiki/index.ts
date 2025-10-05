/**
 * Wiki Module
 * Collaborative knowledge base with version control
 */

import type { ModulePlugin } from '@/types/modules';
import { wikiSchema } from './schema';
import { wikiSeeds } from './seeds';
import type { BuildItDB } from '@/core/storage/db';
import { Book } from 'lucide-react';

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
    icon: Book,
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

  seeds: wikiSeeds,

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
