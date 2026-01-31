/**
 * Events ↔ Calling Module Integration
 * Enables hybrid/virtual events with integrated video conferencing
 */

import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';
import type {
  Event,
  EventVirtualConfig,
  VirtualAttendance,
  VirtualAttendanceStats,
} from '../types';

/**
 * Conference room details for an event
 */
export interface EventConferenceRoom {
  conferenceRoomId: string;
  joinUrl: string;
  hostKey?: string;
  isActive: boolean;
  participantCount: number;
  createdAt: number;
}

/**
 * Join reminder configuration
 */
export interface JoinReminderConfig {
  minutesBefore: number;
  message?: string;
}

/**
 * Events Calling Integration Class
 * Handles integration between events module and calling module for virtual/hybrid events
 */
export class EventCallingIntegration {
  private static instance: EventCallingIntegration | null = null;
  private activeConferences: Map<string, EventConferenceRoom> = new Map();

  /**
   * Get singleton instance
   */
  static getInstance(): EventCallingIntegration {
    if (!this.instance) {
      this.instance = new EventCallingIntegration();
    }
    return this.instance;
  }

  /**
   * Start conference room for an event
   * Called automatically before event start time based on autoStartMinutes
   */
  async startEventConference(
    event: Event,
    virtualConfig: EventVirtualConfig
  ): Promise<EventConferenceRoom> {
    if (!virtualConfig.enabled) {
      throw new Error('Virtual attendance is not enabled for this event');
    }

    // Generate conference room ID if not already assigned
    const conferenceRoomId = virtualConfig.conferenceRoomId || `event-${event.id}-${nanoid(8)}`;

    // In a real implementation, this would call the calling module's API
    // to create a conference room with the specified configuration
    logger.info(`Starting conference room for event: ${event.title}`, {
      eventId: event.id,
      conferenceRoomId,
      waitingRoom: virtualConfig.waitingRoomEnabled,
      recording: virtualConfig.recordingEnabled,
      e2ee: virtualConfig.e2eeRequired,
    });

    const conferenceRoom: EventConferenceRoom = {
      conferenceRoomId,
      joinUrl: `/conference/${conferenceRoomId}`,
      hostKey: nanoid(12),
      isActive: true,
      participantCount: 0,
      createdAt: Date.now(),
    };

    this.activeConferences.set(event.id, conferenceRoom);

    // Would integrate with calling module to actually create the room
    // await callingManager.createConferenceRoom({
    //   roomId: conferenceRoomId,
    //   name: event.title,
    //   waitingRoom: virtualConfig.waitingRoomEnabled,
    //   recording: virtualConfig.recordingEnabled,
    //   e2ee: virtualConfig.e2eeRequired,
    //   maxParticipants: virtualConfig.maxVirtualAttendees,
    //   breakoutRooms: virtualConfig.breakoutRoomsEnabled ? virtualConfig.breakoutConfig : undefined,
    // });

    return conferenceRoom;
  }

  /**
   * End conference and save recording
   */
  async endEventConference(eventId: string): Promise<string | null> {
    const conference = this.activeConferences.get(eventId);

    if (!conference) {
      logger.warn(`No active conference found for event: ${eventId}`);
      return null;
    }

    logger.info(`Ending conference for event: ${eventId}`, {
      conferenceRoomId: conference.conferenceRoomId,
      duration: Date.now() - conference.createdAt,
    });

    // In a real implementation, would:
    // 1. End the conference room via calling module
    // 2. Process and save recording if enabled
    // 3. Return recording URL

    this.activeConferences.delete(eventId);

    // Simulated recording URL - in reality would get from calling module
    const recordingUrl = null; // Would be actual URL if recording was enabled

    return recordingUrl;
  }

  /**
   * Send join reminders to RSVPs
   * Called based on autoStartMinutes before event
   */
  async sendJoinReminders(
    event: Event,
    rsvpPubkeys: string[],
    config: JoinReminderConfig = { minutesBefore: 15 }
  ): Promise<void> {
    const conference = this.activeConferences.get(event.id);

    if (!conference) {
      logger.warn(`No active conference to send reminders for: ${event.id}`);
      return;
    }

    // In a real implementation, would send notifications via messaging module
    // const message = config.message ||
    //   `The virtual event "${event.title}" is starting in ${config.minutesBefore} minutes. Click to join: ${conference.joinUrl}`;
    logger.info(`Sending join reminders for event: ${event.title}`, {
      eventId: event.id,
      recipientCount: rsvpPubkeys.length,
      minutesBefore: config.minutesBefore,
    });

    // Would integrate with messaging/notifications module
    // for (const pubkey of rsvpPubkeys) {
    //   await messagingManager.sendNotification(pubkey, {
    //     type: 'event-reminder',
    //     title: `${event.title} starting soon`,
    //     body: message,
    //     action: { type: 'join-conference', url: conference.joinUrl },
    //   });
    // }
  }

  /**
   * Track virtual attendee for CRM
   * Records when someone joins the virtual event
   */
  async trackVirtualAttendee(
    eventId: string,
    pubkey: string,
    action: 'join' | 'leave'
  ): Promise<VirtualAttendance | null> {
    const conference = this.activeConferences.get(eventId);

    if (!conference) {
      logger.warn(`No active conference to track attendance: ${eventId}`);
      return null;
    }

    const now = Date.now();

    // In a real implementation, would store this in the database
    // and update CRM contact records
    const attendance: VirtualAttendance = {
      id: `attendance-${eventId}-${pubkey}-${now}`,
      eventId,
      pubkey,
      joinedAt: action === 'join' ? now : 0,
      leftAt: action === 'leave' ? now : undefined,
      durationSeconds: 0,
    };

    logger.info(`Tracked virtual attendance: ${pubkey} ${action}ed event ${eventId}`);

    // Would integrate with CRM module
    // await crmIntegration.updateContactEngagement(pubkey, {
    //   type: 'event-attendance',
    //   eventId,
    //   action,
    //   timestamp: now,
    // });

    return attendance;
  }

  /**
   * Get virtual attendance stats for an event
   */
  async getVirtualAttendanceStats(_eventId: string): Promise<VirtualAttendanceStats> {
    // In a real implementation, would query the database for attendance records
    // and calculate statistics

    // Placeholder response
    return {
      totalVirtualAttendees: 0,
      peakConcurrentAttendees: 0,
      averageDurationMinutes: 0,
      attendees: [],
    };
  }

  /**
   * Get conference room details for an event
   */
  getConferenceRoom(eventId: string): EventConferenceRoom | null {
    return this.activeConferences.get(eventId) || null;
  }

  /**
   * Check if event has an active conference
   */
  isConferenceActive(eventId: string): boolean {
    const conference = this.activeConferences.get(eventId);
    return conference?.isActive || false;
  }

  /**
   * Get join URL for an event
   */
  getJoinUrl(eventId: string): string | null {
    const conference = this.activeConferences.get(eventId);
    return conference?.joinUrl || null;
  }

  /**
   * Check if calling module is available
   */
  async isCallingModuleAvailable(): Promise<boolean> {
    // In a real implementation, would check if calling module is enabled
    // and properly configured
    try {
      return true; // Placeholder
    } catch {
      return false;
    }
  }

  /**
   * Create breakout rooms for an event conference
   */
  async createBreakoutRooms(
    eventId: string,
    config: {
      roomCount: number;
      roomNames?: string[];
      autoAssign: boolean;
    }
  ): Promise<string[]> {
    const conference = this.activeConferences.get(eventId);

    if (!conference) {
      throw new Error(`No active conference for event: ${eventId}`);
    }

    const roomIds: string[] = [];

    for (let i = 0; i < config.roomCount; i++) {
      const roomId = `${conference.conferenceRoomId}-breakout-${i + 1}`;
      const roomName = config.roomNames?.[i] || `Breakout Room ${i + 1}`;

      roomIds.push(roomId);

      logger.info(`Created breakout room: ${roomName}`, {
        eventId,
        roomId,
        index: i,
      });
    }

    // Would integrate with calling module to create actual breakout rooms
    // await callingManager.createBreakoutRooms(conference.conferenceRoomId, {
    //   rooms: roomIds.map((id, i) => ({
    //     id,
    //     name: config.roomNames?.[i] || `Breakout Room ${i + 1}`,
    //   })),
    //   autoAssign: config.autoAssign,
    // });

    return roomIds;
  }

  /**
   * Schedule automatic conference start
   * Sets up a timer to start the conference before the event
   */
  scheduleConferenceStart(
    event: Event,
    virtualConfig: EventVirtualConfig,
    rsvpPubkeys: string[]
  ): void {
    const startTime = event.startTime - (virtualConfig.autoStartMinutes * 60 * 1000);
    const delay = startTime - Date.now();

    if (delay <= 0) {
      // Event is starting or has started, start conference immediately
      this.startEventConference(event, virtualConfig)
        .then(() => this.sendJoinReminders(event, rsvpPubkeys))
        .catch((err) => logger.error('Failed to start conference', { eventId: event.id, error: err }));
      return;
    }

    // Schedule conference start
    logger.info(`Scheduled conference start for event: ${event.title}`, {
      eventId: event.id,
      startIn: delay,
      autoStartMinutes: virtualConfig.autoStartMinutes,
    });

    // In a real implementation, would use a proper job scheduler
    // For now, using setTimeout (not ideal for production)
    setTimeout(() => {
      this.startEventConference(event, virtualConfig)
        .then(() => this.sendJoinReminders(event, rsvpPubkeys))
        .catch((err) => logger.error('Failed to start scheduled conference', { eventId: event.id, error: err }));
    }, delay);
  }
}

/**
 * Get the event-calling integration instance
 */
export function getEventCallingIntegration(): EventCallingIntegration {
  return EventCallingIntegration.getInstance();
}
