# Calling Integration: Events Video

## Overview

The Events ↔ Calling integration enables hybrid and fully virtual events with integrated video conferencing. Event organizers can configure virtual attendance options, and attendees can join remotely.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Event                                  │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ In-Person Details   │  │ Virtual Details                 │   │
│  │ - Location          │  │ - Conference Room ID            │   │
│  │ - Capacity          │  │ - Auto-create room on start     │   │
│  │ - Check-in          │  │ - Waiting room enabled          │   │
│  └─────────────────────┘  │ - Recording consent required    │   │
│                            │ - Max virtual attendees         │   │
│                            │ - Breakout rooms config         │   │
│                            └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Calling Module Integration                    │
│  - Auto-provision conference room when event starts              │
│  - Send join link to RSVPs 15 min before                        │
│  - Track virtual attendance for CRM                              │
│  - Record session (with consent) for later viewing               │
└─────────────────────────────────────────────────────────────────┘
```

## Event Attendance Types

```typescript
type EventAttendanceType = 'in-person' | 'virtual' | 'hybrid';
```

- **In-Person**: Traditional physical event, no virtual option
- **Virtual**: Fully remote, conference-only event
- **Hybrid**: Both in-person and virtual attendance options

## Virtual Configuration

```typescript
interface EventVirtualConfig {
  enabled: boolean;
  conferenceRoomId?: string;        // Auto-created when event starts
  autoStartMinutes: number;         // Minutes before event to start room (default: 15)
  waitingRoomEnabled: boolean;
  recordingEnabled: boolean;
  recordingConsentRequired: boolean;
  maxVirtualAttendees?: number;
  breakoutRoomsEnabled: boolean;
  breakoutConfig?: BreakoutRoomConfig;
  recordingUrl?: string;            // After event, if recorded
  e2eeRequired: boolean;
}
```

## Breakout Rooms

```typescript
interface BreakoutRoomConfig {
  enabled: boolean;
  autoAssign: boolean;              // Auto-distribute participants
  roomCount?: number;
  roomNames?: string[];
  allowSelfSelect: boolean;         // Let attendees choose room
  duration?: number;                // Minutes
}
```

## EventCallingIntegration Service

```typescript
class EventCallingIntegration {
  // Start conference room for event
  async startEventConference(
    event: Event,
    virtualConfig: EventVirtualConfig
  ): Promise<EventConferenceRoom>;

  // End conference and save recording
  async endEventConference(eventId: string): Promise<string | null>;

  // Send join reminders to RSVPs
  async sendJoinReminders(
    event: Event,
    rsvpPubkeys: string[],
    config: JoinReminderConfig
  ): Promise<void>;

  // Track virtual attendee for CRM
  async trackVirtualAttendee(
    eventId: string,
    pubkey: string,
    action: 'join' | 'leave'
  ): Promise<VirtualAttendance | null>;

  // Get virtual attendance stats
  async getVirtualAttendanceStats(
    eventId: string
  ): Promise<VirtualAttendanceStats>;

  // Schedule automatic conference start
  scheduleConferenceStart(
    event: Event,
    virtualConfig: EventVirtualConfig,
    rsvpPubkeys: string[]
  ): void;

  // Create breakout rooms
  async createBreakoutRooms(
    eventId: string,
    config: BreakoutRoomConfig
  ): Promise<string[]>;
}
```

## UI Components

### VirtualEventConfig

Form component for configuring virtual attendance when creating/editing events.

Features:
- Attendance type selection (in-person/virtual/hybrid)
- Auto-start timing configuration
- Max virtual attendees setting
- Waiting room toggle
- E2EE requirement toggle
- Recording settings with consent option
- Breakout rooms configuration

### EventJoinButton

Join button displayed on event detail page for virtual/hybrid events.

States:
- **Not Started**: Shows countdown timer
- **Waiting Room**: "Join Waiting Room" button
- **Live**: "Join Now" button
- **Ended**: "Event Ended" (disabled)

Features:
- Recording consent dialog when required
- Security badges (E2EE, Recording indicator)
- Opens conference in new tab

## Virtual Attendance Tracking

```typescript
interface VirtualAttendance {
  id: string;
  eventId: string;
  pubkey: string;
  joinedAt: number;
  leftAt?: number;
  durationSeconds: number;
  breakoutRoomId?: string;
}

interface VirtualAttendanceStats {
  totalVirtualAttendees: number;
  peakConcurrentAttendees: number;
  averageDurationMinutes: number;
  attendees: Array<{
    pubkey: string;
    totalDurationMinutes: number;
    joinedAt: number;
  }>;
}
```

## Conference Lifecycle

```
Event Created
    │
    ▼
[Virtual Config Set]
    │
    ▼
Event Published ────────────────┐
    │                           │
    │ (autoStartMinutes before) │
    ▼                           │
Conference Started              │
    │                           │
    │ (send join reminders)     │
    ▼                           │
Attendees Join ─────────────────┤
    │                           │
    │ (event end time)          │
    ▼                           │
Conference Ended                │
    │                           │
    │ (if recording enabled)    │
    ▼                           │
Recording Available ────────────┘
```

## Notifications

| Event | Notification |
|-------|--------------|
| 15 min before | "Virtual event starting soon - click to join" |
| Event start | "Event is now live - join the conference" |
| Recording ready | "Recording available for [Event Name]" |

## i18n Keys

```typescript
events.virtualConfig.title
events.virtualConfig.description
events.virtualConfig.attendanceTypes.in-person
events.virtualConfig.attendanceTypes.virtual
events.virtualConfig.attendanceTypes.hybrid
events.virtualConfig.autoStartLabel
events.virtualConfig.waitingRoomLabel
events.virtualConfig.e2eeLabel
events.virtualConfig.recordingLabel
events.virtualConfig.breakoutLabel
events.joinButton.joinNow
events.joinButton.joinWaitingRoom
events.joinButton.eventEnded
events.joinButton.consentDialog.title
```

## Security Considerations

- E2EE toggle for sensitive events
- Recording consent dialog before joining
- Waiting room for moderated access
- Virtual attendee count limits
- Breakout room isolation
