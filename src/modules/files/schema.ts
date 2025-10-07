/**
 * Files Module Database Schema
 * Contains all database table definitions for the files module
 */

import type { TableSchema } from '@/types/modules';

export const filesSchema: TableSchema[] = [
  {
    name: 'fileMetadata',
    schema: 'id, groupId, folderId, [groupId+updatedAt], [groupId+folderId]',
    indexes: ['id', 'groupId', 'folderId', '[groupId+updatedAt]', '[groupId+folderId]'],
  },
  {
    name: 'folders',
    schema: 'id, groupId, parentId, [groupId+parentId]',
    indexes: ['id', 'groupId', 'parentId', '[groupId+parentId]'],
  },
  {
    name: 'fileShares',
    schema: 'id, fileId, groupId, shareLink',
    indexes: ['id', 'fileId', 'groupId', 'shareLink'],
  },
  {
    name: 'fileVersions',
    schema: 'id, fileId, version',
    indexes: ['id', 'fileId', 'version'],
  },
  {
    name: 'encryptedFileBlobs',
    schema: 'id, fileId',
    indexes: ['id', 'fileId'],
  },
  {
    name: 'storageQuotas',
    schema: 'groupId',
    indexes: ['groupId'],
  },
];
