import { z } from 'zod'
import type { CustomFieldValues } from '@/modules/custom-fields/types'

/**
 * Event privacy/visibility levels determining encryption and visibility
 * Maps to protocol's 'visibility' field
 */
export type EventPrivacy = 'public' | 'group' | 'private'

/**
 * RSVP status for event attendees
 * Uses underscore format to match protocol schema
 */
export type RSVPStatus = 'going' | 'maybe' | 'not_going'

/**
 * Event schema with Zod validation
 */
export const EventSchema = z.object({
  id: z.string(),
  groupId: z.string().optional(),
  title: z.string().min(1),
  description: z.string(),
  location: z.string().optional(),
  startTime: z.number(), // Unix timestamp (maps to protocol's startAt)
  endTime: z.number().optional(), // Unix timestamp (maps to protocol's endAt)
  privacy: z.enum(['public', 'group', 'private']), // Maps to protocol's visibility
  capacity: z.number().optional(), // Max attendees (maps to protocol's maxAttendees)
  createdBy: z.string(), // Pubkey of creator
  createdAt: z.number(),
  updatedAt: z.number(),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
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
  userPubkey: z.string(), // Maps to protocol's pubkey
  status: z.enum(['going', 'maybe', 'not_going']), // Underscore format matches protocol
  timestamp: z.number(), // Maps to protocol's respondedAt
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
  groupId?: string
  customFields?: CustomFieldValues
}

/**
 * Volunteer role signup status
 */
export type VolunteerSignupStatus = 'pending' | 'confirmed' | 'declined' | 'no-show'

/**
 * Calling role types for volunteer positions
 */
export type VolunteerCallingRole =
  | 'hotline-operator'
  | 'dispatcher'
  | 'medic'
  | 'coordinator'
  | 'lead'

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

  // Calling requirements (optional)
  callingRoleRequired?: VolunteerCallingRole // What calling role this position requires
  hotlineAccess?: string[] // Hotline IDs this role grants access to
  requiresPSTN?: boolean // Whether this role needs PSTN (phone) access
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

/**
 * Event attendance type for hybrid events
 */
export type EventAttendanceType = 'in-person' | 'virtual' | 'hybrid'

/**
 * Breakout room configuration for virtual events
 */
export interface BreakoutRoomConfig {
  enabled: boolean
  autoAssign: boolean
  roomCount?: number
  roomNames?: string[]
  allowSelfSelect: boolean
  duration?: number // minutes
}

/**
 * Virtual event configuration
 * Enables hybrid events with integrated video conferencing
 */
export interface EventVirtualConfig {
  enabled: boolean
  conferenceRoomId?: string // Auto-created when event starts
  autoStartMinutes: number // Minutes before event to start room (default: 15)
  waitingRoomEnabled: boolean
  recordingEnabled: boolean
  recordingConsentRequired: boolean
  maxVirtualAttendees?: number
  breakoutRoomsEnabled: boolean
  breakoutConfig?: BreakoutRoomConfig
  recordingUrl?: string // After event, if recorded
  e2eeRequired: boolean
}

/**
 * Zod schema for virtual event config
 */
export const EventVirtualConfigSchema = z.object({
  enabled: z.boolean(),
  conferenceRoomId: z.string().optional(),
  autoStartMinutes: z.number().int().min(0).max(60).default(15),
  waitingRoomEnabled: z.boolean().default(true),
  recordingEnabled: z.boolean().default(false),
  recordingConsentRequired: z.boolean().default(true),
  maxVirtualAttendees: z.number().int().min(1).optional(),
  breakoutRoomsEnabled: z.boolean().default(false),
  breakoutConfig: z.object({
    enabled: z.boolean(),
    autoAssign: z.boolean(),
    roomCount: z.number().int().min(2).optional(),
    roomNames: z.array(z.string()).optional(),
    allowSelfSelect: z.boolean(),
    duration: z.number().int().min(1).optional(),
  }).optional(),
  recordingUrl: z.string().url().optional(),
  e2eeRequired: z.boolean().default(true),
})

/**
 * Virtual attendance tracking
 */
export interface VirtualAttendance {
  id: string
  eventId: string
  pubkey: string
  joinedAt: number
  leftAt?: number
  durationSeconds: number
  breakoutRoomId?: string
}

/**
 * Virtual attendance stats for an event
 */
export interface VirtualAttendanceStats {
  totalVirtualAttendees: number
  peakConcurrentAttendees: number
  averageDurationMinutes: number
  attendees: Array<{
    pubkey: string
    totalDurationMinutes: number
    joinedAt: number
  }>
}

/**
 * Event with virtual configuration
 */
export interface EventWithVirtualConfig extends Event {
  attendanceType: EventAttendanceType
  virtualConfig?: EventVirtualConfig
}

/**
 * Create event form data with virtual options
 */
export interface CreateEventWithVirtualFormData extends CreateEventFormData {
  attendanceType?: EventAttendanceType
  virtualConfig?: Partial<EventVirtualConfig>
}
