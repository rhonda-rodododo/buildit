/**
 * Course Detail Component
 * Displays course information, modules, lessons, and progress
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useTrainingStore } from '../trainingStore';
import {
  BookOpen,
  Award,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
  CheckCircle,
  Circle,
  Lock,
  Users,
  Calendar,
  ArrowLeft,
  FileText,
  HelpCircle,
  Video,
  PenTool,
  Radio,
  Gamepad2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Course, TrainingModule, Lesson, CourseProgress, LessonProgress, LessonType } from '../types';

const LESSON_ICONS: Record<LessonType, React.ComponentType<{ className?: string }>> = {
  video: Video,
  document: FileText,
  quiz: HelpCircle,
  assignment: PenTool,
  'live-session': Radio,
  interactive: Gamepad2,
};

export function CourseDetail() {
  const { t } = useTranslation('training');
  const { courseId } = useParams<{ courseId: string }>();
  const {
    getCourse,
    loadModules,
    loadLessons,
    modules,
    lessons,
    lessonProgress,
    getProgress,
    enrollInCourse,
    isLoading,
  } = useTrainingStore();

  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!courseId) return;

    const loadCourse = async () => {
      const c = await getCourse(courseId);
      setCourse(c);
      if (c) {
        await loadModules(courseId);
        const p = await getProgress(courseId);
        setProgress(p);
      }
    };

    loadCourse();
  }, [courseId, getCourse, loadModules, getProgress]);

  // Load lessons for all modules
  useEffect(() => {
    if (!courseId) return;
    const courseModules = modules.get(courseId) || [];
    courseModules.forEach(m => {
      loadLessons(m.id);
    });
  }, [courseId, modules, loadLessons]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const handleEnroll = async () => {
    if (!courseId) return;
    await enrollInCourse(courseId);
    const p = await getProgress(courseId);
    setProgress(p);
  };

  if (isLoading || !course) {
    return <CourseDetailSkeleton />;
  }

  const courseModules = modules.get(courseId!) || [];
  const isEnrolled = !!progress;
  const isCompleted = progress?.completedAt;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl p-6">
          <Button variant="ghost" className="mb-4" asChild>
            <a href="/training/courses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('course.courses')}
            </a>
          </Button>

          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{t(`category.${course.category}`)}</Badge>
                <Badge variant="outline">{t(`difficulty.${course.difficulty}`)}</Badge>
                {course.isPublic && (
                  <Badge variant="outline">{t('course.public')}</Badge>
                )}
              </div>

              <h1 className="mt-4 text-3xl font-bold">{course.title}</h1>
              <p className="mt-2 text-lg text-muted-foreground">
                {course.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{course.estimatedHours} {t('progress.timeSpent', 'hours')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  <span>{courseModules.length} {t('module.modules')}</span>
                </div>
                {course.certificationEnabled && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <Award className="h-4 w-4" />
                    <span>{t('certification.title')}</span>
                  </div>
                )}
              </div>
            </div>

            {course.imageUrl && (
              <div className="w-full md:w-64">
                <img
                  src={course.imageUrl}
                  alt={course.title}
                  className="rounded-lg object-cover"
                />
              </div>
            )}
          </div>

          {/* Progress or Enroll */}
          <div className="mt-6">
            {isCompleted ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{t('course.completed')}</span>
                </div>
                {course.certificationEnabled && (
                  <Button variant="outline" asChild>
                    <a href={`/training/certifications?course=${course.id}`}>
                      <Award className="mr-2 h-4 w-4" />
                      {t('course.viewCertificate')}
                    </a>
                  </Button>
                )}
              </div>
            ) : isEnrolled ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('lesson.progress', {
                      completed: progress.lessonsCompleted,
                      total: progress.totalLessons,
                    })}
                  </span>
                  <span className="font-medium">{progress.percentComplete}%</span>
                </div>
                <Progress value={progress.percentComplete} className="h-2" />
                <Button className="mt-4">
                  <Play className="mr-2 h-4 w-4" />
                  {t('course.continue')}
                </Button>
              </div>
            ) : (
              <Button size="lg" onClick={handleEnroll}>
                <Play className="mr-2 h-4 w-4" />
                {t('course.start')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="mx-auto max-w-5xl p-6">
        <h2 className="mb-4 text-xl font-semibold">{t('module.modules')}</h2>

        <div className="space-y-4">
          {courseModules.map((module, moduleIndex) => (
            <ModuleCard
              key={module.id}
              module={module}
              moduleIndex={moduleIndex}
              lessons={lessons.get(module.id) || []}
              lessonProgress={lessonProgress}
              isExpanded={expandedModules.has(module.id)}
              onToggle={() => toggleModule(module.id)}
              isEnrolled={isEnrolled}
            />
          ))}
        </div>

        {courseModules.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">{t('module.empty')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('module.addFirst')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface ModuleCardProps {
  module: TrainingModule;
  moduleIndex: number;
  lessons: Lesson[];
  lessonProgress: Map<string, LessonProgress>;
  isExpanded: boolean;
  onToggle: () => void;
  isEnrolled: boolean;
}

function ModuleCard({
  module,
  moduleIndex,
  lessons,
  lessonProgress,
  isExpanded,
  onToggle,
  isEnrolled,
}: ModuleCardProps) {
  const { t } = useTranslation('training');

  const completedLessons = lessons.filter(l => {
    const key = `${l.id}:${/* pubkey */ ''}`;
    const progress = lessonProgress.get(key);
    return progress?.status === 'completed';
  }).length;

  const allCompleted = completedLessons === lessons.length && lessons.length > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className={cn(allCompleted && 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20')}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  allCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {allCompleted ? <CheckCircle className="h-4 w-4" /> : moduleIndex + 1}
                </div>
                <div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  {module.description && (
                    <CardDescription>{module.description}</CardDescription>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {completedLessons}/{lessons.length} {t('lesson.lessons')}
                </span>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2 border-t pt-4">
              {lessons.map((lesson, lessonIndex) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  lessonIndex={lessonIndex}
                  progress={lessonProgress.get(`${lesson.id}:`)}
                  isEnrolled={isEnrolled}
                />
              ))}
              {lessons.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t('empty.noLessons')}
                </p>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface LessonRowProps {
  lesson: Lesson;
  lessonIndex: number;
  progress?: LessonProgress;
  isEnrolled: boolean;
}

function LessonRow({ lesson, lessonIndex, progress, isEnrolled }: LessonRowProps) {
  const { t } = useTranslation('training');
  const Icon = LESSON_ICONS[lesson.type] || FileText;
  const isCompleted = progress?.status === 'completed';
  const isInProgress = progress?.status === 'in-progress';

  return (
    <a
      href={isEnrolled ? `/training/lesson/${lesson.id}` : '#'}
      className={cn(
        'flex items-center gap-3 rounded-lg p-3 transition-colors',
        isEnrolled
          ? 'hover:bg-muted cursor-pointer'
          : 'cursor-not-allowed opacity-60'
      )}
    >
      <div className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full',
        isCompleted
          ? 'bg-green-500 text-white'
          : isInProgress
          ? 'bg-blue-500 text-white'
          : 'bg-muted text-muted-foreground'
      )}>
        {isCompleted ? (
          <CheckCircle className="h-4 w-4" />
        ) : isInProgress ? (
          <Play className="h-4 w-4" />
        ) : !isEnrolled ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className={cn(
            'font-medium truncate',
            isCompleted && 'text-muted-foreground'
          )}>
            {lesson.title}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t(`lessonType.${lesson.type}`)}</span>
          <span>·</span>
          <span>{t('lesson.duration', { minutes: lesson.estimatedMinutes })}</span>
          {lesson.requiredForCertification && (
            <>
              <span>·</span>
              <span className="text-amber-600">{t('lesson.required')}</span>
            </>
          )}
        </div>
      </div>

      {isCompleted && progress?.score !== undefined && (
        <Badge variant="secondary">{progress.score}%</Badge>
      )}

      {isEnrolled && (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </a>
  );
}

function CourseDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl p-6">
          <Skeleton className="h-10 w-24 mb-4" />
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="mt-4 h-10 w-2/3" />
              <Skeleton className="mt-2 h-6 w-full" />
              <Skeleton className="mt-1 h-6 w-3/4" />
              <div className="mt-4 flex gap-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
            <Skeleton className="h-48 w-64 rounded-lg" />
          </div>
          <Skeleton className="mt-6 h-10 w-40" />
        </div>
      </div>
      <div className="mx-auto max-w-5xl p-6">
        <Skeleton className="h-8 w-32 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="mt-1 h-4 w-32" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
