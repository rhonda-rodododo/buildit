/**
 * Course List Component
 * Displays all available courses with filtering and search
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrainingStore } from '../trainingStore';
import {
  BookOpen,
  Search,
  Filter,
  Award,
  Clock,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Course, CourseCategory, CourseDifficulty, CourseQueryOptions } from '../types';

const CATEGORIES: CourseCategory[] = [
  'app-basics',
  'opsec',
  'digital-security',
  'legal',
  'medic',
  'self-defense',
  'organizing',
  'communication',
  'civil-defense',
  'custom',
];

const DIFFICULTIES: CourseDifficulty[] = ['beginner', 'intermediate', 'advanced'];

export function CourseList() {
  const { t } = useTranslation('training');
  const { courses, isLoading, error, loadCourses } = useTrainingStore();

  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<CourseCategory[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<CourseDifficulty | 'all'>('all');
  const [sortBy, setSortBy] = useState<CourseQueryOptions['sortBy']>('title');

  useEffect(() => {
    loadCourses({
      status: 'published',
      includePublic: true,
      search: search || undefined,
      category: selectedCategories.length === 1 ? selectedCategories[0] : undefined,
      difficulty: selectedDifficulty !== 'all' ? selectedDifficulty : undefined,
      sortBy,
    });
  }, [loadCourses, search, selectedCategories, selectedDifficulty, sortBy]);

  const toggleCategory = (category: CourseCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const filteredCourses = courses.filter(course => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(course.category)) {
      return false;
    }
    return true;
  });

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
          <h1 className="text-2xl font-bold">{t('course.courses')}</h1>
          <p className="text-muted-foreground">
            {filteredCourses.length} {t('course.courses').toLowerCase()}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t('course.create')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('actions.search', 'Search...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              {t('form.category')}
              {selectedCategories.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedCategories.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {CATEGORIES.map(category => (
              <DropdownMenuCheckboxItem
                key={category}
                checked={selectedCategories.includes(category)}
                onCheckedChange={() => toggleCategory(category)}
              >
                {t(`category.${category}`)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select
          value={selectedDifficulty}
          onValueChange={v => setSelectedDifficulty(v as CourseDifficulty | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('form.difficulty')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('form.difficulty')}</SelectItem>
            {DIFFICULTIES.map(diff => (
              <SelectItem key={diff} value={diff}>
                {t(`difficulty.${diff}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={v => setSortBy(v as CourseQueryOptions['sortBy'])}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="created">Newest</SelectItem>
            <SelectItem value="difficulty">Difficulty</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCategories.map(category => (
            <Badge
              key={category}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleCategory(category)}
            >
              {t(`category.${category}`)}
              <span className="ml-1">&times;</span>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCategories([])}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Course Grid */}
      {isLoading ? (
        <CourseListSkeleton />
      ) : filteredCourses.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map(course => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}

interface CourseCardProps {
  course: Course;
}

function CourseCard({ course }: CourseCardProps) {
  const { t } = useTranslation('training');

  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  };

  return (
    <Card className="group cursor-pointer transition-all hover:shadow-md">
      <a href={`/training/course/${course.id}`}>
        {course.imageUrl && (
          <div className="aspect-video overflow-hidden rounded-t-lg">
            <img
              src={course.imageUrl}
              alt={course.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <Badge variant="secondary">{t(`category.${course.category}`)}</Badge>
            <Badge className={difficultyColors[course.difficulty]}>
              {t(`difficulty.${course.difficulty}`)}
            </Badge>
          </div>
          <CardTitle className="mt-2 line-clamp-2 text-lg">{course.title}</CardTitle>
          <CardDescription className="line-clamp-2">
            {course.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                {course.estimatedHours}h
              </span>
            </div>
            {course.certificationEnabled && (
              <div className="flex items-center gap-1 text-amber-600">
                <Award className="h-4 w-4" />
                <span>{t('certification.title')}</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            {course.isPublic && (
              <Badge variant="outline">{t('course.public')}</Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardContent>
      </a>
    </Card>
  );
}

function EmptyState() {
  const { t } = useTranslation('training');

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-medium">{t('empty.noCourses')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t('empty.createFirst')}</p>
      <Button className="mt-4">
        <Plus className="mr-2 h-4 w-4" />
        {t('course.create')}
      </Button>
    </div>
  );
}

function CourseListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <Skeleton className="aspect-video rounded-t-lg" />
          <CardHeader>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="mt-2 h-6 w-full" />
            <Skeleton className="mt-1 h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
