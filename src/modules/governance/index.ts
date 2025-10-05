/**
 * Governance Module
 * Proposals, voting systems, and decision-making
 */

import type { ModulePlugin } from '@/types/modules';
import { governanceSchema } from './schema';
import { governanceSeeds } from './seeds';
import type { BuildItDB } from '@/core/storage/db';
import { Vote } from 'lucide-react';

/**
 * Governance Module Plugin
 */
export const governanceModule: ModulePlugin = {
  metadata: {
    id: 'governance',
    type: 'governance',
    name: 'Governance',
    description: 'Democratic decision-making with multiple voting systems',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: Vote,
    capabilities: [
      {
        id: 'proposal-creation',
        name: 'Proposal Creation',
        description: 'Create and manage proposals',
        requiresPermission: ['member'],
      },
      {
        id: 'voting',
        name: 'Voting',
        description: 'Vote on proposals',
        requiresPermission: ['all'],
      },
      {
        id: 'voting-methods',
        name: 'Voting Methods',
        description: 'Support for multiple voting systems (simple, ranked-choice, quadratic, consensus)',
        requiresPermission: ['admin'],
      },
    ],
    configSchema: [
      {
        key: 'defaultVotingMethod',
        label: 'Default Voting Method',
        type: 'select',
        defaultValue: 'simple',
        options: [
          { label: 'Simple (Yes/No/Abstain)', value: 'simple' },
          { label: 'Ranked Choice', value: 'ranked-choice' },
          { label: 'Quadratic Voting', value: 'quadratic' },
          { label: "D'Hondt Method", value: 'dhondt' },
          { label: 'Consensus', value: 'consensus' },
        ],
      },
      {
        key: 'quorumPercentage',
        label: 'Quorum Percentage',
        type: 'number',
        defaultValue: 50,
        description: 'Minimum percentage of members required to vote',
      },
      {
        key: 'allowAnonymousVoting',
        label: 'Allow Anonymous Voting',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to cast anonymous ballots',
      },
    ],
    requiredPermission: 'all',
  },

  lifecycle: {
    onRegister: async () => {
      console.log('Governance module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      console.log(`Governance module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      console.log(`Governance module disabled for group ${groupId}`);
    },
  },

  schema: governanceSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial governance schema',
      migrate: async (_db: BuildItDB) => {
        console.log('Governance migration v1: Initial schema');
      },
    },
  ],

  seeds: governanceSeeds,

  getDefaultConfig: () => ({
    defaultVotingMethod: 'simple',
    quorumPercentage: 50,
    allowAnonymousVoting: true,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (!['simple', 'ranked-choice', 'quadratic', 'dhondt', 'consensus'].includes(config.defaultVotingMethod as string))
      return false;
    if (typeof config.quorumPercentage !== 'number') return false;
    if (config.quorumPercentage < 0 || config.quorumPercentage > 100) return false;
    if (typeof config.allowAnonymousVoting !== 'boolean') return false;
    return true;
  },
};

export default governanceModule;
