/**
 * Training Module Types
 * Comprehensive type definitions for the training and certification system
 */

import { z } from 'zod';

/**
 * Course category types
 */
export type CourseCategory =
  | 'app-basics'
  | 'opsec'
  | 'digital-security'
  | 'legal'
  | 'medic'
  | 'self-defense'
  | 'organizing'
  | 'communication'
  | 'civil-defense'
  | 'custom';

/**
 * Course difficulty levels
 */
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * Course status
 */
export type CourseStatus = 'draft' | 'published' | 'archived';

/**
 * Lesson types
 */
export type LessonType =
  | 'video'           // Pre-recorded video
  | 'document'        // Markdown or PDF
  | 'quiz'            // Questions with scoring
  | 'assignment'      // File upload for review
  | 'live-session'    // Scheduled video conference
  | 'interactive';    // Embedded exercise

/**
 * Quiz question types
 */
export type QuizQuestionType =
  | 'multiple-choice'
  | 'multi-select'
  | 'true-false'
  | 'fill-in-blank'
  | 'short-answer';

/**
 * Progress status
 */
export type ProgressStatus = 'not-started' | 'in-progress' | 'completed';

/**
 * Assignment review status
 */
export type AssignmentReviewStatus = 'pending' | 'in-review' | 'approved' | 'rejected' | 'revision-requested';

// ============================================================================
// Course Types
// ============================================================================

/**
 * Training course - top-level container
 */
export interface Course {
  id: string;
  groupId?: string;        // null for public courses
  title: string;
  description: string;
  imageUrl?: string;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  estimatedHours: number;
  prerequisites?: string[]; // Course IDs
  status: CourseStatus;
  certificationEnabled: boolean;
  certificationExpiryDays?: number;
  isPublic: boolean;       // Available to all groups
  isDefault: boolean;      // Built-in template course
  created: number;
  createdBy: string;
  updated: number;
}

/**
 * Data for creating a new course
 */
export interface CreateCourseData {
  groupId?: string;
  title: string;
  description: string;
  imageUrl?: string;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  estimatedHours: number;
  prerequisites?: string[];
  certificationEnabled?: boolean;
  certificationExpiryDays?: number;
  isPublic?: boolean;
}

/**
 * Data for updating a course
 */
export interface UpdateCourseData {
  title?: string;
  description?: string;
  imageUrl?: string;
  category?: CourseCategory;
  difficulty?: CourseDifficulty;
  estimatedHours?: number;
  prerequisites?: string[];
  status?: CourseStatus;
  certificationEnabled?: boolean;
  certificationExpiryDays?: number;
  isPublic?: boolean;
}

// ============================================================================
// Module Types
// ============================================================================

/**
 * Training module - chapter within a course
 */
export interface TrainingModule {
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
 * Data for creating a training module
 */
export interface CreateModuleData {
  courseId: string;
  title: string;
  description?: string;
  order?: number;
  estimatedMinutes: number;
}

/**
 * Data for updating a training module
 */
export interface UpdateModuleData {
  title?: string;
  description?: string;
  order?: number;
  estimatedMinutes?: number;
}

// ============================================================================
// Lesson Types
// ============================================================================

/**
 * Video lesson content
 */
export interface VideoContent {
  type: 'video';
  videoUrl: string;
  transcriptUrl?: string;
  captionsUrl?: string;
  chaptersUrl?: string;
  duration?: number;      // seconds
}

/**
 * Document lesson content
 */
export interface DocumentContent {
  type: 'document';
  markdown?: string;
  pdfUrl?: string;
}

/**
 * Quiz question
 */
export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options?: string[];         // For multiple-choice, multi-select
  correctAnswer: string | string[]; // Can be single or multiple correct
  explanation?: string;       // Shown after answer
  points: number;
  order: number;
}

/**
 * Quiz lesson content
 */
export interface QuizContent {
  type: 'quiz';
  questions: QuizQuestion[];
  passingScore: number;       // 0-100
  allowRetakes: boolean;
  maxAttempts?: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showCorrectAfter: boolean;
  timeLimitMinutes?: number;
}

/**
 * Assignment lesson content
 */
export interface AssignmentContent {
  type: 'assignment';
  instructions: string;
  allowedFileTypes?: string[];  // e.g., ['pdf', 'docx', 'md']
  maxFileSizeMB?: number;
  rubric?: AssignmentRubricItem[];
}

/**
 * Assignment rubric item
 */
export interface AssignmentRubricItem {
  id: string;
  criterion: string;
  description: string;
  maxPoints: number;
}

/**
 * Live session lesson content
 */
export interface LiveSessionContent {
  type: 'live-session';
  scheduledAt: number;
  duration: number;           // minutes
  instructorPubkey: string;
  conferenceRoomId?: string;  // Linked to calling module
  recordingUrl?: string;      // After session
  maxParticipants?: number;
  requiresRSVP: boolean;
}

/**
 * Interactive lesson content
 */
export interface InteractiveContent {
  type: 'interactive';
  exerciseType: 'threat-model' | 'security-audit' | 'scenario' | 'simulation' | 'custom';
  configJson: string;         // Exercise-specific configuration
  externalUrl?: string;       // Link to external interactive content
}

/**
 * Combined lesson content type
 */
export type LessonContent =
  | VideoContent
  | DocumentContent
  | QuizContent
  | AssignmentContent
  | LiveSessionContent
  | InteractiveContent;

/**
 * Lesson - individual learning unit
 */
export interface Lesson {
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
  created: number;
  updated: number;
}

/**
 * Data for creating a lesson
 */
export interface CreateLessonData {
  moduleId: string;
  type: LessonType;
  title: string;
  description?: string;
  content: LessonContent;
  order?: number;
  estimatedMinutes: number;
  requiredForCertification?: boolean;
  passingScore?: number;
}

/**
 * Data for updating a lesson
 */
export interface UpdateLessonData {
  title?: string;
  description?: string;
  content?: Partial<LessonContent>;
  order?: number;
  estimatedMinutes?: number;
  requiredForCertification?: boolean;
  passingScore?: number;
}

// ============================================================================
// Progress Types
// ============================================================================

/**
 * User progress on a lesson
 */
export interface LessonProgress {
  id: string;
  lessonId: string;
  pubkey: string;
  status: ProgressStatus;
  score?: number;             // Quiz score (0-100)
  timeSpent: number;          // Seconds
  lastPosition?: number;      // Video position in seconds
  completedAt?: number;
  attempts?: number;          // For quizzes
  created: number;
  updated: number;
}

/**
 * User progress on a course
 */
export interface CourseProgress {
  id: string;
  courseId: string;
  pubkey: string;
  percentComplete: number;    // 0-100
  lessonsCompleted: number;
  totalLessons: number;
  currentModuleId?: string;
  currentLessonId?: string;
  startedAt: number;
  lastActivityAt: number;
  completedAt?: number;
}

/**
 * Quiz attempt record
 */
export interface QuizAttempt {
  id: string;
  lessonId: string;
  pubkey: string;
  answers: QuizAnswer[];
  score: number;              // 0-100
  passed: boolean;
  startedAt: number;
  completedAt: number;
  duration: number;           // seconds
}

/**
 * Individual quiz answer
 */
export interface QuizAnswer {
  questionId: string;
  selectedAnswer: string | string[];
  isCorrect: boolean;
  points: number;
}

/**
 * Assignment submission
 */
export interface AssignmentSubmission {
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
  rubricScores?: Record<string, number>;  // rubricItemId -> score
}

// ============================================================================
// Certification Types
// ============================================================================

/**
 * Certification record
 */
export interface Certification {
  id: string;
  courseId: string;
  pubkey: string;
  earnedAt: number;
  expiresAt?: number;
  verificationCode: string;   // Unique code for verification
  metadata?: Record<string, unknown>;
  revokedAt?: number;
  revokedBy?: string;
  revokeReason?: string;
}

/**
 * Certification verification result
 */
export interface CertificationVerification {
  valid: boolean;
  certification?: Certification;
  course?: Course;
  holderName?: string;
  expired?: boolean;
  revoked?: boolean;
  error?: string;
}

// ============================================================================
// Live Session Types
// ============================================================================

/**
 * Live session RSVP
 */
export interface LiveSessionRSVP {
  id: string;
  lessonId: string;
  pubkey: string;
  status: 'confirmed' | 'tentative' | 'declined';
  createdAt: number;
  updatedAt: number;
}

/**
 * Live session attendance record
 */
export interface LiveSessionAttendance {
  id: string;
  lessonId: string;
  pubkey: string;
  joinedAt: number;
  leftAt?: number;
  duration: number;           // seconds
  wasCompleteSession: boolean;
}

// ============================================================================
// Stats and Analytics Types
// ============================================================================

/**
 * Course statistics
 */
export interface CourseStats {
  courseId: string;
  enrolledCount: number;
  completedCount: number;
  averageProgress: number;
  averageCompletionTime: number;  // hours
  certificationCount: number;
  averageQuizScore: number;
}

/**
 * User training status (for CRM integration)
 */
export interface UserTrainingStatus {
  pubkey: string;
  coursesEnrolled: number;
  coursesCompleted: number;
  certificationsEarned: number;
  certificationsExpiring: number;   // Within 30 days
  totalTimeSpent: number;           // hours
  lastActivity?: number;
}

// ============================================================================
// Template Types
// ============================================================================

/**
 * Course template for pre-built courses
 */
export interface CourseTemplate {
  id: string;
  title: string;
  description: string;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  estimatedHours: number;
  imageUrl?: string;
  modules: ModuleTemplate[];
  certificationEnabled: boolean;
  certificationExpiryDays?: number;
}

/**
 * Module template within a course template
 */
export interface ModuleTemplate {
  title: string;
  description?: string;
  estimatedMinutes: number;
  lessons: LessonTemplate[];
}

/**
 * Lesson template within a module template
 */
export interface LessonTemplate {
  type: LessonType;
  title: string;
  description?: string;
  estimatedMinutes: number;
  requiredForCertification: boolean;
  content?: Partial<LessonContent>;
}

// ============================================================================
// Query Options
// ============================================================================

/**
 * Options for querying courses
 */
export interface CourseQueryOptions {
  groupId?: string;
  category?: CourseCategory;
  difficulty?: CourseDifficulty;
  status?: CourseStatus;
  includePublic?: boolean;
  search?: string;
  sortBy?: 'title' | 'created' | 'updated' | 'difficulty';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Options for querying user progress
 */
export interface ProgressQueryOptions {
  pubkey: string;
  courseId?: string;
  status?: ProgressStatus;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const CourseCategorySchema = z.enum([
  'app-basics', 'opsec', 'digital-security', 'legal', 'medic',
  'self-defense', 'organizing', 'communication', 'civil-defense', 'custom'
]);

export const CourseDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const CourseStatusSchema = z.enum(['draft', 'published', 'archived']);

export const LessonTypeSchema = z.enum([
  'video', 'document', 'quiz', 'assignment', 'live-session', 'interactive'
]);

export const ProgressStatusSchema = z.enum(['not-started', 'in-progress', 'completed']);

export const CreateCourseDataSchema = z.object({
  groupId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  imageUrl: z.string().url().optional(),
  category: CourseCategorySchema,
  difficulty: CourseDifficultySchema,
  estimatedHours: z.number().min(0.5).max(1000),
  prerequisites: z.array(z.string()).optional(),
  certificationEnabled: z.boolean().optional(),
  certificationExpiryDays: z.number().min(1).max(3650).optional(),
  isPublic: z.boolean().optional(),
});

export const UpdateCourseDataSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  imageUrl: z.string().url().optional(),
  category: CourseCategorySchema.optional(),
  difficulty: CourseDifficultySchema.optional(),
  estimatedHours: z.number().min(0.5).max(1000).optional(),
  prerequisites: z.array(z.string()).optional(),
  status: CourseStatusSchema.optional(),
  certificationEnabled: z.boolean().optional(),
  certificationExpiryDays: z.number().min(1).max(3650).optional(),
  isPublic: z.boolean().optional(),
});

export const QuizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['multiple-choice', 'multi-select', 'true-false', 'fill-in-blank', 'short-answer']),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  explanation: z.string().optional(),
  points: z.number().min(1),
  order: z.number(),
});

export const CertificationSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  pubkey: z.string(),
  earnedAt: z.number(),
  expiresAt: z.number().optional(),
  verificationCode: z.string(),
  metadata: z.record(z.unknown()).optional(),
  revokedAt: z.number().optional(),
  revokedBy: z.string().optional(),
  revokeReason: z.string().optional(),
});
