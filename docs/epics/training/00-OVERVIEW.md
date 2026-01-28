# Training Module Epic

## Overview

The Training module provides a comprehensive Learning Management System (LMS) for BuildIt, enabling organizations to create, deliver, and track training content for their members, volunteers, and community.

## Vision

A complete training system supporting:
- **Self-directed learning** - Courses, modules, lessons with progress tracking
- **Live training sessions** - Integrated video conferencing via Calling module
- **Certification tracking** - Completion records linked to CRM
- **Public defaults** - App usage tutorials, opsec best practices
- **Customizable content** - Organizations can create any training content

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Training Module                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │   Course    │────▶│   Module    │────▶│     Lesson      │   │
│  │ (Container) │     │ (Chapter)   │     │ (Content Unit)  │   │
│  └─────────────┘     └─────────────┘     └─────────────────┘   │
│                                                                  │
│  Lesson Types:                                                   │
│  - Video (pre-recorded or live session recording)               │
│  - Document (markdown, PDF viewer)                              │
│  - Quiz (multiple choice, multi-select, fill-in-blank)         │
│  - Assignment (file upload with review)                         │
│  - Live Session (scheduled video conference)                    │
│  - Interactive (embedded exercises, simulations)                │
│                                                                  │
│  Progress Tracking:                                              │
│  - Lesson completion status                                      │
│  - Quiz scores and attempts                                      │
│  - Time spent per lesson                                         │
│  - Overall course progress %                                     │
│  - Certification earned date                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Module Structure

```
src/modules/training/
├── index.ts              # Module registration
├── schema.ts             # Database schema (13 tables)
├── types.ts              # TypeScript types
├── trainingStore.ts      # Zustand store
├── trainingManager.ts    # Business logic
├── migrations.ts         # Schema migrations
├── seeds.ts              # Default courses
├── i18n/
│   └── index.ts          # Translations (en, es, fr, ar)
├── components/
│   ├── TrainingView.tsx      # Main dashboard
│   ├── CourseList.tsx        # Course grid with filters
│   ├── CourseDetail.tsx      # Course detail with modules
│   ├── LessonPlayer.tsx      # Multi-type lesson rendering
│   ├── CertificationsView.tsx # User certifications
│   ├── TrainerDashboard.tsx  # Analytics for trainers
│   └── index.ts              # Component exports
├── hooks/
│   ├── useTraining.ts        # Training data access
│   ├── useCourseProgress.ts  # Progress tracking
│   ├── useLiveSession.ts     # Live session management
│   └── index.ts              # Hook exports
├── integrations/
│   ├── callingIntegration.ts # Live session video
│   ├── crmIntegration.ts     # Certification tracking
│   ├── eventsIntegration.ts  # Training events link
│   └── index.ts              # Integration exports
└── templates/
    ├── appBasics.ts          # How to use BuildIt
    ├── opsecBasics.ts        # Operational security
    ├── digitalSecurity.ts    # Digital security
    ├── jailSupport.ts        # Jail support training
    └── index.ts              # Template exports
```

## Dependencies

| Module | Relationship | Purpose |
|--------|--------------|---------|
| Calling | Optional | Live training sessions via video |
| CRM | Optional | Certification tracking on contacts |
| Events | Optional | Training events scheduling |
| Files | Optional | Assignment file uploads |

## Database Schema

The training module uses 13 database tables:

- `trainingCourses` - Course containers
- `trainingModules` - Chapters within courses
- `trainingLessons` - Individual learning units
- `trainingLessonProgress` - Per-user lesson completion
- `trainingCourseProgress` - Per-user course progress
- `trainingCertifications` - Earned certifications
- `trainingLiveSessions` - Scheduled live sessions
- `trainingLiveSessionRSVPs` - Session registrations
- `trainingLiveSessionAttendance` - Attendance records
- `trainingQuizQuestions` - Quiz question bank
- `trainingQuizAttempts` - User quiz attempts
- `trainingAssignmentSubmissions` - Assignment uploads
- `trainingCourseEnrollments` - Course enrollments

## Key Features

### 1. Self-Directed Learning
- Course catalog with categories and difficulty levels
- Module-based organization (chapters)
- Multiple lesson types (video, document, quiz, etc.)
- Progress tracking with resume capability

### 2. Live Training Sessions
- Integration with Calling module for video
- RSVP system for session registration
- Attendance tracking
- Recording and playback

### 3. Assessment & Certification
- Quizzes with multiple question types
- Pass/fail thresholds
- Automatic certification on completion
- Certification expiration and renewal

### 4. Default Content Templates
- BuildIt Basics (app usage)
- Operational Security
- Digital Security
- Jail Support Training

## Implementation Status

| Feature | Status |
|---------|--------|
| Core types and schema | Complete |
| Store and manager | Complete |
| UI components | Complete |
| Hooks | Complete |
| Module integrations | Complete |
| Default templates | Complete |
| i18n (en, es, fr, ar) | Complete |

## Related Epics

- [01-COURSE-STRUCTURE.md](./01-COURSE-STRUCTURE.md) - Course, module, lesson hierarchy
- [02-PROGRESS-TRACKING.md](./02-PROGRESS-TRACKING.md) - Progress and analytics
- [03-LIVE-SESSIONS.md](./03-LIVE-SESSIONS.md) - Video conference integration
- [04-CERTIFICATIONS.md](./04-CERTIFICATIONS.md) - Certification system
- [05-DEFAULT-CONTENT.md](./05-DEFAULT-CONTENT.md) - Built-in training templates
