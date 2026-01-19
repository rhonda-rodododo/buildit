/**
 * Onboarding Demo Page
 * Demonstrates different onboarding flows based on entry point
 */

import { FC, useState } from 'react';
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
    const labels: Record<string, string> = {
      'campaign': 'Campaign Landing Page',
      'event': 'Event RSVP',
      'friend-invite': 'Friend Invitation',
      'website': 'Main Website',
      'social-media': 'Social Media Link'
    };
    return labels[ep] || ep;
  };

  return (
    <div className="space-y-6">
      <PageMeta title="Onboarding Demo" descriptionKey="meta.defaultDescription" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Personalized Onboarding</h1>
          <p className="text-muted-foreground">
            Different flows based on how users discover the platform
          </p>
        </div>

        {/* Entry Point Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Entry Point: {getEntryPointLabel(entryPoint)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Simulate Entry Point</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setEntryPoint('campaign'); handleReset(); }}>
              Campaign Landing Page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEntryPoint('event'); handleReset(); }}>
              Event RSVP
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEntryPoint('friend-invite'); handleReset(); }}>
              Friend Invitation
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEntryPoint('website'); handleReset(); }}>
              Main Website
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEntryPoint('social-media'); handleReset(); }}>
              Social Media Link
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
          <h2 className="text-2xl font-bold mb-2">Onboarding Complete!</h2>
          <p className="text-muted-foreground mb-6">
            User would now be redirected to their personalized dashboard
          </p>
          <Button onClick={handleReset}>Try Another Entry Point</Button>
        </Card>
      ) : null}

      {/* Info Box */}
      {showOnboarding && (
        <Card className="p-4 bg-blue-500/5 border-blue-500/20">
          <h4 className="font-medium text-sm mb-2">About Personalized Onboarding</h4>
          <p className="text-xs text-muted-foreground">
            Different entry points lead to different onboarding flows optimized for user context:
          </p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4">
            <li>• <strong>Campaign:</strong> Focus on specific issue, then broaden to full platform</li>
            <li>• <strong>Event:</strong> Quick setup to get to RSVP, then explore working groups</li>
            <li>• <strong>Friend Invite:</strong> Social connection first, then community building</li>
            <li>• <strong>Website:</strong> Comprehensive overview of all organizing work</li>
            <li>• <strong>Social Media:</strong> Fast path to action for high-energy newcomers</li>
          </ul>
        </Card>
      )}
    </div>
  );
};
