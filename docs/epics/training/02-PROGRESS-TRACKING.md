# Training Module: Progress Tracking

## Overview

The training module tracks user progress at multiple levels: lesson completion, quiz scores, time spent, and overall course progress. This data drives the UI, certification eligibility, and analytics.

## Progress Hierarchy

```
User Progress
├── Course Progress (overall)
│   ├── Module 1 Progress
│   │   ├── Lesson 1.1 (completed, 15 min)
│   │   ├── Lesson 1.2 (completed, 10 min)
│   │   └── Lesson 1.3 (quiz: 85%, 5 min)
│   └── Module 2 Progress
│       ├── Lesson 2.1 (in-progress, 8 min)
│       └── Lesson 2.2 (not-started)
└── Certifications
    └── Course Certificate (earned: Jan 2026)
```

## Lesson Progress

Tracks individual lesson completion.

```typescript
interface LessonProgress {
  id: string;
  lessonId: string;
  pubkey: string;
  status: 'not-started' | 'in-progress' | 'completed';
  score?: number;           // Quiz score (0-100)
  timeSpent: number;        // Seconds
  lastPosition?: number;    // Video position (seconds)
  attempts?: number;        // Quiz attempts
  completedAt?: number;
  startedAt?: number;
  updatedAt: number;
}
```

### Status Transitions

```
not-started → in-progress → completed
                    ↓
              (failed quiz)
                    ↓
              in-progress (retry)
```

### Completion Criteria

| Lesson Type | Completion Trigger |
|-------------|-------------------|
| Video | Watched 90%+ of duration |
| Document | Scrolled to end / time spent threshold |
| Quiz | Achieved passing score |
| Assignment | Submitted (or reviewed if required) |
| Live Session | Attended 30+ minutes |
| Interactive | Completed all exercises |

## Course Progress

Aggregated progress for a course.

```typescript
interface CourseProgress {
  id: string;
  courseId: string;
  pubkey: string;
  percentComplete: number;    // 0-100
  lessonsCompleted: number;
  totalLessons: number;
  quizAverage?: number;
  totalTimeSpent: number;     // Seconds
  startedAt: number;
  lastActivityAt: number;
  completedAt?: number;
  certified?: boolean;
  certificationId?: string;
}
```

### Progress Calculation

```typescript
percentComplete = (lessonsCompleted / totalLessons) * 100
```

For certification-required lessons only:
```typescript
certificationProgress = (requiredLessonsCompleted / totalRequiredLessons) * 100
```

## Quiz Tracking

### Quiz Attempt

```typescript
interface QuizAttempt {
  id: string;
  lessonId: string;
  pubkey: string;
  answers: QuizAnswer[];
  score: number;
  passed: boolean;
  startedAt: number;
  completedAt: number;
  timeSpent: number;
}

interface QuizAnswer {
  questionId: string;
  answer: string | string[];
  correct: boolean;
  points: number;
}
```

### Scoring Rules

1. **Multiple Choice**: 1 point for correct, 0 for incorrect
2. **Multi-Select**: Partial credit based on correct selections
3. **True/False**: 1 point for correct
4. **Fill-in-Blank**: Exact match or configured alternatives
5. **Short Answer**: Manual review or keyword matching

### Retake Policy

- Configurable per quiz
- Track attempt count
- Optional max attempts limit
- Best score or latest score for progress

## User Training Status

Aggregate view of user's training activity.

```typescript
interface UserTrainingStatus {
  pubkey: string;
  coursesEnrolled: number;
  coursesCompleted: number;
  certificationsEarned: number;
  totalTimeSpent: number;     // Hours
  lastActivity?: number;
  averageQuizScore?: number;
}
```

## Analytics

### Course Analytics (Trainer Dashboard)

```typescript
interface CourseAnalytics {
  courseId: string;
  totalEnrollments: number;
  activeUsers: number;
  completionRate: number;
  averageProgress: number;
  averageTimeToComplete: number;
  quizPassRate: number;
  dropOffPoints: LessonDropOff[];
}
```

### Lesson Drop-Off Analysis

Identifies where users abandon courses:

```typescript
interface LessonDropOff {
  lessonId: string;
  lessonTitle: string;
  startedCount: number;
  completedCount: number;
  dropOffRate: number;
}
```

## Hooks

### useCourseProgress

```typescript
function useCourseProgress(courseId: string): {
  progress: CourseProgress | null;
  lessonProgress: Map<string, LessonProgress>;
  isLoading: boolean;
  percentComplete: number;
  currentLesson: Lesson | null;
  nextLesson: Lesson | null;
  markLessonComplete: (lessonId: string, score?: number) => Promise<void>;
  updateVideoPosition: (lessonId: string, position: number) => void;
}
```

## Database Tables

```typescript
// Lesson progress
trainingLessonProgress: '++id, lessonId, pubkey, status, [lessonId+pubkey]'

// Course progress
trainingCourseProgress: '++id, courseId, pubkey, [courseId+pubkey]'

// Quiz attempts
trainingQuizAttempts: '++id, lessonId, pubkey, score, completedAt'
```

## Progress Persistence

### Auto-Save

- Video position saved every 10 seconds
- Quiz answers saved after each question
- Document scroll position on unmount

### Sync Strategy

- Local-first with IndexedDB
- Sync to server on connectivity
- Conflict resolution: latest timestamp wins

## Privacy Considerations

- Progress data is per-user and private
- Trainer dashboard shows aggregate stats only
- No individual user data exposed without consent
- Optional anonymous mode for sensitive trainings
