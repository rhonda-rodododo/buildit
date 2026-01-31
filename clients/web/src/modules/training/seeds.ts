/**
 * Training Module Seeds
 * Default training templates and demo data
 */

import type { ModuleSeed } from '@/types/modules';
import type { BuildItDB } from '@/core/storage/db';
import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';
import { appBasicsTemplate } from './templates/appBasics';
import { opsecBasicsTemplate } from './templates/opsecBasics';
import { digitalSecurityTemplate } from './templates/digitalSecurity';
import { jailSupportTemplate } from './templates/jailSupport';
import type { CourseTemplate, LessonTemplate, LessonContent, DocumentContent, QuizContent, VideoContent } from './types';

/**
 * Convert a course template to database records
 */
async function seedCourseFromTemplate(
  db: BuildItDB,
  template: CourseTemplate,
  groupId: string | undefined,
  userPubkey: string
): Promise<void> {
  const now = Date.now();

  // Create course
  const courseId = nanoid();
  await db.table('trainingCourses').add({
    id: courseId,
    groupId,
    title: template.title,
    description: template.description,
    imageUrl: template.imageUrl,
    category: template.category,
    difficulty: template.difficulty,
    estimatedHours: template.estimatedHours,
    status: 'published',
    certificationEnabled: template.certificationEnabled ? 1 : 0,
    certificationExpiryDays: template.certificationExpiryDays,
    isPublic: groupId ? 0 : 1,
    isDefault: 1,
    created: now,
    createdBy: userPubkey,
    updated: now,
  });

  // Create modules and lessons
  for (let moduleIndex = 0; moduleIndex < template.modules.length; moduleIndex++) {
    const moduleTemplate = template.modules[moduleIndex];
    const moduleId = nanoid();

    await db.table('trainingModules').add({
      id: moduleId,
      courseId,
      title: moduleTemplate.title,
      description: moduleTemplate.description,
      order: moduleIndex + 1,
      estimatedMinutes: moduleTemplate.estimatedMinutes,
      created: now,
      updated: now,
    });

    // Create lessons
    for (let lessonIndex = 0; lessonIndex < moduleTemplate.lessons.length; lessonIndex++) {
      const lessonTemplate = moduleTemplate.lessons[lessonIndex];
      const lessonId = nanoid();

      // Build content based on type
      const content = buildLessonContent(lessonTemplate);

      await db.table('trainingLessons').add({
        id: lessonId,
        moduleId,
        type: lessonTemplate.type,
        title: lessonTemplate.title,
        description: lessonTemplate.description,
        content: JSON.stringify(content),
        order: lessonIndex + 1,
        estimatedMinutes: lessonTemplate.estimatedMinutes,
        requiredForCertification: lessonTemplate.requiredForCertification ? 1 : 0,
        passingScore: lessonTemplate.type === 'quiz' ? 70 : undefined,
        created: now,
        updated: now,
      });
    }
  }

  logger.info(`Seeded course: ${template.title} (${courseId})`);
}

/**
 * Build lesson content from template
 */
function buildLessonContent(template: LessonTemplate): LessonContent {
  if (template.content) {
    return template.content as LessonContent;
  }

  // Generate placeholder content based on type
  switch (template.type) {
    case 'video':
      return {
        type: 'video',
        videoUrl: '',
        duration: template.estimatedMinutes * 60,
      } as VideoContent;

    case 'document':
      return {
        type: 'document',
        markdown: `# ${template.title}\n\n${template.description || 'Content coming soon.'}`,
      } as DocumentContent;

    case 'quiz':
      return {
        type: 'quiz',
        questions: [],
        passingScore: 70,
        allowRetakes: true,
        maxAttempts: 3,
        shuffleQuestions: true,
        shuffleOptions: true,
        showCorrectAfter: true,
      } as QuizContent;

    case 'assignment':
      return {
        type: 'assignment',
        instructions: template.description || 'Complete the assignment.',
        allowedFileTypes: ['pdf', 'docx', 'md'],
        maxFileSizeMB: 10,
      };

    case 'live-session':
      return {
        type: 'live-session',
        scheduledAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week from now
        duration: template.estimatedMinutes,
        instructorPubkey: '',
        requiresRSVP: true,
      };

    case 'interactive':
      return {
        type: 'interactive',
        exerciseType: 'scenario',
        configJson: '{}',
      };

    default:
      return {
        type: 'document',
        markdown: `# ${template.title}\n\nContent placeholder.`,
      } as DocumentContent;
  }
}

/**
 * Training module seeds
 */
export const trainingSeeds: ModuleSeed[] = [
  {
    name: 'default-training-templates',
    description: 'Seed default public training course templates (App Basics, Opsec, Digital Security, Jail Support)',
    data: async (db: BuildItDB, _groupId: string, userPubkey: string) => {
      // Seed public templates (no groupId)
      const templates: CourseTemplate[] = [
        appBasicsTemplate,
        opsecBasicsTemplate,
        digitalSecurityTemplate,
        jailSupportTemplate,
      ];

      for (const template of templates) {
        // Check if course already exists
        const existing = await db.table('trainingCourses')
          .where('title').equals(template.title)
          .filter(c => c.isDefault === 1)
          .first();

        if (!existing) {
          await seedCourseFromTemplate(db, template, undefined, userPubkey);
        }
      }

      logger.info('Seeded default training templates');
    },
  },
];
