/**
 * Hotlines Module Manager
 * Business logic for hotlines, calls, and dispatch operations
 */

import { dal } from '@/core/storage/dal';
import { nanoid } from 'nanoid';
import type {
  Hotline,
  HotlineCall,
  HotlineDispatch,
  HotlineOperator,
  HotlineStats,
  CreateHotlineData,
  UpdateHotlineData,
  CallerData,
  UpdateCallData,
  CallLogOptions,
  DispatchStatus,
  Priority,
} from './types';
import type {
  DBHotline,
  DBHotlineCall,
  DBHotlineDispatch,
  DBHotlineOperator,
} from './schema';

/**
 * Convert DB record to domain model
 */
function toHotline(record: DBHotline): Hotline {
  return {
    ...record,
    isActive: Boolean(record.isActive),
    operatingHours: record.operatingHours
      ? JSON.parse(record.operatingHours)
      : undefined,
  };
}

function toHotlineCall(record: DBHotlineCall): HotlineCall {
  return {
    ...record,
    followUpNeeded: Boolean(record.followUpNeeded),
  };
}

function toHotlineDispatch(record: DBHotlineDispatch): HotlineDispatch {
  return record;
}

function toHotlineOperator(record: DBHotlineOperator): HotlineOperator {
  return {
    ...record,
    isActive: Boolean(record.isActive),
  };
}

/**
 * Convert domain model to DB record
 */
function toDBHotline(hotline: Hotline): DBHotline {
  return {
    ...hotline,
    isActive: hotline.isActive ? 1 : 0,
    operatingHours: hotline.operatingHours
      ? JSON.stringify(hotline.operatingHours)
      : undefined,
  };
}

function toDBHotlineCall(call: HotlineCall): DBHotlineCall {
  return {
    ...call,
    followUpNeeded: call.followUpNeeded ? 1 : 0,
  };
}

export class HotlinesManager {
  // ============================================
  // Hotline CRUD
  // ============================================

  async createHotline(
    groupId: string,
    data: CreateHotlineData,
    userPubkey: string
  ): Promise<Hotline> {
    const now = Date.now();
    const hotline: Hotline = {
      id: nanoid(),
      groupId,
      name: data.name,
      type: data.type,
      phone: data.phone,
      description: data.description,
      isActive: true,
      operatingHours: data.operatingHours,
      createdBy: userPubkey,
      created: now,
      updated: now,
    };

    await dal.add<DBHotline>('hotlines', toDBHotline(hotline));
    return hotline;
  }

  async updateHotline(id: string, updates: UpdateHotlineData): Promise<void> {
    const { isActive, operatingHours, ...rest } = updates;
    const updateData: Partial<DBHotline> = {
      ...rest,
      updated: Date.now(),
    };

    if (isActive !== undefined) {
      updateData.isActive = isActive ? 1 : 0;
    }

    if (operatingHours !== undefined) {
      updateData.operatingHours = JSON.stringify(operatingHours);
    }

    await dal.update<DBHotline>('hotlines', id, updateData);
  }

  async deleteHotline(id: string): Promise<void> {
    // Delete related calls, dispatches, and operators
    await dal.queryCustom({
      sql: 'DELETE FROM hotline_calls WHERE hotline_id = ?1',
      params: [id],
      dexieFallback: async (db) => {
        await db.hotlineCalls.where('hotlineId').equals(id).delete();
      },
    });
    await dal.queryCustom({
      sql: 'DELETE FROM hotline_dispatches WHERE hotline_id = ?1',
      params: [id],
      dexieFallback: async (db) => {
        await db.hotlineDispatches.where('hotlineId').equals(id).delete();
      },
    });
    await dal.queryCustom({
      sql: 'DELETE FROM hotline_operators WHERE hotline_id = ?1',
      params: [id],
      dexieFallback: async (db) => {
        await db.hotlineOperators.where('hotlineId').equals(id).delete();
      },
    });
    await dal.delete('hotlines', id);
  }

  async getHotlines(groupId: string): Promise<Hotline[]> {
    const records = await dal.query<DBHotline>('hotlines', {
      whereClause: { groupId },
    });
    return records.map(toHotline);
  }

  async getHotlineById(id: string): Promise<Hotline | undefined> {
    const record = await dal.get<DBHotline>('hotlines', id);
    return record ? toHotline(record) : undefined;
  }

  // ============================================
  // Call Management
  // ============================================

  async startCall(
    hotlineId: string,
    callerData: CallerData,
    operatorPubkey: string
  ): Promise<HotlineCall> {
    const hotline = await this.getHotlineById(hotlineId);
    if (!hotline) {
      throw new Error('Hotline not found');
    }

    const now = Date.now();
    const call: HotlineCall = {
      id: nanoid(),
      hotlineId,
      groupId: hotline.groupId,
      callerName: callerData.callerName,
      callerPhone: callerData.callerPhone,
      callerPubkey: callerData.callerPubkey,
      takenBy: operatorPubkey,
      callTime: now,
      status: 'active',
      summary: '',
      priority: callerData.priority || 'medium',
      category: callerData.category,
      followUpNeeded: false,
      created: now,
      updated: now,
    };

    await dal.add<DBHotlineCall>('hotlineCalls', toDBHotlineCall(call));
    return call;
  }

  async updateCall(callId: string, updates: UpdateCallData): Promise<void> {
    const { followUpNeeded, ...rest } = updates;
    const updateData: Partial<DBHotlineCall> = {
      ...rest,
      updated: Date.now(),
    };

    if (followUpNeeded !== undefined) {
      updateData.followUpNeeded = followUpNeeded ? 1 : 0;
    }

    await dal.update<DBHotlineCall>('hotlineCalls', callId, updateData);
  }

  async endCall(callId: string, summary: string): Promise<void> {
    const now = Date.now();
    await dal.update<DBHotlineCall>('hotlineCalls', callId, {
      status: 'completed',
      summary,
      endTime: now,
      updated: now,
    });
  }

  async getActiveCalls(hotlineId: string): Promise<HotlineCall[]> {
    const records = await dal.query<DBHotlineCall>('hotlineCalls', {
      whereClause: { hotlineId },
    });
    const filtered = records.filter(
      (call: DBHotlineCall) => call.status === 'active' || call.status === 'on-hold'
    );
    return filtered.map(toHotlineCall);
  }

  async getCallLog(
    hotlineId: string,
    options?: CallLogOptions
  ): Promise<HotlineCall[]> {
    let records = await dal.query<DBHotlineCall>('hotlineCalls', {
      whereClause: { hotlineId },
    });

    // Reverse for newest first
    records = records.reverse();

    // Apply filters
    if (options?.status) {
      records = records.filter((r: DBHotlineCall) => r.status === options.status);
    }
    if (options?.priority) {
      records = records.filter((r: DBHotlineCall) => r.priority === options.priority);
    }
    if (options?.startDate) {
      records = records.filter((r: DBHotlineCall) => r.callTime >= options.startDate!);
    }
    if (options?.endDate) {
      records = records.filter((r: DBHotlineCall) => r.callTime <= options.endDate!);
    }
    if (options?.operatorPubkey) {
      records = records.filter((r: DBHotlineCall) => r.takenBy === options.operatorPubkey);
    }

    // Apply pagination
    if (options?.offset) {
      records = records.slice(options.offset);
    }
    if (options?.limit) {
      records = records.slice(0, options.limit);
    }

    return records.map(toHotlineCall);
  }

  async getCallById(callId: string): Promise<HotlineCall | undefined> {
    const record = await dal.get<DBHotlineCall>('hotlineCalls', callId);
    return record ? toHotlineCall(record) : undefined;
  }

  // ============================================
  // Dispatch
  // ============================================

  async dispatchVolunteer(
    callId: string,
    volunteerPubkey: string
  ): Promise<HotlineDispatch> {
    const call = await this.getCallById(callId);
    if (!call) {
      throw new Error('Call not found');
    }

    const now = Date.now();
    const dispatch: HotlineDispatch = {
      id: nanoid(),
      callId,
      hotlineId: call.hotlineId,
      groupId: call.groupId,
      dispatchedTo: volunteerPubkey,
      dispatchTime: now,
      status: 'pending',
      created: now,
      updated: now,
    };

    await dal.add<DBHotlineDispatch>('hotlineDispatches', dispatch);
    return dispatch;
  }

  async updateDispatchStatus(
    dispatchId: string,
    status: DispatchStatus
  ): Promise<void> {
    const now = Date.now();
    const updateData: Partial<DBHotlineDispatch> = {
      status,
      updated: now,
    };

    // Set response time when volunteer responds
    if (status === 'accepted' || status === 'declined') {
      updateData.responseTime = now;
    }

    await dal.update<DBHotlineDispatch>('hotlineDispatches', dispatchId, updateData);
  }

  async getDispatchesForCall(callId: string): Promise<HotlineDispatch[]> {
    const records = await dal.query<DBHotlineDispatch>('hotlineDispatches', {
      whereClause: { callId },
    });
    return records.map(toHotlineDispatch);
  }

  // ============================================
  // Operators
  // ============================================

  async startShift(hotlineId: string, operatorPubkey: string): Promise<void> {
    const hotline = await this.getHotlineById(hotlineId);
    if (!hotline) {
      throw new Error('Hotline not found');
    }

    // Check if already on shift
    const existingResults = await dal.queryCustom<DBHotlineOperator>({
      sql: 'SELECT * FROM hotline_operators WHERE hotline_id = ?1 AND operator_pubkey = ?2 AND is_active = 1 LIMIT 1',
      params: [hotlineId, operatorPubkey],
      dexieFallback: async (db) => {
        const result = await db.hotlineOperators
          .where(['hotlineId', 'operatorPubkey'])
          .equals([hotlineId, operatorPubkey])
          .and((op: DBHotlineOperator) => op.isActive === 1)
          .first();
        return result ? [result] : [];
      },
    });

    if (existingResults[0]) {
      throw new Error('Already on shift');
    }

    const operator: DBHotlineOperator = {
      id: nanoid(),
      hotlineId,
      groupId: hotline.groupId,
      operatorPubkey,
      shiftStart: Date.now(),
      isActive: 1,
    };

    await dal.add<DBHotlineOperator>('hotlineOperators', operator);
  }

  async endShift(hotlineId: string, operatorPubkey: string): Promise<void> {
    const operatorResults = await dal.queryCustom<DBHotlineOperator>({
      sql: 'SELECT * FROM hotline_operators WHERE hotline_id = ?1 AND operator_pubkey = ?2 AND is_active = 1 LIMIT 1',
      params: [hotlineId, operatorPubkey],
      dexieFallback: async (db) => {
        const result = await db.hotlineOperators
          .where(['hotlineId', 'operatorPubkey'])
          .equals([hotlineId, operatorPubkey])
          .and((op: DBHotlineOperator) => op.isActive === 1)
          .first();
        return result ? [result] : [];
      },
    });
    const operator = operatorResults[0];

    if (!operator) {
      throw new Error('Not currently on shift');
    }

    await dal.update<DBHotlineOperator>('hotlineOperators', operator.id, {
      isActive: 0,
      shiftEnd: Date.now(),
    });
  }

  async getActiveOperators(hotlineId: string): Promise<string[]> {
    const operators = await dal.queryCustom<DBHotlineOperator>({
      sql: 'SELECT * FROM hotline_operators WHERE hotline_id = ?1 AND is_active = 1',
      params: [hotlineId],
      dexieFallback: async (db) => {
        return db.hotlineOperators
          .where('hotlineId')
          .equals(hotlineId)
          .and((op: DBHotlineOperator) => op.isActive === 1)
          .toArray();
      },
    });
    return operators.map((op: DBHotlineOperator) => op.operatorPubkey);
  }

  async getOperators(hotlineId: string): Promise<HotlineOperator[]> {
    const records = await dal.query<DBHotlineOperator>('hotlineOperators', {
      whereClause: { hotlineId },
    });
    return records.map(toHotlineOperator);
  }

  // ============================================
  // CRM Integration
  // ============================================

  async linkCallToRecord(
    callId: string,
    recordId: string,
    tableKey: string
  ): Promise<void> {
    await dal.update<DBHotlineCall>('hotlineCalls', callId, {
      linkedRecordId: recordId,
      linkedRecordTable: tableKey,
      updated: Date.now(),
    });
  }

  // ============================================
  // Statistics
  // ============================================

  async getStats(hotlineId: string): Promise<HotlineStats> {
    const calls = await dal.query<DBHotlineCall>('hotlineCalls', {
      whereClause: { hotlineId },
    });

    const activeCalls = calls.filter(
      (c: DBHotlineCall) => c.status === 'active' || c.status === 'on-hold'
    );
    const completedCalls = calls.filter((c: DBHotlineCall) => c.status === 'completed');
    const escalatedCalls = calls.filter((c: DBHotlineCall) => c.status === 'escalated');

    // Calculate average call duration
    const callsWithDuration = completedCalls.filter(
      (c: DBHotlineCall) => c.endTime && c.callTime
    );
    const totalDuration = callsWithDuration.reduce(
      (sum: number, c: DBHotlineCall) => sum + (c.endTime! - c.callTime),
      0
    );
    const averageCallDuration =
      callsWithDuration.length > 0
        ? Math.round(totalDuration / callsWithDuration.length / 1000)
        : 0;

    // Count by priority
    const callsByPriority: Record<Priority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    calls.forEach((c: DBHotlineCall) => {
      callsByPriority[c.priority as Priority]++;
    });

    // Active operators
    const activeOperators = await this.getActiveOperators(hotlineId);

    return {
      totalCalls: calls.length,
      activeCalls: activeCalls.length,
      completedCalls: completedCalls.length,
      escalatedCalls: escalatedCalls.length,
      averageCallDuration,
      callsByPriority,
      activeOperators: activeOperators.length,
    };
  }
}

export default HotlinesManager;
