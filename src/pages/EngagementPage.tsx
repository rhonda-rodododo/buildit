/**
 * Engagement Page
 * Shows user's engagement journey and personalized next steps
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
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
  const { t } = useTranslation();
  // Demo state - in real app, this would come from user store
  const [currentLevel, setCurrentLevel] = useState<'Neutral' | 'Passive Support' | 'Active Support' | 'Core Organizer'>('Passive Support');
  const [completedMilestones] = useState<string[]>([
    'attend-first-event',
    'join-group',
    'share-post'
  ]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageMeta titleKey="crm.title" descriptionKey="meta.analytics" path="/app/engagement" />
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">{t('engagementPage.title')}</h1>

          {/* Demo: Level Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {t('engagementPage.demoSwitchLevel')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('engagementPage.viewAs')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCurrentLevel('Neutral')}>
                {t('engagementPage.levelOptions.neutral')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentLevel('Passive Support')}>
                {t('engagementPage.levelOptions.passive')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentLevel('Active Support')}>
                {t('engagementPage.levelOptions.active')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentLevel('Core Organizer')}>
                {t('engagementPage.levelOptions.core')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-muted-foreground">
          {t('engagementPage.subtitle')}
        </p>
      </div>

      {/* Tabs for Engagement and Notifications */}
      <Tabs defaultValue="engagement" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="engagement" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            {t('engagementPage.tabs.engagement')}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            {t('engagementPage.tabs.notifications')}
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
          {t('engagementPage.aboutLadder.title')}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t('engagementPage.aboutLadder.description')}
        </p>
        <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4">
          <li>• {t('engagementPage.aboutLadder.levels.neutral')}</li>
          <li>• {t('engagementPage.aboutLadder.levels.passive')}</li>
          <li>• {t('engagementPage.aboutLadder.levels.active')}</li>
          <li>• {t('engagementPage.aboutLadder.levels.core')}</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          {t('engagementPage.aboutLadder.footer')}
        </p>
      </Card>
    </div>
  );
};
