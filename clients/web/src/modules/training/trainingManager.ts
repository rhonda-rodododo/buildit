/**
 * Training Module Manager
 * Business logic and database operations for training system
 */

import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';
import { getDB, type BuildItDB } from '@/core/storage/db';
import { useIdentityStore } from '@/core/identity';
import type {
  Course,
  TrainingModule,
  Lesson,
  LessonProgress,
  CourseProgress,
  Certification,
  QuizAttempt,
  AssignmentSubmission,
  LiveSessionRSVP,
  LiveSessionAttendance,
  CreateCourseData,
  UpdateCourseData,
  CreateModuleData,
  UpdateModuleData,
  CreateLessonData,
  UpdateLessonData,
  CourseQueryOptions,
  CourseStats,
  UserTrainingStatus,
  QuizAnswer,
  CertificationVerification,
  LessonContent,
} from './types';
import type {
  DBCourse,
  DBTrainingModule,
  DBLesson,
  DBLessonProgress,
  DBCourseProgress,
  DBCertification,
  DBQuizAttempt,
  DBAssignmentSubmission,
  DBLiveSessionRSVP,
  DBLiveSessionAttendance,
  DBCourseEnrollment,
} from './schema';

/**
 * Convert DB course to domain course
 */
function dbCourseToDomain(db: DBCourse): Course {
  return {
    ...db,
    prerequisites: db.prerequisites ? JSON.parse(db.prerequisites) : undefined,
    certificationEnabled: Boolean(db.certificationEnabled),
    isPublic: Boolean(db.isPublic),
    isDefault: Boolean(db.isDefault),
  };
}

/**
 * Convert domain course to DB course
 */
function courseToDB(course: Partial<Course>): Partial<DBCourse> {
  const result: Partial<DBCourse> = { ...course };
  if (course.prerequisites) {
    result.prerequisites = JSON.stringify(course.prerequisites);
  }
  if (course.certificationEnabled !== undefined) {
    result.certificationEnabled = course.certificationEnabled ? 1 : 0;
  }
  if (course.isPublic !== undefined) {
    result.isPublic = course.isPublic ? 1 : 0;
  }
  if (course.isDefault !== undefined) {
    result.isDefault = course.isDefault ? 1 : 0;
  }
  return result;
}

/**
 * Convert DB lesson to domain lesson
 */
function dbLessonToDomain(db: DBLesson): Lesson {
  return {
    ...db,
    content: JSON.parse(db.content) as LessonContent,
    requiredForCertification: Boolean(db.requiredForCertification),
  };
}

/**
 * Convert domain lesson to DB lesson
 */
function lessonToDB(lesson: Partial<Lesson>): Partial<DBLesson> {
  const result: Partial<DBLesson> = { ...lesson };
  if (lesson.content) {
    result.content = JSON.stringify(lesson.content);
  }
  if (lesson.requiredForCertification !== undefined) {
    result.requiredForCertification = lesson.requiredForCertification ? 1 : 0;
  }
  return result;
}

/**
 * Training Manager Class
 */
class TrainingManager {
  private db: BuildItDB | null = null;
  private initialized = false;

  /**
   * Initialize the manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.db = await getDB();
      this.initialized = true;
      logger.info('📚 Training manager initialized');
    } catch (error) {
      logger.error('Failed to initialize training manager', error);
      throw error;
    }
  }

  private getDB(): BuildItDB {
    if (!this.db) {
      throw new Error('Training manager not initialized');
    }
    return this.db;
  }

  private getCurrentPubkey(): string {
    const identity = useIdentityStore.getState().currentIdentity;
    if (!identity) {
      throw new Error('No identity selected');
    }
    return identity.pubkey;
  }

  // =========================================================================
  // Course Operations
  // =========================================================================

  async listCourses(options?: CourseQueryOptions): Promise<Course[]> {
    const db = this.getDB();
    let query = db.table('trainingCourses').toCollection();

    if (options?.groupId) {
      query = query.filter(c => c.groupId === options.groupId || (options.includePublic && c.isPublic));
    }
    if (options?.category) {
      query = query.filter(c => c.category === options.category);
    }
    if (options?.difficulty) {
      query = query.filter(c => c.difficulty === options.difficulty);
    }
    if (options?.status) {
      query = query.filter(c => c.status === options.status);
    }
    if (options?.search) {
      const search = options.search.toLowerCase();
      query = query.filter(c =>
        c.title.toLowerCase().includes(search) ||
        c.description.toLowerCase().includes(search)
      );
    }

    const courses = await query.toArray();

    // Sort
    if (options?.sortBy) {
      courses.sort((a, b) => {
        const aVal = a[options.sortBy!];
        const bVal = b[options.sortBy!];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.sortOrder === 'desc' ? -cmp : cmp;
      });
    }

    // Pagination
    if (options?.offset) {
      courses.splice(0, options.offset);
    }
    if (options?.limit) {
      courses.splice(options.limit);
    }

    return courses.map(dbCourseToDomain);
  }

  async getCourse(courseId: string): Promise<Course | null> {
    const db = this.getDB();
    const course = await db.table('trainingCourses').get(courseId);
    return course ? dbCourseToDomain(course) : null;
  }

  async createCourse(data: CreateCourseData): Promise<Course> {
    const db = this.getDB();
    const now = Date.now();
    const pubkey = this.getCurrentPubkey();

    const course: DBCourse = {
      id: nanoid(),
      groupId: data.groupId,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      category: data.category,
      difficulty: data.difficulty,
      estimatedHours: data.estimatedHours,
      prerequisites: data.prerequisites ? JSON.stringify(data.prerequisites) : undefined,
      status: 'draft',
      certificationEnabled: data.certificationEnabled ? 1 : 0,
      certificationExpiryDays: data.certificationExpiryDays,
      isPublic: data.isPublic ? 1 : 0,
      isDefault: 0,
      created: now,
      createdBy: pubkey,
      updated: now,
    };

    await db.table('trainingCourses').add(course);
    logger.info(`Created course: ${course.id}`);
    return dbCourseToDomain(course);
  }

  async updateCourse(courseId: string, data: UpdateCourseData): Promise<Course> {
    const db = this.getDB();
    const now = Date.now();

    const updateData = courseToDB({
      ...data,
      updated: now,
    } as Course);

    await db.table('trainingCourses').update(courseId, updateData);

    const course = await db.table('trainingCourses').get(courseId);
    if (!course) {
      throw new Error('Course not found after update');
    }

    logger.info(`Updated course: ${courseId}`);
    return dbCourseToDomain(course);
  }

  async deleteCourse(courseId: string): Promise<void> {
    const db = this.getDB();

    // Delete all related data
    const modules = await db.table('trainingModules')
      .where('courseId').equals(courseId)
      .toArray();

    for (const module of modules) {
      await this.deleteModule(module.id);
    }

    await db.table('trainingCourseProgress').where('courseId').equals(courseId).delete();
    await db.table('trainingCertifications').where('courseId').equals(courseId).delete();
    await db.table('trainingCourseEnrollments').where('courseId').equals(courseId).delete();
    await db.table('trainingCourses').delete(courseId);

    logger.info(`Deleted course: ${courseId}`);
  }

  // =========================================================================
  // Module Operations
  // =========================================================================

  async listModules(courseId: string): Promise<TrainingModule[]> {
    const db = this.getDB();
    const modules = await db.table('trainingModules')
      .where('courseId').equals(courseId)
      .sortBy('order');
    return modules;
  }

  async getModule(moduleId: string): Promise<TrainingModule | null> {
    const db = this.getDB();
    return await db.table('trainingModules').get(moduleId);
  }

  async createModule(data: CreateModuleData): Promise<TrainingModule> {
    const db = this.getDB();
    const now = Date.now();

    // Get max order
    const existing = await db.table('trainingModules')
      .where('courseId').equals(data.courseId)
      .toArray();
    const maxOrder = existing.reduce((max, m) => Math.max(max, m.order), 0);

    const module: DBTrainingModule = {
      id: nanoid(),
      courseId: data.courseId,
      title: data.title,
      description: data.description,
      order: data.order ?? maxOrder + 1,
      estimatedMinutes: data.estimatedMinutes,
      created: now,
      updated: now,
    };

    await db.table('trainingModules').add(module);
    logger.info(`Created module: ${module.id}`);
    return module;
  }

  async updateModule(moduleId: string, data: UpdateModuleData): Promise<TrainingModule> {
    const db = this.getDB();
    const now = Date.now();

    await db.table('trainingModules').update(moduleId, {
      ...data,
      updated: now,
    });

    const module = await db.table('trainingModules').get(moduleId);
    if (!module) {
      throw new Error('Module not found after update');
    }

    logger.info(`Updated module: ${moduleId}`);
    return module;
  }

  async deleteModule(moduleId: string): Promise<void> {
    const db = this.getDB();

    // Delete all lessons in module
    const lessons = await db.table('trainingLessons')
      .where('moduleId').equals(moduleId)
      .toArray();

    for (const lesson of lessons) {
      await this.deleteLesson(lesson.id);
    }

    await db.table('trainingModules').delete(moduleId);
    logger.info(`Deleted module: ${moduleId}`);
  }

  async reorderModules(courseId: string, moduleIds: string[]): Promise<void> {
    const db = this.getDB();
    const now = Date.now();

    await db.transaction('rw', db.table('trainingModules'), async () => {
      for (let i = 0; i < moduleIds.length; i++) {
        await db.table('trainingModules').update(moduleIds[i], {
          order: i + 1,
          updated: now,
        });
      }
    });

    logger.info(`Reordered modules for course: ${courseId}`);
  }

  // =========================================================================
  // Lesson Operations
  // =========================================================================

  async listLessons(moduleId: string): Promise<Lesson[]> {
    const db = this.getDB();
    const lessons = await db.table('trainingLessons')
      .where('moduleId').equals(moduleId)
      .sortBy('order');
    return lessons.map(dbLessonToDomain);
  }

  async getLesson(lessonId: string): Promise<Lesson | null> {
    const db = this.getDB();
    const lesson = await db.table('trainingLessons').get(lessonId);
    return lesson ? dbLessonToDomain(lesson) : null;
  }

  async createLesson(data: CreateLessonData): Promise<Lesson> {
    const db = this.getDB();
    const now = Date.now();

    // Get max order
    const existing = await db.table('trainingLessons')
      .where('moduleId').equals(data.moduleId)
      .toArray();
    const maxOrder = existing.reduce((max, l) => Math.max(max, l.order), 0);

    const lesson: DBLesson = {
      id: nanoid(),
      moduleId: data.moduleId,
      type: data.type,
      title: data.title,
      description: data.description,
      content: JSON.stringify(data.content),
      order: data.order ?? maxOrder + 1,
      estimatedMinutes: data.estimatedMinutes,
      requiredForCertification: data.requiredForCertification ? 1 : 0,
      passingScore: data.passingScore,
      created: now,
      updated: now,
    };

    await db.table('trainingLessons').add(lesson);
    logger.info(`Created lesson: ${lesson.id}`);
    return dbLessonToDomain(lesson);
  }

  async updateLesson(lessonId: string, data: UpdateLessonData): Promise<Lesson> {
    const db = this.getDB();
    const now = Date.now();

    const updateData = lessonToDB({
      ...data,
      updated: now,
    } as Lesson);

    await db.table('trainingLessons').update(lessonId, updateData);

    const lesson = await db.table('trainingLessons').get(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found after update');
    }

    logger.info(`Updated lesson: ${lessonId}`);
    return dbLessonToDomain(lesson);
  }

  async deleteLesson(lessonId: string): Promise<void> {
    const db = this.getDB();

    // Delete all related progress, attempts, submissions
    await db.table('trainingLessonProgress').where('lessonId').equals(lessonId).delete();
    await db.table('trainingQuizAttempts').where('lessonId').equals(lessonId).delete();
    await db.table('trainingAssignmentSubmissions').where('lessonId').equals(lessonId).delete();
    await db.table('trainingLiveSessionRSVPs').where('lessonId').equals(lessonId).delete();
    await db.table('trainingLiveSessionAttendance').where('lessonId').equals(lessonId).delete();
    await db.table('trainingLessons').delete(lessonId);

    logger.info(`Deleted lesson: ${lessonId}`);
  }

  async reorderLessons(moduleId: string, lessonIds: string[]): Promise<void> {
    const db = this.getDB();
    const now = Date.now();

    await db.transaction('rw', db.table('trainingLessons'), async () => {
      for (let i = 0; i < lessonIds.length; i++) {
        await db.table('trainingLessons').update(lessonIds[i], {
          order: i + 1,
          updated: now,
        });
      }
    });

    logger.info(`Reordered lessons for module: ${moduleId}`);
  }

  // =========================================================================
  // Progress Operations
  // =========================================================================

  async startLesson(lessonId: string): Promise<LessonProgress> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const existing = await db.table('trainingLessonProgress')
      .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
      .first();

    if (existing) {
      // Update existing progress
      await db.table('trainingLessonProgress').update(existing.id, {
        status: 'in-progress',
        updated: now,
      });
      return { ...existing, status: 'in-progress', updated: now };
    }

    const progress: DBLessonProgress = {
      id: nanoid(),
      lessonId,
      pubkey,
      status: 'in-progress',
      timeSpent: 0,
      created: now,
      updated: now,
    };

    await db.table('trainingLessonProgress').add(progress);

    // Ensure course progress exists
    await this.ensureCourseProgress(lessonId);

    logger.info(`Started lesson: ${lessonId} for ${pubkey}`);
    return progress;
  }

  async updateLessonProgress(lessonId: string, timeSpent: number, position?: number): Promise<LessonProgress> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const existing = await db.table('trainingLessonProgress')
      .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
      .first();

    if (!existing) {
      return this.startLesson(lessonId);
    }

    const updateData: Partial<DBLessonProgress> = {
      timeSpent: existing.timeSpent + timeSpent,
      updated: now,
    };
    if (position !== undefined) {
      updateData.lastPosition = position;
    }

    await db.table('trainingLessonProgress').update(existing.id, updateData);

    return {
      ...existing,
      ...updateData,
    };
  }

  async completeLesson(lessonId: string, score?: number): Promise<LessonProgress> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    let progress = await db.table('trainingLessonProgress')
      .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
      .first();

    if (!progress) {
      progress = await this.startLesson(lessonId);
    }

    const updateData: Partial<DBLessonProgress> = {
      status: 'completed',
      completedAt: now,
      updated: now,
    };
    if (score !== undefined) {
      updateData.score = score;
    }

    await db.table('trainingLessonProgress').update(progress.id, updateData);

    // Update course progress
    await this.updateCourseProgressFromLesson(lessonId);

    // Check for certification
    await this.checkAndAwardCertification(lessonId);

    logger.info(`Completed lesson: ${lessonId} for ${pubkey}`);
    return { ...progress, ...updateData };
  }

  private async ensureCourseProgress(lessonId: string): Promise<void> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    // Get course from lesson
    const lesson = await db.table('trainingLessons').get(lessonId);
    if (!lesson) return;

    const module = await db.table('trainingModules').get(lesson.moduleId);
    if (!module) return;

    const existing = await db.table('trainingCourseProgress')
      .where(['courseId', 'pubkey']).equals([module.courseId, pubkey])
      .first();

    if (existing) return;

    // Count total lessons
    const modules = await db.table('trainingModules')
      .where('courseId').equals(module.courseId)
      .toArray();
    let totalLessons = 0;
    for (const m of modules) {
      const lessons = await db.table('trainingLessons')
        .where('moduleId').equals(m.id)
        .count();
      totalLessons += lessons;
    }

    const progress: DBCourseProgress = {
      id: nanoid(),
      courseId: module.courseId,
      pubkey,
      percentComplete: 0,
      lessonsCompleted: 0,
      totalLessons,
      currentModuleId: module.id,
      currentLessonId: lessonId,
      startedAt: now,
      lastActivityAt: now,
    };

    await db.table('trainingCourseProgress').add(progress);
  }

  private async updateCourseProgressFromLesson(lessonId: string): Promise<void> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const lesson = await db.table('trainingLessons').get(lessonId);
    if (!lesson) return;

    const module = await db.table('trainingModules').get(lesson.moduleId);
    if (!module) return;

    const progress = await db.table('trainingCourseProgress')
      .where(['courseId', 'pubkey']).equals([module.courseId, pubkey])
      .first();

    if (!progress) return;

    // Count completed lessons
    const modules = await db.table('trainingModules')
      .where('courseId').equals(module.courseId)
      .toArray();

    let completedLessons = 0;
    let totalLessons = 0;

    for (const m of modules) {
      const lessons = await db.table('trainingLessons')
        .where('moduleId').equals(m.id)
        .toArray();
      totalLessons += lessons.length;

      for (const l of lessons) {
        const lp = await db.table('trainingLessonProgress')
          .where(['lessonId', 'pubkey']).equals([l.id, pubkey])
          .first();
        if (lp?.status === 'completed') {
          completedLessons++;
        }
      }
    }

    const percentComplete = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    const updateData: Partial<DBCourseProgress> = {
      lessonsCompleted: completedLessons,
      totalLessons,
      percentComplete,
      lastActivityAt: now,
    };

    if (percentComplete === 100) {
      updateData.completedAt = now;
    }

    await db.table('trainingCourseProgress').update(progress.id, updateData);
  }

  async getCourseProgress(courseId: string): Promise<CourseProgress | null> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    return await db.table('trainingCourseProgress')
      .where(['courseId', 'pubkey']).equals([courseId, pubkey])
      .first();
  }

  async getUserTrainingStatus(pubkey: string): Promise<UserTrainingStatus> {
    const db = this.getDB();

    const enrollments = await db.table('trainingCourseEnrollments')
      .where('pubkey').equals(pubkey)
      .toArray();

    const certifications = await db.table('trainingCertifications')
      .where('pubkey').equals(pubkey)
      .toArray();

    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const expiringSoon = certifications.filter(c =>
      c.expiresAt && c.expiresAt > now && c.expiresAt < now + thirtyDays && !c.revokedAt
    );

    const completedEnrollments = enrollments.filter(e => e.status === 'completed');

    // Calculate total time
    const progress = await db.table('trainingLessonProgress')
      .where('pubkey').equals(pubkey)
      .toArray();
    const totalTimeSpent = progress.reduce((sum, p) => sum + p.timeSpent, 0);

    const lastProgress = progress.sort((a, b) => b.updated - a.updated)[0];

    return {
      pubkey,
      coursesEnrolled: enrollments.filter(e => e.status === 'active').length,
      coursesCompleted: completedEnrollments.length,
      certificationsEarned: certifications.filter(c => !c.revokedAt).length,
      certificationsExpiring: expiringSoon.length,
      totalTimeSpent: Math.round(totalTimeSpent / 3600), // Convert to hours
      lastActivity: lastProgress?.updated,
    };
  }

  // =========================================================================
  // Quiz Operations
  // =========================================================================

  async startQuizAttempt(lessonId: string): Promise<QuizAttempt> {
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const attempt: QuizAttempt = {
      id: nanoid(),
      lessonId,
      pubkey,
      answers: [],
      score: 0,
      passed: false,
      startedAt: now,
      completedAt: 0,
      duration: 0,
    };

    return attempt;
  }

  async submitQuizAttempt(attemptId: string, answers: QuizAnswer[]): Promise<QuizAttempt> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    // Calculate score
    const totalPoints = answers.reduce((sum, a) => sum + a.points, 0);
    const earnedPoints = answers.filter(a => a.isCorrect).reduce((sum, a) => sum + a.points, 0);
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    // Get lesson to check passing score
    // Note: We'd need the lessonId from the attempt, but since this is a fresh submission,
    // we'll get it from the first answer's context or pass it explicitly
    const lessonId = answers[0]?.questionId?.split(':')[0]; // Assuming format
    let passingScore = 70; // Default

    if (lessonId) {
      const lesson = await db.table('trainingLessons').get(lessonId);
      if (lesson?.passingScore) {
        passingScore = lesson.passingScore;
      }
    }

    const passed = score >= passingScore;

    const attempt: DBQuizAttempt = {
      id: attemptId,
      lessonId: lessonId || '',
      pubkey,
      answers: JSON.stringify(answers),
      score,
      passed: passed ? 1 : 0,
      startedAt: now - 1000, // Placeholder
      completedAt: now,
      duration: 0,
    };

    await db.table('trainingQuizAttempts').add(attempt);

    if (passed && lessonId) {
      await this.completeLesson(lessonId, score);
    }

    logger.info(`Submitted quiz attempt: ${attemptId}, score: ${score}, passed: ${passed}`);

    return {
      ...attempt,
      answers,
      passed,
    };
  }

  async getQuizAttempts(lessonId: string): Promise<QuizAttempt[]> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();

    const attempts = await db.table('trainingQuizAttempts')
      .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
      .toArray();

    return attempts.map(a => ({
      ...a,
      answers: JSON.parse(a.answers),
      passed: Boolean(a.passed),
    }));
  }

  // =========================================================================
  // Assignment Operations
  // =========================================================================

  async submitAssignment(
    lessonId: string,
    fileUrl: string,
    fileName: string,
    fileSize: number
  ): Promise<AssignmentSubmission> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const submission: DBAssignmentSubmission = {
      id: nanoid(),
      lessonId,
      pubkey,
      fileUrl,
      fileName,
      fileSize,
      submittedAt: now,
      reviewStatus: 'pending',
    };

    await db.table('trainingAssignmentSubmissions').add(submission);

    logger.info(`Submitted assignment: ${submission.id} for lesson ${lessonId}`);
    return submission;
  }

  async reviewAssignment(
    submissionId: string,
    status: AssignmentSubmission['reviewStatus'],
    feedback?: string,
    score?: number
  ): Promise<AssignmentSubmission> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    await db.table('trainingAssignmentSubmissions').update(submissionId, {
      reviewStatus: status,
      reviewedBy: pubkey,
      reviewedAt: now,
      feedback,
      score,
    });

    const submission = await db.table('trainingAssignmentSubmissions').get(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    // If approved, complete the lesson
    if (status === 'approved') {
      await this.completeLesson(submission.lessonId, score);
    }

    logger.info(`Reviewed assignment: ${submissionId}, status: ${status}`);
    return submission;
  }

  // =========================================================================
  // Live Session Operations
  // =========================================================================

  async rsvpLiveSession(lessonId: string, status: LiveSessionRSVP['status']): Promise<void> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const existing = await db.table('trainingLiveSessionRSVPs')
      .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
      .first();

    if (existing) {
      await db.table('trainingLiveSessionRSVPs').update(existing.id, {
        status,
        updatedAt: now,
      });
    } else {
      const rsvp: DBLiveSessionRSVP = {
        id: nanoid(),
        lessonId,
        pubkey,
        status,
        createdAt: now,
        updatedAt: now,
      };
      await db.table('trainingLiveSessionRSVPs').add(rsvp);
    }

    logger.info(`RSVP for live session: ${lessonId}, status: ${status}`);
  }

  async recordLiveAttendance(lessonId: string, joinedAt: number, leftAt?: number): Promise<void> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();

    const existing = await db.table('trainingLiveSessionAttendance')
      .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
      .first();

    const duration = leftAt ? leftAt - joinedAt : Date.now() - joinedAt;

    if (existing) {
      await db.table('trainingLiveSessionAttendance').update(existing.id, {
        leftAt,
        duration: existing.duration + duration,
        wasCompleteSession: duration > 30 * 60 * 1000 ? 1 : 0, // 30 min threshold
      });
    } else {
      const attendance: DBLiveSessionAttendance = {
        id: nanoid(),
        lessonId,
        pubkey,
        joinedAt,
        leftAt,
        duration,
        wasCompleteSession: 0,
      };
      await db.table('trainingLiveSessionAttendance').add(attendance);
    }

    logger.info(`Recorded live attendance: ${lessonId}`);
  }

  // =========================================================================
  // Certification Operations
  // =========================================================================

  async listCertifications(pubkey?: string): Promise<Certification[]> {
    const db = this.getDB();
    const targetPubkey = pubkey || this.getCurrentPubkey();

    const certs = await db.table('trainingCertifications')
      .where('pubkey').equals(targetPubkey)
      .toArray();

    return certs.map(c => ({
      ...c,
      metadata: c.metadata ? JSON.parse(c.metadata) : undefined,
    }));
  }

  async getCertification(courseId: string, pubkey: string): Promise<Certification | null> {
    const db = this.getDB();

    const cert = await db.table('trainingCertifications')
      .where(['courseId', 'pubkey']).equals([courseId, pubkey])
      .first();

    if (!cert) return null;

    return {
      ...cert,
      metadata: cert.metadata ? JSON.parse(cert.metadata) : undefined,
    };
  }

  async verifyCertification(verificationCode: string): Promise<CertificationVerification> {
    const db = this.getDB();

    const cert = await db.table('trainingCertifications')
      .where('verificationCode').equals(verificationCode)
      .first();

    if (!cert) {
      return { valid: false, error: 'Certification not found' };
    }

    if (cert.revokedAt) {
      return { valid: false, revoked: true, certification: cert };
    }

    if (cert.expiresAt && cert.expiresAt < Date.now()) {
      return { valid: false, expired: true, certification: cert };
    }

    const course = await db.table('trainingCourses').get(cert.courseId);

    return {
      valid: true,
      certification: {
        ...cert,
        metadata: cert.metadata ? JSON.parse(cert.metadata) : undefined,
      },
      course: course ? dbCourseToDomain(course) : undefined,
    };
  }

  async revokeCertification(certificationId: string, reason: string): Promise<void> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    await db.table('trainingCertifications').update(certificationId, {
      revokedAt: now,
      revokedBy: pubkey,
      revokeReason: reason,
    });

    logger.info(`Revoked certification: ${certificationId}`);
  }

  private async checkAndAwardCertification(lessonId: string): Promise<void> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();

    const lesson = await db.table('trainingLessons').get(lessonId);
    if (!lesson) return;

    const module = await db.table('trainingModules').get(lesson.moduleId);
    if (!module) return;

    const course = await db.table('trainingCourses').get(module.courseId);
    if (!course || !course.certificationEnabled) return;

    // Check if already certified
    const existing = await db.table('trainingCertifications')
      .where(['courseId', 'pubkey']).equals([course.id, pubkey])
      .first();

    if (existing && !existing.revokedAt) return;

    // Check all required lessons are completed
    const modules = await db.table('trainingModules')
      .where('courseId').equals(course.id)
      .toArray();

    for (const m of modules) {
      const lessons = await db.table('trainingLessons')
        .where('moduleId').equals(m.id)
        .filter(l => l.requiredForCertification === 1)
        .toArray();

      for (const l of lessons) {
        const progress = await db.table('trainingLessonProgress')
          .where(['lessonId', 'pubkey']).equals([l.id, pubkey])
          .first();

        if (!progress || progress.status !== 'completed') {
          return; // Not all required lessons completed
        }

        // Check passing score for quizzes
        if (l.passingScore && progress.score !== undefined && progress.score < l.passingScore) {
          return;
        }
      }
    }

    // Award certification
    const now = Date.now();
    const cert: DBCertification = {
      id: nanoid(),
      courseId: course.id,
      pubkey,
      earnedAt: now,
      expiresAt: course.certificationExpiryDays
        ? now + course.certificationExpiryDays * 24 * 60 * 60 * 1000
        : undefined,
      verificationCode: nanoid(16).toUpperCase(),
    };

    await db.table('trainingCertifications').add(cert);
    logger.info(`Awarded certification: ${cert.id} for course ${course.id}`);
  }

  // =========================================================================
  // Stats Operations
  // =========================================================================

  async getCourseStats(courseId: string): Promise<CourseStats> {
    const db = this.getDB();

    const enrollments = await db.table('trainingCourseEnrollments')
      .where('courseId').equals(courseId)
      .toArray();

    const progress = await db.table('trainingCourseProgress')
      .where('courseId').equals(courseId)
      .toArray();

    const certifications = await db.table('trainingCertifications')
      .where('courseId').equals(courseId)
      .toArray();

    const completedProgress = progress.filter(p => p.completedAt);
    const avgProgress = progress.length > 0
      ? progress.reduce((sum, p) => sum + p.percentComplete, 0) / progress.length
      : 0;

    // Get all quiz attempts for course
    const modules = await db.table('trainingModules')
      .where('courseId').equals(courseId)
      .toArray();

    let totalQuizScore = 0;
    let quizCount = 0;

    for (const m of modules) {
      const lessons = await db.table('trainingLessons')
        .where('moduleId').equals(m.id)
        .filter(l => l.type === 'quiz')
        .toArray();

      for (const l of lessons) {
        const attempts = await db.table('trainingQuizAttempts')
          .where('lessonId').equals(l.id)
          .toArray();

        for (const a of attempts) {
          totalQuizScore += a.score;
          quizCount++;
        }
      }
    }

    // Calculate average completion time
    const completionTimes = completedProgress
      .filter(p => p.startedAt && p.completedAt)
      .map(p => (p.completedAt! - p.startedAt) / (1000 * 60 * 60)); // hours

    const avgCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

    return {
      courseId,
      enrolledCount: enrollments.filter(e => e.status === 'active').length,
      completedCount: completedProgress.length,
      averageProgress: Math.round(avgProgress),
      averageCompletionTime: Math.round(avgCompletionTime * 10) / 10,
      certificationCount: certifications.filter(c => !c.revokedAt).length,
      averageQuizScore: quizCount > 0 ? Math.round(totalQuizScore / quizCount) : 0,
    };
  }

  // =========================================================================
  // Enrollment Operations
  // =========================================================================

  async enrollInCourse(courseId: string): Promise<void> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const existing = await db.table('trainingCourseEnrollments')
      .where(['courseId', 'pubkey']).equals([courseId, pubkey])
      .first();

    if (existing) {
      if (existing.status === 'dropped' || existing.status === 'paused') {
        await db.table('trainingCourseEnrollments').update(existing.id, {
          status: 'active',
        });
      }
      return;
    }

    const enrollment: DBCourseEnrollment = {
      id: nanoid(),
      courseId,
      pubkey,
      enrolledAt: now,
      status: 'active',
    };

    await db.table('trainingCourseEnrollments').add(enrollment);
    logger.info(`Enrolled in course: ${courseId}`);
  }

  async unenrollFromCourse(courseId: string): Promise<void> {
    const db = this.getDB();
    const pubkey = this.getCurrentPubkey();

    const enrollment = await db.table('trainingCourseEnrollments')
      .where(['courseId', 'pubkey']).equals([courseId, pubkey])
      .first();

    if (enrollment) {
      await db.table('trainingCourseEnrollments').update(enrollment.id, {
        status: 'dropped',
      });
    }

    logger.info(`Unenrolled from course: ${courseId}`);
  }

  /**
   * Clean up resources
   */
  close(): void {
    this.db = null;
    this.initialized = false;
    logger.info('📚 Training manager closed');
  }
}

// Singleton instance
let managerInstance: TrainingManager | null = null;

/**
 * Get the training manager instance
 */
export function getTrainingManager(): TrainingManager {
  if (!managerInstance) {
    managerInstance = new TrainingManager();
  }
  return managerInstance;
}

/**
 * Close the training manager
 */
export function closeTrainingManager(): void {
  if (managerInstance) {
    managerInstance.close();
    managerInstance = null;
  }
}
