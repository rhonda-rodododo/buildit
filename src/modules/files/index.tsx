import type { ModulePlugin } from '@/types/modules';
import { filesSchema } from './schema';
import { filesMigrations } from './migrations';
import { filesSeeds } from './seeds';

// Placeholder component
const FilesPlaceholder = () => <div>File Manager (Coming Soon)</div>;

/**
 * Files Module
 * File and folder management with encryption
 */
export const FilesModule: ModulePlugin = {
  schema: filesSchema,
  migrations: filesMigrations,
  seeds: filesSeeds,

  metadata: {
    id: 'files',
    type: 'files',
    name: 'File Manager',
    description: 'Upload, organize, and share encrypted files and folders',
    version: '1.0.0',
    author: 'BuildN',
    icon: 'Folder',
    capabilities: [
      {
        id: 'upload',
        name: 'File Upload',
        description: 'Upload files with encryption',
      },
      {
        id: 'folders',
        name: 'Folder Organization',
        description: 'Organize files in folders',
      },
      {
        id: 'sharing',
        name: 'Secure Sharing',
        description: 'Share files with encryption',
      },
      {
        id: 'preview',
        name: 'File Preview',
        description: 'Preview common file types',
      },
    ],
    configSchema: [
      {
        key: 'maxFileSize',
        label: 'Max File Size (MB)',
        type: 'number',
        defaultValue: 100,
        description: 'Maximum file size for uploads',
      },
      {
        key: 'allowedTypes',
        label: 'Allowed File Types',
        type: 'multiselect',
        defaultValue: ['image', 'document', 'video', 'audio', 'archive'],
        options: [
          { label: 'Images', value: 'image' },
          { label: 'Documents', value: 'document' },
          { label: 'Videos', value: 'video' },
          { label: 'Audio', value: 'audio' },
          { label: 'Archives', value: 'archive' },
          { label: 'Code', value: 'code' },
        ],
        description: 'Allowed file type categories',
      },
      {
        key: 'storageQuota',
        label: 'Storage Quota (GB)',
        type: 'number',
        defaultValue: 10,
        description: 'Storage quota per group (0 = unlimited)',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onEnable: async (groupId, config) => {
      console.log(`Files module enabled for group ${groupId}`, config);
    },

    onDisable: async (groupId) => {
      console.log(`Files module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: '/groups/:groupId/files',
      component: FilesPlaceholder,
      exact: true,
    },
  ],

  getDefaultConfig: () => ({
    maxFileSize: 100,
    allowedTypes: ['image', 'document', 'video', 'audio', 'archive'],
    storageQuota: 10,
  }),

  validateConfig: (config) => {
    if (typeof config.maxFileSize !== 'number' || config.maxFileSize <= 0) {
      return false;
    }
    if (!Array.isArray(config.allowedTypes) || config.allowedTypes.length === 0) {
      return false;
    }
    if (typeof config.storageQuota !== 'number' || config.storageQuota < 0) {
      return false;
    }
    return true;
  },
};
