/**
 * Hotlines Module Database Schema
 * Contains all database table definitions for the hotlines module
 */

import type { TableSchema } from '@/types/modules';
import type {
  HotlineType,
  CallStatus,
  DispatchStatus,
  Priority,
} from './types';

/**
 * Hotline table interface
 */
export interface DBHotline {
  id: string;
  groupId: string;
  name: string;
  phone?: string;
  type: HotlineType;
  description?: string;
  isActive: number; // 0 or 1 for boolean in IndexedDB
  operatingHours?: string; // JSON stringified OperatingHours
  createdBy: string;
  created: number;
  updated: number;
}

/**
 * Hotline call table interface
 */
export interface DBHotlineCall {
  id: string;
  hotlineId: string;
  groupId: string;
  callerName?: string;
  callerPhone?: string;
  callerPubkey?: string;
  takenBy: string;
  callTime: number;
  endTime?: number;
  status: CallStatus;
  summary: string;
  priority: Priority;
  category?: string;
  followUpNeeded: number; // 0 or 1 for boolean
  followUpNotes?: string;
  linkedRecordId?: string;
  linkedRecordTable?: string;
  created: number;
  updated: number;
}

/**
 * Hotline dispatch table interface
 */
export interface DBHotlineDispatch {
  id: string;
  callId: string;
  hotlineId: string;
  groupId: string;
  dispatchedTo: string;
  dispatchTime: number;
  responseTime?: number;
  status: DispatchStatus;
  notes?: string;
  created: number;
  updated: number;
}

/**
 * Hotline operator table interface
 */
export interface DBHotlineOperator {
  id: string;
  hotlineId: string;
  groupId: string;
  operatorPubkey: string;
  shiftStart: number;
  shiftEnd?: number;
  isActive: number; // 0 or 1 for boolean
}

/**
 * Hotlines module schema definition
 */
export const hotlinesSchema: TableSchema[] = [
  {
    name: 'hotlines',
    schema: 'id, groupId, type, isActive, created',
    indexes: ['id', 'groupId', 'type', 'isActive', 'created'],
  },
  {
    name: 'hotlineCalls',
    schema: 'id, hotlineId, groupId, takenBy, status, priority, callTime, created',
    indexes: ['id', 'hotlineId', 'groupId', 'takenBy', 'status', 'priority', 'callTime', 'created'],
  },
  {
    name: 'hotlineDispatches',
    schema: 'id, callId, hotlineId, groupId, dispatchedTo, status, dispatchTime',
    indexes: ['id', 'callId', 'hotlineId', 'groupId', 'dispatchedTo', 'status', 'dispatchTime'],
  },
  {
    name: 'hotlineOperators',
    schema: 'id, hotlineId, groupId, operatorPubkey, isActive, shiftStart',
    indexes: ['id', 'hotlineId', 'groupId', 'operatorPubkey', 'isActive', 'shiftStart'],
  },
];

export default hotlinesSchema;
