/**
 * Governance Module Database Schema
 * Contains all database table definitions for the governance module
 */

import type { TableSchema } from '@/types/modules';

/**
 * Proposal table interface
 */
export interface DBProposal {
  id: string; // event id (primary key)
  groupId: string;
  title: string;
  description: string;
  authorPubkey: string; // Changed from createdBy to match types.ts
  status: 'draft' | 'discussion' | 'voting' | 'decided' | 'cancelled'; // Added 'cancelled'
  votingMethod: 'simple' | 'ranked-choice' | 'quadratic' | 'dhondt' | 'consensus';
  votingDeadline?: number;
  created: number;
  updated: number; // Added to match types.ts
}

/**
 * Vote table interface
 */
export interface DBVote {
  id?: number; // auto-increment
  proposalId: string;
  voterPubkey: string;
  encryptedBallot: string;
  timestamp: number;
}

/**
 * Governance module schema definition
 */
export const governanceSchema: TableSchema[] = [
  {
    name: 'proposals',
    schema: 'id, groupId, status, created, updated, authorPubkey',
    indexes: ['id', 'groupId', 'status', 'created', 'updated', 'authorPubkey'],
  },
  {
    name: 'votes',
    schema: '++id, [proposalId+voterPubkey], proposalId, voterPubkey',
    indexes: ['++id', '[proposalId+voterPubkey]', 'proposalId', 'voterPubkey'],
  },
];

// Note: DBProposal and DBVote are already exported from @/core/storage/db
// No need to re-export them here
