/**
 * Documents Module
 * WYSIWYG editor for comprehensive documents with collaboration
 */

import type { ModulePlugin } from '@/types/modules';
import { documentsSchema } from './schema';
import { FileText } from 'lucide-react';
import { lazy } from 'react';
import { logger } from '@/lib/logger';

// Lazy load DocumentsPage to reduce initial bundle size
const DocumentsPage = lazy(() => import('./components/DocumentsPage').then(m => ({ default: m.DocumentsPage })));

/**
 * Documents Module Plugin
 */
export const documentsModule: ModulePlugin = {
  metadata: {
    id: 'documents',
    type: 'documents',
    name: 'Document Suite',
    description: 'Create and collaborate on rich documents with WYSIWYG editor, comments, and sharing',
    version: '1.0.0',
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
        description: 'Real-time collaborative editing with comments',
        requiresPermission: ['member'],
      },
      {
        id: 'document-sharing',
        name: 'Document Sharing',
        description: 'Share documents with group members or externally',
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
      {
        key: 'enableComments',
        label: 'Enable Comments',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow commenting on documents',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      logger.info('📄 Documents module registered');
    },
    onEnable: async (groupId: string) => {
      logger.info(`📄 Documents module enabled for group ${groupId}`);
    },
    onDisable: async (groupId: string) => {
      logger.info(`📄 Documents module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'documents',
      component: DocumentsPage,
      scope: 'group',
      requiresEnabled: true,
      label: 'Documents',
    },
  ],

  schema: documentsSchema,

  migrations: [],
  seeds: [],

  getDefaultConfig: () => ({
    allowPublicDocs: false,
    enableComments: true,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowPublicDocs !== 'boolean') return false;
    if (typeof config.enableComments !== 'boolean') return false;
    return true;
  },
};

export default documentsModule;
