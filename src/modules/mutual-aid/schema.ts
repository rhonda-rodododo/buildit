/**
 * Mutual Aid Module Database Schema
 * Contains all database table definitions for the mutual aid module
 */

import type { TableSchema } from '@/types/modules';

/**
 * Mutual Aid Request/Offer table interface
 */
export interface DBMutualAidRequest {
  id: string; // event id (primary key)
  groupId: string;
  type: 'request' | 'offer';
  category: string; // food, housing, transport, skills, etc.
  title: string;
  description: string;
  status: 'open' | 'matched' | 'fulfilled' | 'closed';
  location?: string;
  createdBy: string;
  created: number;
  expiresAt?: number;
}

/**
 * Mutual Aid module schema definition
 */
export const mutualAidSchema: TableSchema[] = [
  {
    name: 'mutualAidRequests',
    schema: 'id, groupId, type, category, status, created, createdBy',
    indexes: ['id', 'groupId', 'type', 'category', 'status', 'created', 'createdBy'],
  },
];

// Note: DBMutualAidRequest is already exported from @/core/storage/db
// No need to re-export it here
