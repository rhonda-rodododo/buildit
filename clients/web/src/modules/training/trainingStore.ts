/**
 * Training Module Zustand Store
 * State management for training courses, progress, and certifications
 */

import { create } from 'zustand';
import { logger } from '@/lib/logger';
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
} from './types';
import { getTrainingManager } from './trainingManager';

interface TrainingState {
  // Data
  courses: Course[];
  modules: Map<string, TrainingModule[]>;    // courseId -> modules
  lessons: Map<string, Lesson[]>;            // moduleId -> lessons
  lessonProgress: Map<string, LessonProgress>; // lessonId:pubkey -> progress
  courseProgress: Map<string, CourseProgress>; // courseId:pubkey -> progress
  certifications: Certification[];
  quizAttempts: Map<string, QuizAttempt[]>;  // lessonId:pubkey -> attempts
  submissions: Map<string, AssignmentSubmission[]>; // lessonId:pubkey -> submissions

  // UI State
  currentCourseId: string | null;
  currentModuleId: string | null;
  currentLessonId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions - Courses
  loadCourses: (options?: CourseQueryOptions) => Promise<void>;
  getCourse: (courseId: string) => Promise<Course | null>;
  createCourse: (data: CreateCourseData) => Promise<Course>;
  updateCourse: (courseId: string, data: UpdateCourseData) => Promise<Course>;
  deleteCourse: (courseId: string) => Promise<void>;
  publishCourse: (courseId: string) => Promise<void>;
  archiveCourse: (courseId: string) => Promise<void>;

  // Actions - Modules
  loadModules: (courseId: string) => Promise<void>;
  createModule: (data: CreateModuleData) => Promise<TrainingModule>;
  updateModule: (moduleId: string, data: UpdateModuleData) => Promise<TrainingModule>;
  deleteModule: (moduleId: string) => Promise<void>;
  reorderModules: (courseId: string, moduleIds: string[]) => Promise<void>;

  // Actions - Lessons
  loadLessons: (moduleId: string) => Promise<void>;
  createLesson: (data: CreateLessonData) => Promise<Lesson>;
  updateLesson: (lessonId: string, data: UpdateLessonData) => Promise<Lesson>;
  deleteLesson: (lessonId: string) => Promise<void>;
  reorderLessons: (moduleId: string, lessonIds: string[]) => Promise<void>;

  // Actions - Progress
  startLesson: (lessonId: string) => Promise<void>;
  updateLessonProgress: (lessonId: string, timeSpent: number, position?: number) => Promise<void>;
  completeLesson: (lessonId: string, score?: number) => Promise<void>;
  getProgress: (courseId: string) => Promise<CourseProgress | null>;
  getUserTrainingStatus: (pubkey: string) => Promise<UserTrainingStatus>;

  // Actions - Quizzes
  startQuizAttempt: (lessonId: string) => Promise<QuizAttempt>;
  submitQuizAttempt: (attemptId: string, answers: QuizAnswer[]) => Promise<QuizAttempt>;
  getQuizAttempts: (lessonId: string) => Promise<QuizAttempt[]>;

  // Actions - Assignments
  submitAssignment: (lessonId: string, fileUrl: string, fileName: string, fileSize: number) => Promise<AssignmentSubmission>;
  reviewAssignment: (submissionId: string, status: AssignmentSubmission['reviewStatus'], feedback?: string, score?: number) => Promise<AssignmentSubmission>;

  // Actions - Live Sessions
  rsvpLiveSession: (lessonId: string, status: LiveSessionRSVP['status']) => Promise<void>;
  recordLiveAttendance: (lessonId: string, joinedAt: number, leftAt?: number) => Promise<void>;

  // Actions - Certifications
  loadCertifications: (pubkey?: string) => Promise<void>;
  getCertification: (courseId: string, pubkey: string) => Promise<Certification | null>;
  verifyCertification: (verificationCode: string) => Promise<Certification | null>;
  revokeCertification: (certificationId: string, reason: string) => Promise<void>;

  // Actions - Stats
  getCourseStats: (courseId: string) => Promise<CourseStats>;

  // Actions - Enrollment
  enrollInCourse: (courseId: string) => Promise<void>;
  unenrollFromCourse: (courseId: string) => Promise<void>;

  // Navigation
  setCurrentCourse: (courseId: string | null) => void;
  setCurrentModule: (moduleId: string | null) => void;
  setCurrentLesson: (lessonId: string | null) => void;

  // Utilities
  clearError: () => void;
  reset: () => void;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  // Initial State
  courses: [],
  modules: new Map(),
  lessons: new Map(),
  lessonProgress: new Map(),
  courseProgress: new Map(),
  certifications: [],
  quizAttempts: new Map(),
  submissions: new Map(),
  currentCourseId: null,
  currentModuleId: null,
  currentLessonId: null,
  isLoading: false,
  error: null,

  // Course Actions
  loadCourses: async (options?: CourseQueryOptions) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const courses = await manager.listCourses(options);
      set({ courses, isLoading: false });
    } catch (error) {
      logger.error('Failed to load courses', error);
      set({ error: 'Failed to load courses', isLoading: false });
    }
  },

  getCourse: async (courseId: string) => {
    try {
      const manager = getTrainingManager();
      return await manager.getCourse(courseId);
    } catch (error) {
      logger.error('Failed to get course', error);
      return null;
    }
  },

  createCourse: async (data: CreateCourseData) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const course = await manager.createCourse(data);
      set(state => ({
        courses: [...state.courses, course],
        isLoading: false,
      }));
      return course;
    } catch (error) {
      logger.error('Failed to create course', error);
      set({ error: 'Failed to create course', isLoading: false });
      throw error;
    }
  },

  updateCourse: async (courseId: string, data: UpdateCourseData) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const course = await manager.updateCourse(courseId, data);
      set(state => ({
        courses: state.courses.map(c => c.id === courseId ? course : c),
        isLoading: false,
      }));
      return course;
    } catch (error) {
      logger.error('Failed to update course', error);
      set({ error: 'Failed to update course', isLoading: false });
      throw error;
    }
  },

  deleteCourse: async (courseId: string) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      await manager.deleteCourse(courseId);
      set(state => ({
        courses: state.courses.filter(c => c.id !== courseId),
        isLoading: false,
      }));
    } catch (error) {
      logger.error('Failed to delete course', error);
      set({ error: 'Failed to delete course', isLoading: false });
      throw error;
    }
  },

  publishCourse: async (courseId: string) => {
    return get().updateCourse(courseId, { status: 'published' });
  },

  archiveCourse: async (courseId: string) => {
    return get().updateCourse(courseId, { status: 'archived' });
  },

  // Module Actions
  loadModules: async (courseId: string) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const modules = await manager.listModules(courseId);
      set(state => {
        const newModules = new Map(state.modules);
        newModules.set(courseId, modules);
        return { modules: newModules, isLoading: false };
      });
    } catch (error) {
      logger.error('Failed to load modules', error);
      set({ error: 'Failed to load modules', isLoading: false });
    }
  },

  createModule: async (data: CreateModuleData) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const module = await manager.createModule(data);
      set(state => {
        const newModules = new Map(state.modules);
        const courseModules = newModules.get(data.courseId) || [];
        newModules.set(data.courseId, [...courseModules, module]);
        return { modules: newModules, isLoading: false };
      });
      return module;
    } catch (error) {
      logger.error('Failed to create module', error);
      set({ error: 'Failed to create module', isLoading: false });
      throw error;
    }
  },

  updateModule: async (moduleId: string, data: UpdateModuleData) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const module = await manager.updateModule(moduleId, data);
      set(state => {
        const newModules = new Map(state.modules);
        for (const [courseId, modules] of newModules) {
          const idx = modules.findIndex(m => m.id === moduleId);
          if (idx !== -1) {
            modules[idx] = module;
            newModules.set(courseId, [...modules]);
            break;
          }
        }
        return { modules: newModules, isLoading: false };
      });
      return module;
    } catch (error) {
      logger.error('Failed to update module', error);
      set({ error: 'Failed to update module', isLoading: false });
      throw error;
    }
  },

  deleteModule: async (moduleId: string) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      await manager.deleteModule(moduleId);
      set(state => {
        const newModules = new Map(state.modules);
        for (const [courseId, modules] of newModules) {
          const filtered = modules.filter(m => m.id !== moduleId);
          if (filtered.length !== modules.length) {
            newModules.set(courseId, filtered);
            break;
          }
        }
        return { modules: newModules, isLoading: false };
      });
    } catch (error) {
      logger.error('Failed to delete module', error);
      set({ error: 'Failed to delete module', isLoading: false });
      throw error;
    }
  },

  reorderModules: async (courseId: string, moduleIds: string[]) => {
    try {
      const manager = getTrainingManager();
      await manager.reorderModules(courseId, moduleIds);
      await get().loadModules(courseId);
    } catch (error) {
      logger.error('Failed to reorder modules', error);
      throw error;
    }
  },

  // Lesson Actions
  loadLessons: async (moduleId: string) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const lessons = await manager.listLessons(moduleId);
      set(state => {
        const newLessons = new Map(state.lessons);
        newLessons.set(moduleId, lessons);
        return { lessons: newLessons, isLoading: false };
      });
    } catch (error) {
      logger.error('Failed to load lessons', error);
      set({ error: 'Failed to load lessons', isLoading: false });
    }
  },

  createLesson: async (data: CreateLessonData) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const lesson = await manager.createLesson(data);
      set(state => {
        const newLessons = new Map(state.lessons);
        const moduleLessons = newLessons.get(data.moduleId) || [];
        newLessons.set(data.moduleId, [...moduleLessons, lesson]);
        return { lessons: newLessons, isLoading: false };
      });
      return lesson;
    } catch (error) {
      logger.error('Failed to create lesson', error);
      set({ error: 'Failed to create lesson', isLoading: false });
      throw error;
    }
  },

  updateLesson: async (lessonId: string, data: UpdateLessonData) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const lesson = await manager.updateLesson(lessonId, data);
      set(state => {
        const newLessons = new Map(state.lessons);
        for (const [moduleId, lessons] of newLessons) {
          const idx = lessons.findIndex(l => l.id === lessonId);
          if (idx !== -1) {
            lessons[idx] = lesson;
            newLessons.set(moduleId, [...lessons]);
            break;
          }
        }
        return { lessons: newLessons, isLoading: false };
      });
      return lesson;
    } catch (error) {
      logger.error('Failed to update lesson', error);
      set({ error: 'Failed to update lesson', isLoading: false });
      throw error;
    }
  },

  deleteLesson: async (lessonId: string) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      await manager.deleteLesson(lessonId);
      set(state => {
        const newLessons = new Map(state.lessons);
        for (const [moduleId, lessons] of newLessons) {
          const filtered = lessons.filter(l => l.id !== lessonId);
          if (filtered.length !== lessons.length) {
            newLessons.set(moduleId, filtered);
            break;
          }
        }
        return { lessons: newLessons, isLoading: false };
      });
    } catch (error) {
      logger.error('Failed to delete lesson', error);
      set({ error: 'Failed to delete lesson', isLoading: false });
      throw error;
    }
  },

  reorderLessons: async (moduleId: string, lessonIds: string[]) => {
    try {
      const manager = getTrainingManager();
      await manager.reorderLessons(moduleId, lessonIds);
      await get().loadLessons(moduleId);
    } catch (error) {
      logger.error('Failed to reorder lessons', error);
      throw error;
    }
  },

  // Progress Actions
  startLesson: async (lessonId: string) => {
    try {
      const manager = getTrainingManager();
      const progress = await manager.startLesson(lessonId);
      set(state => {
        const newProgress = new Map(state.lessonProgress);
        newProgress.set(`${lessonId}:${progress.pubkey}`, progress);
        return { lessonProgress: newProgress };
      });
    } catch (error) {
      logger.error('Failed to start lesson', error);
      throw error;
    }
  },

  updateLessonProgress: async (lessonId: string, timeSpent: number, position?: number) => {
    try {
      const manager = getTrainingManager();
      const progress = await manager.updateLessonProgress(lessonId, timeSpent, position);
      set(state => {
        const newProgress = new Map(state.lessonProgress);
        newProgress.set(`${lessonId}:${progress.pubkey}`, progress);
        return { lessonProgress: newProgress };
      });
    } catch (error) {
      logger.error('Failed to update lesson progress', error);
      throw error;
    }
  },

  completeLesson: async (lessonId: string, score?: number) => {
    try {
      const manager = getTrainingManager();
      const progress = await manager.completeLesson(lessonId, score);
      set(state => {
        const newProgress = new Map(state.lessonProgress);
        newProgress.set(`${lessonId}:${progress.pubkey}`, progress);
        return { lessonProgress: newProgress };
      });
    } catch (error) {
      logger.error('Failed to complete lesson', error);
      throw error;
    }
  },

  getProgress: async (courseId: string) => {
    try {
      const manager = getTrainingManager();
      return await manager.getCourseProgress(courseId);
    } catch (error) {
      logger.error('Failed to get progress', error);
      return null;
    }
  },

  getUserTrainingStatus: async (pubkey: string) => {
    try {
      const manager = getTrainingManager();
      return await manager.getUserTrainingStatus(pubkey);
    } catch (error) {
      logger.error('Failed to get user training status', error);
      throw error;
    }
  },

  // Quiz Actions
  startQuizAttempt: async (lessonId: string) => {
    try {
      const manager = getTrainingManager();
      return await manager.startQuizAttempt(lessonId);
    } catch (error) {
      logger.error('Failed to start quiz attempt', error);
      throw error;
    }
  },

  submitQuizAttempt: async (attemptId: string, answers: QuizAnswer[]) => {
    try {
      const manager = getTrainingManager();
      const attempt = await manager.submitQuizAttempt(attemptId, answers);
      // Update local state
      set(state => {
        const key = `${attempt.lessonId}:${attempt.pubkey}`;
        const newAttempts = new Map(state.quizAttempts);
        const existing = newAttempts.get(key) || [];
        newAttempts.set(key, [...existing, attempt]);
        return { quizAttempts: newAttempts };
      });
      return attempt;
    } catch (error) {
      logger.error('Failed to submit quiz attempt', error);
      throw error;
    }
  },

  getQuizAttempts: async (lessonId: string) => {
    try {
      const manager = getTrainingManager();
      return await manager.getQuizAttempts(lessonId);
    } catch (error) {
      logger.error('Failed to get quiz attempts', error);
      return [];
    }
  },

  // Assignment Actions
  submitAssignment: async (lessonId: string, fileUrl: string, fileName: string, fileSize: number) => {
    try {
      const manager = getTrainingManager();
      return await manager.submitAssignment(lessonId, fileUrl, fileName, fileSize);
    } catch (error) {
      logger.error('Failed to submit assignment', error);
      throw error;
    }
  },

  reviewAssignment: async (
    submissionId: string,
    status: AssignmentSubmission['reviewStatus'],
    feedback?: string,
    score?: number
  ) => {
    try {
      const manager = getTrainingManager();
      return await manager.reviewAssignment(submissionId, status, feedback, score);
    } catch (error) {
      logger.error('Failed to review assignment', error);
      throw error;
    }
  },

  // Live Session Actions
  rsvpLiveSession: async (lessonId: string, status: LiveSessionRSVP['status']) => {
    try {
      const manager = getTrainingManager();
      await manager.rsvpLiveSession(lessonId, status);
    } catch (error) {
      logger.error('Failed to RSVP to live session', error);
      throw error;
    }
  },

  recordLiveAttendance: async (lessonId: string, joinedAt: number, leftAt?: number) => {
    try {
      const manager = getTrainingManager();
      await manager.recordLiveAttendance(lessonId, joinedAt, leftAt);
    } catch (error) {
      logger.error('Failed to record live attendance', error);
      throw error;
    }
  },

  // Certification Actions
  loadCertifications: async (pubkey?: string) => {
    set({ isLoading: true, error: null });
    try {
      const manager = getTrainingManager();
      const certifications = await manager.listCertifications(pubkey);
      set({ certifications, isLoading: false });
    } catch (error) {
      logger.error('Failed to load certifications', error);
      set({ error: 'Failed to load certifications', isLoading: false });
    }
  },

  getCertification: async (courseId: string, pubkey: string) => {
    try {
      const manager = getTrainingManager();
      return await manager.getCertification(courseId, pubkey);
    } catch (error) {
      logger.error('Failed to get certification', error);
      return null;
    }
  },

  verifyCertification: async (verificationCode: string) => {
    try {
      const manager = getTrainingManager();
      const result = await manager.verifyCertification(verificationCode);
      return result.valid ? result.certification ?? null : null;
    } catch (error) {
      logger.error('Failed to verify certification', error);
      return null;
    }
  },

  revokeCertification: async (certificationId: string, reason: string) => {
    try {
      const manager = getTrainingManager();
      await manager.revokeCertification(certificationId, reason);
      // Refresh certifications
      await get().loadCertifications();
    } catch (error) {
      logger.error('Failed to revoke certification', error);
      throw error;
    }
  },

  // Stats Actions
  getCourseStats: async (courseId: string) => {
    try {
      const manager = getTrainingManager();
      return await manager.getCourseStats(courseId);
    } catch (error) {
      logger.error('Failed to get course stats', error);
      throw error;
    }
  },

  // Enrollment Actions
  enrollInCourse: async (courseId: string) => {
    try {
      const manager = getTrainingManager();
      await manager.enrollInCourse(courseId);
    } catch (error) {
      logger.error('Failed to enroll in course', error);
      throw error;
    }
  },

  unenrollFromCourse: async (courseId: string) => {
    try {
      const manager = getTrainingManager();
      await manager.unenrollFromCourse(courseId);
    } catch (error) {
      logger.error('Failed to unenroll from course', error);
      throw error;
    }
  },

  // Navigation
  setCurrentCourse: (courseId: string | null) => {
    set({ currentCourseId: courseId });
  },

  setCurrentModule: (moduleId: string | null) => {
    set({ currentModuleId: moduleId });
  },

  setCurrentLesson: (lessonId: string | null) => {
    set({ currentLessonId: lessonId });
  },

  // Utilities
  clearError: () => set({ error: null }),

  reset: () => set({
    courses: [],
    modules: new Map(),
    lessons: new Map(),
    lessonProgress: new Map(),
    courseProgress: new Map(),
    certifications: [],
    quizAttempts: new Map(),
    submissions: new Map(),
    currentCourseId: null,
    currentModuleId: null,
    currentLessonId: null,
    isLoading: false,
    error: null,
  }),
}));
