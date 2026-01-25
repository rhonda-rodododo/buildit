/**
 * Onboarding Demo Page
 * Demonstrates different onboarding flows based on entry point
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sparkles } from 'lucide-react';

export const OnboardingDemoPage: FC = () => {
  const { t } = useTranslation();
  const [entryPoint, setEntryPoint] = useState<'campaign' | 'event' | 'friend-invite' | 'website' | 'social-media'>('campaign');
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [completed, setCompleted] = useState(false);

  const handleComplete = () => {
    setCompleted(true);
    setShowOnboarding(false);
  };

  const handleReset = () => {
    setCompleted(false);
    setShowOnboarding(true);
  };

  const getEntryPointLabel = (ep: string) => {
    return t(`onboardingDemo.entryPoints.${ep}`, ep);
  };

  return (
    <div className="space-y-6">
      <PageMeta title="Onboarding Demo" descriptionKey="meta.defaultDescription" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('onboardingDemo.title')}</h1>
          <p className="text-muted-foreground">
            {t('onboardingDemo.description')}
          </p>
        </div>

        {/* Entry Point Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {t('onboardingDemo.entryPointLabel', { entry: getEntryPointLabel(entryPoint) })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('onboardingDemo.simulateEntryPoint')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setEntryPoint('campaign'); handleReset(); }}>
              {t('onboardingDemo.entryPoints.campaign')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEntryPoint('event'); handleReset(); }}>
              {t('onboardingDemo.entryPoints.event')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEntryPoint('friend-invite'); handleReset(); }}>
              {t('onboardingDemo.entryPoints.friend-invite')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEntryPoint('website'); handleReset(); }}>
              {t('onboardingDemo.entryPoints.website')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEntryPoint('social-media'); handleReset(); }}>
              {t('onboardingDemo.entryPoints.social-media')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Onboarding Flow or Completion */}
      {showOnboarding ? (
        <OnboardingFlow
          entryPoint={entryPoint}
          onComplete={handleComplete}
        />
      ) : completed ? (
        <Card className="p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-green-500/10">
              <Sparkles className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">{t('onboardingDemo.complete.title')}</h2>
          <p className="text-muted-foreground mb-6">
            {t('onboardingDemo.complete.description')}
          </p>
          <Button onClick={handleReset}>{t('onboardingDemo.complete.tryAnother')}</Button>
        </Card>
      ) : null}

      {/* Info Box */}
      {showOnboarding && (
        <Card className="p-4 bg-blue-500/5 border-blue-500/20">
          <h4 className="font-medium text-sm mb-2">{t('onboardingDemo.about.title')}</h4>
          <p className="text-xs text-muted-foreground">
            {t('onboardingDemo.about.intro')}
          </p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4">
            <li>• <strong>{t('onboardingDemo.about.campaign')}</strong> {t('onboardingDemo.about.campaignDesc')}</li>
            <li>• <strong>{t('onboardingDemo.about.event')}</strong> {t('onboardingDemo.about.eventDesc')}</li>
            <li>• <strong>{t('onboardingDemo.about.friendInvite')}</strong> {t('onboardingDemo.about.friendInviteDesc')}</li>
            <li>• <strong>{t('onboardingDemo.about.website')}</strong> {t('onboardingDemo.about.websiteDesc')}</li>
            <li>• <strong>{t('onboardingDemo.about.socialMedia')}</strong> {t('onboardingDemo.about.socialMediaDesc')}</li>
          </ul>
        </Card>
      )}
    </div>
  );
};
