/**
 * Trainer Dashboard Component
 * Analytics and management for course trainers
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrainingStore } from '../trainingStore';
import {
  Users,
  Award,
  TrendingUp,
  BarChart3,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { CourseStats } from '../types';

export function TrainerDashboard() {
  const { t } = useTranslation('training');
  const {
    courses,
    isLoading,
    loadCourses,
    getCourseStats,
  } = useTrainingStore();

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [, setLoadingStats] = useState(false);

  useEffect(() => {
    loadCourses({ includePublic: false });
  }, [loadCourses]);

  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (selectedCourseId) {
      setLoadingStats(true);
      getCourseStats(selectedCourseId)
        .then(setStats)
        .finally(() => setLoadingStats(false));
    }
  }, [selectedCourseId, getCourseStats]);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  if (isLoading) {
    return <TrainerDashboardSkeleton />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('trainer.dashboard')}</h1>
          <p className="text-muted-foreground">
            Manage and monitor your training courses
          </p>
        </div>

        <Select
          value={selectedCourseId || ''}
          onValueChange={setSelectedCourseId}
        >
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map(course => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCourse && stats && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t('trainer.enrollments')}
              value={stats.enrolledCount}
              icon={Users}
              trend="+12%"
              trendUp
            />
            <StatsCard
              title={t('trainer.completions')}
              value={stats.completedCount}
              icon={CheckCircle}
              subtitle={`${Math.round((stats.completedCount / Math.max(stats.enrolledCount, 1)) * 100)}% completion rate`}
            />
            <StatsCard
              title={t('trainer.avgProgress')}
              value={`${stats.averageProgress}%`}
              icon={TrendingUp}
            />
            <StatsCard
              title={t('trainer.avgScore')}
              value={`${stats.averageQuizScore}%`}
              icon={BarChart3}
            />
          </div>

          {/* Course Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t('trainer.courseStats')}</CardTitle>
                <CardDescription>{selectedCourse.title}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Enrollments</span>
                      <span className="font-medium">{stats.enrolledCount}</span>
                    </div>
                    <Progress value={100} className="mt-2 h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Completions</span>
                      <span className="font-medium">{stats.completedCount}</span>
                    </div>
                    <Progress
                      value={(stats.completedCount / Math.max(stats.enrolledCount, 1)) * 100}
                      className="mt-2 h-2"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Certifications Awarded</span>
                      <span className="font-medium">{stats.certificationCount}</span>
                    </div>
                    <Progress
                      value={(stats.certificationCount / Math.max(stats.completedCount, 1)) * 100}
                      className="mt-2 h-2"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Average Completion Time</span>
                      <span className="font-medium">{stats.averageCompletionTime} hours</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Course Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <Badge variant="secondary">
                    {t(`category.${selectedCourse.category}`)}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Difficulty</p>
                  <Badge variant="outline">
                    {t(`difficulty.${selectedCourse.difficulty}`)}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Estimated Time</p>
                  <p className="font-medium">{selectedCourse.estimatedHours} hours</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={selectedCourse.status === 'published' ? 'default' : 'secondary'}>
                    {t(`status.${selectedCourse.status}`)}
                  </Badge>
                </div>

                {selectedCourse.certificationEnabled && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Award className="h-4 w-4" />
                    <span className="text-sm">Certification enabled</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabs for detailed views */}
          <Tabs defaultValue="reviews" className="w-full">
            <TabsList>
              <TabsTrigger value="reviews">
                {t('trainer.pendingReviews')}
              </TabsTrigger>
              <TabsTrigger value="activity">
                {t('trainer.recentActivity')}
              </TabsTrigger>
              <TabsTrigger value="performers">
                {t('trainer.topPerformers')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reviews" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('trainer.pendingReviews')}</CardTitle>
                  <CardDescription>
                    Assignment submissions awaiting your review
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PendingReviewsList courseId={selectedCourse.id} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('trainer.recentActivity')}</CardTitle>
                  <CardDescription>
                    Recent learner activity in this course
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentActivityList courseId={selectedCourse.id} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performers" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('trainer.topPerformers')}</CardTitle>
                  <CardDescription>
                    Learners with the highest progress and scores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TopPerformersList courseId={selectedCourse.id} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!selectedCourse && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No courses yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first course to see analytics
            </p>
            <Button className="mt-4" asChild>
              <a href="/training/courses/new">{t('course.create')}</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
}

function StatsCard({ title, value, icon: Icon, trend, trendUp, subtitle }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {trend && (
            <Badge variant={trendUp ? 'default' : 'secondary'} className={cn(
              trendUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            )}>
              {trend}
            </Badge>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PendingReviewsList({ courseId: _courseId }: { courseId: string }) {
  // This would fetch pending assignment submissions
  const pendingReviews = [
    { id: '1', learner: 'Alice', lesson: 'Threat Modeling Exercise', submittedAt: Date.now() - 3600000 },
    { id: '2', learner: 'Bob', lesson: 'Security Audit Report', submittedAt: Date.now() - 7200000 },
  ];

  if (pendingReviews.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No pending reviews
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {pendingReviews.map(review => (
        <div
          key={review.id}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900">
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-medium">{review.lesson}</p>
              <p className="text-sm text-muted-foreground">
                By {review.learner} · {new Date(review.submittedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <Button size="sm">
            Review
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function RecentActivityList({ courseId: _courseId }: { courseId: string }) {
  // This would fetch recent activity
  const activities = [
    { id: '1', type: 'completed', learner: 'Alice', lesson: 'Understanding Encryption', timestamp: Date.now() - 1800000 },
    { id: '2', type: 'started', learner: 'Bob', lesson: 'VPNs and Tor', timestamp: Date.now() - 3600000 },
    { id: '3', type: 'quiz_passed', learner: 'Charlie', lesson: 'Digital Security Quiz', score: 85, timestamp: Date.now() - 5400000 },
    { id: '4', type: 'enrolled', learner: 'Diana', timestamp: Date.now() - 7200000 },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'started':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'quiz_passed':
        return <Award className="h-4 w-4 text-amber-600" />;
      case 'enrolled':
        return <Users className="h-4 w-4 text-purple-600" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getActivityText = (activity: typeof activities[0]) => {
    switch (activity.type) {
      case 'completed':
        return `${activity.learner} completed "${activity.lesson}"`;
      case 'started':
        return `${activity.learner} started "${activity.lesson}"`;
      case 'quiz_passed':
        return `${activity.learner} passed quiz with ${activity.score}%`;
      case 'enrolled':
        return `${activity.learner} enrolled in the course`;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {activities.map(activity => (
        <div
          key={activity.id}
          className="flex items-center gap-4 rounded-lg border p-4"
        >
          <div className="rounded-full bg-muted p-2">
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1">
            <p className="text-sm">{getActivityText(activity)}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(activity.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopPerformersList({ courseId: _courseId }: { courseId: string }) {
  // This would fetch top performers
  const performers = [
    { id: '1', name: 'Alice', progress: 100, avgScore: 95 },
    { id: '2', name: 'Bob', progress: 85, avgScore: 88 },
    { id: '3', name: 'Charlie', progress: 70, avgScore: 82 },
    { id: '4', name: 'Diana', progress: 60, avgScore: 78 },
    { id: '5', name: 'Eve', progress: 50, avgScore: 75 },
  ];

  return (
    <div className="space-y-4">
      {performers.map((performer, index) => (
        <div
          key={performer.id}
          className="flex items-center gap-4 rounded-lg border p-4"
        >
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full font-medium',
            index === 0 ? 'bg-amber-100 text-amber-800' :
            index === 1 ? 'bg-slate-100 text-slate-800' :
            index === 2 ? 'bg-orange-100 text-orange-800' :
            'bg-muted text-muted-foreground'
          )}>
            {index + 1}
          </div>
          <div className="flex-1">
            <p className="font-medium">{performer.name}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Progress: {performer.progress}%</span>
              <span>Avg Score: {performer.avgScore}%</span>
            </div>
          </div>
          <Progress value={performer.progress} className="w-24 h-2" />
        </div>
      ))}
    </div>
  );
}

function TrainerDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-64" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="mt-4 h-8 w-16" />
              <Skeleton className="mt-2 h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
