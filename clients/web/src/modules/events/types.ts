/**
 * Events Module Types
 *
 * Re-exports generated Zod schemas and types from protocol schemas.
 * UI-only types (form data, computed results, Nostr kind constants) are defined here.
 */

import type { CustomFieldValues } from '@/modules/custom-fields/types'

// Re-export all generated Zod schemas and types
export {
  LocationSchema,
  type Location,
  RecurrenceRuleSchema,
  type RecurrenceRule,
  AttachmentSchema,
  type Attachment,
  EventSchema,
  type Event,
  RSVPSchema,
  type RSVP,
  BreakoutRoomConfigSchema,
  type BreakoutRoomConfig,
  EventVirtualConfigSchema,
  type EventVirtualConfig,
  EventVolunteerRoleSchema,
  type EventVolunteerRole,
  EventVolunteerSignupSchema,
  type EventVolunteerSignup,
  EVENTS_SCHEMA_VERSION,
} from '@/generated/validation/events.zod';

// ── UI-Only Types ────────────────────────────────────────────────

import type { Event, EventVirtualConfig, EventVolunteerRole, EventVolunteerSignup } from '@/generated/validation/events.zod';

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
 * Extended Event with passthrough fields used by the app layer.
 * The protocol Event schema uses `.passthrough()`, so these extra fields
 * are preserved at runtime but not reflected in the generated TS type.
 */
export interface AppEvent extends Event {
  groupId?: string
  coHosts?: string[]
  imageUrl?: string
  tags?: string[]
}

/**
 * Event with RSVP counts
 */
export interface EventWithRSVPs extends AppEvent {
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
 * Event attendance type for hybrid events
 */
export type EventAttendanceType = 'in-person' | 'virtual' | 'hybrid'

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
export interface EventWithVirtualConfig extends AppEvent {
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
