/**
 * CRM Integrations Unit Tests
 * Tests cross-module integration utilities
 */

import { describe, it, expect } from 'vitest';
import {
  canMessageContact,
  getMessageableContacts,
  getDMLink,
  getBulkMessageLink,
  formatMessageTemplate,
  getMessageTemplates,
  getContactCommunicationStats,
} from '../integrations/messagingIntegration';
import {
  calculateContactEngagement,
  groupContactsByEngagement,
} from '../integrations/eventsIntegration';
import {
  suggestDocumentCategory,
  groupAttachmentsByCategory,
  getCategoryDisplayInfo,
  isSensitiveDocument,
} from '../integrations/filesIntegration';
import type { DatabaseRecord } from '@/modules/database/types';
import type { RSVP } from '@/modules/events/types';
import type { RecordAttachment } from '@/modules/database/types';

// Test helpers
function createMockContact(
  id: string,
  customFields: Record<string, unknown>
): DatabaseRecord {
  return {
    id,
    tableId: 'contacts',
    groupId: 'test-group',
    customFields,
    createdAt: Date.now(),
    createdBy: 'test-user',
  };
}

describe('Messaging Integration', () => {
  describe('canMessageContact', () => {
    it('should return true for contact with pubkey', () => {
      const contact = createMockContact('1', {
        pubkey: 'npub123abc',
        name: 'John Doe',
      });
      const result = canMessageContact(contact);
      expect(result.canMessage).toBe(true);
      expect(result.pubkey).toBe('npub123abc');
      expect(result.displayName).toBe('John Doe');
    });

    it('should return false for contact without pubkey', () => {
      const contact = createMockContact('1', { name: 'John Doe' });
      const result = canMessageContact(contact);
      expect(result.canMessage).toBe(false);
      expect(result.reason).toContain('linked social profile');
    });

    it('should return false for invalid pubkey type', () => {
      const contact = createMockContact('1', { pubkey: 12345 });
      const result = canMessageContact(contact);
      expect(result.canMessage).toBe(false);
      expect(result.reason).toContain('Invalid pubkey');
    });

    it('should use custom pubkey field name', () => {
      const contact = createMockContact('1', {
        nostr_pubkey: 'npub123abc',
        name: 'Jane Doe',
      });
      const result = canMessageContact(contact, 'nostr_pubkey');
      expect(result.canMessage).toBe(true);
      expect(result.pubkey).toBe('npub123abc');
    });

    it('should truncate pubkey for display name when no name field', () => {
      const contact = createMockContact('1', {
        pubkey: 'npub123abc456def',
      });
      const result = canMessageContact(contact);
      expect(result.canMessage).toBe(true);
      expect(result.displayName).toBe('npub123a...');
    });
  });

  describe('getMessageableContacts', () => {
    it('should filter to only messageable contacts', () => {
      const contacts = [
        createMockContact('1', { pubkey: 'npub123', name: 'User 1' }),
        createMockContact('2', { name: 'User 2' }), // No pubkey
        createMockContact('3', { pubkey: 'npub456', name: 'User 3' }),
      ];
      const result = getMessageableContacts(contacts);
      expect(result.length).toBe(2);
      expect(result.map((c) => c.id)).toEqual(['1', '3']);
    });

    it('should return empty array when no contacts have pubkeys', () => {
      const contacts = [
        createMockContact('1', { name: 'User 1' }),
        createMockContact('2', { name: 'User 2' }),
      ];
      const result = getMessageableContacts(contacts);
      expect(result.length).toBe(0);
    });
  });

  describe('getDMLink', () => {
    it('should generate basic DM link', () => {
      const link = getDMLink('npub123abc');
      expect(link).toBe('/messages/npub123abc');
    });

    it('should include prefilled message', () => {
      const link = getDMLink('npub123abc', { prefilledMessage: 'Hello!' });
      expect(link).toBe('/messages/npub123abc?message=Hello!');
    });

    it('should encode special characters in message', () => {
      const link = getDMLink('npub123abc', { prefilledMessage: 'Hello & goodbye?' });
      expect(link).toContain('message=Hello%20%26%20goodbye%3F');
    });
  });

  describe('getBulkMessageLink', () => {
    it('should generate bulk message link', () => {
      const link = getBulkMessageLink(['npub1', 'npub2', 'npub3']);
      expect(link).toContain('/messages/compose');
      // URL encodes commas as %2C
      expect(link).toMatch(/recipients=npub1(%2C|,)npub2(%2C|,)npub3/);
    });

    it('should include prefilled message', () => {
      const link = getBulkMessageLink(['npub1'], { prefilledMessage: 'Hello all!' });
      // URL encodes spaces and special characters
      expect(link).toMatch(/message=Hello(%20|\+)all(%21|!)/);
    });

    it('should include group name', () => {
      const link = getBulkMessageLink(['npub1'], { groupName: 'Team A' });
      expect(link).toMatch(/groupName=Team(%20|\+)A/);
    });
  });

  describe('formatMessageTemplate', () => {
    it('should replace placeholders with contact data', () => {
      const contact = createMockContact('1', {
        name: 'John',
        email: 'john@example.com',
      });
      const result = formatMessageTemplate('Hello {{name}}, your email is {{email}}', contact);
      expect(result).toBe('Hello John, your email is john@example.com');
    });

    it('should remove empty placeholders', () => {
      const contact = createMockContact('1', { name: 'John' });
      const result = formatMessageTemplate('Hello {{name}} {{missing}}!', contact);
      expect(result).toBe('Hello John !');
    });

    it('should handle multiple same placeholders', () => {
      const contact = createMockContact('1', { name: 'John' });
      const result = formatMessageTemplate('Hi {{name}}, {{name}} welcome!', contact);
      expect(result).toBe('Hi John, John welcome!');
    });
  });

  describe('getMessageTemplates', () => {
    it('should return base templates', () => {
      const templates = getMessageTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t) => t.id === 'follow-up')).toBe(true);
      expect(templates.some((t) => t.id === 'check-in')).toBe(true);
    });

    it('should include volunteer templates for volunteer context', () => {
      const templates = getMessageTemplates('volunteer');
      expect(templates.some((t) => t.id === 'volunteer-thanks')).toBe(true);
    });

    it('should include donor templates for fundraising context', () => {
      const templates = getMessageTemplates(undefined, 'fundraising');
      expect(templates.some((t) => t.id === 'donor-thanks')).toBe(true);
    });

    it('should include tenant templates for tenant context', () => {
      const templates = getMessageTemplates('tenant');
      expect(templates.some((t) => t.id === 'tenant-meeting')).toBe(true);
    });

    it('should include legal templates for legal context', () => {
      const templates = getMessageTemplates(undefined, 'legal');
      expect(templates.some((t) => t.id === 'legal-update')).toBe(true);
    });
  });

  describe('getContactCommunicationStats', () => {
    it('should calculate correct stats', () => {
      const messages = [
        { id: '1', contactPubkey: 'npub1', direction: 'inbound' as const, content: 'Hi', timestamp: Date.now() - 1000 },
        { id: '2', contactPubkey: 'npub1', direction: 'outbound' as const, content: 'Hello', timestamp: Date.now() - 500 },
        { id: '3', contactPubkey: 'npub1', direction: 'inbound' as const, content: 'Thanks', timestamp: Date.now() },
      ];
      const stats = getContactCommunicationStats(messages);
      expect(stats.totalMessages).toBe(3);
      expect(stats.inboundCount).toBe(2);
      expect(stats.outboundCount).toBe(1);
    });

    it('should handle empty messages', () => {
      const stats = getContactCommunicationStats([]);
      expect(stats.totalMessages).toBe(0);
      expect(stats.daysSinceLastContact).toBe(Infinity);
    });
  });
});

describe('Events Integration', () => {
  describe('calculateContactEngagement', () => {
    it('should calculate correct engagement metrics', () => {
      const attendances = [
        { eventId: '1', eventTitle: 'Event 1', eventDate: Date.now(), rsvpStatus: 'going' as const, attended: true },
        { eventId: '2', eventTitle: 'Event 2', eventDate: Date.now() - 100000, rsvpStatus: 'going' as const, attended: false },
        { eventId: '3', eventTitle: 'Event 3', eventDate: Date.now() - 200000, rsvpStatus: 'maybe' as const },
      ];
      const engagement = calculateContactEngagement(attendances);
      expect(engagement.totalEvents).toBe(3);
      expect(engagement.eventsAttended).toBe(1);
      expect(engagement.eventsRSVPd).toBe(2);
      expect(engagement.attendanceRate).toBe(0.5);
    });

    it('should handle empty attendance', () => {
      const engagement = calculateContactEngagement([]);
      expect(engagement.totalEvents).toBe(0);
      expect(engagement.attendanceRate).toBe(0);
    });
  });

  describe('groupContactsByEngagement', () => {
    it('should categorize contacts by engagement level', () => {
      const contacts = [
        createMockContact('1', { pubkey: 'npub1' }),
        createMockContact('2', { pubkey: 'npub2' }),
        createMockContact('3', { pubkey: 'npub3' }),
        createMockContact('4', {}), // No pubkey
      ];
      const rsvps: RSVP[] = [
        // npub1 - high engagement (5+ events)
        ...Array(6).fill(null).map((_, i) => ({
          id: `rsvp-1-${i}`,
          eventId: `event-${i}`,
          userPubkey: 'npub1',
          status: 'going' as const,
          timestamp: Date.now(),
        })),
        // npub2 - medium engagement (2-4 events)
        ...Array(3).fill(null).map((_, i) => ({
          id: `rsvp-2-${i}`,
          eventId: `event-${10 + i}`,
          userPubkey: 'npub2',
          status: 'going' as const,
          timestamp: Date.now(),
        })),
        // npub3 - low engagement (1 event)
        {
          id: 'rsvp-3-0',
          eventId: 'event-20',
          userPubkey: 'npub3',
          status: 'going' as const,
          timestamp: Date.now(),
        },
      ];

      const result = groupContactsByEngagement(contacts, rsvps);
      expect(result.highEngagement.length).toBe(1);
      expect(result.mediumEngagement.length).toBe(1);
      expect(result.lowEngagement.length).toBe(1);
      expect(result.noEngagement.length).toBe(1);
    });
  });
});

describe('Files Integration', () => {
  describe('suggestDocumentCategory', () => {
    it('should categorize contracts', () => {
      expect(suggestDocumentCategory('contract.pdf', 'application/pdf')).toBe('contract');
      expect(suggestDocumentCategory('lease_agreement.pdf', 'application/pdf')).toBe('contract');
    });

    it('should categorize correspondence', () => {
      expect(suggestDocumentCategory('email_correspondence.eml', 'message/rfc822')).toBe('correspondence');
      expect(suggestDocumentCategory('letter.docx', 'application/msword')).toBe('correspondence');
    });

    it('should categorize legal documents', () => {
      expect(suggestDocumentCategory('court_filing.pdf', 'application/pdf')).toBe('legal');
      expect(suggestDocumentCategory('motion.pdf', 'application/pdf')).toBe('legal');
      expect(suggestDocumentCategory('subpoena.pdf', 'application/pdf')).toBe('legal');
    });

    it('should categorize financial documents', () => {
      expect(suggestDocumentCategory('invoice.pdf', 'application/pdf')).toBe('financial');
      expect(suggestDocumentCategory('receipt.jpg', 'image/jpeg')).toBe('financial');
      expect(suggestDocumentCategory('donation_record.csv', 'text/csv')).toBe('financial');
    });

    it('should categorize identification documents', () => {
      expect(suggestDocumentCategory('drivers_license.jpg', 'image/jpeg')).toBe('identification');
      expect(suggestDocumentCategory('passport.pdf', 'application/pdf')).toBe('identification');
    });

    it('should categorize photos by mime type', () => {
      expect(suggestDocumentCategory('random_photo.jpg', 'image/jpeg')).toBe('photo');
      expect(suggestDocumentCategory('screenshot.png', 'image/png')).toBe('photo');
    });

    it('should return other for unknown types', () => {
      expect(suggestDocumentCategory('random_file.xyz', 'application/octet-stream')).toBe('other');
    });
  });

  describe('getCategoryDisplayInfo', () => {
    it('should return correct info for each category', () => {
      expect(getCategoryDisplayInfo('contract').label).toBe('Contracts');
      expect(getCategoryDisplayInfo('contract').icon).toBe('FileSignature');

      expect(getCategoryDisplayInfo('legal').label).toBe('Legal Documents');
      expect(getCategoryDisplayInfo('legal').icon).toBe('Scale');

      expect(getCategoryDisplayInfo('photo').label).toBe('Photos');
      expect(getCategoryDisplayInfo('photo').icon).toBe('Image');
    });
  });

  describe('isSensitiveDocument', () => {
    it('should flag legal documents as sensitive', () => {
      expect(isSensitiveDocument('case_file.pdf', 'legal')).toBe(true);
    });

    it('should flag financial documents as sensitive', () => {
      expect(isSensitiveDocument('tax_return.pdf', 'financial')).toBe(true);
    });

    it('should flag identification documents as sensitive', () => {
      expect(isSensitiveDocument('id_scan.jpg', 'identification')).toBe(true);
    });

    it('should flag evidence documents as sensitive', () => {
      expect(isSensitiveDocument('evidence.pdf', 'evidence')).toBe(true);
    });

    it('should flag files with sensitive patterns', () => {
      expect(isSensitiveDocument('ssn_document.pdf', 'other')).toBe(true);
      expect(isSensitiveDocument('w2_form.pdf', 'other')).toBe(true);
      expect(isSensitiveDocument('bank_statement.pdf', 'other')).toBe(true);
      expect(isSensitiveDocument('medical_records.pdf', 'other')).toBe(true);
      expect(isSensitiveDocument('confidential_report.docx', 'other')).toBe(true);
    });

    it('should not flag regular documents', () => {
      expect(isSensitiveDocument('meeting_notes.docx', 'other')).toBe(false);
      expect(isSensitiveDocument('photo.jpg', 'photo')).toBe(false);
    });
  });

  describe('groupAttachmentsByCategory', () => {
    it('should group attachments by category', () => {
      const attachments: RecordAttachment[] = [
        { id: '1', recordId: 'r1', tableId: 't1', groupId: 'g1', fileId: 'f1', fileName: 'contract.pdf', fileType: 'application/pdf', addedBy: 'user1', addedAt: Date.now() },
        { id: '2', recordId: 'r1', tableId: 't1', groupId: 'g1', fileId: 'f2', fileName: 'photo.jpg', fileType: 'image/jpeg', addedBy: 'user1', addedAt: Date.now() },
        { id: '3', recordId: 'r1', tableId: 't1', groupId: 'g1', fileId: 'f3', fileName: 'court_filing.pdf', fileType: 'application/pdf', addedBy: 'user1', addedAt: Date.now() },
      ];

      const grouped = groupAttachmentsByCategory(attachments);
      expect(grouped.get('contract')?.length).toBe(1);
      expect(grouped.get('photo')?.length).toBe(1);
      expect(grouped.get('legal')?.length).toBe(1);
    });
  });
});
