/**
 * Notifications Demo Page
 * Standalone page to demonstrate smart notifications
 */

import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
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
  const { t } = useTranslation();
  const [currentLevel, setCurrentLevel] = useState<'Neutral' | 'Passive Support' | 'Active Support' | 'Core Organizer'>('Passive Support');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageMeta titleKey="notificationsDemoPage.title" descriptionKey="meta.notifications" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('notificationsDemoPage.title')}</h1>
          <p className="text-muted-foreground">
            {t('notificationsDemoPage.subtitle')}
          </p>
        </div>

        {/* Demo: Level Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {t('notificationsDemoPage.demoSwitchLevel')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('notificationsDemoPage.viewAs')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCurrentLevel('Neutral')}>
              {t('notificationsDemoLevels.neutral')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentLevel('Passive Support')}>
              {t('notificationsDemoLevels.passiveSupport')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentLevel('Active Support')}>
              {t('notificationsDemoLevels.activeSupport')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentLevel('Core Organizer')}>
              {t('notificationsDemoLevels.coreOrganizer')}
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
          {t('notificationsDemoPage.explanation.title')}
        </h4>
        <p className="text-xs text-muted-foreground mb-2">
          {t('notificationsDemoPage.explanation.description')}
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 ml-4">
          <li>• <strong>{t('notificationsDemoLevels.neutral').split(' (')[0]}:</strong> {t('notificationsDemoPage.explanation.levels.neutral')}</li>
          <li>• <strong>{t('notificationsDemoLevels.passiveSupport').split(' (')[0]}:</strong> {t('notificationsDemoPage.explanation.levels.passive')}</li>
          <li>• <strong>{t('notificationsDemoLevels.activeSupport').split(' (')[0]}:</strong> {t('notificationsDemoPage.explanation.levels.active')}</li>
          <li>• <strong>{t('notificationsDemoLevels.coreOrganizer').split(' (')[0]}:</strong> {t('notificationsDemoPage.explanation.levels.core')}</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          {t('notificationsDemoPage.explanation.footer')}
        </p>
      </Card>
    </div>
  );
};
