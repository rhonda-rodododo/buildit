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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ModuleSettings from '@/components/modules/ModuleSettings';
import { GroupMembersTab } from './GroupMembersTab';
import { useGroupsStore } from '@/stores/groupsStore';
import type { DBGroup } from '@/core/storage/db';
import { toast } from 'sonner';

interface GroupSettingsDialogProps {
  group: DBGroup;
  trigger?: React.ReactNode;
}

export const GroupSettingsDialog: FC<GroupSettingsDialogProps> = ({ group, trigger }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const updateGroup = useGroupsStore((state) => state.updateGroup);

  // General settings form state
  const [groupName, setGroupName] = useState(group.name);
  const [groupDescription, setGroupDescription] = useState(group.description);
  const [groupPrivacy, setGroupPrivacy] = useState<'public' | 'private'>(group.privacy);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveGeneral = async () => {
    if (!groupName.trim()) return;
    setIsSaving(true);
    try {
      await updateGroup(group.id, {
        name: groupName.trim(),
        description: groupDescription.trim(),
        privacy: groupPrivacy,
      });
      toast.success(t('groupSettingsDialog.general.saved', 'Group settings saved'));
    } catch (error) {
      toast.error(t('groupSettingsDialog.general.saveFailed', 'Failed to save settings'));
      console.error('Failed to save group settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            {t('groupSettingsDialog.settings')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[90%] min-h-[90vh] overflow-hidden flex flex-col">
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
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium">{t('groupSettingsDialog.general.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('groupSettingsDialog.general.description')}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Group Name */}
                  <div className="space-y-2">
                    <Label htmlFor="group-name">{t('groupSettingsDialog.general.nameLabel', 'Group Name')}</Label>
                    <Input
                      id="group-name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder={t('groupSettingsDialog.general.namePlaceholder', 'Enter group name')}
                    />
                  </div>

                  {/* Group Description */}
                  <div className="space-y-2">
                    <Label htmlFor="group-description">{t('groupSettingsDialog.general.descriptionLabel', 'Description')}</Label>
                    <Textarea
                      id="group-description"
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      placeholder={t('groupSettingsDialog.general.descriptionPlaceholder', 'Describe this group...')}
                      rows={4}
                    />
                  </div>

                  {/* Privacy Setting */}
                  <div className="space-y-2">
                    <Label>{t('groupSettingsDialog.general.privacyLabel', 'Privacy')}</Label>
                    <Select value={groupPrivacy} onValueChange={(v) => setGroupPrivacy(v as 'public' | 'private')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">{t('groupSettingsDialog.general.public', 'Public - Anyone can find and join')}</SelectItem>
                        <SelectItem value="private">{t('groupSettingsDialog.general.private', 'Private - Invite only')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {groupPrivacy === 'public'
                        ? t('groupSettingsDialog.general.publicHint', 'This group is visible to everyone and anyone can request to join.')
                        : t('groupSettingsDialog.general.privateHint', 'This group is hidden and members must be invited.')}
                    </p>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveGeneral} disabled={isSaving || !groupName.trim()}>
                      {isSaving
                        ? t('groupSettingsDialog.general.saving', 'Saving...')
                        : t('common.save', 'Save Changes')}
                    </Button>
                  </div>
                </div>
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
