/**
 * Training ↔ Calling Module Integration
 * Provides live training sessions via video conferencing
 */

import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';
import { getTrainingManager } from '../trainingManager';
import type {
  Lesson,
  LiveSessionContent,
  LiveSessionAttendance,
} from '../types';

/**
 * Conference room configuration for training
 */
export interface TrainingConferenceConfig {
  name: string;
  maxParticipants?: number;
  waitingRoom: boolean;
  allowRecording: boolean;
  e2eeRequired: boolean;
  instructorPubkey: string;
}

/**
 * Training Calling Integration Class
 * Handles integration between training module and calling module
 */
export class TrainingCallingIntegration {
  private static instance: TrainingCallingIntegration | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): TrainingCallingIntegration {
    if (!this.instance) {
      this.instance = new TrainingCallingIntegration();
    }
    return this.instance;
  }

  /**
   * Create a conference room for a live training session
   */
  async createLiveSession(
    lesson: Lesson,
    config: TrainingConferenceConfig
  ): Promise<{ conferenceRoomId: string; joinUrl: string }> {
    if (lesson.type !== 'live-session') {
      throw new Error('Lesson is not a live session');
    }

    const content = lesson.content as LiveSessionContent;

    // Generate conference room ID
    const conferenceRoomId = `training-${lesson.id}-${nanoid(8)}`;

    // In a real implementation, this would call the calling module's API
    // to create a conference room
    logger.info(`Creating conference room for training session: ${conferenceRoomId}`);

    // Simulated response - in reality, would integrate with calling module
    const joinUrl = `/conference/${conferenceRoomId}`;

    // Update the lesson with the conference room ID
    const manager = getTrainingManager();
    await manager.updateLesson(lesson.id, {
      content: {
        ...content,
        conferenceRoomId,
      } as Partial<LiveSessionContent>,
    });

    logger.info(`Created training conference room: ${conferenceRoomId}`);

    return { conferenceRoomId, joinUrl };
  }

  /**
   * Start a live training session
   * Sends join links to enrolled/RSVPed users
   */
  async startLiveSession(lessonId: string): Promise<void> {
    const manager = getTrainingManager();
    const lesson = await manager.getLesson(lessonId);

    if (!lesson || lesson.type !== 'live-session') {
      throw new Error('Lesson not found or not a live session');
    }

    const content = lesson.content as LiveSessionContent;

    if (!content.conferenceRoomId) {
      throw new Error('Conference room not created');
    }

    // In a real implementation, this would:
    // 1. Get all RSVPed users
    // 2. Send notifications with join links
    // 3. Start the conference room

    logger.info(`Starting live training session: ${lessonId}`);
  }

  /**
   * End a live training session and save recording
   */
  async endLiveSession(lessonId: string): Promise<string | null> {
    const manager = getTrainingManager();
    const lesson = await manager.getLesson(lessonId);

    if (!lesson || lesson.type !== 'live-session') {
      throw new Error('Lesson not found or not a live session');
    }

    const content = lesson.content as LiveSessionContent;

    // In a real implementation, this would:
    // 1. End the conference
    // 2. Get the recording URL
    // 3. Process and store the recording

    const recordingUrl = content.recordingUrl || null;

    // Update lesson with recording URL if available
    if (recordingUrl) {
      await manager.updateLesson(lessonId, {
        content: {
          ...content,
          recordingUrl,
        } as Partial<LiveSessionContent>,
      });
    }

    logger.info(`Ended live training session: ${lessonId}, recording: ${recordingUrl || 'none'}`);

    return recordingUrl;
  }

  /**
   * Track attendance for a live training session
   */
  async trackLiveAttendance(
    lessonId: string,
    pubkey: string,
    joinedAt: number,
    leftAt?: number
  ): Promise<void> {
    const manager = getTrainingManager();
    await manager.recordLiveAttendance(lessonId, joinedAt, leftAt);

    const duration = leftAt ? leftAt - joinedAt : Date.now() - joinedAt;
    const durationMinutes = Math.round(duration / 60000);

    logger.info(`Recorded training attendance: ${pubkey} attended ${durationMinutes} minutes`);

    // If attended for significant duration, mark progress
    if (duration > 30 * 60 * 1000) { // 30 minutes
      await manager.completeLesson(lessonId);
    }
  }

  /**
   * Get conference room details for a training session
   */
  async getConferenceDetails(lessonId: string): Promise<{
    conferenceRoomId: string | null;
    isActive: boolean;
    participantCount: number;
  }> {
    const manager = getTrainingManager();
    const lesson = await manager.getLesson(lessonId);

    if (!lesson || lesson.type !== 'live-session') {
      return { conferenceRoomId: null, isActive: false, participantCount: 0 };
    }

    const content = lesson.content as LiveSessionContent;

    // In a real implementation, would query the calling module for room status
    return {
      conferenceRoomId: content.conferenceRoomId || null,
      isActive: false, // Would check with calling module
      participantCount: 0, // Would get from calling module
    };
  }

  /**
   * Check if calling module is available
   */
  async isCallingModuleAvailable(): Promise<boolean> {
    // In a real implementation, would check if calling module is enabled
    // and properly configured
    try {
      // Check if calling module exists and is initialized
      return true; // Placeholder
    } catch {
      return false;
    }
  }
}

/**
 * Get the training-calling integration instance
 */
export function getTrainingCallingIntegration(): TrainingCallingIntegration {
  return TrainingCallingIntegration.getInstance();
}
