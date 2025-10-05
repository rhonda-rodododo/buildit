/**
 * Personalized Onboarding Flow
 * Different onboarding experiences based on entry point and user interests
 */

import { FC, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Users,
  Calendar,
  MessageSquare,
  Target,
  Heart,
  Megaphone,
  BookOpen,
  Shield
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: typeof Users;
  component: 'interests' | 'profile' | 'groups' | 'events' | 'communication' | 'complete';
}

interface OnboardingFlowProps {
  entryPoint: 'campaign' | 'event' | 'friend-invite' | 'website' | 'social-media';
  onComplete: () => void;
  className?: string;
}

// Different onboarding flows based on entry point
const ONBOARDING_FLOWS: Record<string, OnboardingStep[]> = {
  'campaign': [
    {
      id: 'interests',
      title: 'What brings you here?',
      description: 'Tell us about your interests so we can personalize your experience',
      icon: Heart,
      component: 'interests'
    },
    {
      id: 'profile',
      title: 'Set up your profile',
      description: 'Add a few details to help us connect you with the right people',
      icon: Users,
      component: 'profile'
    },
    {
      id: 'events',
      title: 'Find events near you',
      description: 'Browse upcoming actions and gatherings',
      icon: Calendar,
      component: 'events'
    },
    {
      id: 'communication',
      title: 'Stay connected',
      description: 'Choose how you\'d like to receive updates',
      icon: MessageSquare,
      component: 'communication'
    },
    {
      id: 'complete',
      title: 'You\'re all set!',
      description: 'Welcome to the movement',
      icon: Check,
      component: 'complete'
    }
  ],
  'event': [
    {
      id: 'profile',
      title: 'Quick setup',
      description: 'Just a few details to get started',
      icon: Users,
      component: 'profile'
    },
    {
      id: 'interests',
      title: 'Your interests',
      description: 'What issues matter most to you?',
      icon: Heart,
      component: 'interests'
    },
    {
      id: 'groups',
      title: 'Join working groups',
      description: 'Connect with others working on similar issues',
      icon: Target,
      component: 'groups'
    },
    {
      id: 'complete',
      title: 'Ready to organize!',
      description: 'You\'re part of the team',
      icon: Check,
      component: 'complete'
    }
  ],
  'friend-invite': [
    {
      id: 'profile',
      title: 'Welcome!',
      description: 'Your friend invited you to join our organizing network',
      icon: Users,
      component: 'profile'
    },
    {
      id: 'interests',
      title: 'What interests you?',
      description: 'Select the issues you care about',
      icon: Heart,
      component: 'interests'
    },
    {
      id: 'groups',
      title: 'Find your community',
      description: 'Join groups that match your interests',
      icon: Target,
      component: 'groups'
    },
    {
      id: 'events',
      title: 'Get involved',
      description: 'Check out upcoming events and actions',
      icon: Calendar,
      component: 'events'
    },
    {
      id: 'complete',
      title: 'Welcome aboard!',
      description: 'Let\'s build power together',
      icon: Check,
      component: 'complete'
    }
  ],
  'website': [
    {
      id: 'interests',
      title: 'What brought you here?',
      description: 'Help us understand what you\'re passionate about',
      icon: Heart,
      component: 'interests'
    },
    {
      id: 'profile',
      title: 'Create your profile',
      description: 'Set up your account to join the network',
      icon: Users,
      component: 'profile'
    },
    {
      id: 'groups',
      title: 'Explore campaigns',
      description: 'See what we\'re working on',
      icon: Megaphone,
      component: 'groups'
    },
    {
      id: 'events',
      title: 'Take action',
      description: 'Find ways to get involved',
      icon: Calendar,
      component: 'events'
    },
    {
      id: 'complete',
      title: 'Welcome!',
      description: 'You\'re now part of the movement',
      icon: Check,
      component: 'complete'
    }
  ],
  'social-media': [
    {
      id: 'interests',
      title: 'Tell us more',
      description: 'What issues are you most interested in?',
      icon: Heart,
      component: 'interests'
    },
    {
      id: 'profile',
      title: 'Join the network',
      description: 'Create your profile to connect with organizers',
      icon: Users,
      component: 'profile'
    },
    {
      id: 'events',
      title: 'Get active',
      description: 'Find events and actions you can join',
      icon: Calendar,
      component: 'events'
    },
    {
      id: 'complete',
      title: 'Let\'s go!',
      description: 'Start organizing',
      icon: Check,
      component: 'complete'
    }
  ]
};

const INTEREST_OPTIONS = [
  { id: 'climate', label: 'Climate Justice', icon: '🌍' },
  { id: 'housing', label: 'Housing Rights', icon: '🏠' },
  { id: 'labor', label: 'Workers Rights', icon: '✊' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'healthcare', label: 'Healthcare', icon: '🏥' },
  { id: 'immigration', label: 'Immigration Justice', icon: '🌎' },
  { id: 'police', label: 'Police Accountability', icon: '⚖️' },
  { id: 'lgbtq', label: 'LGBTQ+ Rights', icon: '🏳️‍🌈' },
  { id: 'racial-justice', label: 'Racial Justice', icon: '✊🏾' },
  { id: 'mutual-aid', label: 'Mutual Aid', icon: '🤝' }
];

export const OnboardingFlow: FC<OnboardingFlowProps> = ({
  entryPoint,
  onComplete,
  className
}) => {
  const steps = ONBOARDING_FLOWS[entryPoint] || ONBOARDING_FLOWS['website'];
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    availability: ''
  });

  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const toggleInterest = (interestId: string) => {
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const renderStepContent = () => {
    const StepIcon = currentStep.icon;

    switch (currentStep.component) {
      case 'interests':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <StepIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{currentStep.title}</h3>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {INTEREST_OPTIONS.map(interest => (
                <Card
                  key={interest.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedInterests.includes(interest.id)
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => toggleInterest(interest.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{interest.icon}</span>
                    <span className="text-sm font-medium">{interest.label}</span>
                    {selectedInterests.includes(interest.id) && (
                      <Check className="w-4 h-4 ml-auto text-primary" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <StepIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{currentStep.title}</h3>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your name"
                  className="w-full p-2 border rounded-md bg-background"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Location (Optional)</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, State"
                  className="w-full p-2 border rounded-md bg-background"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Availability</label>
                <select
                  value={formData.availability}
                  onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  <option value="">Select...</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekends">Weekends</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'groups':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <StepIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{currentStep.title}</h3>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Climate Justice Action', members: 142, active: true },
                { name: 'Housing Rights Coalition', members: 89, active: true },
                { name: 'Workers Solidarity Network', members: 203, active: true }
              ].map((group, index) => (
                <Card key={index} className="p-4 hover:bg-muted/50 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{group.name}</h4>
                      <p className="text-xs text-muted-foreground">{group.members} members</p>
                    </div>
                    <Button size="sm" variant="outline">Join</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'events':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <StepIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{currentStep.title}</h3>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { title: 'Community Organizing Workshop', date: 'Tomorrow, 6 PM', attendees: 34 },
                { title: 'Climate Justice Rally', date: 'Saturday, 2 PM', attendees: 156 },
                { title: 'Housing Rights Meeting', date: 'Next Tuesday, 7 PM', attendees: 42 }
              ].map((event, index) => (
                <Card key={index} className="p-4 hover:bg-muted/50 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{event.title}</h4>
                      <p className="text-xs text-muted-foreground">{event.date} • {event.attendees} going</p>
                    </div>
                    <Button size="sm" variant="outline">RSVP</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'communication':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <StepIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{currentStep.title}</h3>
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { title: 'Action Alerts', description: 'Urgent calls to action and mobilizations', icon: Megaphone },
                { title: 'Event Updates', description: 'Upcoming events and gatherings', icon: Calendar },
                { title: 'Weekly Digest', description: 'Summary of movement activities', icon: BookOpen },
                { title: 'Security Alerts', description: 'Important safety and security updates', icon: Shield }
              ].map((pref, index) => {
                const PrefIcon = pref.icon;
                return (
                  <Card key={index} className="p-4">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" defaultChecked className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <PrefIcon className="w-4 h-4 text-primary" />
                          <h4 className="font-medium text-sm">{pref.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">{pref.description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center py-8 space-y-4">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-green-500/10">
                <Check className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold">{currentStep.title}</h3>
            <p className="text-muted-foreground">{currentStep.description}</p>

            {selectedInterests.length > 0 && (
              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-2">Your selected interests:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {selectedInterests.map(id => {
                    const interest = INTEREST_OPTIONS.find(i => i.id === id);
                    return interest && (
                      <Badge key={id} variant="secondary">
                        {interest.icon} {interest.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Content */}
      <Card className="p-6 mb-6">
        {renderStepContent()}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStepIndex === 0}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <Button onClick={handleNext} className="gap-2">
          {currentStepIndex === steps.length - 1 ? 'Get Started' : 'Continue'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
