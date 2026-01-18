/**
 * Media Collective Template
 *
 * For community journalism organizations operating as democratic collectives.
 * Includes publishing, newsletters, governance, and collaboration tools.
 *
 * Inspired by Indymedia: local autonomy, syndication networks, democratic governance.
 */

import type { GroupTemplate } from '../types';

export const MEDIA_COLLECTIVE_TEMPLATE: GroupTemplate = {
  id: 'media-collective',
  name: 'Media Collective',
  description:
    'Community journalism with democratic self-governance. Publish articles, syndicate to networks, and make decisions together.',
  icon: '📰',
  category: 'civic',
  complexity: 5,
  tags: ['journalism', 'media', 'publishing', 'collective', 'democracy', 'news', 'newsletter'],
  defaultPrivacy: 'private',

  modules: [
    // Publishing - Core editorial workflow
    {
      moduleId: 'publishing',
      enabled: true,
      required: true,
      config: {
        editorialStyle: 'editorial-collective',
        editorialWorkflow: {
          enabled: true,
          requireApproval: true,
          approvalRoles: ['editor', 'admin'],
          allowSelfPublish: false,
        },
        syndication: {
          enabled: true,
          acceptSyndication: true,
          defaultDelay: 24, // hours before syndication
        },
        attribution: {
          multiAuthor: true,
          requireByline: true,
          showCollective: true,
        },
      },
    },

    // Newsletters - Subscriber communication
    {
      moduleId: 'newsletters',
      enabled: true,
      required: true,
      config: {
        defaultFrequency: 'weekly',
        allowPublicSubscription: true,
        doubleOptIn: true,
      },
    },

    // Governance - Collective decision-making
    {
      moduleId: 'governance',
      enabled: true,
      required: true,
      config: {
        defaultVotingSystem: 'consensus',
        quorumRequired: true,
        defaultQuorum: 66,
        proposalTemplates: 'media-collective',
        enableAnonymousVoting: false,
      },
    },

    // Documents - Collaborative drafting
    {
      moduleId: 'documents',
      enabled: true,
      required: true,
      config: {
        enableVersionHistory: true,
        enableComments: true,
        enableSuggestions: true,
      },
    },

    // Wiki - Style guides, policies, resources
    {
      moduleId: 'wiki',
      enabled: true,
      config: {
        categories: ['Style Guide', 'Policies', 'Resources', 'Contacts'],
      },
    },

    // Database - Editorial calendar, story tracking
    {
      moduleId: 'database',
      enabled: true,
      config: {
        defaultViews: ['board', 'calendar'],
        enablePMIntegration: true,
      },
    },

    // Public - Public-facing pages
    {
      moduleId: 'public',
      enabled: true,
      required: true,
      config: {
        enablePublicFeed: true,
        enableAboutPage: true,
        enableContactForm: true,
      },
    },

    // Messaging - Internal coordination
    {
      moduleId: 'messaging',
      enabled: true,
      required: true,
    },
  ],

  enhancements: [
    {
      id: 'open-newsroom',
      name: 'Open Newsroom',
      description: 'Accept public story submissions from the community',
      icon: '📥',
      modules: [
        {
          moduleId: 'forms',
          enabled: true,
          config: {
            templates: ['story-pitch', 'news-tip', 'letter-to-editor'],
          },
        },
      ],
    },
    {
      id: 'wire-service',
      name: 'Wire Service Mode',
      description: 'Aggregate and republish stories from other collectives',
      icon: '📡',
      modules: [
        {
          moduleId: 'publishing',
          enabled: true,
          config: {
            wireServiceMode: true,
            aggregateSources: [],
            curateIncoming: true,
          },
        },
      ],
    },
    {
      id: 'events',
      name: 'Events & Press Conferences',
      description: 'Organize press events, community meetings, and coverage coordination',
      icon: '📅',
      modules: [
        {
          moduleId: 'events',
          enabled: true,
          config: {
            allowPublicEvents: true,
            enableRSVP: true,
            categories: ['Press Conference', 'Community Meeting', 'Coverage', 'Training'],
          },
        },
      ],
    },
    {
      id: 'mutual-aid',
      name: 'Community Resources',
      description: 'Connect readers with community resources and mutual aid',
      icon: '🤝',
      modules: [
        {
          moduleId: 'mutual-aid',
          enabled: true,
        },
      ],
    },
    {
      id: 'microblogging',
      name: 'Breaking News Updates',
      description: 'Post quick updates, breaking news, and social media-style content',
      icon: '⚡',
      modules: [
        {
          moduleId: 'microblogging',
          enabled: true,
          config: {
            enableThreads: true,
            enableCrossPosting: true,
          },
        },
      ],
    },
    {
      id: 'fundraising',
      name: 'Fundraising & Membership',
      description: 'Accept donations and manage memberships',
      icon: '💰',
      modules: [
        {
          moduleId: 'fundraising',
          enabled: true,
          config: {
            enableMemberships: true,
            enableOneTimeDonations: true,
            enableArticleTips: true,
          },
        },
      ],
    },
  ],

  defaultChannels: [
    {
      name: 'general',
      description: 'General collective discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'editorial',
      description: 'Editorial planning and article discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'pitches',
      description: 'Story pitches and ideas',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'governance',
      description: 'Collective decisions and proposals',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'announcements',
      description: 'Public announcements',
      type: 'announcement',
      privacy: 'public',
    },
  ],

  defaultRoles: [
    {
      name: 'Editor',
      description: 'Reviews and approves articles for publication',
      color: '#10B981',
      permissions: [
        'review_articles',
        'approve_articles',
        'edit_articles',
        'create_proposals',
        'manage_events',
      ],
    },
    {
      name: 'Writer',
      description: 'Creates articles and submits for review',
      color: '#3B82F6',
      permissions: ['create_articles', 'submit_for_review', 'post_messages'],
    },
    {
      name: 'Copy Editor',
      description: 'Edits articles for style, grammar, and clarity',
      color: '#8B5CF6',
      permissions: ['edit_articles', 'add_comments'],
    },
    {
      name: 'Publisher',
      description: 'Publishes approved articles and manages scheduling',
      color: '#F59E0B',
      permissions: ['publish_articles', 'schedule_articles', 'manage_syndication'],
    },
    {
      name: 'Newsletter Editor',
      description: 'Curates and sends newsletters',
      color: '#EC4899',
      permissions: ['edit_newsletters', 'send_newsletters', 'manage_subscribers'],
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description:
      'Includes sample articles, a draft in review, newsletter template, governance proposals, and style guide wiki',
    seeds: [
      'publishing-demo',
      'newsletters-demo',
      'governance-media-demo',
      'wiki-styleguide-demo',
      'database-editorial-calendar-demo',
    ],
  },

  defaultSettings: {
    discoverable: true,
    requireApproval: true,
    allowInvites: true,
  },

  i18nKey: 'templates.mediaCollective',
};

export default MEDIA_COLLECTIVE_TEMPLATE;
