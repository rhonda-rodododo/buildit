/**
 * Newsletters Module Seed Data
 * Sample newsletter for media collective template
 */

import type { ModuleSeed } from '@/types/modules';
import { dal } from '@/core/storage/dal';
import { generateEventId } from '@/core/nostr/nip01';
import type { Newsletter, NewsletterIssue } from './types';

import { logger } from '@/lib/logger';

/**
 * Newsletter demo seed for media collective template
 */
export const newslettersDemoSeed: ModuleSeed = {
  name: 'newsletters-demo',
  description: 'Sample newsletter with past issues for media collective groups',
  data: async (groupId: string, userPubkey: string) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const newsletterId = generateEventId();

    // Create newsletter
    const newsletter: Newsletter = {
      id: newsletterId,
      groupId,
      ownerPubkey: userPubkey,
      name: 'The Weekly Dispatch',
      description: 'Weekly roundup of movement news, upcoming actions, and community updates. Delivered every Friday via encrypted Nostr DM.',
      theme: {
        primaryColor: '#DC2626',
        backgroundColor: '#FFFFFF',
        textColor: '#1F2937',
        linkColor: '#2563EB',
        fontFamily: 'serif',
      },
      schedule: {
        type: 'weekly',
        dayOfWeek: 5, // Friday
        timeOfDay: '10:00',
      },
      settings: {
        allowReplies: true,
        confirmationRequired: false,
        maxRetriesOnFailure: 3,
        rateLimitPerMinute: 30,
        emailDeliveryEnabled: false,
      },
      subscriberCount: 47,
      totalIssuesSent: 12,
      createdAt: now - 90 * day,
      updatedAt: now - 1 * day,
    };

    await dal.add('newsletters', newsletter);

    // Create sample issues
    const issues: NewsletterIssue[] = [
      {
        id: generateEventId(),
        newsletterId,
        groupId,
        authorPubkey: userPubkey,
        subject: 'Weekly Dispatch #12: Riverside Victory, Metro Union Win',
        content: `# The Weekly Dispatch #12

## Top Stories This Week

### Riverside Tenants Win Rent Stabilization
After four months of organizing, Riverside Apartments tenants secured a landmark agreement capping rent increases at 3%. Read the full story on our publication.

### Metro Warehouse Workers Vote Union
Workers at Metro Distribution Center voted 67-33 to join the Warehouse Workers Alliance. Contract negotiations begin next month.

## Upcoming Actions
- **Saturday**: Canvassing for rent control ballot initiative (9am, Campaign HQ)
- **Tuesday**: City Council hearing on rent stabilization (6pm, City Hall)
- **Next Friday**: Monthly strategy meeting (7pm, Community Center)

## Mutual Aid Needs
- Ride to medical appointment needed (see Mutual Aid board)
- Volunteers needed for Saturday food distribution

Stay strong, stay organized.

*In solidarity,*
*The Editorial Collective*`,
        contentFormat: 'markdown',
        status: 'sent',
        sentAt: now - 1 * day,
        stats: {
          totalRecipients: 47,
          delivered: 45,
          pending: 0,
          failed: 2,
          retrying: 0,
        },
        createdAt: now - 2 * day,
        updatedAt: now - 1 * day,
      },
      {
        id: generateEventId(),
        newsletterId,
        groupId,
        authorPubkey: userPubkey,
        subject: 'Weekly Dispatch #13: Budget Investigation, Training Schedule',
        content: `# The Weekly Dispatch #13

## This Week

### Investigation Coming Soon
Our investigative team is preparing a major story on city budget diversions from social services. Stay tuned.

### Upcoming Trainings
- Legal Observer Training (Feb 14, Community Law Center)
- Digital Security Workshop (Feb 20, TBD)

## Community Calendar
Check the Events module for the full calendar.

*Draft - not yet sent*`,
        contentFormat: 'markdown',
        status: 'draft',
        stats: {
          totalRecipients: 0,
          delivered: 0,
          pending: 0,
          failed: 0,
          retrying: 0,
        },
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const issue of issues) {
      await dal.add('newsletterIssues', issue);
    }

    logger.info(`Seeded newsletter "${newsletter.name}" with ${issues.length} issues for group ${groupId}`);
  },
};

/**
 * All Newsletters Module Seeds
 */
export const newslettersSeeds: ModuleSeed[] = [
  newslettersDemoSeed,
];
