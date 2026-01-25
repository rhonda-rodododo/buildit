/**
 * Friends Module
 *
 * Manages friend relationships, contacts, and social connections.
 * Previously located in src/core/friends/, extracted to module for better modularity.
 */

import type { ModulePlugin } from '@/types/modules';
import { friendsSchema, friendsMigrations, friendsSeeds } from './schema';
import { Users } from 'lucide-react';
import { lazy } from 'react';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import friendsTranslations from './i18n';

// Lazy load ContactsPage to reduce initial bundle size
const ContactsPage = lazy(() => import('./components/ContactsPage').then(m => ({ default: m.ContactsPage })));

/**
 * Friends Module Definition
 *
 * This module provides:
 * - Friend request and acceptance flow
 * - Contact management with trust tiers
 * - Invite links for adding friends
 * - In-person verification
 * - Privacy settings per friend
 */
export const friendsModule: ModulePlugin = {
  metadata: {
    id: 'friends',
    type: 'friends',
    name: 'Friends & Contacts',
    version: '1.0.0',
    description: 'Manage friend relationships, trust levels, and social connections',
    author: 'BuildIt Network',
    icon: Users,
    requiredPermission: 'all',

    dependencies: [
      {
        moduleId: 'messaging',
        relationship: 'recommendedWith',
        reason: 'Friends can send direct messages to each other',
      },
    ],

    providesCapabilities: ['contacts', 'trust-management', 'friend-requests', 'invite-links'],

    capabilities: [
      {
        id: 'contacts',
        name: 'Contact Management',
        description: 'Manage your contacts with tags, notes, and trust levels',
      },
      {
        id: 'trust-management',
        name: 'Trust Tiers',
        description: 'Assign trust levels to contacts (stranger, contact, friend, verified, trusted)',
      },
      {
        id: 'friend-requests',
        name: 'Friend Requests',
        description: 'Send and receive friend requests with optional messages',
      },
      {
        id: 'invite-links',
        name: 'Invite Links',
        description: 'Create shareable invite links to add friends',
      },
    ],

    configSchema: [
      {
        key: 'autoAcceptFromVerified',
        type: 'boolean',
        label: 'Auto-accept from verified contacts',
        description: 'Automatically accept friend requests from contacts you verified in person',
        defaultValue: false,
      },
      {
        key: 'defaultTrustTier',
        type: 'select',
        label: 'Default trust tier for new friends',
        description: 'Trust level assigned to newly accepted friends',
        options: [
          { value: 'stranger', label: 'Stranger' },
          { value: 'contact', label: 'Contact' },
          { value: 'friend', label: 'Friend' },
        ],
        defaultValue: 'contact',
      },
      {
        key: 'inviteLinkExpiry',
        type: 'select',
        label: 'Default invite link expiry',
        description: 'How long invite links are valid by default',
        options: [
          { value: '1d', label: '1 day' },
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
          { value: 'never', label: 'Never expire' },
        ],
        defaultValue: '7d',
      },
    ],
  },

  // App-scoped route for Friends page
  routes: [
    {
      path: 'friends',
      component: ContactsPage,
      scope: 'app',
      label: 'Friends',
    },
  ],

  // Register translations when module loads
  lifecycle: {
    onRegister: async () => {
      registerModuleTranslations('friends', friendsTranslations);
    },
  },

  // Schema is always loaded (modules are loaded at init)
  schema: friendsSchema,

  // Migrations for version upgrades
  migrations: friendsMigrations,

  // Seed data for demo/testing
  seeds: [
    {
      name: 'friends-demo',
      description: 'Example friends and requests for demo purposes',
      data: async (db, _groupId, userPubkey) => {
        // Seed friends for the current user
        const seedFriends = friendsSeeds.friends.map((f) => ({
          ...f,
          id: `${f.id}-${userPubkey.substring(0, 8)}`,
          userPubkey,
        }));

        for (const friend of seedFriends) {
          await db.friends.put(friend);
        }

        // Seed friend requests
        const seedRequests = friendsSeeds.friendRequests.map((r) => ({
          ...r,
          id: `${r.id}-${userPubkey.substring(0, 8)}`,
          toPubkey: userPubkey,
        }));

        for (const request of seedRequests) {
          await db.friendRequests.put(request);
        }

        // Seed invite links
        const seedInvites = friendsSeeds.friendInviteLinks.map((i) => ({
          ...i,
          id: `${i.id}-${userPubkey.substring(0, 8)}`,
          creatorPubkey: userPubkey,
        }));

        for (const invite of seedInvites) {
          await db.friendInviteLinks.put(invite);
        }
      },
    },
  ],

  getDefaultConfig: () => ({
    autoAcceptFromVerified: false,
    defaultTrustTier: 'contact',
    inviteLinkExpiry: '7d',
  }),
};

// Re-export types and utilities
export * from './types';
export * from './friendsStore';

export default friendsModule;
