/**
 * Forms Module Seed Data
 * Example forms, campaigns, and public pages for demos/testing
 */

import type { ModuleSeed } from '@/types/modules';
import type { BuildItDB } from '@/core/storage/db';
import { generateEventId } from '@/core/nostr/nip01';
import type { Form, Campaign, DonationTier, PublicPage } from './types';

/**
 * Event Registration Form Seed
 * Creates a sample form for event registration using an events table
 */
export const eventRegistrationFormSeed: ModuleSeed = {
  name: 'Event Registration Form',
  description: 'Sample event registration form with custom fields',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();

    // Find or create an events table (assumes events module is loaded)
    let eventsTable = await db.databaseTables
      ?.where({ groupId, name: 'Event Attendees' })
      .first();

    if (!eventsTable) {
      // Create a simple events attendee table
      const tableId = generateEventId();
      eventsTable = {
        id: tableId,
        groupId,
        name: 'Event Attendees',
        description: 'Track event attendees and their preferences',
        icon: 'Users',
        fields: [
          {
            id: generateEventId(),
            name: 'Name',
            type: 'text',
            required: true,
            description: 'Attendee name',
          },
          {
            id: generateEventId(),
            name: 'Email',
            type: 'text',
            required: true,
            description: 'Contact email',
          },
          {
            id: generateEventId(),
            name: 'Dietary Restrictions',
            type: 'select',
            required: false,
            description: 'Any dietary needs',
            options: ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Other'],
          },
          {
            id: generateEventId(),
            name: 'Accessibility Needs',
            type: 'text',
            required: false,
            description: 'Any accessibility requirements',
          },
        ],
        created: now,
        createdBy: userPubkey,
        updated: now,
      };
      await db.databaseTables?.add(eventsTable);
    }

    // Create event registration form
    const formId = generateEventId();
    const form: Form = {
      id: formId,
      groupId,
      tableId: eventsTable.id,
      title: 'Rally Registration',
      description: 'Register for our upcoming community rally',
      fields: eventsTable.fields.map((field: any, index: number) => ({
        fieldId: field.id,
        order: index,
      })),
      settings: {
        allowAnonymous: true,
        requireEmail: true,
        multiPage: false,
        confirmationMessage: 'Thank you for registering! We look forward to seeing you at the rally.',
        redirectUrl: '/events',
        sendAutoResponse: true,
        autoResponseSubject: 'Rally Registration Confirmed',
        autoResponseBody: 'Your registration for the community rally has been confirmed.',
        notifyOnSubmission: true,
        enableWebhook: false,
        limitSubmissions: true,
        maxSubmissions: 500,
        limitPerUser: true,
        maxPerUser: 1,
        closeOnDate: false,
        antiSpam: {
          enableHoneypot: true,
          enableRateLimit: true,
          rateLimitCount: 10,
          enableCaptcha: true,
          captchaType: 'hcaptcha',
        },
      },
      status: 'published',
      created: now,
      createdBy: userPubkey,
      updated: now,
    };

    await db.forms?.add(form);
    console.log('✅ Created event registration form seed');
  },
};

/**
 * Volunteer Signup Form Seed
 */
export const volunteerSignupFormSeed: ModuleSeed = {
  name: 'Volunteer Signup Form',
  description: 'Form for volunteers to sign up with skills and availability',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();

    // Create volunteers table
    const tableId = generateEventId();
    const volunteersTable = {
      id: tableId,
      groupId,
      name: 'Volunteers',
      description: 'Volunteer database with skills and availability',
      icon: 'Heart',
      fields: [
        {
          id: generateEventId(),
          name: 'Name',
          type: 'text',
          required: true,
        },
        {
          id: generateEventId(),
          name: 'Email',
          type: 'text',
          required: true,
        },
        {
          id: generateEventId(),
          name: 'Phone',
          type: 'text',
          required: false,
        },
        {
          id: generateEventId(),
          name: 'Skills',
          type: 'multi-select',
          required: true,
          options: [
            'Graphic Design',
            'Social Media',
            'Event Planning',
            'Legal Support',
            'Medical/First Aid',
            'Translation',
            'Tech Support',
            'Fundraising',
          ],
        },
        {
          id: generateEventId(),
          name: 'Availability',
          type: 'multi-select',
          required: true,
          options: ['Weekdays', 'Weekends', 'Evenings', 'Flexible'],
        },
        {
          id: generateEventId(),
          name: 'Experience',
          type: 'text',
          required: false,
          description: 'Previous organizing experience',
        },
      ],
      created: now,
      createdBy: userPubkey,
      updated: now,
    };
    await db.databaseTables?.add(volunteersTable);

    // Create volunteer signup form
    const formId = generateEventId();
    const form: Form = {
      id: formId,
      groupId,
      tableId: volunteersTable.id,
      title: 'Volunteer Sign-Up',
      description: 'Join our organizing team! We need your skills and passion.',
      fields: volunteersTable.fields.map((field: any, index: number) => ({
        fieldId: field.id,
        order: index,
      })),
      settings: {
        allowAnonymous: false,
        requireEmail: true,
        multiPage: false,
        confirmationMessage: 'Welcome to the team! We\'ll be in touch soon.',
        sendAutoResponse: true,
        autoResponseSubject: 'Volunteer Application Received',
        autoResponseBody: 'Thank you for signing up to volunteer! Our team will review your application and be in touch soon.',
        notifyOnSubmission: true,
        enableWebhook: false,
        limitSubmissions: false,
        limitPerUser: true,
        maxPerUser: 1,
        closeOnDate: false,
        antiSpam: {
          enableHoneypot: true,
          enableRateLimit: true,
          rateLimitCount: 5,
          enableCaptcha: true,
          captchaType: 'hcaptcha',
        },
      },
      status: 'published',
      created: now,
      createdBy: userPubkey,
      updated: now,
    };

    await db.forms?.add(form);
    console.log('✅ Created volunteer signup form seed');
  },
};

/**
 * Strike Fund Campaign Seed
 */
export const strikeFundCampaignSeed: ModuleSeed = {
  name: 'Strike Fund Campaign',
  description: 'Fundraising campaign for strike support',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();

    // Create donors table (optional for campaign)
    const tableId = generateEventId();
    const donorsTable = {
      id: tableId,
      groupId,
      name: 'Strike Fund Donors',
      description: 'Donor database for strike fund',
      icon: 'DollarSign',
      fields: [
        {
          id: generateEventId(),
          name: 'Name',
          type: 'text',
          required: true,
        },
        {
          id: generateEventId(),
          name: 'Email',
          type: 'text',
          required: true,
        },
        {
          id: generateEventId(),
          name: 'Amount',
          type: 'number',
          required: true,
        },
        {
          id: generateEventId(),
          name: 'Message',
          type: 'text',
          required: false,
        },
      ],
      created: now,
      createdBy: userPubkey,
      updated: now,
    };
    await db.databaseTables?.add(donorsTable);

    // Create strike fund campaign
    const campaignId = generateEventId();
    const campaign: Campaign = {
      id: campaignId,
      groupId,
      tableId: donorsTable.id,
      title: 'Worker Strike Support Fund',
      slug: 'strike-fund-2025',
      description: '**Support our striking workers!**\n\nOur members are on strike for fair wages, safe working conditions, and dignity on the job. Every dollar helps keep them strong on the picket line.\n\n- Strike pay for workers\n- Legal defense fund\n- Healthcare coverage\n- Emergency support for families',
      category: 'strike',
      goal: 50000,
      currentAmount: 0,
      currency: 'USD',
      allowCustomAmount: true,
      allowRecurring: true,
      status: 'active',
      created: now,
      createdBy: userPubkey,
      updated: now,
      updateCount: 0,
      endsAt: now + 90 * 24 * 60 * 60 * 1000, // 90 days from now
      imageUrl: '/images/strike-solidarity.jpg',
      settings: {
        showDonorWall: true,
        allowAnonymousDonors: true,
        showDonorNames: true,
        showDonorAmounts: false,
        showDonorMessages: true,
        sendThankYouEmail: true,
        thankYouSubject: 'Thank You for Supporting Our Strike!',
        thankYouBody: 'Your solidarity means everything to our striking workers. Together we are stronger!',
        sendTaxReceipt: false,
        continueAfterGoal: true,
        notifyOnDonation: true,
        enabledProcessors: ['stripe', 'paypal'],
      },
    };
    await db.campaigns?.add(campaign);

    // Create donation tiers
    const tiers: DonationTier[] = [
      {
        id: generateEventId(),
        campaignId,
        name: 'Solidarity Supporter',
        amount: 25,
        description: 'Helps provide a day of strike pay for one worker',
        benefits: ['Strike fund supporter badge', 'Updates from the picket line'],
        order: 0,
        limited: false,
        currentCount: 0,
      },
      {
        id: generateEventId(),
        campaignId,
        name: 'Picket Line Partner',
        amount: 100,
        description: 'Covers a week of healthcare for a striking family',
        benefits: [
          'All Solidarity Supporter benefits',
          'Invitation to strategy call with strike leadership',
          'Strike solidarity t-shirt',
        ],
        order: 1,
        limited: false,
        currentCount: 0,
      },
      {
        id: generateEventId(),
        campaignId,
        name: 'Union Champion',
        amount: 500,
        description: 'Provides emergency support for 5 striking families',
        benefits: [
          'All Picket Line Partner benefits',
          'Recognition in campaign updates',
          'Invitation to victory celebration',
        ],
        order: 2,
        limited: true,
        maxCount: 50,
        currentCount: 0,
      },
    ];

    for (const tier of tiers) {
      await db.donationTiers?.add(tier);
    }

    console.log('✅ Created strike fund campaign seed with 3 donation tiers');
  },
};

/**
 * Bail Fund Campaign Seed
 */
export const bailFundCampaignSeed: ModuleSeed = {
  name: 'Bail Fund Campaign',
  description: 'Emergency bail fund for protesters',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();

    // Create bail fund campaign (no donor table for privacy)
    const campaignId = generateEventId();
    const campaign: Campaign = {
      id: campaignId,
      groupId,
      // No tableId - anonymous donations only
      title: 'Emergency Bail Fund',
      slug: 'bail-fund',
      description: '**Free our protesters!**\n\nWhen our community members are arrested for exercising their rights, we stand ready to get them out. This fund provides immediate bail for protesters.\n\n100% of donations go directly to bail.',
      category: 'bail',
      goal: 100000,
      currentAmount: 0,
      currency: 'USD',
      allowCustomAmount: true,
      allowRecurring: false, // One-time donations only
      status: 'active',
      created: now,
      createdBy: userPubkey,
      updated: now,
      updateCount: 0,
      imageUrl: '/images/bail-solidarity.jpg',
      settings: {
        showDonorWall: false, // Privacy: no donor wall
        allowAnonymousDonors: true,
        showDonorNames: false,
        showDonorAmounts: false,
        showDonorMessages: false,
        sendThankYouEmail: false, // No emails for privacy
        sendTaxReceipt: false,
        continueAfterGoal: true,
        notifyOnDonation: true,
        enabledProcessors: ['crypto'], // Crypto only for privacy
      },
    };
    await db.campaigns?.add(campaign);

    console.log('✅ Created bail fund campaign seed (privacy-focused)');
  },
};

/**
 * Public Landing Page Seed
 */
export const publicLandingPageSeed: ModuleSeed = {
  name: 'Public Landing Page',
  description: 'SEO-optimized landing page for the group',
  data: async (db: BuildItDB, groupId: string, userPubkey: string) => {
    const now = Date.now();

    const pageId = generateEventId();
    const page: PublicPage = {
      id: pageId,
      groupId,
      slug: 'home',
      title: 'Workers United - Fighting for Justice',
      type: 'landing',
      content: `# Workers United

## Fighting for Justice, Dignity, and Fair Wages

We are a grassroots union organizing workers across industries. Join us in the fight for:

- **Living Wages** - No one who works full-time should live in poverty
- **Safe Conditions** - Every worker deserves a safe workplace
- **Healthcare** - Universal healthcare is a human right
- **Dignity** - Respect and fair treatment on the job

### Get Involved

- [Join the Union](/join)
- [Upcoming Events](/events)
- [Support Striking Workers](/campaigns/strike-fund)
- [Volunteer](/volunteer)

### Recent Victories

✊ Won 25% wage increase at Metro Transit
✊ Secured paid sick leave at 50 workplaces
✊ Stopped 200 wrongful terminations

---

*Solidarity forever!*`,
      seo: {
        title: 'Workers United - Labor Union Fighting for Justice',
        description: 'Join Workers United in the fight for living wages, safe conditions, and worker dignity. Grassroots union organizing across all industries.',
        keywords: ['union', 'labor', 'workers rights', 'organizing', 'strike', 'solidarity'],
        ogTitle: 'Workers United - Fighting for Justice',
        ogDescription: 'Grassroots union organizing for living wages, safe conditions, and worker dignity',
        ogImage: '/images/workers-united-og.jpg',
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: 'Workers United',
        twitterDescription: 'Labor union fighting for justice and worker dignity',
        twitterImage: '/images/workers-united-twitter.jpg',
        canonicalUrl: 'https://workersunited.org',
      },
      status: 'published',
      publishedAt: now,
      created: now,
      createdBy: userPubkey,
      updated: now,
    };

    await db.publicPages?.add(page);
    console.log('✅ Created public landing page seed');
  },
};

/**
 * All Forms Module Seeds
 */
export const formsSeeds: ModuleSeed[] = [
  eventRegistrationFormSeed,
  volunteerSignupFormSeed,
  strikeFundCampaignSeed,
  bailFundCampaignSeed,
  publicLandingPageSeed,
];
