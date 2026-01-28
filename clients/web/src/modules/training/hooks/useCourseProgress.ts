/**
 * useCourseProgress Hook
 * Track and manage user progress through a course
 */

import { useEffect, useState, useCallback } from 'react';
import { useTrainingStore } from '../trainingStore';
import type { CourseProgress, LessonProgress, TrainingModule, Lesson } from '../types';

interface UseCourseProgressOptions {
  courseId: string;
  autoLoad?: boolean;
}

interface UseCourseProgressReturn {
  // Progress data
  progress: CourseProgress | null;
  lessonProgressMap: Map<string, LessonProgress>;
  isLoading: boolean;

  // Computed
  percentComplete: number;
  lessonsCompleted: number;
  totalLessons: number;
  currentModule: TrainingModule | null;
  currentLesson: Lesson | null;
  isCompleted: boolean;

  // Navigation helpers
  nextLesson: Lesson | null;
  previousLesson: Lesson | null;

  // Actions
  startLesson: (lessonId: string) => Promise<void>;
  completeLesson: (lessonId: string, score?: number) => Promise<void>;
  updateProgress: (lessonId: string, timeSpent: number, position?: number) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

/**
 * Hook for tracking course progress
 */
export function useCourseProgress({ courseId, autoLoad = true }: UseCourseProgressOptions): UseCourseProgressReturn {
  const {
    modules,
    lessons,
    lessonProgress,
    getProgress,
    loadModules,
    loadLessons,
    startLesson: storeStartLesson,
    completeLesson: storeCompleteLesson,
    updateLessonProgress,
  } = useTrainingStore();

  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load progress and modules
  useEffect(() => {
    if (autoLoad && courseId) {
      setIsLoading(true);
      Promise.all([
        getProgress(courseId).then(setProgress),
        loadModules(courseId),
      ]).finally(() => setIsLoading(false));
    }
  }, [courseId, autoLoad, getProgress, loadModules]);

  // Load lessons for all modules
  useEffect(() => {
    const courseModules = modules.get(courseId) || [];
    courseModules.forEach(m => {
      if (!lessons.has(m.id)) {
        loadLessons(m.id);
      }
    });
  }, [courseId, modules, lessons, loadLessons]);

  // Get all lessons for the course in order
  const allLessons = useCallback((): Lesson[] => {
    const courseModules = modules.get(courseId) || [];
    return courseModules
      .sort((a, b) => a.order - b.order)
      .flatMap(m => {
        const moduleLessons = lessons.get(m.id) || [];
        return moduleLessons.sort((a, b) => a.order - b.order);
      });
  }, [courseId, modules, lessons]);

  // Find current lesson
  const findCurrentLesson = useCallback((): { module: TrainingModule | null; lesson: Lesson | null } => {
    if (!progress?.currentLessonId) {
      const courseLessons = allLessons();
      return {
        module: null,
        lesson: courseLessons[0] || null,
      };
    }

    const courseModules = modules.get(courseId) || [];
    for (const m of courseModules) {
      const moduleLessons = lessons.get(m.id) || [];
      const lesson = moduleLessons.find(l => l.id === progress.currentLessonId);
      if (lesson) {
        return { module: m, lesson };
      }
    }
    return { module: null, lesson: null };
  }, [courseId, modules, lessons, progress, allLessons]);

  // Find next/previous lessons
  const findAdjacentLessons = useCallback((): { next: Lesson | null; previous: Lesson | null } => {
    const courseLessons = allLessons();
    const currentIdx = courseLessons.findIndex(l => l.id === progress?.currentLessonId);

    if (currentIdx === -1) {
      return { next: courseLessons[0] || null, previous: null };
    }

    return {
      next: courseLessons[currentIdx + 1] || null,
      previous: courseLessons[currentIdx - 1] || null,
    };
  }, [allLessons, progress]);

  // Actions
  const startLesson = async (lessonId: string) => {
    await storeStartLesson(lessonId);
    const newProgress = await getProgress(courseId);
    setProgress(newProgress);
  };

  const completeLesson = async (lessonId: string, score?: number) => {
    await storeCompleteLesson(lessonId, score);
    const newProgress = await getProgress(courseId);
    setProgress(newProgress);
  };

  const updateProgress = async (lessonId: string, timeSpent: number, position?: number) => {
    await updateLessonProgress(lessonId, timeSpent, position);
  };

  const refresh = async () => {
    setIsLoading(true);
    try {
      const newProgress = await getProgress(courseId);
      setProgress(newProgress);
      await loadModules(courseId);
    } finally {
      setIsLoading(false);
    }
  };

  // Computed values
  const { module: currentModule, lesson: currentLesson } = findCurrentLesson();
  const { next: nextLesson, previous: previousLesson } = findAdjacentLessons();

  return {
    progress,
    lessonProgressMap: lessonProgress,
    isLoading,
    percentComplete: progress?.percentComplete || 0,
    lessonsCompleted: progress?.lessonsCompleted || 0,
    totalLessons: progress?.totalLessons || allLessons().length,
    currentModule,
    currentLesson,
    isCompleted: !!progress?.completedAt,
    nextLesson,
    previousLesson,
    startLesson,
    completeLesson,
    updateProgress,
    refresh,
  };
}
