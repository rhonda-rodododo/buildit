/**
 * Training ↔ CRM Module Integration
 * Links certifications to CRM contacts and tracks training status
 */

import { logger } from '@/lib/logger';
import { getTrainingManager } from '../trainingManager';
import type {
  Certification,
  UserTrainingStatus,
  Course,
} from '../types';

/**
 * CRM Contact Training Info
 */
export interface ContactTrainingInfo {
  contactId: string;
  pubkey: string;
  enrolledCourses: number;
  completedCourses: number;
  certifications: Certification[];
  certificationsExpiring: Certification[];
  totalTimeSpent: number; // hours
  lastActivity?: number;
}

/**
 * Training requirement for volunteer roles
 */
export interface TrainingRequirement {
  courseId: string;
  courseName: string;
  required: boolean;
  currentlyMet: boolean;
  certificationExpired?: boolean;
  certificationExpiresAt?: number;
}

/**
 * Training CRM Integration Class
 * Handles integration between training module and CRM
 */
export class TrainingCRMIntegration {
  private static instance: TrainingCRMIntegration | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): TrainingCRMIntegration {
    if (!this.instance) {
      this.instance = new TrainingCRMIntegration();
    }
    return this.instance;
  }

  /**
   * Add certification to a CRM contact record
   */
  async addCertificationToContact(
    contactId: string,
    certification: Certification
  ): Promise<void> {
    // In a real implementation, this would update the CRM contact record
    // with the certification information
    logger.info(
      `Adding certification ${certification.id} to contact ${contactId}`
    );

    // Store in CRM custom fields
    // This would interact with the database module/CRM module
  }

  /**
   * Get training status for a CRM contact
   */
  async getContactTrainingStatus(contactId: string, pubkey: string): Promise<ContactTrainingInfo> {
    const manager = getTrainingManager();
    const status = await manager.getUserTrainingStatus(pubkey);
    const certifications = await manager.listCertifications(pubkey);

    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const expiringSoon = certifications.filter(
      c => c.expiresAt && c.expiresAt > now && c.expiresAt < now + thirtyDays && !c.revokedAt
    );

    return {
      contactId,
      pubkey,
      enrolledCourses: status.coursesEnrolled,
      completedCourses: status.coursesCompleted,
      certifications: certifications.filter(c => !c.revokedAt),
      certificationsExpiring: expiringSoon,
      totalTimeSpent: status.totalTimeSpent,
      lastActivity: status.lastActivity,
    };
  }

  /**
   * Filter CRM contacts by certification
   */
  async filterContactsByCertification(
    courseId: string,
    includeExpired: boolean = false
  ): Promise<string[]> {
    const manager = getTrainingManager();
    const certifications = await manager.listCertifications();

    const now = Date.now();
    const filtered = certifications.filter(c => {
      if (c.courseId !== courseId) return false;
      if (c.revokedAt) return false;
      if (!includeExpired && c.expiresAt && c.expiresAt < now) return false;
      return true;
    });

    // Return unique pubkeys
    return [...new Set(filtered.map(c => c.pubkey))];
  }

  /**
   * Check training requirements for a contact
   */
  async checkTrainingRequirements(
    pubkey: string,
    requiredCourseIds: string[]
  ): Promise<{ met: boolean; requirements: TrainingRequirement[] }> {
    const manager = getTrainingManager();
    const certifications = await manager.listCertifications(pubkey);
    const now = Date.now();

    const requirements: TrainingRequirement[] = [];
    let allMet = true;

    for (const courseId of requiredCourseIds) {
      const course = await manager.getCourse(courseId);
      const cert = certifications.find(c => c.courseId === courseId && !c.revokedAt);

      const expired = cert?.expiresAt ? cert.expiresAt < now : false;
      const met = !!cert && !expired;

      if (!met) {
        allMet = false;
      }

      requirements.push({
        courseId,
        courseName: course?.title || 'Unknown Course',
        required: true,
        currentlyMet: met,
        certificationExpired: expired,
        certificationExpiresAt: cert?.expiresAt,
      });
    }

    return { met: allMet, requirements };
  }

  /**
   * Get contacts with expiring certifications
   */
  async getContactsWithExpiringCertifications(
    daysThreshold: number = 30
  ): Promise<Array<{ pubkey: string; certification: Certification; course: Course | null }>> {
    const manager = getTrainingManager();
    const certifications = await manager.listCertifications();

    const now = Date.now();
    const threshold = daysThreshold * 24 * 60 * 60 * 1000;

    const expiring = certifications.filter(c =>
      c.expiresAt &&
      c.expiresAt > now &&
      c.expiresAt < now + threshold &&
      !c.revokedAt
    );

    const results = await Promise.all(
      expiring.map(async cert => ({
        pubkey: cert.pubkey,
        certification: cert,
        course: await manager.getCourse(cert.courseId),
      }))
    );

    return results;
  }

  /**
   * Send certification reminders to contacts
   */
  async sendCertificationReminders(
    pubkeys: string[],
    courseId: string,
    message: string
  ): Promise<void> {
    // In a real implementation, this would send notifications via the messaging module
    logger.info(
      `Sending certification reminders to ${pubkeys.length} contacts for course ${courseId}`
    );

    // Would integrate with messaging/notifications module
  }

  /**
   * Check if CRM module is available
   */
  async isCRMModuleAvailable(): Promise<boolean> {
    // In a real implementation, would check if CRM module is enabled
    try {
      return true; // Placeholder
    } catch {
      return false;
    }
  }

  /**
   * Sync certification data to CRM
   * Called when certifications are earned/revoked
   */
  async syncCertificationToCRM(certification: Certification): Promise<void> {
    const manager = getTrainingManager();
    const course = await manager.getCourse(certification.courseId);

    logger.info(
      `Syncing certification ${certification.id} (${course?.title}) to CRM for ${certification.pubkey}`
    );

    // Would update CRM custom fields with:
    // - Certification earned date
    // - Certification expiry date
    // - Course name
    // - Verification code
  }
}

/**
 * Get the training-CRM integration instance
 */
export function getTrainingCRMIntegration(): TrainingCRMIntegration {
  return TrainingCRMIntegration.getInstance();
}
