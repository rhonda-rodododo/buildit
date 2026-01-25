/**
 * Documents Module Database Schema
 * Contains all database table definitions for the documents module
 */

import type { TableSchema } from '@/types/modules';

export const documentsSchema: TableSchema[] = [
  {
    name: 'documents',
    schema: 'id, groupId, folderId, [groupId+updatedAt]',
    indexes: ['id', 'groupId', 'folderId', '[groupId+updatedAt]'],
  },
  {
    name: 'documentVersions',
    schema: 'id, documentId, version',
    indexes: ['id', 'documentId', 'version'],
  },
  {
    name: 'documentCollaboration',
    schema: 'documentId, groupId, isActive',
    indexes: ['documentId', 'groupId', 'isActive'],
  },
  // Epic 56: Advanced Document Features
  {
    name: 'documentComments',
    schema: 'id, documentId, parentCommentId, resolved, createdAt',
    indexes: ['id', 'documentId', 'parentCommentId', 'resolved', 'createdAt'],
  },
  {
    name: 'documentSuggestions',
    schema: 'id, documentId, status, createdAt',
    indexes: ['id', 'documentId', 'status', 'createdAt'],
  },
  {
    name: 'documentFolders',
    schema: 'id, groupId, parentFolderId, name',
    indexes: ['id', 'groupId', 'parentFolderId', 'name'],
  },
  {
    name: 'documentShareLinks',
    schema: 'id, documentId, createdByPubkey, expiresAt',
    indexes: ['id', 'documentId', 'createdByPubkey', 'expiresAt'],
  },
  {
    name: 'documentCollaborators',
    schema: '[documentId+userPubkey], documentId, userPubkey, permission',
    indexes: ['[documentId+userPubkey]', 'documentId', 'userPubkey', 'permission'],
  },
  {
    name: 'documentStars',
    schema: '[documentId+userPubkey], documentId, userPubkey, createdAt',
    indexes: ['[documentId+userPubkey]', 'documentId', 'userPubkey', 'createdAt'],
  },
  // Epic 58: Folder permissions for inheritance
  {
    name: 'folderPermissions',
    schema: '[folderId+userPubkey], folderId, groupId, userPubkey',
    indexes: ['[folderId+userPubkey]', 'folderId', 'groupId', 'userPubkey'],
  },
  // Epic 58: Access requests
  {
    name: 'accessRequests',
    schema: 'id, resourceId, resourceType, requesterPubkey, status, createdAt',
    indexes: ['id', 'resourceId', 'resourceType', 'requesterPubkey', 'status', 'createdAt'],
  },
];
