/**
 * Files Module
 * Encrypted file storage and management
 */

import { lazy } from 'react'
import type { ModulePlugin } from '@/types/modules'
import { filesSchema } from './schema'
import { FolderOpen } from 'lucide-react'
import { logger } from '@/lib/logger'
import { registerModuleTranslations } from '@/i18n/moduleI18n'
import filesTranslations from './i18n'

// Lazy load components
const FilesPage = lazy(() =>
  import('./components/FilesPage').then(m => ({ default: m.FilesPage }))
)

/**
 * Files Module Plugin
 */
export const filesModule: ModulePlugin = {
  metadata: {
    id: 'files',
    type: 'files',
    name: 'File Manager',
    description: 'Encrypted file uploads and storage with folder organization',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: FolderOpen,
    capabilities: [
      {
        id: 'file-upload',
        name: 'File Upload',
        description: 'Upload encrypted files with drag & drop',
        requiresPermission: ['member'],
      },
      {
        id: 'file-sharing',
        name: 'File Sharing',
        description: 'Share files with privacy controls',
        requiresPermission: ['member'],
      },
      {
        id: 'folder-management',
        name: 'Folder Management',
        description: 'Organize files in folders',
        requiresPermission: ['member'],
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
        key: 'allowedFileTypes',
        label: 'Allowed File Types',
        type: 'multiselect',
        defaultValue: ['image', 'document', 'video', 'audio'],
        options: [
          { label: 'Images', value: 'image' },
          { label: 'Documents', value: 'document' },
          { label: 'Videos', value: 'video' },
          { label: 'Audio', value: 'audio' },
          { label: 'Archives', value: 'archive' },
        ],
      },
      {
        key: 'storageQuota',
        label: 'Storage Quota (GB)',
        type: 'number',
        defaultValue: 1,
        description: 'Storage quota per group in GB',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      registerModuleTranslations('files', filesTranslations)
      logger.info('📁 Files module registered')
    },
    onEnable: async (groupId: string) => {
      logger.info(`📁 Files module enabled for group ${groupId}`)
      // Initialize storage quota when enabled
      const { fileManager } = await import('./fileManager')
      const quotaGB = 1 // Default 1GB
      await fileManager.initializeStorageQuota(groupId, quotaGB * 1024 * 1024 * 1024)
    },
  },

  schema: filesSchema,

  migrations: [],
  seeds: [],

  routes: [
    {
      path: 'files',
      component: FilesPage,
      requiresEnabled: true,
    },
  ],

  getDefaultConfig: () => ({
    maxFileSize: 100,
    allowedFileTypes: ['image', 'document', 'video', 'audio'],
    storageQuota: 1,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.maxFileSize !== 'number') return false
    if (config.maxFileSize < 1 || config.maxFileSize > 1000) return false
    if (!Array.isArray(config.allowedFileTypes)) return false
    if (typeof config.storageQuota !== 'number') return false
    if (config.storageQuota < 0 || config.storageQuota > 100) return false
    return true
  },
}

export default filesModule
