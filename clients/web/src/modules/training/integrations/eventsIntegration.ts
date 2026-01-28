/**
 * Training ↔ Events Module Integration
 * Links training sessions to events and manages training events
 */

import { logger } from '@/lib/logger';
import { getTrainingManager } from '../trainingManager';
import type {
  Course,
  Lesson,
  LiveSessionContent,
} from '../types';

/**
 * Training event configuration
 */
export interface TrainingEventConfig {
  courseId: string;
  lessonId?: string; // For linking to specific live session
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  location?: string;
  maxParticipants?: number;
  requiresRSVP: boolean;
  isVirtual: boolean;
}

/**
 * Event with linked training
 */
export interface TrainingLinkedEvent {
  eventId: string;
  courseId: string;
  lessonId?: string;
  courseName: string;
  lessonName?: string;
  trainingType: 'course' | 'live-session' | 'workshop';
}

/**
 * Training Events Integration Class
 * Handles integration between training module and events module
 */
export class TrainingEventsIntegration {
  private static instance: TrainingEventsIntegration | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): TrainingEventsIntegration {
    if (!this.instance) {
      this.instance = new TrainingEventsIntegration();
    }
    return this.instance;
  }

  /**
   * Create an event for a training course
   */
  async createTrainingEvent(config: TrainingEventConfig): Promise<string> {
    const manager = getTrainingManager();
    const course = await manager.getCourse(config.courseId);

    if (!course) {
      throw new Error('Course not found');
    }

    let lessonName: string | undefined;
    if (config.lessonId) {
      const lesson = await manager.getLesson(config.lessonId);
      lessonName = lesson?.title;
    }

    // In a real implementation, this would create an event via the events module
    const eventId = `training-event-${Date.now()}`;

    logger.info(
      `Created training event ${eventId} for course ${course.title}${
        lessonName ? ` - ${lessonName}` : ''
      }`
    );

    return eventId;
  }

  /**
   * Link an existing event to a training course or lesson
   */
  async linkEventToTraining(
    eventId: string,
    courseId: string,
    lessonId?: string
  ): Promise<void> {
    const manager = getTrainingManager();
    const course = await manager.getCourse(courseId);

    if (!course) {
      throw new Error('Course not found');
    }

    // In a real implementation, would update the event with training link metadata
    logger.info(`Linked event ${eventId} to training course ${courseId}`);
  }

  /**
   * Get events linked to a specific course
   */
  async getEventsForCourse(courseId: string): Promise<TrainingLinkedEvent[]> {
    const manager = getTrainingManager();
    const course = await manager.getCourse(courseId);

    if (!course) {
      return [];
    }

    // In a real implementation, would query events module for linked events
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Get training info for an event
   */
  async getTrainingForEvent(eventId: string): Promise<TrainingLinkedEvent | null> {
    // In a real implementation, would query event metadata for training link
    // For now, return null as placeholder
    return null;
  }

  /**
   * Create live session from scheduled event
   * When an event with training link is scheduled, this sets up the live session
   */
  async createLiveSessionFromEvent(
    eventId: string,
    courseId: string,
    moduleId: string,
    instructorPubkey: string,
    scheduledAt: number,
    duration: number
  ): Promise<string> {
    const manager = getTrainingManager();

    // Create a live session lesson in the training module
    const lesson = await manager.createLesson({
      moduleId,
      type: 'live-session',
      title: `Live Training Session - ${new Date(scheduledAt).toLocaleDateString()}`,
      estimatedMinutes: duration,
      requiredForCertification: true,
      content: {
        type: 'live-session',
        scheduledAt,
        duration,
        instructorPubkey,
        requiresRSVP: true,
      } as LiveSessionContent,
    });

    logger.info(`Created live session ${lesson.id} from event ${eventId}`);

    return lesson.id;
  }

  /**
   * Sync event RSVP to training enrollment
   * When someone RSVPs to a training event, enroll them in the course
   */
  async syncEventRSVPToTraining(
    eventId: string,
    pubkey: string,
    rsvpStatus: 'attending' | 'not_attending' | 'maybe'
  ): Promise<void> {
    // Get training info for event
    const trainingInfo = await this.getTrainingForEvent(eventId);

    if (!trainingInfo) {
      return; // Not a training event
    }

    const manager = getTrainingManager();

    if (rsvpStatus === 'attending') {
      // Enroll in course
      await manager.enrollInCourse(trainingInfo.courseId);

      // If there's a specific lesson, RSVP to it
      if (trainingInfo.lessonId) {
        await manager.rsvpLiveSession(trainingInfo.lessonId, 'confirmed');
      }
    }

    logger.info(
      `Synced RSVP for ${pubkey} to training ${trainingInfo.courseId}: ${rsvpStatus}`
    );
  }

  /**
   * Get upcoming training events
   */
  async getUpcomingTrainingEvents(
    groupId?: string,
    limit: number = 10
  ): Promise<Array<TrainingLinkedEvent & { eventStartTime: number }>> {
    // In a real implementation, would query events module for training-linked events
    // filtered by group and sorted by start time
    return [];
  }

  /**
   * Check if events module is available
   */
  async isEventsModuleAvailable(): Promise<boolean> {
    // In a real implementation, would check if events module is enabled
    try {
      return true; // Placeholder
    } catch {
      return false;
    }
  }

  /**
   * Track event attendance for training progress
   */
  async trackEventAttendance(
    eventId: string,
    pubkey: string,
    checkInTime: number,
    checkOutTime?: number
  ): Promise<void> {
    const trainingInfo = await this.getTrainingForEvent(eventId);

    if (!trainingInfo?.lessonId) {
      return;
    }

    const manager = getTrainingManager();

    // Record attendance
    await manager.recordLiveAttendance(
      trainingInfo.lessonId,
      checkInTime,
      checkOutTime
    );

    // If attended long enough, mark lesson complete
    const duration = (checkOutTime || Date.now()) - checkInTime;
    if (duration > 30 * 60 * 1000) { // 30 minutes
      await manager.completeLesson(trainingInfo.lessonId);
    }

    logger.info(
      `Tracked event attendance for ${pubkey} at training event ${eventId}`
    );
  }
}

/**
 * Get the training-events integration instance
 */
export function getTrainingEventsIntegration(): TrainingEventsIntegration {
  return TrainingEventsIntegration.getInstance();
}
