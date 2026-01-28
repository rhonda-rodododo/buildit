# Training Module: Live Sessions

## Overview

Live sessions integrate the Training module with the Calling module to provide scheduled, instructor-led video training. Sessions can be recorded for later playback.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Live Session Workflow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Schedule    →    RSVP    →    Join    →    Attend    →    Record
│     ↓              ↓            ↓            ↓              ↓
│  [Create     [Users sign  [Conference  [Track      [Recording
│   lesson]     up/confirm]  starts]      time]       saved]
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Live Session Content Type

```typescript
interface LiveSessionContent {
  type: 'live-session';
  scheduledAt: number;           // Unix timestamp
  duration: number;              // Minutes
  instructorPubkey: string;
  conferenceRoomId?: string;     // Set when room created
  recordingUrl?: string;         // Set after session
  maxParticipants?: number;
  requiresRSVP: boolean;
}
```

## Session States

```
┌──────────────┐
│   Scheduled  │ ← Initial state
└──────┬───────┘
       │ (auto-start time reached)
       ▼
┌──────────────┐
│    Active    │ ← Conference room open
└──────┬───────┘
       │ (duration elapsed or manually ended)
       ▼
┌──────────────┐
│    Ended     │ ← Recording processed
└──────────────┘
```

## RSVP System

### RSVP Status

```typescript
type LiveSessionRSVPStatus = 'confirmed' | 'tentative' | 'declined';

interface LiveSessionRSVP {
  id: string;
  lessonId: string;
  pubkey: string;
  status: LiveSessionRSVPStatus;
  rsvpTime: number;
  reminderSent?: boolean;
}
```

### RSVP Flow

1. User views scheduled live session
2. User selects RSVP status
3. Reminder sent 15 minutes before start
4. Join link provided when session starts

## Attendance Tracking

```typescript
interface LiveSessionAttendance {
  id: string;
  lessonId: string;
  pubkey: string;
  joinedAt: number;
  leftAt?: number;
  totalDuration: number;     // Seconds
  joinCount: number;         // Reconnection count
}
```

### Completion Criteria

- Minimum attendance: 30 minutes
- Percentage threshold: 50% of scheduled duration
- Either condition triggers lesson completion

## Calling Module Integration

### TrainingCallingIntegration Service

```typescript
class TrainingCallingIntegration {
  // Create conference room for live session
  async createLiveSession(
    lesson: Lesson,
    config: TrainingConferenceConfig
  ): Promise<{ conferenceRoomId: string; joinUrl: string }>;

  // Start live session (send join links)
  async startLiveSession(lessonId: string): Promise<void>;

  // End live session and save recording
  async endLiveSession(lessonId: string): Promise<string | null>;

  // Track attendance
  async trackLiveAttendance(
    lessonId: string,
    pubkey: string,
    joinedAt: number,
    leftAt?: number
  ): Promise<void>;

  // Get conference room details
  async getConferenceDetails(lessonId: string): Promise<{
    conferenceRoomId: string | null;
    isActive: boolean;
    participantCount: number;
  }>;
}
```

### Conference Configuration

```typescript
interface TrainingConferenceConfig {
  name: string;
  maxParticipants?: number;
  waitingRoom: boolean;
  allowRecording: boolean;
  e2eeRequired: boolean;
  instructorPubkey: string;
}
```

## useLiveSession Hook

```typescript
interface UseLiveSessionReturn {
  // Session data
  lesson: Lesson | null;
  content: LiveSessionContent | null;
  isLoading: boolean;
  error: string | null;

  // Status
  isScheduled: boolean;
  isLive: boolean;
  isEnded: boolean;
  hasRecording: boolean;
  timeUntilStart: number | null;

  // RSVP
  rsvpStatus: LiveSessionRSVPStatus | null;
  canRSVP: boolean;
  rsvp: (status: LiveSessionRSVPStatus) => Promise<void>;

  // Attendance
  isAttending: boolean;
  attendanceDuration: number;
  joinSession: () => Promise<string | null>;
  leaveSession: () => Promise<void>;

  // Recording
  recordingUrl: string | null;
}
```

## UI Components

### LiveSessionJoin (in LessonPlayer)

Displays:
- Countdown timer before session
- RSVP buttons (Confirm/Tentative/Decline)
- Join button when session is live
- Recording playback when session ended

### Instructor Controls

During live session:
- Start/End session
- Enable/Disable recording
- Mute all participants
- Share screen
- Q&A moderation

## Notifications

### Reminder Notifications

| Timing | Notification |
|--------|--------------|
| 24 hours | "Tomorrow: [Session Name] at [Time]" |
| 1 hour | "[Session Name] starting in 1 hour" |
| 15 minutes | "[Session Name] starting soon - Join Now" |
| Start time | "Live now: [Session Name]" |

### Recording Available

- Sent to all RSVPs
- Includes recording link
- Lesson marked as completable via recording

## Recording Playback

When session ends:
1. Recording processed and uploaded
2. `recordingUrl` set on lesson content
3. Users can complete lesson by watching recording
4. Same 90% view threshold as video lessons

## Database Tables

```typescript
// Live sessions
trainingLiveSessions: '++id, lessonId, conferenceRoomId, scheduledAt'

// RSVPs
trainingLiveSessionRSVPs: '++id, lessonId, pubkey, status, [lessonId+pubkey]'

// Attendance
trainingLiveSessionAttendance: '++id, lessonId, pubkey, joinedAt, [lessonId+pubkey]'
```

## Security Considerations

- E2EE required for sensitive training content
- Recording consent from all participants
- Waiting room for controlled access
- Instructor verification before session start
