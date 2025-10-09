/**
 * Forms Module Seed Data
 * Example forms for demos/testing
 */

import type { ModuleSeed } from '@/types/modules';
import type { BuildItDB } from '@/core/storage/db';
import { generateEventId } from '@/core/nostr/nip01';
import type { Form } from './types';

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
 * All Forms Module Seeds
 */
export const formsSeeds: ModuleSeed[] = [
  eventRegistrationFormSeed,
  volunteerSignupFormSeed,
];
