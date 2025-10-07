/**
 * Documents Module Database Schema
 * Contains all database table definitions for the documents module
 */

import type { TableSchema } from '@/types/modules';

export const documentsSchema: TableSchema[] = [
  {
    name: 'documents',
    schema: 'id, groupId, [groupId+updatedAt]',
    indexes: ['id', 'groupId', '[groupId+updatedAt]'],
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
];
