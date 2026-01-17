/**
 * Mutual Aid Module Seed Data
 * Provides example/template data for the mutual aid module
 */

import type { ModuleSeed } from '@/types/modules';
import type { DBMutualAidRequest } from './schema';

/**
 * Seed data for mutual aid module
 */
export const mutualAidSeeds: ModuleSeed[] = [
  {
    name: 'comprehensive-mutual-aid',
    description: 'Comprehensive mutual aid examples covering all categories and scenarios',
    data: async (db, groupId, userPubkey) => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      const exampleRequests: DBMutualAidRequest[] = [
        // FOOD CATEGORY
        {
          id: `ma-food-request-1-${groupId}`,
          groupId,
          type: 'request',
          category: 'food',
          title: 'Food for Family in Need',
          description: 'Family of 4 in need of groceries this week. Open to non-perishables, fresh produce, or grocery gift cards. Dietary needs: vegetarian household.',
          status: 'open',
          location: 'East Side neighborhood',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 3 * day,
        },
        {
          id: `ma-food-offer-1-${groupId}`,
          groupId,
          type: 'offer',
          category: 'food',
          title: 'Community Garden Produce Share',
          description: 'Excess vegetables from community garden. Have tomatoes, zucchini, herbs. Free to anyone who needs. Pick up only.',
          status: 'open',
          location: 'Community Garden, 5th Ave',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 2 * day,
        },

        // HOUSING CATEGORY
        {
          id: `ma-housing-request-1-${groupId}`,
          groupId,
          type: 'request',
          category: 'housing',
          title: 'Temporary Housing Needed',
          description: 'Comrade facing eviction needs temporary housing for 2-4 weeks while finding permanent place. Quiet, responsible, can help with chores/costs.',
          status: 'open',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 10 * day,
        },
        {
          id: `ma-housing-offer-1-${groupId}`,
          groupId,
          type: 'offer',
          category: 'housing',
          title: 'Spare Room Available',
          description: 'Have a spare room available for activists/organizers passing through or in crisis. Max 1 week, LGBTQ+ friendly, smoke-free home.',
          status: 'open',
          location: 'North District',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 30 * day,
        },

        // TRANSPORT CATEGORY
        {
          id: `ma-transport-request-1-${groupId}`,
          groupId,
          type: 'request',
          category: 'transport',
          title: 'Ride to Medical Appointment',
          description: 'Need ride to medical appointment next Tuesday 2pm. From Riverside to County Hospital. Can contribute gas money.',
          status: 'open',
          location: 'Riverside area',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 5 * day,
        },
        {
          id: `ma-transport-offer-1-${groupId}`,
          groupId,
          type: 'offer',
          category: 'transport',
          title: 'Solidarity Rideshare Network',
          description: 'Available for rides to protests, mutual aid deliveries, or emergency transportation. Van seats 6. Signal contact in DM.',
          status: 'open',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 60 * day,
        },

        // SKILLS CATEGORY
        {
          id: `ma-skills-request-1-${groupId}`,
          groupId,
          type: 'request',
          category: 'skills',
          title: 'Web Developer for Nonprofit Project',
          description: 'Local housing rights org needs help setting up a simple website. Looking for volunteer web dev with React experience. ~10-15 hours work.',
          status: 'open',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 14 * day,
        },
        {
          id: `ma-skills-offer-1-${groupId}`,
          groupId,
          type: 'offer',
          category: 'skills',
          title: 'Free Legal Consultations',
          description: 'Lawyer offering free 30-min consultations for activists facing charges, evictions, or workplace issues. Not full representation but can advise on options.',
          status: 'open',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 90 * day,
        },
        {
          id: `ma-skills-offer-2-${groupId}`,
          groupId,
          type: 'offer',
          category: 'skills',
          title: 'Graphic Design for Movement Orgs',
          description: 'Can create flyers, social media graphics, logos for grassroots organizations. Free for community groups, sliding scale for nonprofits.',
          status: 'open',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 120 * day,
        },

        // CHILDCARE CATEGORY
        {
          id: `ma-childcare-request-1-${groupId}`,
          groupId,
          type: 'request',
          category: 'childcare',
          title: 'Childcare During Meeting',
          description: 'Need childcare for 2 kids (ages 3 & 6) during monthly strategy meeting, 2 hours. Will reciprocate!',
          status: 'open',
          location: 'Community Center area',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 7 * day,
        },
        {
          id: `ma-childcare-offer-1-${groupId}`,
          groupId,
          type: 'offer',
          category: 'childcare',
          title: 'Childcare Collective',
          description: 'Group of parents offering collective childcare swaps. Join us to share care duties so we can all stay involved in organizing work.',
          status: 'open',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 180 * day,
        },

        // SUPPLIES/EQUIPMENT
        {
          id: `ma-supplies-request-1-${groupId}`,
          groupId,
          type: 'request',
          category: 'supplies',
          title: 'Sound System for Rally',
          description: 'Need to borrow PA system/megaphone for rally this weekend. Will take good care of it and return promptly.',
          status: 'open',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 4 * day,
        },
        {
          id: `ma-supplies-offer-1-${groupId}`,
          groupId,
          type: 'offer',
          category: 'supplies',
          title: 'Protest Supplies Available',
          description: 'Have extra signs, markers, first aid kits, water bottles for protests. Free to movement folks. DM to coordinate pickup.',
          status: 'open',
          location: 'West Side',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 30 * day,
        },

        // FINANCIAL ASSISTANCE
        {
          id: `ma-financial-request-1-${groupId}`,
          groupId,
          type: 'request',
          category: 'financial',
          title: 'Bail Fund Assistance',
          description: 'Comrade arrested at protest needs bail assistance. $500 needed. Will pay forward when able. Venmo/CashApp accepted.',
          status: 'matched',
          createdBy: userPubkey,
          created: now - 2 * day,
          expiresAt: now + 1 * day,
        },
        {
          id: `ma-financial-offer-1-${groupId}`,
          groupId,
          type: 'offer',
          category: 'financial',
          title: 'Solidarity Fund Contributions',
          description: 'Have some extra funds available for comrades in crisis. Can help with rent, utilities, medical bills on case-by-case basis. DM for confidential request.',
          status: 'open',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 90 * day,
        },

        // EMOTIONAL SUPPORT
        {
          id: `ma-support-offer-1-${groupId}`,
          groupId,
          type: 'offer',
          category: 'support',
          title: 'Peer Support & Check-ins',
          description: 'Licensed counselor offering free peer support sessions for activists dealing with burnout, trauma, or mental health struggles. Sliding scale therapy also available.',
          status: 'open',
          createdBy: userPubkey,
          created: now,
          expiresAt: now + 365 * day,
        },
      ];

      await db.mutualAidRequests?.bulkAdd(exampleRequests);
      console.info(`Seeded ${exampleRequests.length} mutual aid items for group ${groupId}`);
    },
  },
];
