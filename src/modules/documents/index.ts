/**
 * Documents Module
 * WYSIWYG editor for comprehensive documents (Placeholder for Phase 2)
 */

import type { ModulePlugin } from '@/types/modules';
import { documentsSchema } from './schema';
import { FileText } from 'lucide-react';

/**
 * Documents Module Plugin (Placeholder)
 */
export const documentsModule: ModulePlugin = {
  metadata: {
    id: 'documents',
    type: 'documents',
    name: 'Document Suite',
    description: 'WYSIWYG editor for comprehensive documents (Phase 2)',
    version: '0.1.0',
    author: 'BuildIt Network',
    icon: FileText,
    capabilities: [
      {
        id: 'document-creation',
        name: 'Document Creation',
        description: 'Create rich documents with WYSIWYG editor',
        requiresPermission: ['member'],
      },
      {
        id: 'collaboration',
        name: 'Collaboration',
        description: 'Real-time collaborative editing',
        requiresPermission: ['member'],
      },
    ],
    configSchema: [
      {
        key: 'allowPublicDocs',
        label: 'Allow Public Documents',
        type: 'boolean',
        defaultValue: false,
        description: 'Allow creating publicly viewable documents',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      console.log('Documents module registered (placeholder)');
    },
    onEnable: async (groupId: string) => {
      console.log(`Documents module enabled for group ${groupId} (placeholder)`);
    },
  },

  schema: documentsSchema,

  migrations: [],
  seeds: [],

  getDefaultConfig: () => ({
    allowPublicDocs: false,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowPublicDocs !== 'boolean') return false;
    return true;
  },
};

export default documentsModule;
