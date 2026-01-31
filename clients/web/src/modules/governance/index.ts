/**
 * Governance Module
 * Proposals, voting systems, and decision-making
 */

import type { ModulePlugin } from '@/types/modules';
import { governanceSchema } from './schema';
import { governanceSeeds } from './seeds';

import { Vote } from 'lucide-react';
import { lazy } from 'react';
import { logger } from '@/lib/logger';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import governanceTranslations from './i18n';

// Lazy load GovernanceView to reduce initial bundle size
const GovernanceView = lazy(() => import('./components/GovernanceView').then(m => ({ default: m.GovernanceView })));

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
        defaultValue: 'simple-majority',
        options: [
          { label: 'Simple Majority (Yes/No/Abstain)', value: 'simple-majority' },
          { label: 'Supermajority', value: 'supermajority' },
          { label: 'Ranked Choice', value: 'ranked-choice' },
          { label: 'Approval Voting', value: 'approval' },
          { label: 'Quadratic Voting', value: 'quadratic' },
          { label: "D'Hondt Method", value: 'd-hondt' },
          { label: 'Consensus', value: 'consensus' },
          { label: 'Modified Consensus', value: 'modified-consensus' },
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
      registerModuleTranslations('governance', governanceTranslations);
      logger.info('🗳️ Governance module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      logger.info(`🗳️ Governance module enabled for group ${groupId}`, config);
    },
    onDisable: async (groupId: string) => {
      logger.info(`🗳️ Governance module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: 'governance',
      component: GovernanceView,
      scope: 'app',
      label: 'Governance',
    },
    {
      path: 'governance',
      component: GovernanceView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Governance',
    },
  ],

  schema: governanceSchema,

  migrations: [
    {
      version: 1,
      description: 'Initial governance schema',
      migrate: async () => {
        logger.info('Governance migration v1: Initial schema');
      },
    },
  ],

  seeds: governanceSeeds,

  getDefaultConfig: () => ({
    defaultVotingMethod: 'simple-majority',
    quorumPercentage: 50,
    allowAnonymousVoting: true,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    const validMethods = ['simple-majority', 'supermajority', 'ranked-choice', 'approval', 'quadratic', 'd-hondt', 'consensus', 'modified-consensus'];
    if (!validMethods.includes(config.defaultVotingMethod as string))
      return false;
    if (typeof config.quorumPercentage !== 'number') return false;
    if (config.quorumPercentage < 0 || config.quorumPercentage > 100) return false;
    if (typeof config.allowAnonymousVoting !== 'boolean') return false;
    return true;
  },
};

export default governanceModule;
