/**
 * CRM ↔ Calling Module Integration
 * Provides caller ID lookup, automatic contact creation, and call history
 */

import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';
import type { CRMContact } from '../types';

/**
 * Call history record
 */
export interface CallHistoryRecord {
  id: string;
  contactId: string;
  direction: 'inbound' | 'outbound';
  phoneNumber: string;
  startedAt: number;
  endedAt?: number;
  duration: number; // seconds
  status: 'completed' | 'missed' | 'voicemail' | 'failed';
  recordingUrl?: string;
  transcriptUrl?: string;
  notes?: string;
  operatorPubkey?: string;
  hotlineId?: string;
  created: number;
}

/**
 * Caller ID lookup result
 */
export interface CallerLookupResult {
  found: boolean;
  contact?: CRMContact;
  matchedField?: 'phone' | 'mobile' | 'work_phone';
  previousCalls?: number;
  lastCallDate?: number;
}

/**
 * Engagement score update from call
 */
export interface CallEngagementUpdate {
  contactId: string;
  previousScore: number;
  newScore: number;
  callDuration: number;
  callDirection: 'inbound' | 'outbound';
}

/**
 * Contact creation from call data
 */
export interface CreateContactFromCallData {
  phoneNumber: string;
  name?: string;
  notes?: string;
  hotlineId?: string;
  operatorPubkey?: string;
}

/**
 * CRM Calling Integration Class
 * Handles integration between CRM module and calling module
 */
export class CRMCallingIntegration {
  private static instance: CRMCallingIntegration | null = null;

  // In-memory call history cache (would be persisted in real implementation)
  private callHistory: Map<string, CallHistoryRecord[]> = new Map();

  /**
   * Get singleton instance
   */
  static getInstance(): CRMCallingIntegration {
    if (!this.instance) {
      this.instance = new CRMCallingIntegration();
    }
    return this.instance;
  }

  /**
   * Look up contact by phone number
   * Used for caller ID during inbound calls
   */
  async lookupByPhone(
    phone: string,
    groupId?: string
  ): Promise<CallerLookupResult> {
    // Normalize phone number for lookup
    const normalizedPhone = this.normalizePhoneNumber(phone);

    logger.info(`Looking up contact by phone: ${normalizedPhone}`, { groupId });

    // In a real implementation, would query the database module
    // to find contacts with matching phone fields
    // const records = await databaseManager.queryRecords({
    //   filters: [
    //     { field: 'phone', operator: 'eq', value: normalizedPhone },
    //     { field: 'mobile', operator: 'eq', value: normalizedPhone },
    //     { field: 'work_phone', operator: 'eq', value: normalizedPhone },
    //   ],
    //   operator: 'or',
    //   groupId,
    // });

    // For now, return not found as placeholder
    return {
      found: false,
    };
  }

  /**
   * Create contact from call
   * Used when an unknown caller is identified or info is collected during call
   */
  async createContactFromCall(
    data: CreateContactFromCallData,
    groupId: string
  ): Promise<CRMContact> {
    const normalizedPhone = this.normalizePhoneNumber(data.phoneNumber);

    logger.info(`Creating contact from call: ${normalizedPhone}`, {
      groupId,
      hotlineId: data.hotlineId,
    });

    // Create a new contact record
    const contact: CRMContact = {
      id: `contact-${nanoid()}`,
      tableId: '', // Would be set based on CRM template
      groupId,
      name: data.name || 'Unknown Caller',
      phone: normalizedPhone,
      customFields: {
        source: 'inbound-call',
        sourceHotline: data.hotlineId,
        firstContactDate: Date.now(),
        notes: data.notes,
      },
      created: Date.now(),
      createdBy: data.operatorPubkey || 'system',
      updated: Date.now(),
      updatedBy: data.operatorPubkey || 'system',
    };

    // In a real implementation, would save to database
    // await databaseManager.createRecord(contact);

    return contact;
  }

  /**
   * Log call interaction
   * Records a call in the contact's history
   */
  async logCallInteraction(
    contactId: string,
    call: Omit<CallHistoryRecord, 'id' | 'contactId' | 'created'>
  ): Promise<CallHistoryRecord> {
    const record: CallHistoryRecord = {
      id: `call-${nanoid()}`,
      contactId,
      ...call,
      created: Date.now(),
    };

    // Store in memory cache
    const contactCalls = this.callHistory.get(contactId) || [];
    contactCalls.push(record);
    this.callHistory.set(contactId, contactCalls);

    logger.info(`Logged call interaction for contact: ${contactId}`, {
      direction: call.direction,
      duration: call.duration,
      status: call.status,
    });

    // In a real implementation, would save to database
    // await db.callHistory.add(record);

    return record;
  }

  /**
   * Get call history for contact
   */
  async getContactCallHistory(
    contactId: string,
    options?: {
      limit?: number;
      offset?: number;
      direction?: 'inbound' | 'outbound';
      dateFrom?: number;
      dateTo?: number;
    }
  ): Promise<CallHistoryRecord[]> {
    const calls = this.callHistory.get(contactId) || [];

    let filtered = calls;

    // Apply filters
    if (options?.direction) {
      filtered = filtered.filter((c) => c.direction === options.direction);
    }

    if (options?.dateFrom) {
      filtered = filtered.filter((c) => c.startedAt >= options.dateFrom!);
    }

    if (options?.dateTo) {
      filtered = filtered.filter((c) => c.startedAt <= options.dateTo!);
    }

    // Sort by date descending (most recent first)
    filtered.sort((a, b) => b.startedAt - a.startedAt);

    // Apply pagination
    if (options?.offset) {
      filtered = filtered.slice(options.offset);
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Update engagement score after call
   * Increases contact's engagement score based on call metrics
   */
  async updateEngagementFromCall(
    contactId: string,
    callDuration: number,
    direction: 'inbound' | 'outbound'
  ): Promise<CallEngagementUpdate> {
    // Get current engagement score (would fetch from database)
    const previousScore = 0; // Placeholder

    // Calculate score increase based on call metrics
    let scoreIncrease = 0;

    // Base points for having a call
    scoreIncrease += direction === 'inbound' ? 10 : 5;

    // Additional points based on duration (capped)
    const durationMinutes = Math.floor(callDuration / 60);
    scoreIncrease += Math.min(durationMinutes * 2, 20);

    const newScore = previousScore + scoreIncrease;

    logger.info(`Updated engagement score for contact: ${contactId}`, {
      previousScore,
      newScore,
      scoreIncrease,
      callDuration,
      direction,
    });

    // In a real implementation, would update in database
    // await databaseManager.updateRecord(contactId, {
    //   customFields: { engagement_score: newScore },
    // });

    return {
      contactId,
      previousScore,
      newScore,
      callDuration,
      callDirection: direction,
    };
  }

  /**
   * Get recent calls across all contacts
   * For dashboard/reporting
   */
  async getRecentCalls(
    _groupId?: string,
    limit: number = 50
  ): Promise<CallHistoryRecord[]> {
    const allCalls: CallHistoryRecord[] = [];

    // Collect all calls from cache
    for (const calls of this.callHistory.values()) {
      allCalls.push(...calls);
    }

    // Sort by date descending
    allCalls.sort((a, b) => b.startedAt - a.startedAt);

    return allCalls.slice(0, limit);
  }

  /**
   * Get call statistics for a contact
   */
  async getContactCallStats(contactId: string): Promise<{
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    totalDuration: number;
    averageDuration: number;
    lastCallDate?: number;
    missedCalls: number;
  }> {
    const calls = this.callHistory.get(contactId) || [];

    const stats = {
      totalCalls: calls.length,
      inboundCalls: calls.filter((c) => c.direction === 'inbound').length,
      outboundCalls: calls.filter((c) => c.direction === 'outbound').length,
      totalDuration: calls.reduce((sum, c) => sum + c.duration, 0),
      averageDuration: 0,
      lastCallDate: calls.length > 0 ? Math.max(...calls.map((c) => c.startedAt)) : undefined,
      missedCalls: calls.filter((c) => c.status === 'missed').length,
    };

    stats.averageDuration = stats.totalCalls > 0 ? stats.totalDuration / stats.totalCalls : 0;

    return stats;
  }

  /**
   * Link call recording to contact
   * Associates a recorded call with the contact record
   */
  async linkCallRecording(
    contactId: string,
    callId: string,
    recordingUrl: string,
    transcriptUrl?: string
  ): Promise<void> {
    const contactCalls = this.callHistory.get(contactId) || [];
    const callIndex = contactCalls.findIndex((c) => c.id === callId);

    if (callIndex >= 0) {
      contactCalls[callIndex].recordingUrl = recordingUrl;
      if (transcriptUrl) {
        contactCalls[callIndex].transcriptUrl = transcriptUrl;
      }
      this.callHistory.set(contactId, contactCalls);

      logger.info(`Linked recording to call: ${callId}`, {
        contactId,
        recordingUrl,
        transcriptUrl,
      });
    }
  }

  /**
   * Add notes to a call
   */
  async addCallNotes(
    contactId: string,
    callId: string,
    notes: string
  ): Promise<void> {
    const contactCalls = this.callHistory.get(contactId) || [];
    const callIndex = contactCalls.findIndex((c) => c.id === callId);

    if (callIndex >= 0) {
      contactCalls[callIndex].notes = notes;
      this.callHistory.set(contactId, contactCalls);

      logger.info(`Added notes to call: ${callId}`, { contactId });
    }
  }

  /**
   * Check if calling module is available
   */
  async isCallingModuleAvailable(): Promise<boolean> {
    // In a real implementation, would check if calling module is enabled
    try {
      return true; // Placeholder
    } catch {
      return false;
    }
  }

  /**
   * Normalize phone number for consistent lookup
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except leading +
    const hasPlus = phone.startsWith('+');
    const digits = phone.replace(/\D/g, '');

    // For US numbers, ensure E.164 format
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // Return with + prefix if originally had it
    return hasPlus ? `+${digits}` : digits;
  }
}

/**
 * Get the CRM-calling integration instance
 */
export function getCRMCallingIntegration(): CRMCallingIntegration {
  return CRMCallingIntegration.getInstance();
}
