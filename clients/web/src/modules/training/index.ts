/**
 * Training Module
 * Comprehensive training system with courses, progress tracking, and certifications
 */

import type { ModulePlugin } from '@/types/modules';
import { trainingSchema } from './schema';
import type { BuildItDB } from '@/core/storage/db';
import { GraduationCap } from 'lucide-react';
import { lazy } from 'react';
import { logger } from '@/lib/logger';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import trainingTranslations from './i18n';
import { getTrainingManager } from './trainingManager';
import { trainingMigrations } from './migrations';
import { trainingSeeds } from './seeds';

// Lazy load components to reduce initial bundle size
const TrainingView = lazy(() => import('./components/TrainingView').then(m => ({ default: m.TrainingView })));
const CourseList = lazy(() => import('./components/CourseList').then(m => ({ default: m.CourseList })));
const CourseDetail = lazy(() => import('./components/CourseDetail').then(m => ({ default: m.CourseDetail })));
const LessonPlayer = lazy(() => import('./components/LessonPlayer').then(m => ({ default: m.LessonPlayer })));
const TrainerDashboard = lazy(() => import('./components/TrainerDashboard').then(m => ({ default: m.TrainerDashboard })));
const CertificationsView = lazy(() => import('./components/CertificationsView').then(m => ({ default: m.CertificationsView })));

/**
 * Training Module Plugin
 */
export const trainingModule: ModulePlugin = {
  metadata: {
    id: 'training',
    type: 'training',
    name: 'Training',
    description: 'Comprehensive training system with courses, quizzes, live sessions, and certifications',
    version: '1.0.0',
    author: 'BuildIt Network',
    icon: GraduationCap,
    capabilities: [
      {
        id: 'course-management',
        name: 'Course Management',
        description: 'Create and manage training courses with modules and lessons',
        requiresPermission: ['moderator', 'admin'],
      },
      {
        id: 'self-directed-learning',
        name: 'Self-Directed Learning',
        description: 'Complete courses at your own pace with progress tracking',
        requiresPermission: ['all'],
      },
      {
        id: 'live-training-sessions',
        name: 'Live Training Sessions',
        description: 'Attend live video training sessions with instructors',
        requiresPermission: ['member'],
      },
      {
        id: 'quizzes-assessments',
        name: 'Quizzes & Assessments',
        description: 'Take quizzes and assessments to verify learning',
        requiresPermission: ['all'],
      },
      {
        id: 'certifications',
        name: 'Certifications',
        description: 'Earn verifiable certifications upon course completion',
        requiresPermission: ['all'],
      },
      {
        id: 'assignment-review',
        name: 'Assignment Review',
        description: 'Submit and review assignments',
        requiresPermission: ['member'],
      },
      {
        id: 'trainer-dashboard',
        name: 'Trainer Dashboard',
        description: 'View training analytics and manage learners',
        requiresPermission: ['moderator', 'admin'],
      },
    ],
    configSchema: [
      {
        key: 'enablePublicCourses',
        label: 'Enable Public Courses',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow access to public training courses',
      },
      {
        key: 'enableCertifications',
        label: 'Enable Certifications',
        type: 'boolean',
        defaultValue: true,
        description: 'Allow learners to earn certifications',
      },
      {
        key: 'enableLiveSessions',
        label: 'Enable Live Sessions',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable live video training sessions',
      },
      {
        key: 'enableAssignments',
        label: 'Enable Assignments',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable assignment submissions and reviews',
      },
      {
        key: 'maxCourses',
        label: 'Max Courses',
        type: 'number',
        defaultValue: 100,
        description: 'Maximum number of courses a group can create',
      },
      {
        key: 'defaultPassingScore',
        label: 'Default Passing Score',
        type: 'number',
        defaultValue: 70,
        description: 'Default passing score for quizzes (0-100)',
      },
    ],
    requiredPermission: 'all',
    dependencies: [
      {
        moduleId: 'calling',
        relationship: 'optional',
        reason: 'Live training sessions use video conferencing from the calling module',
        enhancementConfig: {
          featureFlags: ['live-training-sessions'],
          uiSlots: ['lesson-live-session'],
        },
      },
      {
        moduleId: 'crm',
        relationship: 'optional',
        reason: 'Certification tracking integrates with CRM contacts',
        enhancementConfig: {
          featureFlags: ['certification-crm-sync'],
          uiSlots: ['contact-certifications'],
        },
      },
      {
        moduleId: 'events',
        relationship: 'optional',
        reason: 'Training events can be linked to the events module',
        enhancementConfig: {
          featureFlags: ['training-events-link'],
          uiSlots: ['event-training-info'],
        },
      },
      {
        moduleId: 'files',
        relationship: 'optional',
        reason: 'Assignment file uploads use the files module',
        enhancementConfig: {
          featureFlags: ['assignment-file-upload'],
        },
      },
    ],
    providesCapabilities: [
      'course-management',
      'self-directed-learning',
      'live-training-sessions',
      'quizzes-assessments',
      'certifications',
      'assignment-review',
      'trainer-dashboard',
    ],
  },

  lifecycle: {
    onRegister: async () => {
      // Register module translations
      registerModuleTranslations('training', trainingTranslations);
      logger.info('📚 Training module registered');
    },
    onEnable: async (groupId: string, config: Record<string, unknown>) => {
      // Initialize training manager when module is enabled
      try {
        const manager = getTrainingManager();
        await manager.initialize();
        logger.info(`📚 Training module enabled for group ${groupId}`, config);
      } catch (error) {
        logger.error('Failed to initialize training manager', error);
      }
    },
    onDisable: async (groupId: string) => {
      logger.info(`📚 Training module disabled for group ${groupId}`);
    },
    onDependencyEnabled: async (groupId: string, dependencyModuleId: string, _config: Record<string, unknown>) => {
      if (dependencyModuleId === 'calling') {
        logger.info(`📚 Calling module enabled - live training sessions now available for group ${groupId}`);
      }
      if (dependencyModuleId === 'crm') {
        logger.info(`📚 CRM module enabled - certification tracking now available for group ${groupId}`);
      }
    },
  },

  routes: [
    // App-level routes (available without group context)
    {
      path: 'training',
      component: TrainingView,
      scope: 'app',
      label: 'Training',
    },
    {
      path: 'training/courses',
      component: CourseList,
      scope: 'app',
      label: 'Courses',
    },
    {
      path: 'training/certifications',
      component: CertificationsView,
      scope: 'app',
      label: 'Certifications',
    },
    // Group-level routes
    {
      path: 'training',
      component: TrainingView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Training',
    },
    {
      path: 'training/courses',
      component: CourseList,
      scope: 'group',
      requiresEnabled: true,
      label: 'Courses',
    },
    {
      path: 'training/course/:courseId',
      component: CourseDetail,
      scope: 'group',
      requiresEnabled: true,
      label: 'Course',
    },
    {
      path: 'training/lesson/:lessonId',
      component: LessonPlayer,
      scope: 'group',
      requiresEnabled: true,
      label: 'Lesson',
    },
    {
      path: 'training/certifications',
      component: CertificationsView,
      scope: 'group',
      requiresEnabled: true,
      label: 'Certifications',
    },
    {
      path: 'training/trainer',
      component: TrainerDashboard,
      scope: 'group',
      requiresEnabled: true,
      label: 'Trainer Dashboard',
    },
  ],

  schema: trainingSchema,

  migrations: trainingMigrations,

  seeds: trainingSeeds,

  getDefaultConfig: () => ({
    enablePublicCourses: true,
    enableCertifications: true,
    enableLiveSessions: true,
    enableAssignments: true,
    maxCourses: 100,
    defaultPassingScore: 70,
  }),

  validateConfig: (config: Record<string, unknown>) => {
    if (typeof config.enablePublicCourses !== 'boolean') return false;
    if (typeof config.enableCertifications !== 'boolean') return false;
    if (typeof config.enableLiveSessions !== 'boolean') return false;
    if (typeof config.enableAssignments !== 'boolean') return false;
    if (typeof config.maxCourses !== 'number') return false;
    if (config.maxCourses < 1 || config.maxCourses > 10000) return false;
    if (typeof config.defaultPassingScore !== 'number') return false;
    if (config.defaultPassingScore < 0 || config.defaultPassingScore > 100) return false;
    return true;
  },
};

export default trainingModule;

// Re-export types and utilities
export * from './types';
export * from './trainingStore';
export { getTrainingManager, closeTrainingManager } from './trainingManager';

// Lazy loaded components for use in other modules
export { TrainingView, CourseList, CourseDetail, LessonPlayer, TrainerDashboard, CertificationsView };
