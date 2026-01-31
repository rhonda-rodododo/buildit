/**
 * Certifications View Component
 * Displays earned certifications and verification
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrainingStore } from '../trainingStore';
import {
  Award,
  Calendar,
  Clock,
  XCircle,
  AlertTriangle,
  Search,
  Download,
  Share2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Certification, Course } from '../types';

export function CertificationsView() {
  const { t } = useTranslation('training');
  const {
    certifications,
    courses,
    isLoading,
    loadCertifications,
    loadCourses,
    verifyCertification,
  } = useTrainingStore();

  const [verificationCode, setVerificationCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    certification?: Certification;
    course?: Course;
    error?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    loadCertifications();
    loadCourses({ status: 'published', includePublic: true });
  }, [loadCertifications, loadCourses]);

  const handleVerify = async () => {
    if (!verificationCode.trim()) return;

    setIsVerifying(true);
    try {
      const result = await verifyCertification(verificationCode.trim());
      if (result) {
        const course = courses.find(c => c.id === result.courseId);
        setVerificationResult({ valid: true, certification: result, course });
      } else {
        setVerificationResult({ valid: false, error: t('certification.invalid') });
      }
    } catch (error) {
      setVerificationResult({ valid: false, error: t('errors.verifyCertification') });
    } finally {
      setIsVerifying(false);
    }
  };

  const activeCertifications = certifications.filter(c => !c.revokedAt);
  const expiredCertifications = certifications.filter(
    c => c.expiresAt && c.expiresAt < Date.now() && !c.revokedAt
  );
  const expiringSoonCertifications = activeCertifications.filter(c => {
    if (!c.expiresAt) return false;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return c.expiresAt > Date.now() && c.expiresAt < Date.now() + thirtyDays;
  });

  if (isLoading) {
    return <CertificationsViewSkeleton />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('certification.certifications')}</h1>
          <p className="text-muted-foreground">
            {activeCertifications.length} {t('certification.certifications').toLowerCase()}
          </p>
        </div>
      </div>

      {/* Expiring Soon Alert */}
      {expiringSoonCertifications.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {t('certification.expiringSoon')}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {expiringSoonCertifications.length} certification(s) expiring within 30 days
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="my-certs" className="w-full">
        <TabsList>
          <TabsTrigger value="my-certs">
            {t('certification.certifications')} ({activeCertifications.length})
          </TabsTrigger>
          <TabsTrigger value="verify">
            {t('certification.verify')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-certs" className="mt-4">
          {activeCertifications.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeCertifications.map(cert => (
                <CertificationCard
                  key={cert.id}
                  certification={cert}
                  course={courses.find(c => c.id === cert.courseId)}
                />
              ))}
            </div>
          )}

          {expiredCertifications.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
                {t('certification.expired')} ({expiredCertifications.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {expiredCertifications.map(cert => (
                  <CertificationCard
                    key={cert.id}
                    certification={cert}
                    course={courses.find(c => c.id === cert.courseId)}
                    expired
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="verify" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('certification.verify')}</CardTitle>
              <CardDescription>
                Enter a verification code to validate a certification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('certification.verificationCode')}
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.toUpperCase())}
                    className="pl-10 font-mono uppercase"
                  />
                </div>
                <Button onClick={handleVerify} disabled={isVerifying || !verificationCode.trim()}>
                  {isVerifying ? 'Verifying...' : t('certification.verify')}
                </Button>
              </div>

              {verificationResult && (
                <div className="mt-6">
                  {verificationResult.valid ? (
                    <VerificationSuccess
                      certification={verificationResult.certification!}
                      course={verificationResult.course}
                    />
                  ) : (
                    <VerificationFailure error={verificationResult.error} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface CertificationCardProps {
  certification: Certification;
  course?: Course;
  expired?: boolean;
}

function CertificationCard({ certification, course, expired }: CertificationCardProps) {
  const { t } = useTranslation('training');

  const isExpiringSoon = certification.expiresAt &&
    certification.expiresAt > Date.now() &&
    certification.expiresAt < Date.now() + 30 * 24 * 60 * 60 * 1000;

  return (
    <Card className={cn(
      expired && 'opacity-60',
      isExpiringSoon && 'border-amber-200 dark:border-amber-900'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className={cn(
            'rounded-full p-2',
            expired ? 'bg-muted' : 'bg-amber-100 dark:bg-amber-900'
          )}>
            <Award className={cn(
              'h-6 w-6',
              expired ? 'text-muted-foreground' : 'text-amber-600'
            )} />
          </div>
          {expired ? (
            <Badge variant="destructive">{t('certification.expired')}</Badge>
          ) : isExpiringSoon ? (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              {t('certification.expiringSoon')}
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {t('certification.verified')}
            </Badge>
          )}
        </div>
        <CardTitle className="mt-2">{course?.title || 'Unknown Course'}</CardTitle>
        <CardDescription>
          {course?.category && t(`category.${course.category}`)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {t('certification.earned')}: {new Date(certification.earnedAt).toLocaleDateString()}
            </span>
          </div>
          {certification.expiresAt && (
            <div className={cn(
              'flex items-center gap-2',
              expired ? 'text-destructive' : isExpiringSoon ? 'text-amber-600' : 'text-muted-foreground'
            )}>
              <Clock className="h-4 w-4" />
              <span>
                {t('certification.expires')}: {new Date(certification.expiresAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <ExternalLink className="mr-2 h-3 w-3" />
                View
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <CertificationDetail certification={certification} course={course} />
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface CertificationDetailProps {
  certification: Certification;
  course?: Course;
}

function CertificationDetail({ certification, course }: CertificationDetailProps) {
  const { t } = useTranslation('training');

  return (
    <>
      <DialogHeader className="text-center">
        <div className="mx-auto mb-4 rounded-full bg-amber-100 p-4 dark:bg-amber-900">
          <Award className="h-12 w-12 text-amber-600" />
        </div>
        <DialogTitle className="text-xl">{course?.title}</DialogTitle>
        <DialogDescription>
          Certificate of Completion
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-center">
        <div className="rounded-lg bg-muted p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {t('certification.verificationCode')}
          </p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wider">
            {certification.verificationCode}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t('certification.earned')}</p>
            <p className="font-medium">
              {new Date(certification.earnedAt).toLocaleDateString()}
            </p>
          </div>
          {certification.expiresAt && (
            <div>
              <p className="text-muted-foreground">{t('certification.expires')}</p>
              <p className="font-medium">
                {new Date(certification.expiresAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button className="flex-1" variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t('certification.download')}
          </Button>
          <Button className="flex-1">
            <Share2 className="mr-2 h-4 w-4" />
            {t('certification.share')}
          </Button>
        </div>
      </div>
    </>
  );
}

interface VerificationSuccessProps {
  certification: Certification;
  course?: Course;
}

function VerificationSuccess({ certification, course }: VerificationSuccessProps) {
  const { t } = useTranslation('training');

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/20">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
          <ShieldCheck className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-green-800 dark:text-green-200">
            {t('certification.verified')}
          </h3>
          <p className="mt-1 text-green-700 dark:text-green-300">
            This certification is valid and authentic.
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-medium">Course:</span> {course?.title || 'Unknown'}
            </p>
            <p>
              <span className="font-medium">{t('certification.earned')}:</span>{' '}
              {new Date(certification.earnedAt).toLocaleDateString()}
            </p>
            {certification.expiresAt && (
              <p>
                <span className="font-medium">{t('certification.expires')}:</span>{' '}
                {new Date(certification.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerificationFailure({ error }: { error?: string }) {
  const { t } = useTranslation('training');

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-red-100 p-2 dark:bg-red-900">
          <XCircle className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h3 className="font-semibold text-red-800 dark:text-red-200">
            {t('certification.invalid')}
          </h3>
          <p className="mt-1 text-red-700 dark:text-red-300">
            {error || 'This verification code is not valid.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation('training');

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <Award className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-medium">{t('certification.noCertifications')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('certification.complete')}</p>
        <Button className="mt-4" asChild>
          <a href="/training/courses">Browse Courses</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function CertificationsViewSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="mt-2 h-6 w-32" />
              <Skeleton className="mt-1 h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
