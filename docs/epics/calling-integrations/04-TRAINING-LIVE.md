# Calling Integration: Training Live Sessions

## Overview

The Training ↔ Calling integration enables live, instructor-led training sessions via video conferencing. Sessions can be scheduled, recorded, and played back. Attendance is tracked for course completion.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Training Module                               │
│  ┌────────────┐     ┌─────────────┐     ┌──────────────────┐   │
│  │   Course   │────▶│   Module    │────▶│  Live Session    │   │
│  └────────────┘     └─────────────┘     │  Lesson          │   │
│                                          └────────┬─────────┘   │
└───────────────────────────────────────────────────┼─────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Calling Module                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Conference Room                          │    │
│  │  - Instructor as host                                    │    │
│  │  - Enrolled users as participants                        │    │
│  │  - E2EE optional                                        │    │
│  │  - Recording enabled/disabled                            │    │
│  └─────────────────────────────────────────────────────────┘    │
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

## TrainingCallingIntegration Service

```typescript
class TrainingCallingIntegration {
  // Create conference room for live session
  async createLiveSession(
    lesson: Lesson,
    config: TrainingConferenceConfig
  ): Promise<{ conferenceRoomId: string; joinUrl: string }>;

  // Start live session
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

  // Get conference details
  async getConferenceDetails(lessonId: string): Promise<{
    conferenceRoomId: string | null;
    isActive: boolean;
    participantCount: number;
  }>;
}
```

## Conference Configuration

```typescript
interface TrainingConferenceConfig {
  name: string;                    // Session title
  maxParticipants?: number;
  waitingRoom: boolean;
  allowRecording: boolean;
  e2eeRequired: boolean;
  instructorPubkey: string;
}
```

## Session Lifecycle

```
Lesson Created (type: live-session)
    │
    │ scheduledAt set
    ▼
Session Scheduled
    │
    │ (auto-start time)
    ▼
Conference Room Created ────────────────┐
    │                                    │
    │ startLiveSession()                 │
    ▼                                    │
Session Active                           │
    │                                    │
    │ trackLiveAttendance()              │
    ▼                                    │
Attendees Join/Leave ───────────────────┤
    │                                    │
    │ endLiveSession()                   │
    ▼                                    │
Session Ended                            │
    │                                    │
    │ (if recording enabled)             │
    ▼                                    │
Recording Processed                      │
    │                                    │
    │ recordingUrl set                   │
    ▼                                    │
Recording Available ────────────────────┘
```

## RSVP System

```typescript
interface LiveSessionRSVP {
  id: string;
  lessonId: string;
  pubkey: string;
  status: 'confirmed' | 'tentative' | 'declined';
  rsvpTime: number;
  reminderSent?: boolean;
}
```

### RSVP Flow
1. User views scheduled live session
2. User RSVPs (confirm/tentative/decline)
3. Reminder sent before session
4. Join link provided when session starts

## Attendance Tracking

```typescript
interface LiveSessionAttendance {
  id: string;
  lessonId: string;
  pubkey: string;
  joinedAt: number;
  leftAt?: number;
  totalDuration: number;         // Seconds
  joinCount: number;             // Reconnections
}
```

### Completion Criteria
- Minimum attendance: 30 minutes
- OR: 50% of scheduled duration
- Automatic lesson completion when threshold met

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
  rsvpStatus: 'confirmed' | 'tentative' | 'declined' | null;
  canRSVP: boolean;
  rsvp: (status: string) => Promise<void>;

  // Attendance
  isAttending: boolean;
  attendanceDuration: number;    // Seconds
  joinSession: () => Promise<string | null>;
  leaveSession: () => Promise<void>;

  // Recording
  recordingUrl: string | null;
}
```

## UI Integration

### In LessonPlayer

Live session rendering includes:

**Before Session:**
- Countdown timer
- RSVP buttons
- Session details (instructor, duration)

**During Session:**
- "Join Now" button
- Participant count
- Duration tracker

**After Session:**
- Recording playback (if available)
- Attendance summary
- Completion status

## Recording Playback

After session ends:
1. Recording processed and uploaded
2. `recordingUrl` set on lesson content
3. Users can complete lesson via recording
4. Same 90% view threshold as video lessons

## CRM Integration

### TrainingCRMIntegration

Links certifications and training status to CRM contacts:

```typescript
class TrainingCRMIntegration {
  // Add certification to contact
  async addCertificationToContact(
    contactId: string,
    certification: Certification
  ): Promise<void>;

  // Get contact's training status
  async getContactTrainingStatus(
    contactId: string,
    pubkey: string
  ): Promise<ContactTrainingInfo>;

  // Filter contacts by certification
  async filterContactsByCertification(
    courseId: string,
    includeExpired?: boolean
  ): Promise<string[]>;

  // Check training requirements
  async checkTrainingRequirements(
    pubkey: string,
    requiredCourseIds: string[]
  ): Promise<{ met: boolean; requirements: TrainingRequirement[] }>;

  // Get contacts with expiring certifications
  async getContactsWithExpiringCertifications(
    daysThreshold: number
  ): Promise<Array<{ pubkey: string; certification: Certification }>>;
}
```

## Events Integration

### TrainingEventsIntegration

Links training to events module:

```typescript
class TrainingEventsIntegration {
  // Create training event
  async createTrainingEvent(
    config: TrainingEventConfig
  ): Promise<string>;

  // Link event to training
  async linkEventToTraining(
    eventId: string,
    courseId: string,
    lessonId?: string
  ): Promise<void>;

  // Sync event RSVP to training enrollment
  async syncEventRSVPToTraining(
    eventId: string,
    pubkey: string,
    rsvpStatus: string
  ): Promise<void>;

  // Track event attendance
  async trackEventAttendance(
    eventId: string,
    pubkey: string,
    checkInTime: number,
    checkOutTime?: number
  ): Promise<void>;
}
```

## Notifications

| Event | Notification |
|-------|--------------|
| Session scheduled | "New live session: [Title] on [Date]" |
| 24 hours before | "Tomorrow: [Session] at [Time]" |
| 1 hour before | "[Session] starting in 1 hour" |
| Session starting | "[Session] is now live - Join" |
| Recording ready | "Recording available: [Session]" |

## Security Considerations

- E2EE toggle for sensitive training
- Instructor verification before session
- Waiting room for moderated access
- Recording consent (if required by config)
- Attendance data privacy
