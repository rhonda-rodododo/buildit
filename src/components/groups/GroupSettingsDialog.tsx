import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ModuleSettings from '@/components/modules/ModuleSettings';
import { GroupMembersTab } from './GroupMembersTab';
import type { DBGroup } from '@/core/storage/db';

interface GroupSettingsDialogProps {
  group: DBGroup;
  trigger?: React.ReactNode;
}

export const GroupSettingsDialog: FC<GroupSettingsDialogProps> = ({ group, trigger }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            {t('groupSettingsDialog.settings')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('groupSettingsDialog.title', { groupName: group.name })}</DialogTitle>
          <DialogDescription>{t('groupSettingsDialog.description')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="modules" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="modules" className="flex-1">
              {t('groupSettingsDialog.tabs.modules')}
            </TabsTrigger>
            <TabsTrigger value="general" className="flex-1">
              {t('groupSettingsDialog.tabs.general')}
            </TabsTrigger>
            <TabsTrigger value="members" className="flex-1">
              {t('groupSettingsDialog.tabs.members')}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="modules" className="mt-0">
              <ModuleSettings groupId={group.id} />
            </TabsContent>

            <TabsContent value="general" className="mt-0">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">{t('groupSettingsDialog.general.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('groupSettingsDialog.general.description')}
                  </p>
                </div>
                {/* General settings deferred to Phase 2 */}
                <p className="text-muted-foreground">{t('groupSettingsDialog.general.comingSoon')}</p>
              </div>
            </TabsContent>

            <TabsContent value="members" className="mt-0">
              <GroupMembersTab
                groupId={group.id}
                groupName={group.name}
                adminPubkeys={group.adminPubkeys}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
