/**
 * Files Module Seed Data
 * Provides example/template data for the files module
 */

import type { ModuleSeed } from '@/types/modules'
import { dal } from '@/core/storage/dal'
import type { Folder, StorageQuota } from './types'

/**
 * Seed data for files module
 */
export const filesSeeds: ModuleSeed[] = [
  {
    name: 'basic-folders',
    description: 'Basic folder structure for file organization',
    data: async (groupId, userPubkey) => {
      const now = Date.now()
      const day = 24 * 60 * 60 * 1000

      // Create folders
      const folders: Folder[] = [
        {
          id: `folder-documents-${groupId}`,
          groupId,
          parentId: null,
          name: 'Documents',
          createdBy: userPubkey,
          createdAt: now - 7 * day,
          updatedAt: now - 7 * day,
          color: '#3b82f6',
          icon: 'FileText',
        },
        {
          id: `folder-media-${groupId}`,
          groupId,
          parentId: null,
          name: 'Media',
          createdBy: userPubkey,
          createdAt: now - 5 * day,
          updatedAt: now - 5 * day,
          color: '#8b5cf6',
          icon: 'Image',
        },
        {
          id: `folder-resources-${groupId}`,
          groupId,
          parentId: null,
          name: 'Resources',
          createdBy: userPubkey,
          createdAt: now - 3 * day,
          updatedAt: now - 3 * day,
          color: '#10b981',
          icon: 'Archive',
        },
      ]

      // Insert folders
      for (const folder of folders) {
        await dal.add('folders', folder)
      }

      // Initialize storage quota
      const quota: StorageQuota = {
        groupId,
        totalBytes: 1024 * 1024 * 1024, // 1GB
        usedBytes: 0,
        fileCount: 0,
        quotaLimit: 1024 * 1024 * 1024, // 1GB
        updatedAt: now,
      }

      await dal.add('storageQuotas', quota)
    },
  },
]
