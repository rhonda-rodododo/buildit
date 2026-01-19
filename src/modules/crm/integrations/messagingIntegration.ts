/**
 * Messaging Integration for CRM Module
 * Enables direct messaging with contacts who have linked social profiles
 */

import type { DatabaseRecord } from '@/modules/database/types';

/**
 * Contact messaging capability
 */
export interface ContactMessagingCapability {
  canMessage: boolean;
  pubkey?: string;
  displayName?: string;
  reason?: string;
}

/**
 * Message history item (for CRM communication log)
 */
export interface ContactMessage {
  id: string;
  contactPubkey: string;
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: number;
  read?: boolean;
}

/**
 * Check if a contact can be messaged (has a linked pubkey)
 */
export function canMessageContact(
  contact: DatabaseRecord,
  pubkeyFieldName: string = 'pubkey'
): ContactMessagingCapability {
  const pubkey = contact.customFields[pubkeyFieldName];

  if (!pubkey) {
    return {
      canMessage: false,
      reason: 'Contact does not have a linked social profile',
    };
  }

  if (typeof pubkey !== 'string') {
    return {
      canMessage: false,
      reason: 'Invalid pubkey format',
    };
  }

  // Get display name from common fields
  const displayName =
    (contact.customFields['name'] as string) ||
    (contact.customFields['displayName'] as string) ||
    (contact.customFields['fullName'] as string) ||
    pubkey.slice(0, 8) + '...';

  return {
    canMessage: true,
    pubkey,
    displayName,
  };
}

/**
 * Get all messageable contacts from a list
 */
export function getMessageableContacts(
  contacts: DatabaseRecord[],
  pubkeyFieldName: string = 'pubkey'
): DatabaseRecord[] {
  return contacts.filter((contact) => {
    const capability = canMessageContact(contact, pubkeyFieldName);
    return capability.canMessage;
  });
}

/**
 * Build a DM link for a contact
 * Returns a path that can be used with the app's router
 */
export function getDMLink(
  contactPubkey: string,
  options?: {
    prefilledMessage?: string;
  }
): string {
  const basePath = `/messages/${contactPubkey}`;

  if (options?.prefilledMessage) {
    const encoded = encodeURIComponent(options.prefilledMessage);
    return `${basePath}?message=${encoded}`;
  }

  return basePath;
}

/**
 * Build a bulk message link for multiple contacts
 * Returns a path for group messaging
 */
export function getBulkMessageLink(
  contactPubkeys: string[],
  options?: {
    prefilledMessage?: string;
    groupName?: string;
  }
): string {
  const params = new URLSearchParams();
  params.set('recipients', contactPubkeys.join(','));

  if (options?.prefilledMessage) {
    params.set('message', options.prefilledMessage);
  }

  if (options?.groupName) {
    params.set('groupName', options.groupName);
  }

  return `/messages/compose?${params.toString()}`;
}

/**
 * Format a message template with contact data
 * Replaces placeholders like {{name}}, {{email}}, etc.
 */
export function formatMessageTemplate(
  template: string,
  contact: DatabaseRecord
): string {
  let formatted = template;

  // Replace all {{fieldName}} placeholders with contact field values
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  formatted = formatted.replace(placeholderRegex, (_match, fieldName) => {
    const value = contact.customFields[fieldName];
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  });

  // Clean up any double spaces or trailing spaces from empty placeholders
  formatted = formatted.replace(/\s+/g, ' ').trim();

  return formatted;
}

/**
 * Get suggested message templates for a contact
 * Based on contact type, status, or CRM template
 */
export function getMessageTemplates(
  contactType?: string,
  context?: string
): { id: string; name: string; template: string }[] {
  const templates = [
    {
      id: 'follow-up',
      name: 'Follow Up',
      template: 'Hi {{name}}, I wanted to follow up on our conversation. How are things going?',
    },
    {
      id: 'check-in',
      name: 'Check In',
      template: 'Hey {{name}}, just checking in. Let me know if you need anything!',
    },
    {
      id: 'meeting-request',
      name: 'Meeting Request',
      template: 'Hi {{name}}, would you be available for a call this week? I\'d love to connect.',
    },
  ];

  // Add context-specific templates
  if (contactType === 'volunteer' || context === 'volunteer') {
    templates.push({
      id: 'volunteer-thanks',
      name: 'Volunteer Thank You',
      template:
        'Thank you so much for volunteering, {{name}}! Your help makes a real difference.',
    });
    templates.push({
      id: 'volunteer-opportunity',
      name: 'Volunteer Opportunity',
      template:
        'Hi {{name}}, we have an upcoming opportunity that might interest you. Would you like to learn more?',
    });
  }

  if (contactType === 'donor' || context === 'fundraising') {
    templates.push({
      id: 'donor-thanks',
      name: 'Donation Thank You',
      template:
        'Thank you for your generous support, {{name}}! Your contribution helps us continue our work.',
    });
    templates.push({
      id: 'donor-update',
      name: 'Donor Update',
      template:
        'Hi {{name}}, I wanted to share an update on the impact of your support. [Share impact story]',
    });
  }

  if (contactType === 'tenant' || context === 'tenant') {
    templates.push({
      id: 'tenant-meeting',
      name: 'Tenant Meeting Invite',
      template:
        'Hi {{name}}, we\'re having a building meeting to discuss [topic]. Can you make it?',
    });
    templates.push({
      id: 'tenant-followup',
      name: 'Case Follow-Up',
      template:
        'Hi {{name}}, following up on your case. Do you have any updates or questions?',
    });
  }

  if (contactType === 'client' || context === 'legal') {
    templates.push({
      id: 'legal-update',
      name: 'Case Update',
      template:
        'Hi {{name}}, I wanted to give you an update on your case. [Share update]',
    });
    templates.push({
      id: 'court-reminder',
      name: 'Court Date Reminder',
      template:
        'Hi {{name}}, this is a reminder about your upcoming court date on {{nextCourtDate}}. Let me know if you have any questions.',
    });
  }

  return templates;
}

/**
 * Log a message to the CRM communication history
 * This creates an activity record for tracking
 */
export function createMessageLogEntry(
  _contactId: string,
  contactPubkey: string,
  direction: 'inbound' | 'outbound',
  contentPreview: string,
  _userPubkey: string
): ContactMessage {
  return {
    id: crypto.randomUUID(),
    contactPubkey,
    direction,
    content: contentPreview,
    timestamp: Date.now(),
    read: direction === 'outbound',
  };
}

/**
 * Get communication frequency for a contact
 * Useful for identifying contacts who need follow-up
 */
export function getContactCommunicationStats(
  messages: ContactMessage[]
): {
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  lastInbound?: number;
  lastOutbound?: number;
  daysSinceLastContact: number;
} {
  const inbound = messages.filter((m) => m.direction === 'inbound');
  const outbound = messages.filter((m) => m.direction === 'outbound');

  const lastInbound = inbound.length > 0
    ? Math.max(...inbound.map((m) => m.timestamp))
    : undefined;

  const lastOutbound = outbound.length > 0
    ? Math.max(...outbound.map((m) => m.timestamp))
    : undefined;

  const lastContact = Math.max(lastInbound || 0, lastOutbound || 0);
  const daysSinceLastContact = lastContact > 0
    ? Math.floor((Date.now() - lastContact) / (24 * 60 * 60 * 1000))
    : Infinity;

  return {
    totalMessages: messages.length,
    inboundCount: inbound.length,
    outboundCount: outbound.length,
    lastInbound,
    lastOutbound,
    daysSinceLastContact,
  };
}
