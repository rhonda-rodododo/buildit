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
 * Nostr event kinds for events
 */
export const EVENT_KINDS = {
  EVENT: 31923, // Parameterized replaceable event
  RSVP: 31924,  // RSVP event
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
