/**
 * Events Module Seed Data
 * Provides example/template data for the events module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBEvent, DBRSVP } from './schema';

/**
 * Seed data for events module
 * Can be used for demos, testing, or providing templates
 */
export const eventsSeeds: ModuleSeed[] = [
  {
    name: 'realistic-events',
    description: 'Comprehensive event examples covering all privacy levels and event types',
    data: async (db, groupId, userPubkey) => {
      const now = Date.now();
      const hour = 60 * 60 * 1000;
      const day = 24 * hour;

      const exampleEvents: DBEvent[] = [
        // Public events
        {
          id: `event-public-rally-${groupId}`,
          groupId,
          title: 'Climate Justice Rally',
          description: 'Join us at City Hall for a peaceful demonstration demanding climate action. Bring signs, invite friends, and make your voice heard!',
          startTime: now + 5 * day,
          endTime: now + 5 * day + 3 * hour,
          location: 'City Hall Steps, Downtown',
          privacy: 'public',
          capacity: 500,
          createdBy: userPubkey,
          createdAt: now,
          updatedAt: now,
          tags: 'protest,rally,climate,public-action',
        },
        {
          id: `event-public-workshop-${groupId}`,
          groupId,
          title: 'Community Organizing 101',
          description: 'Free workshop on grassroots organizing fundamentals: building power, coalition work, campaign strategy. Open to all.',
          startTime: now + 10 * day,
          endTime: now + 10 * day + 4 * hour,
          location: 'Public Library Meeting Room A',
          privacy: 'public',
          capacity: 30,
          createdBy: userPubkey,
          createdAt: now,
          updatedAt: now,
          tags: 'workshop,education,organizing,training',
        },

        // Group-only events
        {
          id: `event-group-meeting-${groupId}`,
          groupId,
          title: 'Monthly Strategy Meeting',
          description: 'Members-only monthly meeting to discuss ongoing campaigns, plan upcoming actions, and coordinate efforts. Agenda will be posted 2 days before.',
          startTime: now + 7 * day,
          endTime: now + 7 * day + 2 * hour,
          location: 'Community Center, Room 204',
          privacy: 'group',
          createdBy: userPubkey,
          createdAt: now,
          updatedAt: now,
          tags: 'meeting,strategy,planning,internal',
        },
        {
          id: `event-group-skillshare-${groupId}`,
          groupId,
          title: 'Security Culture & Digital Safety',
          description: 'Members-only workshop on maintaining security culture, digital hygiene, and protecting ourselves and our movements.',
          startTime: now + 12 * day,
          endTime: now + 12 * day + 3 * hour,
          location: 'TBD - will be shared via encrypted channel',
          privacy: 'group',
          capacity: 20,
          createdBy: userPubkey,
          createdAt: now,
          updatedAt: now,
          tags: 'workshop,security,training,opsec',
        },

        // Private events
        {
          id: `event-private-training-${groupId}`,
          groupId,
          title: 'Legal Observer Training',
          description: 'Private training for designated legal observers. Covers documentation, de-escalation, legal rights, and coordination with NLG.',
          startTime: now + 15 * day,
          endTime: now + 15 * day + 5 * hour,
          location: 'Location shared with registered participants only',
          privacy: 'private',
          capacity: 15,
          createdBy: userPubkey,
          createdAt: now,
          updatedAt: now,
          tags: 'training,legal,nlg,private',
        },

        // Direct action (location reveal on day-of)
        {
          id: `event-direct-action-${groupId}`,
          groupId,
          title: 'Direct Action: Housing Justice',
          description: 'Coordinated action to prevent an eviction. This is a direct action event - location will be revealed 2 hours before start time. Be prepared for possible arrests. Know your rights.',
          startTime: now + 20 * day,
          endTime: now + 20 * day + 4 * hour,
          location: 'Location to be revealed 2 hours before',
          locationRevealTime: now + 20 * day - 2 * hour,
          privacy: 'direct-action',
          capacity: 50,
          createdBy: userPubkey,
          createdAt: now,
          updatedAt: now,
          tags: 'direct-action,housing,eviction-defense,high-risk',
        },

        // More diverse event types
        {
          id: `event-mutual-aid-${groupId}`,
          groupId,
          title: 'Community Meal Prep & Distribution',
          description: 'Help prepare and distribute free meals to our neighbors. All welcome! We provide food, containers, and supplies.',
          startTime: now + 3 * day,
          endTime: now + 3 * day + 4 * hour,
          location: 'Community Kitchen, 123 Oak Street',
          privacy: 'public',
          createdBy: userPubkey,
          createdAt: now,
          updatedAt: now,
          tags: 'mutual-aid,food,community,volunteering',
        },
        {
          id: `event-social-${groupId}`,
          groupId,
          title: 'Movement Social & Potluck',
          description: 'Casual social gathering for members and allies. Bring a dish to share, meet fellow organizers, decompress, and build community.',
          startTime: now + 18 * day,
          endTime: now + 18 * day + 3 * hour,
          location: 'Riverside Park Pavilion',
          privacy: 'group',
          createdBy: userPubkey,
          createdAt: now,
          updatedAt: now,
          tags: 'social,community,networking,potluck',
        },
        {
          id: `event-campaign-${groupId}`,
          groupId,
          title: 'Canvassing Day: Rent Control Campaign',
          description: 'Door-to-door canvassing to build support for rent control ballot initiative. Training provided. We\'ll split into teams and cover key neighborhoods.',
          startTime: now + 8 * day,
          endTime: now + 8 * day + 5 * hour,
          location: 'Meet at Campaign HQ, 456 Market St',
          privacy: 'public',
          capacity: 40,
          createdBy: userPubkey,
          createdAt: now,
          updatedAt: now,
          tags: 'canvassing,campaign,outreach,electoral',
        },
      ];

      // Sample RSVPs
      const exampleRSVPs: DBRSVP[] = [
        {
          eventId: `event-public-rally-${groupId}`,
          userPubkey,
          status: 'going',
          timestamp: now,
          note: 'Bringing a sound system!',
        },
        {
          eventId: `event-group-meeting-${groupId}`,
          userPubkey,
          status: 'going',
          timestamp: now,
        },
        {
          eventId: `event-public-workshop-${groupId}`,
          userPubkey,
          status: 'maybe',
          timestamp: now,
          note: 'Depends on work schedule',
        },
      ];

      // Insert seed data
      await db.events?.bulkAdd(exampleEvents);
      await db.rsvps?.bulkAdd(exampleRSVPs);
      console.info(`Seeded ${exampleEvents.length} events and ${exampleRSVPs.length} RSVPs for group ${groupId}`);
    },
  },
];
