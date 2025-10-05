import type { ModulePlugin } from '@/types/modules';
import GovernanceDashboard from '@/components/governance/GovernanceDashboard';
import { governanceSchema } from './schema';
import { governanceMigrations } from './migrations';
import { governanceSeeds } from './seeds';

/**
 * Governance Module
 * Proposals, voting systems, decision making
 */
export const GovernanceModule: ModulePlugin = {
  schema: governanceSchema,
  migrations: governanceMigrations,
  seeds: governanceSeeds,

  metadata: {
    id: 'governance',
    type: 'governance',
    name: 'Governance & Voting',
    description: 'Create proposals, conduct votes with multiple voting systems, track decisions',
    version: '1.0.0',
    author: 'BuildN',
    icon: 'Vote',
    capabilities: [
      {
        id: 'proposals',
        name: 'Proposals',
        description: 'Create and discuss proposals',
      },
      {
        id: 'voting',
        name: 'Voting Systems',
        description: 'Multiple voting methods (simple, ranked-choice, quadratic, etc.)',
      },
      {
        id: 'anonymous-ballots',
        name: 'Anonymous Ballots',
        description: 'Cast anonymous votes with optional verification',
      },
      {
        id: 'audit-log',
        name: 'Decision Audit Log',
        description: 'Track decision history and outcomes',
      },
    ],
    configSchema: [
      {
        key: 'defaultVotingMethod',
        label: 'Default Voting Method',
        type: 'select',
        defaultValue: 'simple',
        options: [
          { label: 'Simple Majority', value: 'simple' },
          { label: 'Ranked Choice', value: 'ranked-choice' },
          { label: 'Quadratic', value: 'quadratic' },
          { label: "D'Hondt Method", value: 'dhondt' },
          { label: 'Consensus', value: 'consensus' },
        ],
        description: 'Default voting method for new proposals',
      },
      {
        key: 'quorumPercentage',
        label: 'Quorum Percentage',
        type: 'number',
        defaultValue: 50,
        description: 'Minimum participation percentage required',
      },
      {
        key: 'proposalDiscussionDays',
        label: 'Discussion Period (days)',
        type: 'number',
        defaultValue: 7,
        description: 'Required discussion period before voting',
      },
      {
        key: 'enableAnonymousVoting',
        label: 'Enable Anonymous Voting',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow anonymous ballot casting',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onEnable: async (groupId, config) => {
      console.log(`Governance module enabled for group ${groupId}`, config);
    },

    onDisable: async (groupId) => {
      console.log(`Governance module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: '/groups/:groupId/governance',
      component: GovernanceDashboard,
      exact: true,
    },
  ],

  getDefaultConfig: () => ({
    defaultVotingMethod: 'simple',
    quorumPercentage: 50,
    proposalDiscussionDays: 7,
    enableAnonymousVoting: true,
  }),

  validateConfig: (config) => {
    const validMethods = ['simple', 'ranked-choice', 'quadratic', 'dhondt', 'consensus'];
    if (!validMethods.includes(config.defaultVotingMethod as string)) {
      return false;
    }
    if (
      typeof config.quorumPercentage !== 'number' ||
      config.quorumPercentage < 0 ||
      config.quorumPercentage > 100
    ) {
      return false;
    }
    if (typeof config.proposalDiscussionDays !== 'number' || config.proposalDiscussionDays < 0) {
      return false;
    }
    if (typeof config.enableAnonymousVoting !== 'boolean') {
      return false;
    }
    return true;
  },
};
