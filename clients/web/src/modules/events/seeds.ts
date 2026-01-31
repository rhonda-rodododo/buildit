/**
 * Events Module Seed Data
 * Provides example/template data for the events module
 */

import type { ModuleSeed } from '@/types/modules';
import { dal } from '@/core/storage/dal';
import type { DBEvent, DBRSVP } from './schema';

import { logger } from '@/lib/logger';

/**
 * Court support events for Movement Legal Defense template
 */
const courtEventsSeed: ModuleSeed = {
  name: 'events-court-demo',
  description: 'Court dates, arraignments, and legal defense events for movement legal defense groups',
  data: async (groupId, userPubkey) => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    const events: DBEvent[] = [
      {
        id: `event-arraignment-1-${groupId}`,
        groupId,
        title: 'Arraignment: Jordan Blake - Housing Sit-In Case',
        description: 'Arraignment hearing for Jordan Blake, arrested at City Hall housing rights sit-in on 1/15. Charges: trespassing, failure to disperse. Attorney: Patricia Hernandez.\n\nCourt support needed: Show up in solidarity, fill the courtroom. Dress code: business casual. No signs inside courthouse.\n\nMeet in the lobby at 8:30am. Bring ID for courthouse security.',
        startTime: now + 10 * day,
        endTime: now + 10 * day + 3 * hour,
        location: 'County Courthouse, Room 4B, 100 Main Street',
        privacy: 'group',
        capacity: 30,
        createdBy: userPubkey,
        createdAt: now - 5 * day,
        updatedAt: now - 1 * day,
        tags: 'court,arraignment,court-support,housing-action',
      },
      {
        id: `event-hearing-1-${groupId}`,
        groupId,
        title: 'Pre-Trial Hearing: Maria Santos - Pipeline Blockade',
        description: 'Pre-trial hearing for Maria Santos, charged with criminal trespass and resisting arrest at pipeline blockade. Attorney: David Chen.\n\nDiscovery motion being filed. Defense requesting body cam footage. Court support important - the judge notices.\n\nMeet outside courthouse at 9am. Buddy system in effect.',
        startTime: now + 5 * day,
        endTime: now + 5 * day + 2 * hour,
        location: 'County Courthouse, Room 2A, 100 Main Street',
        privacy: 'group',
        createdBy: userPubkey,
        createdAt: now - 10 * day,
        updatedAt: now - 3 * day,
        tags: 'court,pre-trial,court-support,climate-action',
      },
      {
        id: `event-lo-training-${groupId}`,
        groupId,
        title: 'Legal Observer Training - Spring Session',
        description: 'NLG legal observer training. Learn how to document police interactions, know your rights, and support protesters from a legal standpoint.\n\nWhat to bring: Notepad, pen, phone with charged battery, water.\n\nTraining covers: documentation protocols, arrest observation, de-escalation, reporting forms, working with attorneys.\n\nOpen to group members only. Must complete training before deployment.',
        startTime: now + 14 * day,
        endTime: now + 14 * day + 5 * hour,
        location: 'Community Law Center, 250 Justice Ave, Room 3',
        privacy: 'group',
        capacity: 20,
        createdBy: userPubkey,
        createdAt: now - 7 * day,
        updatedAt: now - 7 * day,
        tags: 'training,legal-observer,nlg,certification',
      },
      {
        id: `event-kyr-workshop-${groupId}`,
        groupId,
        title: 'Know Your Rights Workshop - Pre-Action Briefing',
        description: 'Mandatory KYR briefing before the upcoming housing action. Covers:\n\n- What to do if stopped by police\n- What to do if arrested\n- Jail support hotline number (memorize it)\n- What NOT to say to police\n- How to invoke your rights\n- Medical and legal contacts\n\nAttend this if you plan to participate in any upcoming actions.',
        startTime: now + 3 * day,
        endTime: now + 3 * day + 2 * hour,
        location: 'Shared via encrypted channel 24hrs before',
        privacy: 'private',
        capacity: 40,
        createdBy: userPubkey,
        createdAt: now - 2 * day,
        updatedAt: now - 2 * day,
        tags: 'workshop,know-your-rights,pre-action,mandatory',
      },
      {
        id: `event-jail-support-debrief-${groupId}`,
        groupId,
        title: 'Jail Support Team Debrief',
        description: 'Debrief from the January 15th housing sit-in arrests. Review what went well, what to improve.\n\nTopics:\n- Hotline call volume and response times\n- Arraignment support coordination\n- Communication gaps\n- Emotional support check-in for hotline operators\n\nAll jail support volunteers should attend.',
        startTime: now + 2 * day,
        endTime: now + 2 * day + 90 * 60 * 1000,
        location: 'Community Center, Room 12',
        privacy: 'group',
        createdBy: userPubkey,
        createdAt: now - 1 * day,
        updatedAt: now - 1 * day,
        tags: 'debrief,jail-support,internal,review',
      },
    ];

    const rsvps: DBRSVP[] = [
      {
        eventId: `event-arraignment-1-${groupId}`,
        userPubkey,
        status: 'going',
        timestamp: now,
        note: 'Will be there to coordinate court support team',
      },
      {
        eventId: `event-lo-training-${groupId}`,
        userPubkey,
        status: 'going',
        timestamp: now,
      },
      {
        eventId: `event-kyr-workshop-${groupId}`,
        userPubkey,
        status: 'going',
        timestamp: now,
      },
    ];

    await dal.bulkPut('events', events);
    await dal.bulkPut('rsvps', rsvps);
    logger.info(`Seeded ${events.length} court/legal events for group ${groupId}`);
  },
};

/**
 * Community events for community hub and mutual aid templates
 */
const communityEventsSeed: ModuleSeed = {
  name: 'events-community-demo',
  description: 'Community events: potlucks, skill shares, mutual aid distributions, and community meetings',
  data: async (groupId, userPubkey) => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    const events: DBEvent[] = [
      {
        id: `event-community-potluck-${groupId}`,
        groupId,
        title: 'Monthly Community Potluck',
        description: 'Bring a dish to share! A casual gathering to connect with neighbors, share food, and build community. All are welcome. Tables and drinks provided.',
        startTime: now + 7 * day,
        endTime: now + 7 * day + 3 * hour,
        location: 'Riverside Park Pavilion',
        privacy: 'public',
        createdBy: userPubkey,
        createdAt: now - 5 * day,
        updatedAt: now - 5 * day,
        tags: 'social,potluck,community,monthly',
      },
      {
        id: `event-community-skillshare-${groupId}`,
        groupId,
        title: 'Skill Share: Bike Repair & Basic Sewing',
        description: 'Learn practical skills from community members! This month: basic bike repair and clothing mending. Bring your broken stuff and we\'ll fix it together.\n\nTools and materials provided. All skill levels welcome.',
        startTime: now + 12 * day,
        endTime: now + 12 * day + 3 * hour,
        location: 'Community Workshop, 88 Cedar Lane',
        privacy: 'public',
        capacity: 25,
        createdBy: userPubkey,
        createdAt: now - 3 * day,
        updatedAt: now - 3 * day,
        tags: 'skill-share,education,mutual-aid,practical',
      },
      {
        id: `event-community-distribution-${groupId}`,
        groupId,
        title: 'Food & Supply Distribution',
        description: 'Weekly free food and supply distribution. Fresh produce, pantry staples, hygiene products, and warm clothing. No ID or questions asked. Volunteers needed for setup at 9am.',
        startTime: now + 3 * day,
        endTime: now + 3 * day + 4 * hour,
        location: 'Community Center parking lot, 200 Oak Ave',
        privacy: 'public',
        createdBy: userPubkey,
        createdAt: now - 2 * day,
        updatedAt: now - 2 * day,
        tags: 'distribution,food,mutual-aid,weekly',
      },
      {
        id: `event-community-meeting-${groupId}`,
        groupId,
        title: 'Neighborhood Assembly',
        description: 'Monthly open meeting to discuss neighborhood concerns, plan projects, and coordinate mutual aid. Childcare provided. Interpretation available (Spanish/English).',
        startTime: now + 14 * day,
        endTime: now + 14 * day + 2 * hour,
        location: 'Public Library Community Room',
        privacy: 'public',
        createdBy: userPubkey,
        createdAt: now - 7 * day,
        updatedAt: now - 7 * day,
        tags: 'meeting,assembly,neighborhood,monthly',
      },
    ];

    await dal.bulkPut('events', events);
    logger.info(`Seeded ${events.length} community events for group ${groupId}`);
  },
};

/**
 * Action-oriented events for activist collective template
 */
const actionEventsSeed: ModuleSeed = {
  name: 'events-action-demo',
  description: 'Activist events: rallies, direct actions, canvassing, and strategy meetings',
  data: async (groupId, userPubkey) => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    const events: DBEvent[] = [
      {
        id: `event-action-rally-${groupId}`,
        groupId,
        title: 'Climate Justice Rally at City Hall',
        description: 'Mass rally demanding the city declare a climate emergency and divest from fossil fuels. Bring signs, water, and sunscreen. Family friendly.',
        startTime: now + 8 * day,
        endTime: now + 8 * day + 3 * hour,
        location: 'City Hall Steps, Downtown',
        privacy: 'public',
        capacity: 500,
        createdBy: userPubkey,
        createdAt: now - 10 * day,
        updatedAt: now - 3 * day,
        tags: 'rally,climate,public-action,city-hall',
      },
      {
        id: `event-action-canvass-${groupId}`,
        groupId,
        title: 'Canvassing Day: Rent Control Ballot Initiative',
        description: 'Door-to-door canvassing to build support for the rent control ballot measure. Training at 9am, canvassing 10am-2pm. Lunch provided. Work in pairs.',
        startTime: now + 5 * day,
        endTime: now + 5 * day + 5 * hour,
        location: 'Campaign HQ, 456 Market St',
        privacy: 'public',
        capacity: 40,
        createdBy: userPubkey,
        createdAt: now - 7 * day,
        updatedAt: now - 7 * day,
        tags: 'canvassing,campaign,rent-control,outreach',
      },
      {
        id: `event-action-strategy-${groupId}`,
        groupId,
        title: 'Monthly Strategy Meeting',
        description: 'Members-only meeting to review campaign progress, plan next actions, and coordinate with coalition partners. Agenda distributed 48 hours before.',
        startTime: now + 10 * day,
        endTime: now + 10 * day + 2 * hour,
        location: 'Community Center, Room 204',
        privacy: 'group',
        createdBy: userPubkey,
        createdAt: now - 5 * day,
        updatedAt: now - 5 * day,
        tags: 'meeting,strategy,planning,internal',
      },
      {
        id: `event-action-directaction-${groupId}`,
        groupId,
        title: 'Direct Action: Eviction Defense',
        description: 'Coordinated eviction defense. Know Your Rights briefing at start. Be prepared for police presence. Jail support hotline active. Legal observers present.\n\nLocation shared 2 hours before to confirmed attendees only.',
        startTime: now + 4 * day,
        endTime: now + 4 * day + 4 * hour,
        location: 'Location shared with confirmed attendees only',
        privacy: 'private',
        capacity: 50,
        createdBy: userPubkey,
        createdAt: now - 3 * day,
        updatedAt: now - 1 * day,
        tags: 'direct-action,eviction-defense,housing,high-risk',
      },
      {
        id: `event-action-training-${groupId}`,
        groupId,
        title: 'Security Culture & Digital Safety Workshop',
        description: 'Learn to protect yourself and your community. Topics: encrypted communications, social media safety, security culture basics, device security.\n\nBring your phone for hands-on setup.',
        startTime: now + 15 * day,
        endTime: now + 15 * day + 3 * hour,
        location: 'TBD - shared via encrypted channel',
        privacy: 'group',
        capacity: 20,
        createdBy: userPubkey,
        createdAt: now - 5 * day,
        updatedAt: now - 5 * day,
        tags: 'training,security,digital-safety,opsec',
      },
    ];

    await dal.bulkPut('events', events);
    logger.info(`Seeded ${events.length} activist events for group ${groupId}`);
  },
};

/**
 * Union meeting events
 */
const meetingEventsSeed: ModuleSeed = {
  name: 'events-meeting-demo',
  description: 'Union meetings: general membership, steward council, grievance hearings, and organizing meetings',
  data: async (groupId, userPubkey) => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    const events: DBEvent[] = [
      {
        id: `event-meeting-general-${groupId}`,
        groupId,
        title: 'General Membership Meeting',
        description: 'Monthly general membership meeting. Agenda: treasurer\'s report, grievance updates, contract negotiation timeline, new business. Quorum required for votes.',
        startTime: now + 7 * day,
        endTime: now + 7 * day + 2 * hour,
        location: 'Union Hall, 300 Labor Lane',
        privacy: 'group',
        createdBy: userPubkey,
        createdAt: now - 14 * day,
        updatedAt: now - 7 * day,
        tags: 'meeting,membership,monthly,union',
      },
      {
        id: `event-meeting-steward-${groupId}`,
        groupId,
        title: 'Steward Council Meeting',
        description: 'Stewards-only meeting to discuss active grievances, management behavior patterns, and upcoming contract proposals. Bring your grievance logs.',
        startTime: now + 3 * day,
        endTime: now + 3 * day + 90 * 60 * 1000,
        location: 'Union Hall, Back Room',
        privacy: 'private',
        createdBy: userPubkey,
        createdAt: now - 7 * day,
        updatedAt: now - 3 * day,
        tags: 'meeting,stewards,grievances,private',
      },
      {
        id: `event-meeting-newmember-${groupId}`,
        groupId,
        title: 'New Member Orientation',
        description: 'Orientation for new union members. Learn about your rights, the contract, steward system, and how to get involved. Refreshments provided.',
        startTime: now + 12 * day,
        endTime: now + 12 * day + 2 * hour,
        location: 'Union Hall, Main Room',
        privacy: 'group',
        capacity: 30,
        createdBy: userPubkey,
        createdAt: now - 5 * day,
        updatedAt: now - 5 * day,
        tags: 'orientation,new-members,education,union',
      },
    ];

    await dal.bulkPut('events', events);
    logger.info(`Seeded ${events.length} union meeting events for group ${groupId}`);
  },
};

/**
 * Tenant union events
 */
const tenantEventsSeed: ModuleSeed = {
  name: 'events-tenant-demo',
  description: 'Tenant union events: tenant meetings, city council hearings, rent strike actions',
  data: async (groupId, userPubkey) => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    const events: DBEvent[] = [
      {
        id: `event-tenant-meeting-${groupId}`,
        groupId,
        title: 'Riverside Apartments Tenant Meeting',
        description: 'Building-wide meeting to discuss the 40% rent increase and our collective response. Discuss options: negotiation, rent strike, legal action. All tenants welcome.',
        startTime: now + 5 * day,
        endTime: now + 5 * day + 2 * hour,
        location: 'Riverside Community Room, 1st Floor',
        privacy: 'group',
        createdBy: userPubkey,
        createdAt: now - 7 * day,
        updatedAt: now - 3 * day,
        tags: 'meeting,tenant,riverside,rent-increase',
      },
      {
        id: `event-tenant-council-${groupId}`,
        groupId,
        title: 'City Council Hearing: Rent Stabilization',
        description: 'Public hearing on the proposed rent stabilization ordinance. We need to fill the chambers! Sign up to give public comment (2 min each). Wear red for solidarity.',
        startTime: now + 10 * day,
        endTime: now + 10 * day + 3 * hour,
        location: 'City Hall, Council Chambers',
        privacy: 'public',
        createdBy: userPubkey,
        createdAt: now - 10 * day,
        updatedAt: now - 5 * day,
        tags: 'hearing,city-council,rent-stabilization,public-comment',
      },
      {
        id: `event-tenant-eviction-court-${groupId}`,
        groupId,
        title: 'Court Support: Amira Khalil Eviction Hearing',
        description: 'Retaliation eviction hearing for Amira, who reported housing code violations. Show up to support. Meet in lobby at 8:30am. Business casual dress.',
        startTime: now + 21 * day,
        endTime: now + 21 * day + 3 * hour,
        location: 'Housing Court, Room 3B',
        privacy: 'group',
        capacity: 25,
        createdBy: userPubkey,
        createdAt: now - 1 * day,
        updatedAt: now - 1 * day,
        tags: 'court,eviction,court-support,retaliation',
      },
    ];

    await dal.bulkPut('events', events);
    logger.info(`Seeded ${events.length} tenant union events for group ${groupId}`);
  },
};

/**
 * Nonprofit events
 */
const nonprofitEventsSeed: ModuleSeed = {
  name: 'events-nonprofit-demo',
  description: 'Nonprofit events: fundraiser galas, volunteer orientations, board meetings, program events',
  data: async (groupId, userPubkey) => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    const events: DBEvent[] = [
      {
        id: `event-nonprofit-gala-${groupId}`,
        groupId,
        title: 'Annual Spring Fundraiser Gala',
        description: 'Our biggest fundraiser of the year! Dinner, silent auction, and keynote speaker. Tickets $75 individual, $125 couple. Scholarship tickets available.',
        startTime: now + 30 * day,
        endTime: now + 30 * day + 4 * hour,
        location: 'Grand Ballroom, Riverside Hotel',
        privacy: 'public',
        capacity: 200,
        createdBy: userPubkey,
        createdAt: now - 30 * day,
        updatedAt: now - 7 * day,
        tags: 'fundraiser,gala,annual,public',
      },
      {
        id: `event-nonprofit-volunteer-${groupId}`,
        groupId,
        title: 'Volunteer Orientation',
        description: 'New volunteer orientation. Learn about our programs, policies, and how to get involved. Background check required for youth programs.',
        startTime: now + 10 * day,
        endTime: now + 10 * day + 2 * hour,
        location: 'Main Office, 500 Service Ave',
        privacy: 'public',
        capacity: 20,
        createdBy: userPubkey,
        createdAt: now - 14 * day,
        updatedAt: now - 14 * day,
        tags: 'volunteer,orientation,onboarding',
      },
      {
        id: `event-nonprofit-board-${groupId}`,
        groupId,
        title: 'Board of Directors Meeting',
        description: 'Quarterly board meeting. Agenda: financial review, program updates, strategic plan progress, grant pipeline, executive director report.',
        startTime: now + 14 * day,
        endTime: now + 14 * day + 3 * hour,
        location: 'Board Room, Main Office',
        privacy: 'private',
        createdBy: userPubkey,
        createdAt: now - 21 * day,
        updatedAt: now - 7 * day,
        tags: 'board,quarterly,governance,private',
      },
    ];

    await dal.bulkPut('events', events);
    logger.info(`Seeded ${events.length} nonprofit events for group ${groupId}`);
  },
};

/**
 * Seed data for events module
 * Can be used for demos, testing, or providing templates
 */
export const eventsSeeds: ModuleSeed[] = [
  courtEventsSeed,
  communityEventsSeed,
  actionEventsSeed,
  meetingEventsSeed,
  tenantEventsSeed,
  nonprofitEventsSeed,
  {
    name: 'realistic-events',
    description: 'Comprehensive event examples covering all privacy levels and event types',
    data: async (groupId, userPubkey) => {
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

        // Private direct action event (location shared privately with attendees)
        {
          id: `event-direct-action-${groupId}`,
          groupId,
          title: 'Direct Action: Housing Justice',
          description: 'Coordinated action to prevent an eviction. Location will be shared privately with confirmed attendees. Be prepared for possible arrests. Know your rights.',
          startTime: now + 20 * day,
          endTime: now + 20 * day + 4 * hour,
          location: 'Location shared with confirmed attendees only',
          privacy: 'private',
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
      await dal.bulkPut('events', exampleEvents);
      await dal.bulkPut('rsvps', exampleRSVPs);
      logger.info(`Seeded ${exampleEvents.length} events and ${exampleRSVPs.length} RSVPs for group ${groupId}`);
    },
  },
];
