import type { ModulePlugin } from '@/types/modules';
import { documentsSchema } from './schema';
import { documentsMigrations } from './migrations';
import { documentsSeeds } from './seeds';
import { DocumentsPage } from './components/DocumentsPage';
import { initializeTemplates } from './templates';

/**
 * Documents Module
 * WYSIWYG document editor with collaboration
 */
export const DocumentsModule: ModulePlugin = {
  schema: documentsSchema,
  migrations: documentsMigrations,
  seeds: documentsSeeds,

  metadata: {
    id: 'documents',
    type: 'documents',
    name: 'Document Suite',
    description: 'Create and edit comprehensive documents with WYSIWYG editor',
    version: '1.0.0',
    author: 'BuildN',
    icon: 'FileText',
    capabilities: [
      {
        id: 'wysiwyg',
        name: 'WYSIWYG Editor',
        description: 'Rich text editing with formatting',
      },
      {
        id: 'collaboration',
        name: 'Real-time Collaboration',
        description: 'Multiple users editing simultaneously',
      },
      {
        id: 'templates',
        name: 'Document Templates',
        description: 'Pre-built templates for common document types',
      },
      {
        id: 'export',
        name: 'Export Options',
        description: 'Export to PDF, Markdown, HTML',
      },
    ],
    configSchema: [
      {
        key: 'enableCollaboration',
        label: 'Enable Real-time Collaboration',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow multiple users to edit simultaneously',
      },
      {
        key: 'autoSaveInterval',
        label: 'Auto-save Interval (seconds)',
        type: 'number',
        defaultValue: 30,
        description: 'How often to auto-save documents',
      },
      {
        key: 'enableVersionHistory',
        label: 'Enable Version History',
        type: 'boolean',
        defaultValue: true,
        description: 'Track document version history',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      // Initialize document templates
      initializeTemplates();
    },

    onEnable: async (groupId, config) => {
      console.log(`Documents module enabled for group ${groupId}`, config);
    },

    onDisable: async (groupId) => {
      console.log(`Documents module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: '/groups/:groupId/documents',
      component: DocumentsPage,
      exact: true,
    },
  ],

  getDefaultConfig: () => ({
    enableCollaboration: true,
    autoSaveInterval: 30,
    enableVersionHistory: true,
  }),

  validateConfig: (config) => {
    if (typeof config.enableCollaboration !== 'boolean') {
      return false;
    }
    if (typeof config.autoSaveInterval !== 'number' || config.autoSaveInterval < 10) {
      return false;
    }
    if (typeof config.enableVersionHistory !== 'boolean') {
      return false;
    }
    return true;
  },
};
