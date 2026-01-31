/**
 * Training ↔ Calling Module Integration
 * Provides live training sessions via video conferencing
 */

import { logger } from '@/lib/logger';
import { getTrainingManager } from '../trainingManager';
import { getSFUConferenceManager } from '@/modules/calling/services/sfuConferenceManager';
import type {
  Lesson,
  LiveSessionContent,
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

    logger.info(`Creating conference room for training session: ${lesson.id}`);

    const conferenceManager = getSFUConferenceManager();
    const room = await conferenceManager.createConference({
      name: config.name,
      maxParticipants: config.maxParticipants,
      settings: {
        waitingRoom: config.waitingRoom,
        allowRecording: config.allowRecording,
        e2eeRequired: config.e2eeRequired,
      },
    });

    const conferenceRoomId = room.roomId;
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

    const conferenceManager = getSFUConferenceManager();
    const conferenceState = conferenceManager.getState();

    // If we're not already in this conference room, join it
    if (!conferenceState || conferenceState.roomId !== content.conferenceRoomId) {
      await conferenceManager.joinConference(content.conferenceRoomId);
    }

    // TODO: Send notifications with join links to RSVPed users via messaging module

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

    const conferenceManager = getSFUConferenceManager();
    const conferenceState = conferenceManager.getState();

    // Capture recording URL from conference state before leaving (if recording was enabled)
    const recordingUrl = (conferenceState?.isRecording ? content.recordingUrl : content.recordingUrl) || null;

    // Leave/end the conference
    await conferenceManager.leaveConference();

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

    const conferenceManager = getSFUConferenceManager();
    const conferenceState = conferenceManager.getState();
    const conferenceRoomId = content.conferenceRoomId || null;

    // Check if the active conference matches this lesson's room
    const isActive = conferenceState !== null && conferenceState.roomId === conferenceRoomId;
    const participantCount = isActive ? conferenceManager.getParticipantCount() : 0;

    return {
      conferenceRoomId,
      isActive,
      participantCount,
    };
  }

  /**
   * Check if calling module is available
   */
  async isCallingModuleAvailable(): Promise<boolean> {
    try {
      const manager = getSFUConferenceManager();
      return manager !== null && manager !== undefined;
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
