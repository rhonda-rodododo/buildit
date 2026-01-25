import { z } from 'zod'
import type { CustomFieldValues } from '@/modules/custom-fields/types'

/**
 * Event privacy levels determining encryption and visibility
 */
export type EventPrivacy = 'public' | 'group' | 'private' | 'direct-action'

/**
 * RSVP status for event attendees
 */
export type RSVPStatus = 'going' | 'maybe' | 'not-going'

/**
 * Event schema with Zod validation
 */
export const EventSchema = z.object({
  id: z.string(),
  groupId: z.string().optional(),
  title: z.string().min(1),
  description: z.string(),
  location: z.string().optional(),
  startTime: z.number(), // Unix timestamp
  endTime: z.number().optional(), // Unix timestamp
  privacy: z.enum(['public', 'group', 'private', 'direct-action']),
  capacity: z.number().optional(), // Max attendees
  createdBy: z.string(), // Pubkey of creator
  createdAt: z.number(),
  updatedAt: z.number(),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
  // Direct action specific: time-delayed location reveal
  locationRevealTime: z.number().optional(),
  // Co-hosting support
  coHosts: z.array(z.string()).default([]), // Pubkeys
  // Custom fields (dynamic fields from custom-fields module)
  customFields: z.record(z.string(), z.unknown()).optional(), // CustomFieldValues
})

export type Event = z.infer<typeof EventSchema>

/**
 * RSVP schema
 */
export const RSVPSchema = z.object({
  eventId: z.string(),
  userPubkey: z.string(),
  status: z.enum(['going', 'maybe', 'not-going']),
  timestamp: z.number(),
  note: z.string().optional(),
})

export type RSVP = z.infer<typeof RSVPSchema>

/**
 * Event with RSVP counts
 */
export interface EventWithRSVPs extends Event {
  rsvpCounts: {
    going: number
    maybe: number
    notGoing: number
  }
  userRSVP?: RSVPStatus
}

/**
 * Nostr event kinds for events (imported from centralized sync module)
 */
import { BUILD_IT_KINDS } from '@/core/storage/sync'

export const EVENT_KINDS = {
  EVENT: BUILD_IT_KINDS.EVENT,
  RSVP: BUILD_IT_KINDS.RSVP,
} as const

/**
 * Create event form data
 */
export interface CreateEventFormData {
  title: string
  description: string
  location?: string
  startTime: Date
  endTime?: Date
  privacy: EventPrivacy
  capacity?: number
  tags?: string[]
  imageUrl?: string
  locationRevealTime?: Date
  groupId?: string
  customFields?: CustomFieldValues
}

/**
 * Volunteer role signup status
 */
export type VolunteerSignupStatus = 'pending' | 'confirmed' | 'declined' | 'no-show'

/**
 * Event Volunteer Role
 * Defines a role that volunteers can sign up for at an event
 */
export interface EventVolunteerRole {
  id: string
  eventId: string
  name: string
  description?: string
  spotsNeeded: number
  spotsFilled: number
  requiredTrainings?: string[] // Training IDs from CRM
  shiftStart?: number // Unix timestamp
  shiftEnd?: number // Unix timestamp
  created: number
  createdBy: string
}

/**
 * Event Volunteer Signup
 * Records a volunteer's signup for a specific role
 */
export interface EventVolunteerSignup {
  id: string
  eventId: string
  roleId: string
  contactId: string // CRM contact ID
  contactPubkey?: string // If linked to user
  status: VolunteerSignupStatus
  signupTime: number
  confirmedBy?: string
  notes?: string
  created: number
  updated: number
}

/**
 * Volunteer role with signup data
 */
export interface EventVolunteerRoleWithSignups extends EventVolunteerRole {
  signups: EventVolunteerSignup[]
}

/**
 * Create volunteer role data
 */
export interface CreateVolunteerRoleData {
  name: string
  description?: string
  spotsNeeded: number
  requiredTrainings?: string[]
  shiftStart?: number
  shiftEnd?: number
}

/**
 * Zod schemas for volunteer types
 */
export const EventVolunteerRoleSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  spotsNeeded: z.number().int().min(1),
  spotsFilled: z.number().int().min(0),
  requiredTrainings: z.array(z.string()).optional(),
  shiftStart: z.number().optional(),
  shiftEnd: z.number().optional(),
  created: z.number(),
  createdBy: z.string(),
})

export const EventVolunteerSignupSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  roleId: z.string(),
  contactId: z.string(),
  contactPubkey: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'declined', 'no-show']),
  signupTime: z.number(),
  confirmedBy: z.string().optional(),
  notes: z.string().optional(),
  created: z.number(),
  updated: z.number(),
})
