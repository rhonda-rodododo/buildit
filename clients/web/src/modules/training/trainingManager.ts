/**
 * Training Module Manager
 * Business logic and database operations for training system
 */

import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';
import { dal } from '@/core/storage/dal';
import { useAuthStore } from '@/stores/authStore';
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
  const { prerequisites, certificationEnabled, isPublic, isDefault, ...rest } = course;
  const result: Partial<DBCourse> = { ...rest };
  if (prerequisites) {
    result.prerequisites = JSON.stringify(prerequisites);
  }
  if (certificationEnabled !== undefined) {
    result.certificationEnabled = certificationEnabled ? 1 : 0;
  }
  if (isPublic !== undefined) {
    result.isPublic = isPublic ? 1 : 0;
  }
  if (isDefault !== undefined) {
    result.isDefault = isDefault ? 1 : 0;
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
  const { content, requiredForCertification, ...rest } = lesson;
  const result: Partial<DBLesson> = { ...rest };
  if (content) {
    result.content = JSON.stringify(content);
  }
  if (requiredForCertification !== undefined) {
    result.requiredForCertification = requiredForCertification ? 1 : 0;
  }
  return result;
}

/**
 * Training Manager Class
 */
class TrainingManager {
  private initialized = false;

  /**
   * Initialize the manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.initialized = true;
      logger.info('📚 Training manager initialized');
    } catch (error) {
      logger.error('Failed to initialize training manager', error);
      throw error;
    }
  }

  private getCurrentPubkey(): string {
    const identity = useAuthStore.getState().currentIdentity;
    if (!identity) {
      throw new Error('No identity selected');
    }
    return identity.publicKey;
  }

  // =========================================================================
  // Course Operations
  // =========================================================================

  async listCourses(options?: CourseQueryOptions): Promise<Course[]> {
    let courses = await dal.getAll<DBCourse>('trainingCourses');

    if (options?.groupId) {
      courses = courses.filter(c => c.groupId === options.groupId || (options.includePublic && c.isPublic));
    }
    if (options?.category) {
      courses = courses.filter(c => c.category === options.category);
    }
    if (options?.difficulty) {
      courses = courses.filter(c => c.difficulty === options.difficulty);
    }
    if (options?.status) {
      courses = courses.filter(c => c.status === options.status);
    }
    if (options?.search) {
      const search = options.search.toLowerCase();
      courses = courses.filter(c =>
        c.title.toLowerCase().includes(search) ||
        c.description.toLowerCase().includes(search)
      );
    }

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
    const course = await dal.get<DBCourse>('trainingCourses', courseId);
    return course ? dbCourseToDomain(course) : null;
  }

  async createCourse(data: CreateCourseData): Promise<Course> {
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

    await dal.add<DBCourse>('trainingCourses', course);
    logger.info(`Created course: ${course.id}`);
    return dbCourseToDomain(course);
  }

  async updateCourse(courseId: string, data: UpdateCourseData): Promise<Course> {
    const now = Date.now();

    const updateData = courseToDB({
      ...data,
      updated: now,
    } as Course);

    await dal.update<DBCourse>('trainingCourses', courseId, updateData);

    const course = await dal.get<DBCourse>('trainingCourses', courseId);
    if (!course) {
      throw new Error('Course not found after update');
    }

    logger.info(`Updated course: ${courseId}`);
    return dbCourseToDomain(course);
  }

  async deleteCourse(courseId: string): Promise<void> {
    // Delete all related data
    const modules = await dal.query<DBTrainingModule>('trainingModules', {
      whereClause: { courseId },
    });

    for (const module of modules) {
      await this.deleteModule(module.id);
    }

    await dal.queryCustom({
      sql: 'DELETE FROM training_course_progress WHERE course_id = ?1',
      params: [courseId],
      dexieFallback: async (db) => {
        await db.table('trainingCourseProgress').where('courseId').equals(courseId).delete();
      },
    });
    await dal.queryCustom({
      sql: 'DELETE FROM training_certifications WHERE course_id = ?1',
      params: [courseId],
      dexieFallback: async (db) => {
        await db.table('trainingCertifications').where('courseId').equals(courseId).delete();
      },
    });
    await dal.queryCustom({
      sql: 'DELETE FROM training_course_enrollments WHERE course_id = ?1',
      params: [courseId],
      dexieFallback: async (db) => {
        await db.table('trainingCourseEnrollments').where('courseId').equals(courseId).delete();
      },
    });
    await dal.delete('trainingCourses', courseId);

    logger.info(`Deleted course: ${courseId}`);
  }

  // =========================================================================
  // Module Operations
  // =========================================================================

  async listModules(courseId: string): Promise<TrainingModule[]> {
    const modules = await dal.query<DBTrainingModule>('trainingModules', {
      whereClause: { courseId },
      orderBy: 'order',
    });
    return modules;
  }

  async getModule(moduleId: string): Promise<TrainingModule | null> {
    return await dal.get<DBTrainingModule>('trainingModules', moduleId) ?? null;
  }

  async createModule(data: CreateModuleData): Promise<TrainingModule> {
    const now = Date.now();

    // Get max order
    const existing = await dal.query<DBTrainingModule>('trainingModules', {
      whereClause: { courseId: data.courseId },
    });
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

    await dal.add<DBTrainingModule>('trainingModules', module);
    logger.info(`Created module: ${module.id}`);
    return module;
  }

  async updateModule(moduleId: string, data: UpdateModuleData): Promise<TrainingModule> {
    const now = Date.now();

    await dal.update<DBTrainingModule>('trainingModules', moduleId, {
      ...data,
      updated: now,
    });

    const module = await dal.get<DBTrainingModule>('trainingModules', moduleId);
    if (!module) {
      throw new Error('Module not found after update');
    }

    logger.info(`Updated module: ${moduleId}`);
    return module;
  }

  async deleteModule(moduleId: string): Promise<void> {
    // Delete all lessons in module
    const lessons = await dal.query<DBLesson>('trainingLessons', {
      whereClause: { moduleId },
    });

    for (const lesson of lessons) {
      await this.deleteLesson(lesson.id);
    }

    await dal.delete('trainingModules', moduleId);
    logger.info(`Deleted module: ${moduleId}`);
  }

  async reorderModules(courseId: string, moduleIds: string[]): Promise<void> {
    const now = Date.now();

    for (let i = 0; i < moduleIds.length; i++) {
      await dal.update<DBTrainingModule>('trainingModules', moduleIds[i], {
        order: i + 1,
        updated: now,
      });
    }

    logger.info(`Reordered modules for course: ${courseId}`);
  }

  // =========================================================================
  // Lesson Operations
  // =========================================================================

  async listLessons(moduleId: string): Promise<Lesson[]> {
    const lessons = await dal.query<DBLesson>('trainingLessons', {
      whereClause: { moduleId },
      orderBy: 'order',
    });
    return lessons.map(dbLessonToDomain);
  }

  async getLesson(lessonId: string): Promise<Lesson | null> {
    const lesson = await dal.get<DBLesson>('trainingLessons', lessonId);
    return lesson ? dbLessonToDomain(lesson) : null;
  }

  async createLesson(data: CreateLessonData): Promise<Lesson> {
    const now = Date.now();

    // Get max order
    const existing = await dal.query<DBLesson>('trainingLessons', {
      whereClause: { moduleId: data.moduleId },
    });
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

    await dal.add<DBLesson>('trainingLessons', lesson);
    logger.info(`Created lesson: ${lesson.id}`);
    return dbLessonToDomain(lesson);
  }

  async updateLesson(lessonId: string, data: UpdateLessonData): Promise<Lesson> {
    const now = Date.now();

    const updateData = lessonToDB({
      ...data,
      updated: now,
    } as Lesson);

    await dal.update<DBLesson>('trainingLessons', lessonId, updateData);

    const lesson = await dal.get<DBLesson>('trainingLessons', lessonId);
    if (!lesson) {
      throw new Error('Lesson not found after update');
    }

    logger.info(`Updated lesson: ${lessonId}`);
    return dbLessonToDomain(lesson);
  }

  async deleteLesson(lessonId: string): Promise<void> {
    // Delete all related progress, attempts, submissions
    await dal.queryCustom({
      sql: 'DELETE FROM training_lesson_progress WHERE lesson_id = ?1',
      params: [lessonId],
      dexieFallback: async (db) => {
        await db.table('trainingLessonProgress').where('lessonId').equals(lessonId).delete();
      },
    });
    await dal.queryCustom({
      sql: 'DELETE FROM training_quiz_attempts WHERE lesson_id = ?1',
      params: [lessonId],
      dexieFallback: async (db) => {
        await db.table('trainingQuizAttempts').where('lessonId').equals(lessonId).delete();
      },
    });
    await dal.queryCustom({
      sql: 'DELETE FROM training_assignment_submissions WHERE lesson_id = ?1',
      params: [lessonId],
      dexieFallback: async (db) => {
        await db.table('trainingAssignmentSubmissions').where('lessonId').equals(lessonId).delete();
      },
    });
    await dal.queryCustom({
      sql: 'DELETE FROM training_live_session_rsvps WHERE lesson_id = ?1',
      params: [lessonId],
      dexieFallback: async (db) => {
        await db.table('trainingLiveSessionRSVPs').where('lessonId').equals(lessonId).delete();
      },
    });
    await dal.queryCustom({
      sql: 'DELETE FROM training_live_session_attendance WHERE lesson_id = ?1',
      params: [lessonId],
      dexieFallback: async (db) => {
        await db.table('trainingLiveSessionAttendance').where('lessonId').equals(lessonId).delete();
      },
    });
    await dal.delete('trainingLessons', lessonId);

    logger.info(`Deleted lesson: ${lessonId}`);
  }

  async reorderLessons(moduleId: string, lessonIds: string[]): Promise<void> {
    const now = Date.now();

    for (let i = 0; i < lessonIds.length; i++) {
      await dal.update<DBLesson>('trainingLessons', lessonIds[i], {
        order: i + 1,
        updated: now,
      });
    }

    logger.info(`Reordered lessons for module: ${moduleId}`);
  }

  // =========================================================================
  // Progress Operations
  // =========================================================================

  async startLesson(lessonId: string): Promise<LessonProgress> {
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const existingResults = await dal.queryCustom<DBLessonProgress>({
      sql: 'SELECT * FROM training_lesson_progress WHERE lesson_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [lessonId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingLessonProgress')
          .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
          .first()
          .then((r: DBLessonProgress | undefined) => r ? [r] : []);
      },
    });
    const existing = existingResults[0];

    if (existing) {
      // Update existing progress
      await dal.update<DBLessonProgress>('trainingLessonProgress', existing.id, {
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

    await dal.add<DBLessonProgress>('trainingLessonProgress', progress);

    // Ensure course progress exists
    await this.ensureCourseProgress(lessonId);

    logger.info(`Started lesson: ${lessonId} for ${pubkey}`);
    return progress;
  }

  async updateLessonProgress(lessonId: string, timeSpent: number, position?: number): Promise<LessonProgress> {
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const existingResults = await dal.queryCustom<DBLessonProgress>({
      sql: 'SELECT * FROM training_lesson_progress WHERE lesson_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [lessonId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingLessonProgress')
          .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
          .first()
          .then((r: DBLessonProgress | undefined) => r ? [r] : []);
      },
    });
    const existing = existingResults[0];

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

    await dal.update<DBLessonProgress>('trainingLessonProgress', existing.id, updateData);

    return {
      ...existing,
      ...updateData,
    };
  }

  async completeLesson(lessonId: string, score?: number): Promise<LessonProgress> {
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const progressResults = await dal.queryCustom<DBLessonProgress>({
      sql: 'SELECT * FROM training_lesson_progress WHERE lesson_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [lessonId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingLessonProgress')
          .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
          .first()
          .then((r: DBLessonProgress | undefined) => r ? [r] : []);
      },
    });
    let progress = progressResults[0];

    if (!progress) {
      progress = await this.startLesson(lessonId) as DBLessonProgress;
    }

    const updateData: Partial<DBLessonProgress> = {
      status: 'completed',
      completedAt: now,
      updated: now,
    };
    if (score !== undefined) {
      updateData.score = score;
    }

    await dal.update<DBLessonProgress>('trainingLessonProgress', progress.id, updateData);

    // Update course progress
    await this.updateCourseProgressFromLesson(lessonId);

    // Check for certification
    await this.checkAndAwardCertification(lessonId);

    logger.info(`Completed lesson: ${lessonId} for ${pubkey}`);
    return { ...progress, ...updateData };
  }

  private async ensureCourseProgress(lessonId: string): Promise<void> {
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    // Get course from lesson
    const lesson = await dal.get<DBLesson>('trainingLessons', lessonId);
    if (!lesson) return;

    const module = await dal.get<DBTrainingModule>('trainingModules', lesson.moduleId);
    if (!module) return;

    const existingResults = await dal.queryCustom<DBCourseProgress>({
      sql: 'SELECT * FROM training_course_progress WHERE course_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [module.courseId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingCourseProgress')
          .where(['courseId', 'pubkey']).equals([module.courseId, pubkey])
          .first()
          .then((r: DBCourseProgress | undefined) => r ? [r] : []);
      },
    });

    if (existingResults[0]) return;

    // Count total lessons
    const modules = await dal.query<DBTrainingModule>('trainingModules', {
      whereClause: { courseId: module.courseId },
    });
    let totalLessons = 0;
    for (const m of modules) {
      const lessonCount = await dal.queryCustom<{ cnt: number }>({
        sql: 'SELECT COUNT(*) as cnt FROM training_lessons WHERE module_id = ?1',
        params: [m.id],
        dexieFallback: async (db) => {
          const count = await db.table('trainingLessons')
            .where('moduleId').equals(m.id)
            .count();
          return [{ cnt: count }];
        },
      });
      totalLessons += lessonCount[0]?.cnt ?? 0;
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

    await dal.add<DBCourseProgress>('trainingCourseProgress', progress);
  }

  private async updateCourseProgressFromLesson(lessonId: string): Promise<void> {
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const lesson = await dal.get<DBLesson>('trainingLessons', lessonId);
    if (!lesson) return;

    const module = await dal.get<DBTrainingModule>('trainingModules', lesson.moduleId);
    if (!module) return;

    const progressResults = await dal.queryCustom<DBCourseProgress>({
      sql: 'SELECT * FROM training_course_progress WHERE course_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [module.courseId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingCourseProgress')
          .where(['courseId', 'pubkey']).equals([module.courseId, pubkey])
          .first()
          .then((r: DBCourseProgress | undefined) => r ? [r] : []);
      },
    });
    const progress = progressResults[0];

    if (!progress) return;

    // Count completed lessons
    const modules = await dal.query<DBTrainingModule>('trainingModules', {
      whereClause: { courseId: module.courseId },
    });

    let completedLessons = 0;
    let totalLessons = 0;

    for (const m of modules) {
      const lessons = await dal.query<DBLesson>('trainingLessons', {
        whereClause: { moduleId: m.id },
      });
      totalLessons += lessons.length;

      for (const l of lessons) {
        const lpResults = await dal.queryCustom<DBLessonProgress>({
          sql: 'SELECT * FROM training_lesson_progress WHERE lesson_id = ?1 AND pubkey = ?2 LIMIT 1',
          params: [l.id, pubkey],
          dexieFallback: async (db) => {
            return db.table('trainingLessonProgress')
              .where(['lessonId', 'pubkey']).equals([l.id, pubkey])
              .first()
              .then((r: DBLessonProgress | undefined) => r ? [r] : []);
          },
        });
        if (lpResults[0]?.status === 'completed') {
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

    await dal.update<DBCourseProgress>('trainingCourseProgress', progress.id, updateData);
  }

  async getCourseProgress(courseId: string): Promise<CourseProgress | null> {
    const pubkey = this.getCurrentPubkey();
    const results = await dal.queryCustom<DBCourseProgress>({
      sql: 'SELECT * FROM training_course_progress WHERE course_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [courseId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingCourseProgress')
          .where(['courseId', 'pubkey']).equals([courseId, pubkey])
          .first()
          .then((r: DBCourseProgress | undefined) => r ? [r] : []);
      },
    });
    return results[0] ?? null;
  }

  async getUserTrainingStatus(pubkey: string): Promise<UserTrainingStatus> {
    const enrollments = await dal.query<DBCourseEnrollment>('trainingCourseEnrollments', {
      whereClause: { pubkey },
    });

    const certifications = await dal.query<DBCertification>('trainingCertifications', {
      whereClause: { pubkey },
    });

    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const expiringSoon = certifications.filter(c =>
      c.expiresAt && c.expiresAt > now && c.expiresAt < now + thirtyDays && !c.revokedAt
    );

    const completedEnrollments = enrollments.filter(e => e.status === 'completed');

    // Calculate total time
    const progress = await dal.query<DBLessonProgress>('trainingLessonProgress', {
      whereClause: { pubkey },
    });
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
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    // Calculate score
    const totalPoints = answers.reduce((sum, a) => sum + a.points, 0);
    const earnedPoints = answers.filter(a => a.isCorrect).reduce((sum, a) => sum + a.points, 0);
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    // Get lesson to check passing score
    const lessonId = answers[0]?.questionId?.split(':')[0]; // Assuming format
    let passingScore = 70; // Default

    if (lessonId) {
      const lesson = await dal.get<DBLesson>('trainingLessons', lessonId);
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

    await dal.add<DBQuizAttempt>('trainingQuizAttempts', attempt);

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
    const pubkey = this.getCurrentPubkey();

    const attempts = await dal.queryCustom<DBQuizAttempt>({
      sql: 'SELECT * FROM training_quiz_attempts WHERE lesson_id = ?1 AND pubkey = ?2',
      params: [lessonId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingQuizAttempts')
          .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
          .toArray();
      },
    });

    return attempts.map(a => ({
      ...a,
      answers: JSON.parse(a.answers as unknown as string),
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

    await dal.add<DBAssignmentSubmission>('trainingAssignmentSubmissions', submission);

    logger.info(`Submitted assignment: ${submission.id} for lesson ${lessonId}`);
    return {
      ...submission,
      rubricScores: submission.rubricScores ? JSON.parse(submission.rubricScores) : undefined,
    };
  }

  async reviewAssignment(
    submissionId: string,
    status: AssignmentSubmission['reviewStatus'],
    feedback?: string,
    score?: number
  ): Promise<AssignmentSubmission> {
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    await dal.update<DBAssignmentSubmission>('trainingAssignmentSubmissions', submissionId, {
      reviewStatus: status,
      reviewedBy: pubkey,
      reviewedAt: now,
      feedback,
      score,
    });

    const submission = await dal.get<DBAssignmentSubmission>('trainingAssignmentSubmissions', submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    // If approved, complete the lesson
    if (status === 'approved') {
      await this.completeLesson(submission.lessonId, score);
    }

    logger.info(`Reviewed assignment: ${submissionId}, status: ${status}`);
    return {
      ...submission,
      rubricScores: submission.rubricScores ? JSON.parse(submission.rubricScores) : undefined,
    };
  }

  // =========================================================================
  // Live Session Operations
  // =========================================================================

  async rsvpLiveSession(lessonId: string, status: LiveSessionRSVP['status']): Promise<void> {
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const existingResults = await dal.queryCustom<DBLiveSessionRSVP>({
      sql: 'SELECT * FROM training_live_session_rsvps WHERE lesson_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [lessonId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingLiveSessionRSVPs')
          .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
          .first()
          .then((r: DBLiveSessionRSVP | undefined) => r ? [r] : []);
      },
    });
    const existing = existingResults[0];

    if (existing) {
      await dal.update<DBLiveSessionRSVP>('trainingLiveSessionRSVPs', existing.id, {
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
      await dal.add<DBLiveSessionRSVP>('trainingLiveSessionRSVPs', rsvp);
    }

    logger.info(`RSVP for live session: ${lessonId}, status: ${status}`);
  }

  async recordLiveAttendance(lessonId: string, joinedAt: number, leftAt?: number): Promise<void> {
    const pubkey = this.getCurrentPubkey();

    const existingResults = await dal.queryCustom<DBLiveSessionAttendance>({
      sql: 'SELECT * FROM training_live_session_attendance WHERE lesson_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [lessonId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingLiveSessionAttendance')
          .where(['lessonId', 'pubkey']).equals([lessonId, pubkey])
          .first()
          .then((r: DBLiveSessionAttendance | undefined) => r ? [r] : []);
      },
    });
    const existing = existingResults[0];

    const duration = leftAt ? leftAt - joinedAt : Date.now() - joinedAt;

    if (existing) {
      await dal.update<DBLiveSessionAttendance>('trainingLiveSessionAttendance', existing.id, {
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
      await dal.add<DBLiveSessionAttendance>('trainingLiveSessionAttendance', attendance);
    }

    logger.info(`Recorded live attendance: ${lessonId}`);
  }

  // =========================================================================
  // Certification Operations
  // =========================================================================

  async listCertifications(pubkey?: string): Promise<Certification[]> {
    const targetPubkey = pubkey || this.getCurrentPubkey();

    const certs = await dal.query<DBCertification>('trainingCertifications', {
      whereClause: { pubkey: targetPubkey },
    });

    return certs.map(c => ({
      ...c,
      metadata: c.metadata ? JSON.parse(c.metadata) : undefined,
    }));
  }

  async getCertification(courseId: string, pubkey: string): Promise<Certification | null> {
    const results = await dal.queryCustom<DBCertification>({
      sql: 'SELECT * FROM training_certifications WHERE course_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [courseId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingCertifications')
          .where(['courseId', 'pubkey']).equals([courseId, pubkey])
          .first()
          .then((r: DBCertification | undefined) => r ? [r] : []);
      },
    });
    const cert = results[0];

    if (!cert) return null;

    return {
      ...cert,
      metadata: cert.metadata ? JSON.parse(cert.metadata) : undefined,
    };
  }

  async verifyCertification(verificationCode: string): Promise<CertificationVerification> {
    const results = await dal.query<DBCertification>('trainingCertifications', {
      whereClause: { verificationCode },
      limit: 1,
    });
    const cert = results[0];

    if (!cert) {
      return { valid: false, error: 'Certification not found' };
    }

    const domainCert: Certification = {
      ...cert,
      metadata: cert.metadata ? JSON.parse(cert.metadata) as Record<string, unknown> : undefined,
    };

    if (cert.revokedAt) {
      return { valid: false, revoked: true, certification: domainCert };
    }

    if (cert.expiresAt && cert.expiresAt < Date.now()) {
      return { valid: false, expired: true, certification: domainCert };
    }

    const course = await dal.get<DBCourse>('trainingCourses', cert.courseId);

    return {
      valid: true,
      certification: domainCert,
      course: course ? dbCourseToDomain(course) : undefined,
    };
  }

  async revokeCertification(certificationId: string, reason: string): Promise<void> {
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    await dal.update<DBCertification>('trainingCertifications', certificationId, {
      revokedAt: now,
      revokedBy: pubkey,
      revokeReason: reason,
    });

    logger.info(`Revoked certification: ${certificationId}`);
  }

  private async checkAndAwardCertification(lessonId: string): Promise<void> {
    const pubkey = this.getCurrentPubkey();

    const lesson = await dal.get<DBLesson>('trainingLessons', lessonId);
    if (!lesson) return;

    const module = await dal.get<DBTrainingModule>('trainingModules', lesson.moduleId);
    if (!module) return;

    const course = await dal.get<DBCourse>('trainingCourses', module.courseId);
    if (!course || !course.certificationEnabled) return;

    // Check if already certified
    const existingResults = await dal.queryCustom<DBCertification>({
      sql: 'SELECT * FROM training_certifications WHERE course_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [course.id, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingCertifications')
          .where(['courseId', 'pubkey']).equals([course.id, pubkey])
          .first()
          .then((r: DBCertification | undefined) => r ? [r] : []);
      },
    });

    if (existingResults[0] && !existingResults[0].revokedAt) return;

    // Check all required lessons are completed
    const modules = await dal.query<DBTrainingModule>('trainingModules', {
      whereClause: { courseId: course.id },
    });

    for (const m of modules) {
      const lessons = await dal.query<DBLesson>('trainingLessons', {
        whereClause: { moduleId: m.id },
      });
      const requiredLessons = lessons.filter(l => l.requiredForCertification === 1);

      for (const l of requiredLessons) {
        const progressResults = await dal.queryCustom<DBLessonProgress>({
          sql: 'SELECT * FROM training_lesson_progress WHERE lesson_id = ?1 AND pubkey = ?2 LIMIT 1',
          params: [l.id, pubkey],
          dexieFallback: async (db) => {
            return db.table('trainingLessonProgress')
              .where(['lessonId', 'pubkey']).equals([l.id, pubkey])
              .first()
              .then((r: DBLessonProgress | undefined) => r ? [r] : []);
          },
        });
        const lprogress = progressResults[0];

        if (!lprogress || lprogress.status !== 'completed') {
          return; // Not all required lessons completed
        }

        // Check passing score for quizzes
        if (l.passingScore && lprogress.score !== undefined && lprogress.score < l.passingScore) {
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

    await dal.add<DBCertification>('trainingCertifications', cert);
    logger.info(`Awarded certification: ${cert.id} for course ${course.id}`);
  }

  // =========================================================================
  // Stats Operations
  // =========================================================================

  async getCourseStats(courseId: string): Promise<CourseStats> {
    const enrollments = await dal.query<DBCourseEnrollment>('trainingCourseEnrollments', {
      whereClause: { courseId },
    });

    const progress = await dal.query<DBCourseProgress>('trainingCourseProgress', {
      whereClause: { courseId },
    });

    const certifications = await dal.query<DBCertification>('trainingCertifications', {
      whereClause: { courseId },
    });

    const completedProgress = progress.filter(p => p.completedAt);
    const avgProgress = progress.length > 0
      ? progress.reduce((sum, p) => sum + p.percentComplete, 0) / progress.length
      : 0;

    // Get all quiz attempts for course
    const modules = await dal.query<DBTrainingModule>('trainingModules', {
      whereClause: { courseId },
    });

    let totalQuizScore = 0;
    let quizCount = 0;

    for (const m of modules) {
      const lessons = await dal.query<DBLesson>('trainingLessons', {
        whereClause: { moduleId: m.id },
      });
      const quizLessons = lessons.filter(l => l.type === 'quiz');

      for (const l of quizLessons) {
        const attempts = await dal.query<DBQuizAttempt>('trainingQuizAttempts', {
          whereClause: { lessonId: l.id },
        });

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
    const pubkey = this.getCurrentPubkey();
    const now = Date.now();

    const existingResults = await dal.queryCustom<DBCourseEnrollment>({
      sql: 'SELECT * FROM training_course_enrollments WHERE course_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [courseId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingCourseEnrollments')
          .where(['courseId', 'pubkey']).equals([courseId, pubkey])
          .first()
          .then((r: DBCourseEnrollment | undefined) => r ? [r] : []);
      },
    });
    const existing = existingResults[0];

    if (existing) {
      if (existing.status === 'dropped' || existing.status === 'paused') {
        await dal.update<DBCourseEnrollment>('trainingCourseEnrollments', existing.id, {
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

    await dal.add<DBCourseEnrollment>('trainingCourseEnrollments', enrollment);
    logger.info(`Enrolled in course: ${courseId}`);
  }

  async unenrollFromCourse(courseId: string): Promise<void> {
    const pubkey = this.getCurrentPubkey();

    const existingResults = await dal.queryCustom<DBCourseEnrollment>({
      sql: 'SELECT * FROM training_course_enrollments WHERE course_id = ?1 AND pubkey = ?2 LIMIT 1',
      params: [courseId, pubkey],
      dexieFallback: async (db) => {
        return db.table('trainingCourseEnrollments')
          .where(['courseId', 'pubkey']).equals([courseId, pubkey])
          .first()
          .then((r: DBCourseEnrollment | undefined) => r ? [r] : []);
      },
    });
    const enrollment = existingResults[0];

    if (enrollment) {
      await dal.update<DBCourseEnrollment>('trainingCourseEnrollments', enrollment.id, {
        status: 'dropped',
      });
    }

    logger.info(`Unenrolled from course: ${courseId}`);
  }

  /**
   * Clean up resources
   */
  close(): void {
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
