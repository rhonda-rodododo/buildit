/**
 * Microblogging Module
 * Social posts, reactions, comments, and feed features
 */

import type { ModulePlugin } from '@/types/modules';
import { microbloggingSchema, microbloggingMigrations, microbloggingSeeds } from './schema';
import { MessageSquare } from 'lucide-react';

/**
 * Microblogging Module Plugin
 */
export const microbloggingModule: ModulePlugin = {
  metadata: {
    id: 'microblogging',
    type: 'microblogging',
    name: 'Posts & Feed',
    description: 'Share updates, build community, organize actions with social posts and activity feed',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: MessageSquare,
    capabilities: [
      {
        id: 'create-post',
        name: 'Create Posts',
        description: 'Share text, images, videos, and updates with privacy controls',
        requiresPermission: ['member'],
      },
      {
        id: 'react-comment',
        name: 'React & Comment',
        description: 'Engage with posts through reactions, comments, and discussions',
        requiresPermission: ['member'],
      },
      {
        id: 'repost-share',
        name: 'Repost & Share',
        description: 'Amplify posts through reposts and sharing',
        requiresPermission: ['member'],
      },
      {
        id: 'activity-feed',
        name: 'Activity Feed',
        description: 'Unified feed showing activity from all groups and modules',
        requiresPermission: ['member'],
      },
    ],
    configSchema: [
      {
        key: 'allowPublicPosts',
        label: 'Allow Public Posts',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to create public posts visible outside the group',
      },
      {
        key: 'maxPostLength',
        label: 'Max Post Length',
        type: 'number',
        defaultValue: 5000,
        description: 'Maximum characters allowed per post',
      },
      {
        key: 'allowReposts',
        label: 'Allow Reposts',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow members to repost content',
      },
      {
        key: 'allowAnonymousReactions',
        label: 'Allow Anonymous Reactions',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow reactions without revealing identity',
      },
    ],
    requiredPermission: 'member',
  },

  lifecycle: {
    onRegister: async () => {
      console.log('Microblogging module registered');
    },
    onEnable: async (groupId: string) => {
      console.log(`Microblogging module enabled for group ${groupId}`);
      // Load seed posts for demo
      // TODO: Load microbloggingSeeds.posts into database
    },
    onDisable: async (groupId: string) => {
      console.log(`Microblogging module disabled for group ${groupId}`);
      // Note: Data persists even when disabled (UI-level only)
    },
    onConfigUpdate: async (groupId: string, config: Record<string, unknown>) => {
      console.log(`Microblogging config updated for group ${groupId}:`, config);
    },
  },

  schema: microbloggingSchema,

  migrations: microbloggingMigrations,

  seeds: microbloggingSeeds.posts,

  getDefaultConfig: () => ({
    allowPublicPosts: true,
    maxPostLength: 5000,
    allowReposts: true,
    allowAnonymousReactions: true,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.allowPublicPosts !== 'boolean') return false;
    if (typeof config.maxPostLength !== 'number') return false;
    if (config.maxPostLength < 100 || config.maxPostLength > 50000) return false;
    if (typeof config.allowReposts !== 'boolean') return false;
    if (typeof config.allowAnonymousReactions !== 'boolean') return false;
    return true;
  },
};

export default microbloggingModule;

// Export components
export { PostComposer } from './components/PostComposer';
export { PostCard } from './components/PostCard';

// Export types
export type * from './types';

// Export store
export { usePostsStore } from './postsStore';
