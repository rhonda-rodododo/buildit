/**
 * useTraining Hook
 * Provides access to training data and actions for components
 */

import { useEffect, useMemo } from 'react';
import { useTrainingStore } from '../trainingStore';
import type { Course, CourseQueryOptions } from '../types';

interface UseTrainingOptions {
  autoLoad?: boolean;
  queryOptions?: CourseQueryOptions;
}

interface UseTrainingReturn {
  // Data
  courses: Course[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadCourses: (options?: CourseQueryOptions) => Promise<void>;
  getCourse: (courseId: string) => Promise<Course | null>;
  enrollInCourse: (courseId: string) => Promise<void>;
  unenrollFromCourse: (courseId: string) => Promise<void>;

  // Computed
  publicCourses: Course[];
  groupCourses: Course[];
  publishedCourses: Course[];

  // Utilities
  clearError: () => void;
  refresh: () => Promise<void>;
}

/**
 * Hook for accessing training courses and actions
 */
export function useTraining(options: UseTrainingOptions = {}): UseTrainingReturn {
  const { autoLoad = true, queryOptions } = options;

  const {
    courses,
    isLoading,
    error,
    loadCourses,
    getCourse,
    enrollInCourse,
    unenrollFromCourse,
    clearError,
  } = useTrainingStore();

  // Auto-load courses on mount
  useEffect(() => {
    if (autoLoad) {
      loadCourses(queryOptions);
    }
  }, [autoLoad, loadCourses]); // Intentionally not including queryOptions to avoid re-fetching on every render

  // Computed values
  const publicCourses = useMemo(
    () => courses.filter(c => c.isPublic),
    [courses]
  );

  const groupCourses = useMemo(
    () => courses.filter(c => !c.isPublic),
    [courses]
  );

  const publishedCourses = useMemo(
    () => courses.filter(c => c.status === 'published'),
    [courses]
  );

  const refresh = async () => {
    await loadCourses(queryOptions);
  };

  return {
    courses,
    isLoading,
    error,
    loadCourses,
    getCourse,
    enrollInCourse,
    unenrollFromCourse,
    publicCourses,
    groupCourses,
    publishedCourses,
    clearError,
    refresh,
  };
}
