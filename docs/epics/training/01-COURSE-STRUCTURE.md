# Training Module: Course Structure

## Overview

Training content is organized in a three-tier hierarchy: Courses > Modules > Lessons. This structure provides flexibility for both simple tutorials and comprehensive training programs.

## Hierarchy

```
Course (Container)
├── Module 1 (Chapter)
│   ├── Lesson 1.1 (Video)
│   ├── Lesson 1.2 (Document)
│   └── Lesson 1.3 (Quiz)
├── Module 2 (Chapter)
│   ├── Lesson 2.1 (Interactive)
│   ├── Lesson 2.2 (Live Session)
│   └── Lesson 2.3 (Quiz)
└── Module 3 (Chapter)
    ├── Lesson 3.1 (Assignment)
    └── Lesson 3.2 (Quiz - Final)
```

## Course

Top-level container for training content.

```typescript
interface Course {
  id: string;
  groupId?: string;           // null for public courses
  title: string;
  description: string;
  imageUrl?: string;
  category: CourseCategory;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  prerequisites?: string[];   // Other course IDs
  status: 'draft' | 'published' | 'archived';
  certificationEnabled: boolean;
  certificationExpiryDays?: number;
  created: number;
  createdBy: string;
  updated: number;
}
```

### Course Categories

- `app-basics` - How to use BuildIt
- `opsec` - Operational security
- `digital-security` - Digital security practices
- `legal` - Legal observer, jail support
- `medic` - Street medic training
- `self-defense` - Community self-defense
- `organizing` - Organizing skills
- `communication` - Communication training
- `civil-defense` - Civil defense training
- `custom` - Organization-specific

## Module

Chapter or section within a course.

```typescript
interface TrainingModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  estimatedMinutes: number;
}
```

## Lesson Types

### Video Lesson

Pre-recorded video content with optional transcript and captions.

```typescript
interface VideoContent {
  type: 'video';
  videoUrl: string;
  transcriptUrl?: string;
  captionsUrl?: string;
  chaptersUrl?: string;
}
```

### Document Lesson

Text-based content in markdown or PDF format.

```typescript
interface DocumentContent {
  type: 'document';
  markdown?: string;
  pdfUrl?: string;
}
```

### Quiz Lesson

Assessment with scoring and multiple question types.

```typescript
interface QuizContent {
  type: 'quiz';
  questions: QuizQuestion[];
  passingScore: number;      // 0-100
  allowRetakes: boolean;
  maxAttempts?: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showCorrectAfter: boolean;
}
```

### Quiz Question Types

```typescript
type QuizQuestionType =
  | 'multiple-choice'   // Single correct answer
  | 'multi-select'      // Multiple correct answers
  | 'true-false'        // True or false
  | 'fill-in-blank'     // Text input
  | 'short-answer';     // Free text
```

### Assignment Lesson

File upload with optional instructor review.

```typescript
interface AssignmentContent {
  type: 'assignment';
  instructions: string;
  allowedFileTypes: string[];
  maxFileSizeMB: number;
  requiresReview: boolean;
  rubric?: AssignmentRubric;
}
```

### Live Session Lesson

Scheduled video conference with instructor.

```typescript
interface LiveSessionContent {
  type: 'live-session';
  scheduledAt: number;
  duration: number;           // minutes
  instructorPubkey: string;
  conferenceRoomId?: string;
  recordingUrl?: string;      // After session
  maxParticipants?: number;
  requiresRSVP: boolean;
}
```

### Interactive Lesson

Embedded exercises or simulations.

```typescript
interface InteractiveContent {
  type: 'interactive';
  embedUrl?: string;
  customComponent?: string;
  data?: Record<string, unknown>;
}
```

## Lesson Common Properties

```typescript
interface Lesson {
  id: string;
  moduleId: string;
  type: LessonType;
  title: string;
  description?: string;
  content: LessonContent;
  order: number;
  estimatedMinutes: number;
  requiredForCertification: boolean;
  passingScore?: number;      // For quizzes (0-100)
}
```

## Content Organization Best Practices

### Module Length
- Aim for 3-7 lessons per module
- Keep modules focused on a single topic
- Allow completion in one sitting (30-60 minutes)

### Lesson Sequencing
1. Start with video/document introduction
2. Include interactive elements
3. End with quiz assessment

### Quiz Design
- Mix question types for engagement
- Include immediate feedback
- Allow retakes for learning
- Set reasonable passing scores (70-80%)

## UI Components

### CourseList
Displays available courses with:
- Category filters
- Difficulty badges
- Progress indicators
- Search functionality

### CourseDetail
Shows course structure with:
- Collapsible modules
- Lesson list with types
- Progress checkmarks
- Enroll/Continue buttons

### LessonPlayer
Renders lesson content:
- Video player with controls
- Markdown/PDF viewer
- Quiz interface
- Assignment submission
- Live session join

## Database Tables

```typescript
// Courses table
trainingCourses: '++id, groupId, status, category, created'

// Modules table
trainingModules: '++id, courseId, order'

// Lessons table
trainingLessons: '++id, moduleId, type, order'
```
