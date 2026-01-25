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
  // Epic 58: Folder permissions for inheritance
  {
    name: 'fileFolderPermissions',
    schema: '[folderId+userPubkey], folderId, groupId, userPubkey',
    indexes: ['[folderId+userPubkey]', 'folderId', 'groupId', 'userPubkey'],
  },
  // Epic 58: File access requests
  {
    name: 'fileAccessRequests',
    schema: 'id, resourceId, resourceType, requesterPubkey, status, createdAt',
    indexes: ['id', 'resourceId', 'resourceType', 'requesterPubkey', 'status', 'createdAt'],
  },
  // Epic 57: Saved search filters
  {
    name: 'savedSearchFilters',
    schema: 'id, groupId, name, createdAt',
    indexes: ['id', 'groupId', 'name', 'createdAt'],
  },
  // Epic 57: Recent searches
  {
    name: 'recentSearches',
    schema: 'id, groupId, timestamp, query',
    indexes: ['id', 'groupId', 'timestamp', 'query'],
  },
  // Epic 57: File activity logs
  {
    name: 'fileActivityLogs',
    schema: 'id, groupId, fileId, action, timestamp, userPubkey',
    indexes: ['id', 'groupId', 'fileId', 'action', 'timestamp', 'userPubkey'],
  },
  // Epic 57: File content index (for full-text search)
  {
    name: 'fileContentIndex',
    schema: 'id, fileId, groupId, content',
    indexes: ['id', 'fileId', 'groupId'],
  },
  // Epic 57: File hashes (for duplicate detection)
  {
    name: 'fileHashes',
    schema: 'id, fileId, groupId, hash',
    indexes: ['id', 'fileId', 'groupId', 'hash'],
  },
];
