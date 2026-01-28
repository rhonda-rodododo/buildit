/**
 * Training Module Main View
 * Dashboard showing courses, progress, and certifications
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrainingStore } from '../trainingStore';
import {
  BookOpen,
  Award,
  Clock,
  TrendingUp,
  ChevronRight,
  GraduationCap,
  Play,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Course, CourseProgress } from '../types';

export function TrainingView() {
  const { t } = useTranslation('training');
  const {
    courses,
    certifications,
    isLoading,
    error,
    loadCourses,
    loadCertifications,
    getProgress,
  } = useTrainingStore();

  const [progressMap, setProgressMap] = useState<Map<string, CourseProgress>>(new Map());

  useEffect(() => {
    loadCourses({ status: 'published', includePublic: true });
    loadCertifications();
  }, [loadCourses, loadCertifications]);

  useEffect(() => {
    // Load progress for all courses
    const loadAllProgress = async () => {
      const newProgressMap = new Map<string, CourseProgress>();
      for (const course of courses) {
        const progress = await getProgress(course.id);
        if (progress) {
          newProgressMap.set(course.id, progress);
        }
      }
      setProgressMap(newProgressMap);
    };

    if (courses.length > 0) {
      loadAllProgress();
    }
  }, [courses, getProgress]);

  const inProgressCourses = courses.filter(c => {
    const progress = progressMap.get(c.id);
    return progress && progress.percentComplete > 0 && progress.percentComplete < 100;
  });

  const completedCourses = courses.filter(c => {
    const progress = progressMap.get(c.id);
    return progress?.completedAt;
  });

  const availableCourses = courses.filter(c => {
    const progress = progressMap.get(c.id);
    return !progress || progress.percentComplete === 0;
  });

  if (isLoading) {
    return <TrainingViewSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => loadCourses()} className="mt-4">
          {t('actions.retry', 'Retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" asChild>
          <a href="/training/certifications">
            <Award className="mr-2 h-4 w-4" />
            {t('nav.certifications')}
          </a>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title={t('course.courses')}
          value={courses.length}
          icon={BookOpen}
        />
        <StatsCard
          title={t('course.inProgress')}
          value={inProgressCourses.length}
          icon={Play}
        />
        <StatsCard
          title={t('course.completed')}
          value={completedCourses.length}
          icon={TrendingUp}
        />
        <StatsCard
          title={t('certification.certifications')}
          value={certifications.filter(c => !c.revokedAt).length}
          icon={Award}
        />
      </div>

      {/* Continue Learning */}
      {inProgressCourses.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">{t('course.continue')}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {inProgressCourses.slice(0, 3).map(course => (
              <CourseProgressCard
                key={course.id}
                course={course}
                progress={progressMap.get(course.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Course Tabs */}
      <Tabs defaultValue="available" className="w-full">
        <TabsList>
          <TabsTrigger value="available">
            {t('course.courses')} ({availableCourses.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            {t('course.completed')} ({completedCourses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-4">
          {availableCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t('empty.noCourses')}
              description={t('empty.browseCourses')}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableCourses.map(course => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedCourses.length === 0 ? (
            <EmptyState
              icon={Award}
              title={t('certification.noCertifications')}
              description={t('certification.complete')}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedCourses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  completed
                  progress={progressMap.get(course.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}

function StatsCard({ title, value, icon: Icon }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface CourseCardProps {
  course: Course;
  completed?: boolean;
  progress?: CourseProgress;
}

function CourseCard({ course, completed, progress }: CourseCardProps) {
  const { t } = useTranslation('training');

  return (
    <Card className="group cursor-pointer transition-shadow hover:shadow-md">
      <a href={`/training/course/${course.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <Badge variant={completed ? 'default' : 'secondary'}>
              {t(`category.${course.category}`)}
            </Badge>
            <Badge variant="outline">
              {t(`difficulty.${course.difficulty}`)}
            </Badge>
          </div>
          <CardTitle className="mt-2 line-clamp-2">{course.title}</CardTitle>
          <CardDescription className="line-clamp-2">
            {course.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                {course.estimatedHours} {t('progress.timeSpent', 'hours')}
              </span>
            </div>
            {course.certificationEnabled && (
              <div className="flex items-center gap-1">
                <Award className="h-4 w-4" />
                <span>{t('certification.title')}</span>
              </div>
            )}
          </div>
          {completed && progress?.completedAt && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
              <GraduationCap className="h-4 w-4" />
              <span>
                {t('course.completed')} {new Date(progress.completedAt).toLocaleDateString()}
              </span>
            </div>
          )}
          <ChevronRight className="mt-2 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </CardContent>
      </a>
    </Card>
  );
}

interface CourseProgressCardProps {
  course: Course;
  progress?: CourseProgress;
}

function CourseProgressCard({ course, progress }: CourseProgressCardProps) {
  const { t } = useTranslation('training');

  return (
    <Card className="group cursor-pointer transition-shadow hover:shadow-md">
      <a href={`/training/course/${course.id}`}>
        <CardHeader className="pb-2">
          <Badge variant="secondary" className="w-fit">
            {t(`category.${course.category}`)}
          </Badge>
          <CardTitle className="mt-2 line-clamp-1">{course.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('lesson.progress', {
                  completed: progress?.lessonsCompleted || 0,
                  total: progress?.totalLessons || 0,
                })}
              </span>
              <span className="font-medium">{progress?.percentComplete || 0}%</span>
            </div>
            <Progress value={progress?.percentComplete || 0} className="h-2" />
          </div>
          <Button className="mt-4 w-full" size="sm">
            <Play className="mr-2 h-4 w-4" />
            {t('course.continue')}
          </Button>
        </CardContent>
      </a>
    </Card>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function TrainingViewSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="mt-2 h-6 w-48" />
              <Skeleton className="mt-1 h-4 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
