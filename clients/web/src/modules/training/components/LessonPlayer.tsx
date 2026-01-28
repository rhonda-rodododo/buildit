/**
 * Lesson Player Component
 * Displays and manages different lesson types
 */

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrainingStore } from '../trainingStore';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  Video,
  HelpCircle,
  PenTool,
  Radio,
  Gamepad2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Award,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  Lesson,
  LessonProgress,
  TrainingModule,
  Course,
  QuizContent,
  QuizQuestion,
  QuizAnswer,
  DocumentContent,
  VideoContent,
  LiveSessionContent,
} from '../types';

export function LessonPlayer() {
  const { t } = useTranslation('training');
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const {
    modules,
    lessons,
    lessonProgress,
    startLesson,
    updateLessonProgress,
    completeLesson,
    startQuizAttempt,
    submitQuizAttempt,
  } = useTrainingStore();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [adjacentLessons, setAdjacentLessons] = useState<{
    prev?: Lesson;
    next?: Lesson;
  }>({});

  // Timer for tracking time spent
  const startTimeRef = useRef<number>(Date.now());
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!lessonId) return;

    // Find lesson across all loaded modules
    let foundLesson: Lesson | null = null;
    let foundModule: TrainingModule | null = null;

    for (const [moduleId, moduleLessons] of lessons) {
      const l = moduleLessons.find(ls => ls.id === lessonId);
      if (l) {
        foundLesson = l;
        // Find the module
        for (const [, mods] of modules) {
          const m = mods.find(mod => mod.id === moduleId);
          if (m) {
            foundModule = m;
            break;
          }
        }
        break;
      }
    }

    setLesson(foundLesson);
    setModule(foundModule);

    // Find adjacent lessons
    if (foundModule) {
      const moduleLessons = lessons.get(foundModule.id) || [];
      const currentIndex = moduleLessons.findIndex(l => l.id === lessonId);
      setAdjacentLessons({
        prev: currentIndex > 0 ? moduleLessons[currentIndex - 1] : undefined,
        next: currentIndex < moduleLessons.length - 1 ? moduleLessons[currentIndex + 1] : undefined,
      });
    }

    // Start lesson tracking
    startLesson(lessonId);
    startTimeRef.current = Date.now();

    // Periodic progress updates
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastUpdateRef.current) / 1000);
      if (elapsed >= 30) {
        updateLessonProgress(lessonId, elapsed);
        lastUpdateRef.current = now;
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      // Final update on unmount
      const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000);
      if (elapsed > 0) {
        updateLessonProgress(lessonId, elapsed);
      }
    };
  }, [lessonId, lessons, modules, startLesson, updateLessonProgress]);

  useEffect(() => {
    if (lessonId) {
      const key = `${lessonId}:`;
      setProgress(lessonProgress.get(key) || null);
    }
  }, [lessonId, lessonProgress]);

  const handleComplete = async () => {
    if (!lessonId) return;
    await completeLesson(lessonId);
    if (adjacentLessons.next) {
      navigate(`/training/lesson/${adjacentLessons.next.id}`);
    }
  };

  if (!lesson) {
    return <LessonPlayerSkeleton />;
  }

  const isCompleted = progress?.status === 'completed';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-4xl p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild>
              <a href={`/training/course/${module?.courseId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('course.courses')}
              </a>
            </Button>

            <div className="flex items-center gap-2">
              {isCompleted && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {t('lesson.completed')}
                </Badge>
              )}
              <Badge variant="outline">
                {t(`lessonType.${lesson.type}`)}
              </Badge>
            </div>
          </div>

          <h1 className="mt-4 text-2xl font-bold">{lesson.title}</h1>
          {lesson.description && (
            <p className="mt-1 text-muted-foreground">{lesson.description}</p>
          )}

          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{t('lesson.duration', { minutes: lesson.estimatedMinutes })}</span>
            </div>
            {lesson.requiredForCertification && (
              <div className="flex items-center gap-1 text-amber-600">
                <Award className="h-4 w-4" />
                <span>{t('lesson.required')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl p-6">
        <LessonContent
          lesson={lesson}
          onComplete={handleComplete}
          isCompleted={isCompleted}
          progress={progress}
        />
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
          <Button
            variant="ghost"
            disabled={!adjacentLessons.prev}
            onClick={() => adjacentLessons.prev && navigate(`/training/lesson/${adjacentLessons.prev.id}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('lesson.previous')}
          </Button>

          {!isCompleted && lesson.type !== 'quiz' && (
            <Button onClick={handleComplete}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {t('lesson.complete')}
            </Button>
          )}

          <Button
            variant="ghost"
            disabled={!adjacentLessons.next}
            onClick={() => adjacentLessons.next && navigate(`/training/lesson/${adjacentLessons.next.id}`)}
          >
            {t('lesson.next')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LessonContentProps {
  lesson: Lesson;
  onComplete: () => void;
  isCompleted: boolean;
  progress: LessonProgress | null;
}

function LessonContent({ lesson, onComplete, isCompleted, progress }: LessonContentProps) {
  switch (lesson.type) {
    case 'document':
      return <DocumentLesson content={lesson.content as DocumentContent} />;
    case 'video':
      return <VideoLesson content={lesson.content as VideoContent} />;
    case 'quiz':
      return (
        <QuizLesson
          content={lesson.content as QuizContent}
          lessonId={lesson.id}
          passingScore={lesson.passingScore || 70}
          isCompleted={isCompleted}
          previousScore={progress?.score}
        />
      );
    case 'live-session':
      return <LiveSessionLesson content={lesson.content as LiveSessionContent} />;
    default:
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              This lesson type is not yet supported.
            </p>
          </CardContent>
        </Card>
      );
  }
}

function DocumentLesson({ content }: { content: DocumentContent }) {
  if (content.pdfUrl) {
    return (
      <Card>
        <CardContent className="p-0">
          <iframe
            src={content.pdfUrl}
            className="h-[70vh] w-full rounded-lg"
            title="PDF Document"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="prose prose-slate dark:prose-invert max-w-none p-6">
        <div dangerouslySetInnerHTML={{ __html: content.markdown || '' }} />
      </CardContent>
    </Card>
  );
}

function VideoLesson({ content }: { content: VideoContent }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  if (!content.videoUrl) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Video className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Video content coming soon</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={content.videoUrl}
            className="h-full w-full"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Video Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>

              <div className="flex-1" />

              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleFullscreen}
              >
                <Maximize className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuizLessonProps {
  content: QuizContent;
  lessonId: string;
  passingScore: number;
  isCompleted: boolean;
  previousScore?: number;
}

function QuizLesson({ content, lessonId, passingScore, isCompleted, previousScore }: QuizLessonProps) {
  const { t } = useTranslation('training');
  const { submitQuizAttempt, completeLesson } = useTrainingStore();

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string | string[]>>(new Map());
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);

  const questions = content.shuffleQuestions
    ? [...content.questions].sort(() => Math.random() - 0.5)
    : content.questions;

  const handleAnswer = (questionId: string, answer: string | string[]) => {
    setAnswers(new Map(answers.set(questionId, answer)));
  };

  const handleSubmit = async () => {
    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;
    const quizAnswers: QuizAnswer[] = [];

    for (const question of content.questions) {
      totalPoints += question.points;
      const userAnswer = answers.get(question.id);
      const isCorrect = Array.isArray(question.correctAnswer)
        ? JSON.stringify(userAnswer?.sort()) === JSON.stringify([...question.correctAnswer].sort())
        : userAnswer === question.correctAnswer;

      if (isCorrect) {
        earnedPoints += question.points;
      }

      quizAnswers.push({
        questionId: question.id,
        selectedAnswer: userAnswer || '',
        isCorrect,
        points: isCorrect ? question.points : 0,
      });
    }

    const calculatedScore = Math.round((earnedPoints / totalPoints) * 100);
    setScore(calculatedScore);
    setShowResults(true);

    // If passed, complete the lesson
    if (calculatedScore >= passingScore) {
      await completeLesson(lessonId, calculatedScore);
    }
  };

  if (!quizStarted && !isCompleted) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t('quiz.title')}</CardTitle>
          <CardDescription>
            {content.questions.length} {t('quiz.question', { current: '', total: '' }).replace(' of ', ' ')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t('quiz.passingScore')}: {passingScore}%</p>
            {content.allowRetakes && content.maxAttempts && (
              <p>{t('quiz.attemptsRemaining', { count: content.maxAttempts })}</p>
            )}
            {content.timeLimitMinutes && (
              <p>{t('quiz.timeLimit')}: {content.timeLimitMinutes} min</p>
            )}
          </div>
          <Button className="mt-6" onClick={() => setQuizStarted(true)}>
            {t('quiz.start')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showResults || isCompleted) {
    const finalScore = score ?? previousScore ?? 0;
    const passed = finalScore >= passingScore;

    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className={passed ? 'text-green-600' : 'text-red-600'}>
            {passed ? t('quiz.passed') : t('quiz.failed')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-4xl font-bold">{finalScore}%</div>
          <p className="mt-2 text-muted-foreground">
            {t('quiz.passingScore')}: {passingScore}%
          </p>

          {!passed && content.allowRetakes && (
            <Button
              className="mt-6"
              onClick={() => {
                setShowResults(false);
                setScore(null);
                setAnswers(new Map());
                setCurrentQuestion(0);
              }}
            >
              {t('quiz.retake')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const question = questions[currentQuestion];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="outline">
            {t('quiz.question', { current: currentQuestion + 1, total: questions.length })}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {question.points} pts
          </span>
        </div>
        <Progress value={((currentQuestion + 1) / questions.length) * 100} className="mt-2 h-1" />
      </CardHeader>
      <CardContent>
        <h3 className="text-lg font-medium">{question.question}</h3>

        <div className="mt-4">
          {question.type === 'multiple-choice' || question.type === 'true-false' ? (
            <RadioGroup
              value={answers.get(question.id) as string || ''}
              onValueChange={v => handleAnswer(question.id, v)}
            >
              {question.options?.map((option, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`option-${i}`} />
                  <Label htmlFor={`option-${i}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          ) : question.type === 'multi-select' ? (
            <div className="space-y-2">
              {question.options?.map((option, i) => {
                const selected = (answers.get(question.id) as string[]) || [];
                return (
                  <div key={i} className="flex items-center space-x-2">
                    <Checkbox
                      id={`option-${i}`}
                      checked={selected.includes(option)}
                      onCheckedChange={checked => {
                        const newSelected = checked
                          ? [...selected, option]
                          : selected.filter(s => s !== option);
                        handleAnswer(question.id, newSelected);
                      }}
                    />
                    <Label htmlFor={`option-${i}`}>{option}</Label>
                  </div>
                );
              })}
            </div>
          ) : (
            <Textarea
              placeholder="Your answer..."
              value={answers.get(question.id) as string || ''}
              onChange={e => handleAnswer(question.id, e.target.value)}
            />
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={currentQuestion === 0}
            onClick={() => setCurrentQuestion(currentQuestion - 1)}
          >
            Previous
          </Button>

          {currentQuestion < questions.length - 1 ? (
            <Button
              disabled={!answers.has(question.id)}
              onClick={() => setCurrentQuestion(currentQuestion + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              disabled={answers.size < questions.length}
              onClick={handleSubmit}
            >
              {t('quiz.submit')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LiveSessionLesson({ content }: { content: LiveSessionContent }) {
  const { t } = useTranslation('training');
  const { rsvpLiveSession } = useTrainingStore();
  const [rsvpStatus, setRsvpStatus] = useState<'confirmed' | 'tentative' | 'declined' | null>(null);

  const isUpcoming = content.scheduledAt > Date.now();
  const sessionDate = new Date(content.scheduledAt);

  const handleRSVP = async (status: 'confirmed' | 'tentative' | 'declined') => {
    // This would need the lessonId passed in
    setRsvpStatus(status);
  };

  if (content.recordingUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('liveSession.recording')}</CardTitle>
          <CardDescription>
            Session from {sessionDate.toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-black rounded-lg">
            <video
              src={content.recordingUrl}
              controls
              className="h-full w-full rounded-lg"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('liveSession.title')}</CardTitle>
        <CardDescription>
          {isUpcoming ? t('liveSession.scheduled') : t('liveSession.ended')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-muted p-3">
              <Radio className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">
                {sessionDate.toLocaleDateString()} at {sessionDate.toLocaleTimeString()}
              </p>
              <p className="text-sm text-muted-foreground">
                {content.duration} minutes
              </p>
            </div>
          </div>

          {isUpcoming && content.requiresRSVP && (
            <div className="flex gap-2">
              <Button
                variant={rsvpStatus === 'confirmed' ? 'default' : 'outline'}
                onClick={() => handleRSVP('confirmed')}
              >
                {t('liveSession.rsvpConfirmed')}
              </Button>
              <Button
                variant={rsvpStatus === 'tentative' ? 'default' : 'outline'}
                onClick={() => handleRSVP('tentative')}
              >
                {t('liveSession.rsvpTentative')}
              </Button>
              <Button
                variant={rsvpStatus === 'declined' ? 'destructive' : 'outline'}
                onClick={() => handleRSVP('declined')}
              >
                {t('liveSession.rsvpDeclined')}
              </Button>
            </div>
          )}

          {isUpcoming && content.conferenceRoomId && (
            <Button className="w-full" asChild>
              <a href={`/conference/${content.conferenceRoomId}`}>
                {t('liveSession.join')}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LessonPlayerSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-4xl p-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-4 h-8 w-2/3" />
          <Skeleton className="mt-2 h-5 w-1/2" />
        </div>
      </div>
      <div className="mx-auto max-w-4xl p-6">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
