import type { ModulePlugin } from '@/types/modules';

// Placeholder component
const MutualAidPlaceholder = () => <div>Mutual Aid Module (Coming Soon)</div>;

/**
 * Mutual Aid Module
 * Resource request/offer system, solidarity network
 */
export const MutualAidModule: ModulePlugin = {
  metadata: {
    id: 'mutual-aid',
    type: 'mutual-aid',
    name: 'Mutual Aid',
    description: 'Community resource sharing, request/offer matching, solidarity network',
    version: '1.0.0',
    author: 'BuildN',
    icon: 'Heart',
    capabilities: [
      {
        id: 'requests',
        name: 'Aid Requests',
        description: 'Post requests for resources or assistance',
      },
      {
        id: 'offers',
        name: 'Aid Offers',
        description: 'Offer resources or assistance to others',
      },
      {
        id: 'matching',
        name: 'Request Matching',
        description: 'Automatic matching of requests with offers',
      },
      {
        id: 'rideshare',
        name: 'Solidarity Rideshare',
        description: 'Community rideshare network',
      },
    ],
    configSchema: [
      {
        key: 'categories',
        label: 'Aid Categories',
        type: 'multiselect',
        defaultValue: ['food', 'housing', 'transport', 'skills', 'supplies'],
        options: [
          { label: 'Food', value: 'food' },
          { label: 'Housing', value: 'housing' },
          { label: 'Transport', value: 'transport' },
          { label: 'Skills', value: 'skills' },
          { label: 'Supplies', value: 'supplies' },
          { label: 'Medical', value: 'medical' },
          { label: 'Legal', value: 'legal' },
          { label: 'Childcare', value: 'childcare' },
        ],
        description: 'Available aid categories for this group',
      },
      {
        key: 'requireVerification',
        label: 'Require Verification',
        type: 'boolean',
        defaultValue: false,
        description: 'Require moderator verification of aid requests',
      },
      {
        key: 'enableRideshare',
        label: 'Enable Rideshare',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable solidarity rideshare features',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onEnable: async (groupId, config) => {
      console.log(`Mutual Aid module enabled for group ${groupId}`, config);
    },

    onDisable: async (groupId) => {
      console.log(`Mutual Aid module disabled for group ${groupId}`);
    },
  },

  routes: [
    {
      path: '/groups/:groupId/mutual-aid',
      component: MutualAidPlaceholder,
      exact: true,
    },
  ],

  getDefaultConfig: () => ({
    categories: ['food', 'housing', 'transport', 'skills', 'supplies'],
    requireVerification: false,
    enableRideshare: true,
  }),

  validateConfig: (config) => {
    if (!Array.isArray(config.categories)) {
      return false;
    }
    if (typeof config.requireVerification !== 'boolean') {
      return false;
    }
    if (typeof config.enableRideshare !== 'boolean') {
      return false;
    }
    return true;
  },
};
