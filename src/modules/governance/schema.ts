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
  status: 'draft' | 'discussion' | 'voting' | 'decided';
  votingMethod: 'simple' | 'ranked-choice' | 'quadratic' | 'dhondt' | 'consensus';
  votingDeadline?: number;
  createdBy: string;
  created: number;
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
    schema: 'id, groupId, status, created, createdBy',
    indexes: ['id', 'groupId', 'status', 'created', 'createdBy'],
  },
  {
    name: 'votes',
    schema: '++id, [proposalId+voterPubkey], proposalId, voterPubkey',
    indexes: ['++id', '[proposalId+voterPubkey]', 'proposalId', 'voterPubkey'],
  },
];

// Note: DBProposal and DBVote are already exported from @/core/storage/db
// No need to re-export them here
