/**
 * Training Module Database Schema
 * Contains all database table definitions for the training and certification system
 */

import type { TableSchema } from '@/types/modules';
import type {
  CourseCategory,
  CourseDifficulty,
  CourseStatus,
  LessonType,
  ProgressStatus,
  AssignmentReviewStatus
} from './types';

// ============================================================================
// Database Type Interfaces
// ============================================================================

/**
 * Course table interface
 */
export interface DBCourse {
  id: string;
  groupId?: string;
  title: string;
  description: string;
  imageUrl?: string;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  estimatedHours: number;
  prerequisites?: string;           // JSON array of course IDs
  status: CourseStatus;
  certificationEnabled: number;     // boolean as number
  certificationExpiryDays?: number;
  isPublic: number;                 // boolean as number
  isDefault: number;                // boolean as number
  created: number;
  createdBy: string;
  updated: number;
}

/**
 * Training module table interface
 */
export interface DBTrainingModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  estimatedMinutes: number;
  created: number;
  updated: number;
}

/**
 * Lesson table interface
 */
export interface DBLesson {
  id: string;
  moduleId: string;
  type: LessonType;
  title: string;
  description?: string;
  content: string;                  // JSON serialized LessonContent
  order: number;
  estimatedMinutes: number;
  requiredForCertification: number; // boolean as number
  passingScore?: number;
  created: number;
  updated: number;
}

/**
 * Lesson progress table interface
 */
export interface DBLessonProgress {
  id: string;
  lessonId: string;
  pubkey: string;
  status: ProgressStatus;
  score?: number;
  timeSpent: number;
  lastPosition?: number;
  completedAt?: number;
  attempts?: number;
  created: number;
  updated: number;
}

/**
 * Course progress table interface
 */
export interface DBCourseProgress {
  id: string;
  courseId: string;
  pubkey: string;
  percentComplete: number;
  lessonsCompleted: number;
  totalLessons: number;
  currentModuleId?: string;
  currentLessonId?: string;
  startedAt: number;
  lastActivityAt: number;
  completedAt?: number;
}

/**
 * Certification table interface
 */
export interface DBCertification {
  id: string;
  courseId: string;
  pubkey: string;
  earnedAt: number;
  expiresAt?: number;
  verificationCode: string;
  metadata?: string;              // JSON serialized
  revokedAt?: number;
  revokedBy?: string;
  revokeReason?: string;
}

/**
 * Live session table interface
 */
export interface DBLiveSession {
  id: string;
  lessonId: string;
  conferenceRoomId?: string;
  scheduledAt: number;
  startedAt?: number;
  endedAt?: number;
  recordingUrl?: string;
  attendeeCount: number;
}

/**
 * Live session RSVP table interface
 */
export interface DBLiveSessionRSVP {
  id: string;
  lessonId: string;
  pubkey: string;
  status: 'confirmed' | 'tentative' | 'declined';
  createdAt: number;
  updatedAt: number;
}

/**
 * Live session attendance table interface
 */
export interface DBLiveSessionAttendance {
  id: string;
  lessonId: string;
  pubkey: string;
  joinedAt: number;
  leftAt?: number;
  duration: number;
  wasCompleteSession: number;     // boolean as number
}

/**
 * Quiz question table interface (for mutable quizzes)
 */
export interface DBQuizQuestion {
  id: string;
  lessonId: string;
  type: string;
  question: string;
  options?: string;               // JSON array
  correctAnswer: string;          // JSON (can be string or array)
  explanation?: string;
  points: number;
  order: number;
}

/**
 * Quiz attempt table interface
 */
export interface DBQuizAttempt {
  id: string;
  lessonId: string;
  pubkey: string;
  answers: string;                // JSON array of QuizAnswer
  score: number;
  passed: number;                 // boolean as number
  startedAt: number;
  completedAt: number;
  duration: number;
}

/**
 * Assignment submission table interface
 */
export interface DBAssignmentSubmission {
  id: string;
  lessonId: string;
  pubkey: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  submittedAt: number;
  reviewStatus: AssignmentReviewStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  feedback?: string;
  score?: number;
  rubricScores?: string;          // JSON object
}

/**
 * Course enrollment table (for tracking enrollments)
 */
export interface DBCourseEnrollment {
  id: string;
  courseId: string;
  pubkey: string;
  enrolledAt: number;
  enrolledBy?: string;            // If enrolled by admin
  status: 'active' | 'paused' | 'completed' | 'dropped';
  completedAt?: number;
}

// ============================================================================
// Schema Definition
// ============================================================================

/**
 * Training module schema definition
 */
export const trainingSchema: TableSchema[] = [
  {
    name: 'trainingCourses',
    schema: 'id, groupId, title, category, difficulty, status, isPublic, isDefault, created, createdBy',
    indexes: ['id', 'groupId', 'title', 'category', 'difficulty', 'status', 'isPublic', 'isDefault', 'created', 'createdBy'],
  },
  {
    name: 'trainingModules',
    schema: 'id, courseId, title, order',
    indexes: ['id', 'courseId', 'title', 'order'],
  },
  {
    name: 'trainingLessons',
    schema: 'id, moduleId, type, title, order, requiredForCertification',
    indexes: ['id', 'moduleId', 'type', 'title', 'order', 'requiredForCertification'],
  },
  {
    name: 'trainingLessonProgress',
    schema: 'id, lessonId, pubkey, status, completedAt',
    indexes: ['id', 'lessonId', 'pubkey', 'status', 'completedAt'],
  },
  {
    name: 'trainingCourseProgress',
    schema: 'id, courseId, pubkey, percentComplete, startedAt, completedAt',
    indexes: ['id', 'courseId', 'pubkey', 'percentComplete', 'startedAt', 'completedAt'],
  },
  {
    name: 'trainingCertifications',
    schema: 'id, courseId, pubkey, earnedAt, expiresAt, verificationCode',
    indexes: ['id', 'courseId', 'pubkey', 'earnedAt', 'expiresAt', 'verificationCode'],
  },
  {
    name: 'trainingLiveSessions',
    schema: 'id, lessonId, conferenceRoomId, scheduledAt, startedAt, endedAt',
    indexes: ['id', 'lessonId', 'conferenceRoomId', 'scheduledAt', 'startedAt', 'endedAt'],
  },
  {
    name: 'trainingLiveSessionRSVPs',
    schema: 'id, lessonId, pubkey, status, createdAt',
    indexes: ['id', 'lessonId', 'pubkey', 'status', 'createdAt'],
  },
  {
    name: 'trainingLiveSessionAttendance',
    schema: 'id, lessonId, pubkey, joinedAt, duration',
    indexes: ['id', 'lessonId', 'pubkey', 'joinedAt', 'duration'],
  },
  {
    name: 'trainingQuizQuestions',
    schema: 'id, lessonId, type, order',
    indexes: ['id', 'lessonId', 'type', 'order'],
  },
  {
    name: 'trainingQuizAttempts',
    schema: 'id, lessonId, pubkey, score, passed, completedAt',
    indexes: ['id', 'lessonId', 'pubkey', 'score', 'passed', 'completedAt'],
  },
  {
    name: 'trainingAssignmentSubmissions',
    schema: 'id, lessonId, pubkey, reviewStatus, submittedAt, reviewedAt',
    indexes: ['id', 'lessonId', 'pubkey', 'reviewStatus', 'submittedAt', 'reviewedAt'],
  },
  {
    name: 'trainingCourseEnrollments',
    schema: 'id, courseId, pubkey, status, enrolledAt, completedAt',
    indexes: ['id', 'courseId', 'pubkey', 'status', 'enrolledAt', 'completedAt'],
  },
];
