/**
 * Engagement Page
 * Shows user's engagement journey and personalized next steps
 */

import { FC, useState } from 'react';
import { EngagementLadder } from '@/components/engagement/EngagementLadder';
import { SmartNotifications } from '@/components/notifications/SmartNotifications';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TrendingUp, Bell } from 'lucide-react';

export const EngagementPage: FC = () => {
  // Demo state - in real app, this would come from user store
  const [currentLevel, setCurrentLevel] = useState<'Neutral' | 'Passive Support' | 'Active Support' | 'Core Organizer'>('Passive Support');
  const [completedMilestones] = useState<string[]>([
    'attend-first-event',
    'join-group',
    'share-post'
  ]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Your Journey</h1>

          {/* Demo: Level Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Demo: Switch Level
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>View as...</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCurrentLevel('Neutral')}>
                Neutral (30%)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentLevel('Passive Support')}>
                Passive Support (40%)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentLevel('Active Support')}>
                Active Support (70%)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentLevel('Core Organizer')}>
                Core Organizer (100%)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-muted-foreground">
          Track your engagement, complete milestones, and grow as an organizer
        </p>
      </div>

      {/* Tabs for Engagement and Notifications */}
      <Tabs defaultValue="engagement" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="engagement" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Engagement Journey
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Smart Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="mt-6">
          <EngagementLadder
            currentLevel={currentLevel}
            completedMilestones={completedMilestones}
          />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <SmartNotifications currentEngagementLevel={currentLevel} />
        </TabsContent>
      </Tabs>

      {/* Info Box */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          About the Engagement Ladder
        </h4>
        <p className="text-xs text-muted-foreground">
          The Engagement Ladder is based on the Spectrum of Support methodology used by successful organizing movements.
          Each level represents deeper involvement in the movement:
        </p>
        <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4">
          <li>• <strong>Neutral (30%)</strong> - Learning and exploring</li>
          <li>• <strong>Passive Support (40%)</strong> - Supporting from the sidelines</li>
          <li>• <strong>Active Support (70%)</strong> - Actively participating in actions</li>
          <li>• <strong>Core Organizer (100%)</strong> - Leading and developing others</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          Complete milestones at your current level to unlock the next stage of your organizing journey.
        </p>
      </Card>
    </div>
  );
};
