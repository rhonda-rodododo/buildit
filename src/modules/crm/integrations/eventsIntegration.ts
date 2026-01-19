/**
 * Events Integration for CRM Module
 * Links CRM contacts to event attendance and tracks engagement
 */

import { logger } from '@/lib/logger';
import type { Event, RSVP, RSVPStatus } from '@/modules/events/types';
import type { DatabaseRecord } from '@/modules/database/types';

/**
 * Contact event attendance record
 */
export interface ContactEventAttendance {
  eventId: string;
  eventTitle: string;
  eventDate: number;
  rsvpStatus: RSVPStatus;
  attended?: boolean;
  notes?: string;
}

/**
 * Contact engagement metrics from events
 */
export interface ContactEventEngagement {
  totalEvents: number;
  eventsAttended: number;
  eventsRSVPd: number;
  lastEventDate?: number;
  attendanceRate: number;
}

/**
 * Get events a contact has RSVPd to based on their pubkey
 * Used for contacts with linked social profiles
 */
export async function getContactEvents(
  contactPubkey: string,
  rsvps: RSVP[],
  events: Map<string, Event>
): Promise<ContactEventAttendance[]> {
  try {
    const contactRsvps = rsvps.filter((r) => r.userPubkey === contactPubkey);

    return contactRsvps
      .map((rsvp) => {
        const event = events.get(rsvp.eventId);
        if (!event) return null;

        return {
          eventId: rsvp.eventId,
          eventTitle: event.title,
          eventDate: event.startTime,
          rsvpStatus: rsvp.status,
        };
      })
      .filter((attendance): attendance is ContactEventAttendance => attendance !== null)
      .sort((a, b) => b.eventDate - a.eventDate);
  } catch (error) {
    logger.error('Failed to get contact events:', error);
    return [];
  }
}

/**
 * Calculate engagement metrics for a contact
 */
export function calculateContactEngagement(
  attendances: ContactEventAttendance[]
): ContactEventEngagement {
  const totalEvents = attendances.length;
  const eventsAttended = attendances.filter((a) => a.attended === true).length;
  const eventsRSVPd = attendances.filter((a) => a.rsvpStatus === 'going').length;
  const lastEventDate = attendances.length > 0 ? attendances[0].eventDate : undefined;
  const attendanceRate = eventsRSVPd > 0 ? eventsAttended / eventsRSVPd : 0;

  return {
    totalEvents,
    eventsAttended,
    eventsRSVPd,
    lastEventDate,
    attendanceRate,
  };
}

/**
 * Find contacts who attended a specific event
 * Returns contact records that have the matching pubkey
 */
export function findContactsAtEvent(
  eventId: string,
  rsvps: RSVP[],
  contacts: DatabaseRecord[],
  pubkeyFieldName: string = 'pubkey'
): DatabaseRecord[] {
  // Get all going RSVPs for this event
  const eventRsvps = rsvps.filter((r) => r.eventId === eventId && r.status === 'going');
  const attendeePubkeys = new Set(eventRsvps.map((r) => r.userPubkey));

  // Find matching contacts
  return contacts.filter((contact) => {
    const pubkey = contact.customFields[pubkeyFieldName];
    return typeof pubkey === 'string' && attendeePubkeys.has(pubkey);
  });
}

/**
 * Create a contact from an event RSVP
 * Used when an unknown person RSVPs to create a new CRM record
 */
export function createContactFromRSVP(
  rsvp: RSVP,
  event: Event,
  defaultFields?: Record<string, unknown>
): Partial<DatabaseRecord['customFields']> {
  return {
    pubkey: rsvp.userPubkey,
    source: 'event-rsvp',
    sourceEventId: rsvp.eventId,
    sourceEventTitle: event.title,
    firstContactDate: rsvp.timestamp,
    ...defaultFields,
  };
}

/**
 * Get upcoming events for contacts (for follow-up reminders)
 */
export function getUpcomingContactEvents(
  contactPubkey: string,
  rsvps: RSVP[],
  events: Map<string, Event>,
  daysAhead: number = 7
): ContactEventAttendance[] {
  const now = Date.now();
  const futureLimit = now + daysAhead * 24 * 60 * 60 * 1000;

  const contactRsvps = rsvps.filter(
    (r) => r.userPubkey === contactPubkey && r.status === 'going'
  );

  return contactRsvps
    .map((rsvp) => {
      const event = events.get(rsvp.eventId);
      if (!event || event.startTime < now || event.startTime > futureLimit) {
        return null;
      }

      return {
        eventId: rsvp.eventId,
        eventTitle: event.title,
        eventDate: event.startTime,
        rsvpStatus: rsvp.status,
      };
    })
    .filter((attendance): attendance is ContactEventAttendance => attendance !== null)
    .sort((a, b) => a.eventDate - b.eventDate);
}

/**
 * Get contacts who haven't attended events recently
 * Useful for re-engagement outreach
 */
export function getInactiveContacts(
  contacts: DatabaseRecord[],
  rsvps: RSVP[],
  pubkeyFieldName: string = 'pubkey',
  inactiveDays: number = 30
): DatabaseRecord[] {
  const cutoffDate = Date.now() - inactiveDays * 24 * 60 * 60 * 1000;

  // Build a map of pubkey -> last RSVP timestamp
  const lastRsvpByPubkey = new Map<string, number>();
  for (const rsvp of rsvps) {
    const existing = lastRsvpByPubkey.get(rsvp.userPubkey);
    if (!existing || rsvp.timestamp > existing) {
      lastRsvpByPubkey.set(rsvp.userPubkey, rsvp.timestamp);
    }
  }

  return contacts.filter((contact) => {
    const pubkey = contact.customFields[pubkeyFieldName];
    if (typeof pubkey !== 'string') return false;

    const lastRsvp = lastRsvpByPubkey.get(pubkey);
    // Include contacts who have never RSVPd or whose last RSVP was before cutoff
    return !lastRsvp || lastRsvp < cutoffDate;
  });
}

/**
 * Group contacts by their attendance frequency
 */
export function groupContactsByEngagement(
  contacts: DatabaseRecord[],
  rsvps: RSVP[],
  pubkeyFieldName: string = 'pubkey'
): {
  highEngagement: DatabaseRecord[];
  mediumEngagement: DatabaseRecord[];
  lowEngagement: DatabaseRecord[];
  noEngagement: DatabaseRecord[];
} {
  // Count RSVPs per pubkey
  const rsvpCountByPubkey = new Map<string, number>();
  for (const rsvp of rsvps) {
    if (rsvp.status === 'going') {
      const count = rsvpCountByPubkey.get(rsvp.userPubkey) || 0;
      rsvpCountByPubkey.set(rsvp.userPubkey, count + 1);
    }
  }

  const highEngagement: DatabaseRecord[] = [];
  const mediumEngagement: DatabaseRecord[] = [];
  const lowEngagement: DatabaseRecord[] = [];
  const noEngagement: DatabaseRecord[] = [];

  for (const contact of contacts) {
    const pubkey = contact.customFields[pubkeyFieldName];
    if (typeof pubkey !== 'string') {
      noEngagement.push(contact);
      continue;
    }

    const count = rsvpCountByPubkey.get(pubkey) || 0;
    if (count >= 5) {
      highEngagement.push(contact);
    } else if (count >= 2) {
      mediumEngagement.push(contact);
    } else if (count >= 1) {
      lowEngagement.push(contact);
    } else {
      noEngagement.push(contact);
    }
  }

  return { highEngagement, mediumEngagement, lowEngagement, noEngagement };
}
