/**
 * RecoveryPhraseSetup Component
 * Mandatory recovery phrase display and verification during account creation.
 * Users must verify they have saved their recovery phrase before accessing the app.
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Shield,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface RecoveryPhraseSetupProps {
  /** The recovery phrase to display (derived from private key) */
  recoveryPhrase: string;
  /** Called when user has successfully verified their recovery phrase */
  onComplete: () => void;
  /** Called if user wants to go back */
  onBack?: () => void;
  /** User's display name for personalization */
  userName?: string;
}

type SetupStep = 'display' | 'verify';

/**
 * Generates 3 random word indices for verification
 * Returns indices in sorted order for consistent display
 */
function getRandomVerificationIndices(wordCount: number = 24): number[] {
  const indices = new Set<number>();
  while (indices.size < 3) {
    const randomIndex = Math.floor(Math.random() * wordCount);
    indices.add(randomIndex);
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export function RecoveryPhraseSetup({
  recoveryPhrase,
  onComplete,
  onBack,
  userName,
}: RecoveryPhraseSetupProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<SetupStep>('display');
  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasConfirmedWrittenDown, setHasConfirmedWrittenDown] = useState(false);

  // Verification state
  const [verificationIndices, setVerificationIndices] = useState<number[]>([]);
  const [verificationInputs, setVerificationInputs] = useState<Record<number, string>>({});
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const phraseWords = useMemo(() => recoveryPhrase.split(' '), [recoveryPhrase]);

  // Initialize verification indices when entering verification step
  useEffect(() => {
    if (step === 'verify' && verificationIndices.length === 0) {
      setVerificationIndices(getRandomVerificationIndices(phraseWords.length));
    }
  }, [step, verificationIndices.length, phraseWords.length]);

  const handleCopyPhrase = async () => {
    try {
      await navigator.clipboard.writeText(recoveryPhrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = recoveryPhrase;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleProceedToVerification = () => {
    setStep('verify');
    setVerificationIndices(getRandomVerificationIndices(phraseWords.length));
    setVerificationInputs({});
    setVerificationError(null);
  };

  const handleVerificationInputChange = (index: number, value: string) => {
    setVerificationInputs((prev) => ({
      ...prev,
      [index]: value.toLowerCase().trim(),
    }));
    setVerificationError(null);
  };

  const handleVerifyPhrase = () => {
    setIsVerifying(true);
    setVerificationError(null);

    // Check each word
    let allCorrect = true;
    for (const index of verificationIndices) {
      const expectedWord = phraseWords[index]?.toLowerCase();
      const inputWord = verificationInputs[index]?.toLowerCase().trim();

      if (inputWord !== expectedWord) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      onComplete();
    } else {
      setVerificationError(
        t(
          'auth.recovery.verificationFailed',
          'One or more words are incorrect. Please check your recovery phrase and try again.'
        )
      );
    }

    setIsVerifying(false);
  };

  const handleRetryVerification = () => {
    setVerificationIndices(getRandomVerificationIndices(phraseWords.length));
    setVerificationInputs({});
    setVerificationError(null);
  };

  const canProceedToVerification = hasConfirmedWrittenDown;
  const canVerify =
    verificationIndices.length > 0 &&
    verificationIndices.every((index) => verificationInputs[index]?.trim());

  // Render the display step
  if (step === 'display') {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t('auth.recovery.title', 'Secure Your Account')}
          </CardTitle>
          <CardDescription>
            {userName
              ? t(
                  'auth.recovery.descriptionWithName',
                  'Welcome, {{name}}! Before you can use BuildIt, you need to save your recovery phrase.',
                  { name: userName }
                )
              : t(
                  'auth.recovery.description',
                  'Before you can use BuildIt, you need to save your recovery phrase.'
                )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('auth.recovery.warningTitle', 'Critical Security Step')}</AlertTitle>
            <AlertDescription>
              {t(
                'auth.recovery.warningDescription',
                'This 24-word phrase is the ONLY way to recover your account if you forget your password or lose access to your device. There is NO password reset. Write it down and store it securely offline.'
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                {t('auth.recovery.phraseLabel', 'Your Recovery Phrase')}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPhrase(!showPhrase)}
                className="h-8"
              >
                {showPhrase ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    {t('auth.recovery.hide', 'Hide')}
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    {t('auth.recovery.show', 'Show')}
                  </>
                )}
              </Button>
            </div>

            <div
              className={cn(
                'grid grid-cols-4 gap-2 p-4 bg-muted rounded-lg border',
                !showPhrase && 'blur-sm select-none'
              )}
            >
              {phraseWords.map((word, i) => (
                <div key={i} className="text-sm py-1">
                  <span className="text-muted-foreground mr-1 font-mono text-xs">{i + 1}.</span>
                  <span className="font-mono">{word}</span>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full" onClick={handleCopyPhrase}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t('auth.recovery.copied', 'Copied!')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('auth.recovery.copyPhrase', 'Copy to Clipboard')}
                </>
              )}
            </Button>
          </div>

          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="confirm-written"
              checked={hasConfirmedWrittenDown}
              onCheckedChange={(checked) => setHasConfirmedWrittenDown(checked === true)}
              className="mt-0.5"
            />
            <label
              htmlFor="confirm-written"
              className="text-sm leading-snug cursor-pointer select-none"
            >
              {t(
                'auth.recovery.confirmWrittenDown',
                'I have written down my recovery phrase and stored it in a secure location. I understand that if I lose this phrase, I will permanently lose access to my account.'
              )}
            </label>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              {t('common.back', 'Back')}
            </Button>
          )}
          <Button
            onClick={handleProceedToVerification}
            disabled={!canProceedToVerification}
            className={cn(!onBack && 'w-full')}
          >
            {t('auth.recovery.verifyPhrase', 'Verify Recovery Phrase')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Render the verification step
  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          {t('auth.recovery.verifyTitle', 'Verify Your Recovery Phrase')}
        </CardTitle>
        <CardDescription>
          {t(
            'auth.recovery.verifyDescription',
            'Enter the requested words from your recovery phrase to confirm you have saved it correctly.'
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          {verificationIndices.map((wordIndex) => (
            <div key={wordIndex} className="space-y-2">
              <Label htmlFor={`word-${wordIndex}`}>
                {t('auth.recovery.enterWord', 'Enter word #{{number}}', { number: wordIndex + 1 })}
              </Label>
              <Input
                id={`word-${wordIndex}`}
                type="text"
                placeholder={t('auth.recovery.wordPlaceholder', 'Enter word')}
                value={verificationInputs[wordIndex] || ''}
                onChange={(e) => handleVerificationInputChange(wordIndex, e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono"
              />
            </div>
          ))}
        </div>

        {verificationError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{verificationError}</AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-muted-foreground">
          {t(
            'auth.recovery.verifyHint',
            "Can't remember? Go back to view your recovery phrase again, but make sure to write it down this time!"
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between gap-3">
        <Button variant="outline" onClick={() => setStep('display')}>
          {t('common.back', 'Back')}
        </Button>

        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={handleRetryVerification} title={t('auth.recovery.newWords', 'Try different words')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleVerifyPhrase} disabled={!canVerify || isVerifying}>
            {isVerifying
              ? t('auth.recovery.verifying', 'Verifying...')
              : t('auth.recovery.confirm', 'Confirm & Continue')}
            {!isVerifying && <Check className="h-4 w-4 ml-2" />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default RecoveryPhraseSetup;
