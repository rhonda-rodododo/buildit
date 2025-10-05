/**
 * Notifications Demo Page
 * Standalone page to demonstrate smart notifications
 */

import { FC, useState } from 'react';
import { SmartNotifications } from '@/components/notifications/SmartNotifications';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

export const NotificationsDemoPage: FC = () => {
  const [currentLevel, setCurrentLevel] = useState<'Neutral' | 'Passive Support' | 'Active Support' | 'Core Organizer'>('Passive Support');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Smart Notifications</h1>
          <p className="text-muted-foreground">
            Context-aware notifications based on engagement level
          </p>
        </div>

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

      {/* Notifications */}
      <SmartNotifications currentEngagementLevel={currentLevel} />

      {/* Explanation */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-500" />
          How Smart Notifications Work
        </h4>
        <p className="text-xs text-muted-foreground mb-2">
          Notifications change based on your engagement level:
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 ml-4">
          <li>• <strong>Neutral:</strong> Beginner-friendly events, educational content</li>
          <li>• <strong>Passive Support:</strong> Encouragement to attend actions, progress updates</li>
          <li>• <strong>Active Support:</strong> Volunteer opportunities, urgent mobilizations</li>
          <li>• <strong>Core Organizer:</strong> Leadership meetings, mentorship, security alerts</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          Each notification includes a relevance score showing why you're seeing it.
        </p>
      </Card>
    </div>
  );
};
