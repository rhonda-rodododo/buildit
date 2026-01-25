import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupContext } from '@/contexts/GroupContext';
import { useGroupsStore } from '@/stores/groupsStore';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';

/**
 * Group Settings Page
 * Configure group settings and enabled modules
 */
export const GroupSettingsPage: FC = () => {
  const { t } = useTranslation();
  const { group, groupId, availableModules, isModuleEnabled, refetch } = useGroupContext();
  const { updateGroup, toggleModule } = useGroupsStore();

  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!group) {
    return <div>{t('pages.groupNotFound')}</div>;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateGroup(groupId, { name, description });
      await refetch();
    } catch (error) {
      console.error('Failed to update group:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleModule = async (moduleId: string) => {
    try {
      await toggleModule(groupId, moduleId);
      await refetch();
    } catch (error) {
      console.error('Failed to toggle module:', error);
    }
  };

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <PageMeta
        title={`${group.name} - Settings`}
        descriptionKey="meta.settings"
      />
      <div>
        <h1 className="text-3xl font-bold">{t('pages.groupSettings')}</h1>
        <p className="text-muted-foreground">
          {t('pages.configureSettings', { name: group.name })}
        </p>
      </div>

      {/* Basic settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pages.basicInformation')}</CardTitle>
          <CardDescription>
            {t('pages.updateNameDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('groups.groupName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('pages.enterGroupName')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('groups.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('pages.enterGroupDescription')}
              rows={3}
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? t('pages.saving') : t('pages.saveChanges')}
          </Button>
        </CardContent>
      </Card>

      {/* Module settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('groups.enabledModules')}</CardTitle>
          <CardDescription>
            {t('pages.chooseModules')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availableModules
              .filter(module => module.metadata.id !== 'custom-fields') // Hide foundational module
              .map((module) => {
                const enabled = isModuleEnabled(module.metadata.id);
                return (
                  <div
                    key={module.metadata.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{module.metadata.name}</h3>
                        <Badge variant={enabled ? 'default' : 'secondary'}>
                          {enabled ? t('pages.enabled') : t('pages.disabled')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {module.metadata.description}
                      </p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => handleToggleModule(module.metadata.id)}
                    />
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Privacy settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('groups.privacy')}</CardTitle>
          <CardDescription>
            {t('pages.managePrivacy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>{t('pages.privacyLevel')}</Label>
            <Badge variant="outline">{group.privacy}</Badge>
            <p className="text-sm text-muted-foreground">
              {group.privacy === 'public'
                ? t('pages.publicAccess')
                : t('pages.privateAccess')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
