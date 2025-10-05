import { z } from 'zod'
import type { CustomFieldValues } from '@/modules/custom-fields/types'

/**
 * Mutual aid request/offer types
 */
export type AidType = 'request' | 'offer'

/**
 * Aid categories
 */
export type AidCategory =
  | 'food'
  | 'housing'
  | 'transport'
  | 'childcare'
  | 'medical'
  | 'legal'
  | 'skills'
  | 'supplies'
  | 'financial'
  | 'other'

/**
 * Aid status workflow
 */
export type AidStatus = 'open' | 'matched' | 'in-progress' | 'fulfilled' | 'closed'

/**
 * Urgency levels
 */
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * Aid item schema
 */
export const AidItemSchema = z.object({
  id: z.string(),
  type: z.enum(['request', 'offer']),
  category: z.enum([
    'food',
    'housing',
    'transport',
    'childcare',
    'medical',
    'legal',
    'skills',
    'supplies',
    'financial',
    'other',
  ]),
  title: z.string().min(1),
  description: z.string(),
  location: z.string().optional(),
  groupId: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  status: z.enum(['open', 'matched', 'in-progress', 'fulfilled', 'closed']),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  quantity: z.number().optional(),
  expiresAt: z.number().optional(),
  tags: z.array(z.string()).default([]),
  // Privacy
  isAnonymous: z.boolean().default(false),
  showLocation: z.boolean().default(true),
  // Matching
  matchedWith: z.string().optional(), // ID of matched request/offer
  fulfilledBy: z.string().optional(), // Pubkey of fulfiller
  // Custom fields (dynamic fields from custom-fields module)
  customFields: z.record(z.unknown()).optional(), // CustomFieldValues
})

export type AidItem = z.infer<typeof AidItemSchema>

/**
 * Ride share specific schema
 */
export const RideShareSchema = z.object({
  id: z.string(),
  type: z.enum(['request', 'offer']),
  origin: z.string(),
  destination: z.string(),
  departureTime: z.number(),
  flexibility: z.number().default(0), // Minutes of flexibility
  seats: z.number().optional(), // For offers
  needsSeats: z.number().default(1), // For requests
  recurring: z.boolean().default(false),
  recurringDays: z.array(z.string()).optional(), // ['monday', 'wednesday', etc]
  createdBy: z.string(),
  createdAt: z.number(),
  status: z.enum(['open', 'matched', 'completed', 'cancelled']),
  groupId: z.string().optional(),
  matchedWith: z.string().optional(),
})

export type RideShare = z.infer<typeof RideShareSchema>

/**
 * Match result
 */
export interface MatchResult {
  requestId: string
  offerId: string
  score: number // 0-100
  reasons: string[]
}

/**
 * Nostr event kinds for mutual aid
 */
export const MUTUAL_AID_KINDS = {
  ITEM: 31930, // General mutual aid item (request/offer)
  RIDE_SHARE: 31931, // Ride share
  MATCH: 31932, // Match notification
} as const

/**
 * Create aid item form data
 */
export interface CreateAidItemFormData {
  type: AidType
  category: AidCategory
  title: string
  description: string
  location?: string
  urgency?: UrgencyLevel
  quantity?: number
  expiresAt?: Date
  tags?: string[]
  isAnonymous?: boolean
  showLocation?: boolean
  groupId?: string
  customFields?: CustomFieldValues
}

/**
 * Create ride share form data
 */
export interface CreateRideShareFormData {
  type: AidType
  origin: string
  destination: string
  departureTime: Date
  flexibility?: number
  seats?: number
  needsSeats?: number
  recurring?: boolean
  recurringDays?: string[]
  groupId?: string
}
