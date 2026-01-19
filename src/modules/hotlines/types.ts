/**
 * Hotlines Module Types
 * Types for jail support hotlines, dispatch, and call logging
 */

import { z } from 'zod';

/**
 * Hotline types for different use cases
 */
export type HotlineType =
  | 'jail-support' // Jail support / arrestee intake
  | 'legal-intake' // Legal case intake
  | 'dispatch' // General dispatch (medics, security, etc.)
  | 'crisis' // Crisis line
  | 'general'; // General information

/**
 * Call status tracking
 */
export type CallStatus =
  | 'active' // Currently on the call
  | 'on-hold' // Call on hold
  | 'completed' // Call completed
  | 'escalated' // Escalated to supervisor
  | 'transferred'; // Transferred to another operator

/**
 * Dispatch status for volunteer deployment
 */
export type DispatchStatus =
  | 'pending' // Waiting for volunteer response
  | 'accepted' // Volunteer accepted
  | 'declined' // Volunteer declined
  | 'en-route' // Volunteer is on the way
  | 'on-scene' // Volunteer arrived
  | 'completed'; // Dispatch completed

/**
 * Call priority levels
 */
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Operating hours configuration
 */
export interface OperatingHours {
  days: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone?: string;
  is24Hours?: boolean;
}

/**
 * Hotline definition
 */
export interface Hotline {
  id: string;
  groupId: string;
  name: string;
  phone?: string; // External phone number (optional)
  type: HotlineType;
  description?: string;
  isActive: boolean;
  operatingHours?: OperatingHours;
  createdBy: string;
  created: number;
  updated: number;
}

/**
 * Hotline call record
 */
export interface HotlineCall {
  id: string;
  hotlineId: string;
  groupId: string;
  callerName?: string;
  callerPhone?: string;
  callerPubkey?: string; // If known user
  takenBy: string; // Operator pubkey
  callTime: number;
  endTime?: number;
  status: CallStatus;
  summary: string;
  priority: Priority;
  category?: string; // Hotline-specific categories
  followUpNeeded: boolean;
  followUpNotes?: string;
  linkedRecordId?: string; // Link to CRM record
  linkedRecordTable?: string;
  created: number;
  updated: number;
}

/**
 * Dispatch record for volunteer deployment
 */
export interface HotlineDispatch {
  id: string;
  callId: string;
  hotlineId: string;
  groupId: string;
  dispatchedTo: string; // Volunteer pubkey
  dispatchTime: number;
  responseTime?: number;
  status: DispatchStatus;
  notes?: string;
  created: number;
  updated: number;
}

/**
 * Operator shift tracking
 */
export interface HotlineOperator {
  id: string;
  hotlineId: string;
  groupId: string;
  operatorPubkey: string;
  shiftStart: number;
  shiftEnd?: number;
  isActive: boolean;
}

/**
 * Data for creating a new hotline
 */
export interface CreateHotlineData {
  name: string;
  type: HotlineType;
  phone?: string;
  description?: string;
  operatingHours?: OperatingHours;
}

/**
 * Data for updating a hotline
 */
export interface UpdateHotlineData {
  name?: string;
  phone?: string;
  description?: string;
  isActive?: boolean;
  operatingHours?: OperatingHours;
}

/**
 * Data for starting a call
 */
export interface CallerData {
  callerName?: string;
  callerPhone?: string;
  callerPubkey?: string;
  priority?: Priority;
  category?: string;
}

/**
 * Data for updating a call
 */
export interface UpdateCallData {
  status?: CallStatus;
  priority?: Priority;
  category?: string;
  summary?: string;
  followUpNeeded?: boolean;
  followUpNotes?: string;
}

/**
 * Options for fetching call logs
 */
export interface CallLogOptions {
  limit?: number;
  offset?: number;
  status?: CallStatus;
  priority?: Priority;
  startDate?: number;
  endDate?: number;
  operatorPubkey?: string;
}

/**
 * Hotline statistics
 */
export interface HotlineStats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  escalatedCalls: number;
  averageCallDuration: number; // in seconds
  callsByPriority: Record<Priority, number>;
  activeOperators: number;
}

/**
 * Zod Schemas for Validation
 */

export const HotlineTypeSchema = z.enum([
  'jail-support',
  'legal-intake',
  'dispatch',
  'crisis',
  'general',
]);

export const CallStatusSchema = z.enum([
  'active',
  'on-hold',
  'completed',
  'escalated',
  'transferred',
]);

export const DispatchStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'en-route',
  'on-scene',
  'completed',
]);

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const OperatingHoursSchema = z.object({
  days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  timezone: z.string().optional(),
  is24Hours: z.boolean().optional(),
});

export const HotlineSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  type: HotlineTypeSchema,
  description: z.string().optional(),
  isActive: z.boolean(),
  operatingHours: OperatingHoursSchema.optional(),
  createdBy: z.string(),
  created: z.number(),
  updated: z.number(),
});

export const HotlineCallSchema = z.object({
  id: z.string(),
  hotlineId: z.string(),
  groupId: z.string(),
  callerName: z.string().optional(),
  callerPhone: z.string().optional(),
  callerPubkey: z.string().optional(),
  takenBy: z.string(),
  callTime: z.number(),
  endTime: z.number().optional(),
  status: CallStatusSchema,
  summary: z.string(),
  priority: PrioritySchema,
  category: z.string().optional(),
  followUpNeeded: z.boolean(),
  followUpNotes: z.string().optional(),
  linkedRecordId: z.string().optional(),
  linkedRecordTable: z.string().optional(),
  created: z.number(),
  updated: z.number(),
});

export const HotlineDispatchSchema = z.object({
  id: z.string(),
  callId: z.string(),
  hotlineId: z.string(),
  groupId: z.string(),
  dispatchedTo: z.string(),
  dispatchTime: z.number(),
  responseTime: z.number().optional(),
  status: DispatchStatusSchema,
  notes: z.string().optional(),
  created: z.number(),
  updated: z.number(),
});

export const CreateHotlineDataSchema = z.object({
  name: z.string().min(1).max(100),
  type: HotlineTypeSchema,
  phone: z.string().optional(),
  description: z.string().optional(),
  operatingHours: OperatingHoursSchema.optional(),
});
