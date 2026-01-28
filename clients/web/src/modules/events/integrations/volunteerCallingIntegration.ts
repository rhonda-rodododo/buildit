/**
 * Volunteer Calling Integration
 * Handles volunteer signup flows for roles that require calling capabilities
 */

import { logger } from '@/lib/logger';
import type {
  EventVolunteerRole,
  EventVolunteerSignup,
  VolunteerCallingRole,
} from '../types';

/**
 * Training requirement status
 */
export interface TrainingRequirementStatus {
  courseId: string;
  courseName: string;
  required: boolean;
  met: boolean;
  certificationExpired?: boolean;
  expiresAt?: number;
}

/**
 * Volunteer requirements check result
 */
export interface VolunteerRequirementsResult {
  met: boolean;
  missingTrainings: TrainingRequirementStatus[];
  missingCallingAccess: boolean;
  callingRoleRequired?: VolunteerCallingRole;
  message?: string;
}

/**
 * Shift configuration for operator pool
 */
export interface ShiftConfig {
  hotlineId: string;
  startTime: number;
  endTime: number;
  role: VolunteerCallingRole;
  isRecurring?: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
}

/**
 * Operator pool entry
 */
export interface OperatorPoolEntry {
  pubkey: string;
  contactId: string;
  hotlineId: string;
  role: VolunteerCallingRole;
  shifts: ShiftConfig[];
  addedAt: number;
  addedBy: string;
  status: 'active' | 'inactive' | 'suspended';
}

/**
 * Volunteer Calling Integration Class
 * Handles integration between volunteer signups and calling module access
 */
export class VolunteerCallingIntegration {
  private static instance: VolunteerCallingIntegration | null = null;

  // In-memory operator pool (would be persisted in real implementation)
  private operatorPool: Map<string, OperatorPoolEntry[]> = new Map(); // hotlineId -> entries

  /**
   * Get singleton instance
   */
  static getInstance(): VolunteerCallingIntegration {
    if (!this.instance) {
      this.instance = new VolunteerCallingIntegration();
    }
    return this.instance;
  }

  /**
   * Check if volunteer meets requirements for a role
   * Validates training certifications and calling access
   */
  async checkRequirements(
    contactId: string,
    pubkey: string,
    role: EventVolunteerRole
  ): Promise<VolunteerRequirementsResult> {
    const missingTrainings: TrainingRequirementStatus[] = [];
    let missingCallingAccess = false;

    // Check training requirements
    if (role.requiredTrainings && role.requiredTrainings.length > 0) {
      for (const courseId of role.requiredTrainings) {
        // In a real implementation, would check training module for certification
        // const certification = await trainingManager.getCertification(pubkey, courseId);

        // Placeholder - assume not met
        missingTrainings.push({
          courseId,
          courseName: `Training ${courseId}`, // Would fetch actual name
          required: true,
          met: false, // Would check actual certification
        });
      }
    }

    // Check calling access requirements
    if (role.callingRoleRequired) {
      // In a real implementation, would check calling module for access
      // const hasAccess = await callingManager.checkRoleAccess(pubkey, role.callingRoleRequired);

      // Placeholder
      missingCallingAccess = true; // Assume needs to be granted
    }

    // For now, we'll simulate that requirements are met if no specific trainings are required
    // In production, this would check actual training certifications
    const actuallyMissingTrainings = missingTrainings.filter((t) => !t.met);

    const met = actuallyMissingTrainings.length === 0 && !missingCallingAccess;

    let message: string | undefined;
    if (!met) {
      const issues: string[] = [];
      if (actuallyMissingTrainings.length > 0) {
        issues.push(`${actuallyMissingTrainings.length} required training(s) not completed`);
      }
      if (missingCallingAccess && role.callingRoleRequired) {
        issues.push(`${role.callingRoleRequired} access not granted`);
      }
      message = issues.join(', ');
    }

    logger.info(`Checked volunteer requirements for ${contactId}`, {
      roleId: role.id,
      met,
      missingTrainings: actuallyMissingTrainings.length,
      missingCallingAccess,
    });

    return {
      met,
      missingTrainings: actuallyMissingTrainings,
      missingCallingAccess,
      callingRoleRequired: role.callingRoleRequired,
      message,
    };
  }

  /**
   * Grant hotline access when volunteer signup is confirmed
   * Adds the volunteer to the operator pool for the specified hotlines
   */
  async grantHotlineAccess(
    contactId: string,
    pubkey: string,
    hotlineIds: string[],
    role: VolunteerCallingRole,
    grantedBy: string
  ): Promise<void> {
    for (const hotlineId of hotlineIds) {
      // Check if already has access
      const existing = this.getOperatorPoolEntry(hotlineId, pubkey);
      if (existing) {
        logger.info(`Volunteer ${contactId} already has access to hotline ${hotlineId}`);
        continue;
      }

      // Create operator pool entry
      const entry: OperatorPoolEntry = {
        pubkey,
        contactId,
        hotlineId,
        role,
        shifts: [],
        addedAt: Date.now(),
        addedBy: grantedBy,
        status: 'active',
      };

      // Add to pool
      const pool = this.operatorPool.get(hotlineId) || [];
      pool.push(entry);
      this.operatorPool.set(hotlineId, pool);

      logger.info(`Granted hotline access to volunteer`, {
        contactId,
        pubkey,
        hotlineId,
        role,
      });

      // In a real implementation, would:
      // 1. Update calling module permissions
      // 2. Send notification to volunteer
      // 3. Persist to database
    }
  }

  /**
   * Revoke hotline access
   */
  async revokeHotlineAccess(
    pubkey: string,
    hotlineId: string,
    reason?: string
  ): Promise<void> {
    const pool = this.operatorPool.get(hotlineId);
    if (!pool) return;

    const index = pool.findIndex((e) => e.pubkey === pubkey);
    if (index >= 0) {
      pool.splice(index, 1);
      this.operatorPool.set(hotlineId, pool);

      logger.info(`Revoked hotline access`, {
        pubkey,
        hotlineId,
        reason,
      });
    }
  }

  /**
   * Add volunteer to operator pool for specific shifts
   */
  async addToOperatorPool(
    contactId: string,
    pubkey: string,
    hotlineId: string,
    shifts: ShiftConfig[]
  ): Promise<void> {
    const pool = this.operatorPool.get(hotlineId) || [];
    const entry = pool.find((e) => e.pubkey === pubkey);

    if (!entry) {
      logger.warn(`Volunteer ${contactId} not in operator pool for ${hotlineId}`);
      return;
    }

    // Add shifts to existing entry
    entry.shifts.push(...shifts);

    logger.info(`Added shifts for volunteer`, {
      contactId,
      hotlineId,
      shiftCount: shifts.length,
    });

    // In a real implementation, would:
    // 1. Update scheduler
    // 2. Send shift confirmation to volunteer
  }

  /**
   * Remove shifts from operator
   */
  async removeFromOperatorPool(
    pubkey: string,
    hotlineId: string,
    shiftIds?: string[]
  ): Promise<void> {
    const pool = this.operatorPool.get(hotlineId);
    if (!pool) return;

    const entry = pool.find((e) => e.pubkey === pubkey);
    if (!entry) return;

    if (shiftIds) {
      // Remove specific shifts
      entry.shifts = entry.shifts.filter(
        (s) => !shiftIds.includes(`${s.startTime}-${s.endTime}`)
      );
    } else {
      // Remove all shifts
      entry.shifts = [];
    }

    logger.info(`Removed shifts from volunteer`, {
      pubkey,
      hotlineId,
    });
  }

  /**
   * Get operator pool entry
   */
  getOperatorPoolEntry(
    hotlineId: string,
    pubkey: string
  ): OperatorPoolEntry | undefined {
    const pool = this.operatorPool.get(hotlineId);
    return pool?.find((e) => e.pubkey === pubkey);
  }

  /**
   * Get all operators for a hotline
   */
  getHotlineOperators(hotlineId: string): OperatorPoolEntry[] {
    return this.operatorPool.get(hotlineId) || [];
  }

  /**
   * Get available operators for a shift
   */
  getAvailableOperators(
    hotlineId: string,
    time: number
  ): OperatorPoolEntry[] {
    const pool = this.operatorPool.get(hotlineId) || [];

    return pool.filter((entry) => {
      if (entry.status !== 'active') return false;

      // Check if operator has a shift covering this time
      return entry.shifts.some(
        (shift) => shift.startTime <= time && time <= shift.endTime
      );
    });
  }

  /**
   * Process volunteer signup confirmation
   * Called when a volunteer signup is confirmed, grants appropriate access
   */
  async processSignupConfirmation(
    signup: EventVolunteerSignup,
    role: EventVolunteerRole,
    confirmedBy: string
  ): Promise<{ accessGranted: boolean; message: string }> {
    // Check requirements
    const requirements = await this.checkRequirements(
      signup.contactId,
      signup.contactPubkey || '',
      role
    );

    if (!requirements.met) {
      return {
        accessGranted: false,
        message: requirements.message || 'Requirements not met',
      };
    }

    // Grant hotline access if specified
    if (role.hotlineAccess && role.hotlineAccess.length > 0 && role.callingRoleRequired) {
      await this.grantHotlineAccess(
        signup.contactId,
        signup.contactPubkey || '',
        role.hotlineAccess,
        role.callingRoleRequired,
        confirmedBy
      );
    }

    // Add to operator pool for shifts if role has shift times
    if (role.shiftStart && role.shiftEnd && role.hotlineAccess) {
      const shifts: ShiftConfig[] = role.hotlineAccess.map((hotlineId) => ({
        hotlineId,
        startTime: role.shiftStart!,
        endTime: role.shiftEnd!,
        role: role.callingRoleRequired || 'hotline-operator',
      }));

      for (const shift of shifts) {
        await this.addToOperatorPool(
          signup.contactId,
          signup.contactPubkey || '',
          shift.hotlineId,
          [shift]
        );
      }
    }

    logger.info(`Processed volunteer signup confirmation`, {
      signupId: signup.id,
      roleId: role.id,
      contactId: signup.contactId,
    });

    return {
      accessGranted: true,
      message: 'Volunteer confirmed and access granted',
    };
  }

  /**
   * Check if calling module is available
   */
  async isCallingModuleAvailable(): Promise<boolean> {
    try {
      return true; // Placeholder
    } catch {
      return false;
    }
  }
}

/**
 * Get the volunteer-calling integration instance
 */
export function getVolunteerCallingIntegration(): VolunteerCallingIntegration {
  return VolunteerCallingIntegration.getInstance();
}
