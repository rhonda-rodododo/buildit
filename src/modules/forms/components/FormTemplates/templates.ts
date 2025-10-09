/**
 * Built-in Form Templates
 * Pre-configured form templates using JSON Schema
 */

import type { JSONSchema7 } from 'json-schema';

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: 'event' | 'volunteer' | 'contact' | 'survey' | 'membership';
  schema: JSONSchema7;
  uiSchema: Record<string, unknown>;
}

/**
 * 1. Event Registration Template
 */
export const eventRegistrationTemplate: FormTemplate = {
  id: 'event-registration',
  name: 'Event Registration',
  description: 'Collect RSVPs and attendee information for events',
  category: 'event',
  schema: {
    type: 'object',
    required: ['name', 'email', 'attending'],
    properties: {
      name: {
        type: 'string',
        title: 'Full Name',
        minLength: 2,
      },
      email: {
        type: 'string',
        title: 'Email Address',
        format: 'email',
      },
      phone: {
        type: 'string',
        title: 'Phone Number (optional)',
        pattern: '^[0-9]{10,15}$',
      },
      attending: {
        type: 'boolean',
        title: 'Will you attend this event?',
        default: true,
      },
      numGuests: {
        type: 'integer',
        title: 'Number of Guests',
        minimum: 0,
        maximum: 5,
        default: 0,
      },
      dietaryRestrictions: {
        type: 'string',
        title: 'Dietary Restrictions',
      },
      accessibility: {
        type: 'string',
        title: 'Accessibility Requirements',
      },
      comments: {
        type: 'string',
        title: 'Additional Comments',
      },
    },
    // Conditional logic: only show dietaryRestrictions if attending
    if: {
      properties: { attending: { const: true } },
    },
    then: {
      required: ['dietaryRestrictions'],
    },
  },
  uiSchema: {
    name: { 'ui:placeholder': 'John Doe' },
    email: { 'ui:placeholder': 'john@example.com' },
    phone: { 'ui:placeholder': '+1 (555) 123-4567' },
    numGuests: { 'ui:widget': 'updown' },
    dietaryRestrictions: {
      'ui:widget': 'textarea',
      'ui:placeholder': 'Vegan, gluten-free, etc.',
    },
    accessibility: {
      'ui:widget': 'textarea',
      'ui:placeholder': 'Wheelchair access, ASL interpreter, etc.',
    },
    comments: {
      'ui:widget': 'textarea',
      'ui:placeholder': 'Any questions or comments?',
    },
  },
};

/**
 * 2. Volunteer Signup Template
 */
export const volunteerSignupTemplate: FormTemplate = {
  id: 'volunteer-signup',
  name: 'Volunteer Signup',
  description: 'Recruit volunteers and collect availability information',
  category: 'volunteer',
  schema: {
    type: 'object',
    required: ['name', 'email', 'availability', 'skills'],
    properties: {
      name: {
        type: 'string',
        title: 'Full Name',
        minLength: 2,
      },
      email: {
        type: 'string',
        title: 'Email Address',
        format: 'email',
      },
      phone: {
        type: 'string',
        title: 'Phone Number',
        pattern: '^[0-9]{10,15}$',
      },
      availability: {
        type: 'array',
        title: 'When are you available?',
        items: {
          type: 'string',
          enum: ['Weekday Mornings', 'Weekday Afternoons', 'Weekday Evenings', 'Weekend Days', 'Weekend Evenings'],
        },
        uniqueItems: true,
        minItems: 1,
      },
      skills: {
        type: 'array',
        title: 'Skills & Interests',
        items: {
          type: 'string',
          enum: ['Organizing', 'Fundraising', 'Social Media', 'Design', 'Writing', 'Translation', 'Legal Support', 'Tech Support', 'Childcare', 'Transportation'],
        },
        uniqueItems: true,
        minItems: 1,
      },
      experience: {
        type: 'string',
        title: 'Relevant Experience',
      },
      languages: {
        type: 'string',
        title: 'Languages Spoken',
      },
      shirtSize: {
        type: 'string',
        title: 'T-Shirt Size',
        enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      },
    },
  },
  uiSchema: {
    name: { 'ui:placeholder': 'Your full name' },
    email: { 'ui:placeholder': 'your@email.com' },
    phone: { 'ui:placeholder': '+1 (555) 123-4567' },
    availability: {
      'ui:widget': 'checkboxes',
    },
    skills: {
      'ui:widget': 'checkboxes',
    },
    experience: {
      'ui:widget': 'textarea',
      'ui:placeholder': 'Previous organizing experience, relevant skills, etc.',
    },
    languages: {
      'ui:placeholder': 'English, Spanish, etc.',
    },
  },
};

/**
 * 3. Contact Form Template
 */
export const contactFormTemplate: FormTemplate = {
  id: 'contact-form',
  name: 'Contact Form',
  description: 'Simple contact form for inquiries and feedback',
  category: 'contact',
  schema: {
    type: 'object',
    required: ['name', 'email', 'subject', 'message'],
    properties: {
      name: {
        type: 'string',
        title: 'Name',
        minLength: 2,
      },
      email: {
        type: 'string',
        title: 'Email',
        format: 'email',
      },
      phone: {
        type: 'string',
        title: 'Phone (optional)',
        pattern: '^[0-9]{10,15}$',
      },
      subject: {
        type: 'string',
        title: 'Subject',
        enum: ['General Inquiry', 'Support Request', 'Feedback', 'Partnership', 'Press Inquiry', 'Other'],
      },
      message: {
        type: 'string',
        title: 'Message',
        minLength: 10,
      },
    },
  },
  uiSchema: {
    name: { 'ui:placeholder': 'Your name' },
    email: { 'ui:placeholder': 'your@email.com' },
    phone: { 'ui:placeholder': '+1 (555) 123-4567' },
    message: {
      'ui:widget': 'textarea',
      'ui:placeholder': 'How can we help you?',
      'ui:options': {
        rows: 6,
      },
    },
  },
};

/**
 * 4. Survey/Feedback Template
 */
export const surveyTemplate: FormTemplate = {
  id: 'survey-feedback',
  name: 'Survey & Feedback',
  description: 'Collect feedback and opinions from community members',
  category: 'survey',
  schema: {
    type: 'object',
    required: ['satisfaction', 'recommend'],
    properties: {
      name: {
        type: 'string',
        title: 'Name (optional)',
      },
      email: {
        type: 'string',
        title: 'Email (optional)',
        format: 'email',
      },
      satisfaction: {
        type: 'integer',
        title: 'How satisfied are you with our organization?',
        enum: [1, 2, 3, 4, 5],
        oneOf: [
          { const: 1, title: 'Very Unsatisfied' },
          { const: 2, title: 'Unsatisfied' },
          { const: 3, title: 'Neutral' },
          { const: 4, title: 'Satisfied' },
          { const: 5, title: 'Very Satisfied' },
        ],
      },
      recommend: {
        type: 'integer',
        title: 'How likely are you to recommend us to a friend?',
        minimum: 0,
        maximum: 10,
      },
      mostValuable: {
        type: 'string',
        title: 'What do you find most valuable about our work?',
      },
      improvements: {
        type: 'string',
        title: 'What could we improve?',
      },
      futureInterests: {
        type: 'array',
        title: 'What topics are you interested in?',
        items: {
          type: 'string',
          enum: ['Organizing Workshops', 'Community Events', 'Direct Action', 'Mutual Aid', 'Political Education', 'Arts & Culture'],
        },
        uniqueItems: true,
      },
      additionalComments: {
        type: 'string',
        title: 'Additional Comments',
      },
    },
  },
  uiSchema: {
    satisfaction: {
      'ui:widget': 'radio',
    },
    recommend: {
      'ui:widget': 'range',
      'ui:help': '0 = Not likely, 10 = Extremely likely',
    },
    mostValuable: {
      'ui:widget': 'textarea',
    },
    improvements: {
      'ui:widget': 'textarea',
    },
    futureInterests: {
      'ui:widget': 'checkboxes',
    },
    additionalComments: {
      'ui:widget': 'textarea',
    },
  },
};

/**
 * 5. Membership Application Template
 */
export const membershipApplicationTemplate: FormTemplate = {
  id: 'membership-application',
  name: 'Membership Application',
  description: 'Application form for new members to join your organization',
  category: 'membership',
  schema: {
    type: 'object',
    required: ['firstName', 'lastName', 'email', 'phone', 'agreedToTerms'],
    properties: {
      firstName: {
        type: 'string',
        title: 'First Name',
        minLength: 1,
      },
      lastName: {
        type: 'string',
        title: 'Last Name',
        minLength: 1,
      },
      email: {
        type: 'string',
        title: 'Email Address',
        format: 'email',
      },
      phone: {
        type: 'string',
        title: 'Phone Number',
        pattern: '^[0-9]{10,15}$',
      },
      address: {
        type: 'string',
        title: 'Street Address',
      },
      city: {
        type: 'string',
        title: 'City',
      },
      state: {
        type: 'string',
        title: 'State/Province',
      },
      zipCode: {
        type: 'string',
        title: 'ZIP/Postal Code',
      },
      membershipType: {
        type: 'string',
        title: 'Membership Type',
        enum: ['Individual', 'Family', 'Student', 'Senior', 'Solidarity'],
        default: 'Individual',
      },
      referralSource: {
        type: 'string',
        title: 'How did you hear about us?',
        enum: ['Friend', 'Social Media', 'Event', 'Website', 'News Article', 'Other'],
      },
      interests: {
        type: 'array',
        title: 'Areas of Interest',
        items: {
          type: 'string',
          enum: ['Organizing', 'Mutual Aid', 'Education', 'Direct Action', 'Community Building', 'Arts & Culture', 'Legal Support'],
        },
        uniqueItems: true,
      },
      whyJoin: {
        type: 'string',
        title: 'Why do you want to join?',
      },
      agreedToTerms: {
        type: 'boolean',
        title: 'I agree to the membership terms and code of conduct',
        const: true,
      },
    },
  },
  uiSchema: {
    address: {
      'ui:placeholder': '123 Main St',
    },
    city: {
      'ui:placeholder': 'New York',
    },
    state: {
      'ui:placeholder': 'NY',
    },
    zipCode: {
      'ui:placeholder': '10001',
    },
    interests: {
      'ui:widget': 'checkboxes',
    },
    whyJoin: {
      'ui:widget': 'textarea',
      'ui:placeholder': 'Tell us about your interest in joining...',
      'ui:options': {
        rows: 4,
      },
    },
    agreedToTerms: {
      'ui:widget': 'checkbox',
    },
  },
};

/**
 * All built-in templates
 */
export const BUILT_IN_TEMPLATES: FormTemplate[] = [
  eventRegistrationTemplate,
  volunteerSignupTemplate,
  contactFormTemplate,
  surveyTemplate,
  membershipApplicationTemplate,
];
