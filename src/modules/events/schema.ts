/**
 * Events Module Database Schema
 * Contains all database table definitions for the events module
 */

import type { TableSchema } from '@/types/modules';

/**
 * Event table interface
 */
export interface DBEvent {
  id: string; // event id (primary key)
  groupId?: string;
  title: string;
  description: string;
  startTime: number;
  endTime?: number;
  location?: string;
  privacy: 'public' | 'group' | 'private' | 'direct-action';
  capacity?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  tags: string; // comma-separated
  imageUrl?: string;
  locationRevealTime?: number;
}

/**
 * RSVP table interface
 */
export interface DBRSVP {
  id?: number; // auto-increment
  eventId: string;
  userPubkey: string;
  status: 'going' | 'maybe' | 'not-going';
  timestamp: number;
  note?: string;
}

/**
 * Volunteer role table interface
 */
export interface DBEventVolunteerRole {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  spotsNeeded: number;
  spotsFilled: number;
  requiredTrainings?: string; // JSON stringified array
  shiftStart?: number;
  shiftEnd?: number;
  created: number;
  createdBy: string;
}

/**
 * Volunteer signup table interface
 */
export interface DBEventVolunteerSignup {
  id: string;
  eventId: string;
  roleId: string;
  contactId: string;
  contactPubkey?: string;
  status: 'pending' | 'confirmed' | 'declined' | 'no-show';
  signupTime: number;
  confirmedBy?: string;
  notes?: string;
  created: number;
  updated: number;
}

/**
 * Events module schema definition
 */
export const eventsSchema: TableSchema[] = [
  {
    name: 'events',
    schema: 'id, groupId, startTime, createdBy, privacy',
    indexes: ['id', 'groupId', 'startTime', 'createdBy', 'privacy'],
  },
  {
    name: 'rsvps',
    schema: '++id, [eventId+userPubkey], eventId, userPubkey, status',
    indexes: ['++id', '[eventId+userPubkey]', 'eventId', 'userPubkey', 'status'],
  },
  {
    name: 'eventVolunteerRoles',
    schema: 'id, eventId, created',
    indexes: ['id', 'eventId', 'created'],
  },
  {
    name: 'eventVolunteerSignups',
    schema: 'id, eventId, roleId, contactId, contactPubkey, status, signupTime',
    indexes: ['id', 'eventId', 'roleId', 'contactId', 'contactPubkey', 'status', 'signupTime'],
  },
];

// Note: DBEvent and DBRSVP are already exported from @/core/storage/db
// No need to re-export them here
