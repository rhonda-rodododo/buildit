import { FC, useState } from 'react';
import { useGroupContext } from '@/contexts/GroupContext';
import { useGroupsStore } from '@/stores/groupsStore';
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
  const { group, groupId, availableModules, isModuleEnabled, refetch } = useGroupContext();
  const { updateGroup, toggleModule } = useGroupsStore();

  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!group) {
    return <div>Group not found</div>;
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Group Settings</h1>
        <p className="text-muted-foreground">
          Configure {group.name} settings and features
        </p>
      </div>

      {/* Basic settings */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Update your group's name and description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter group description"
              rows={3}
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Module settings */}
      <Card>
        <CardHeader>
          <CardTitle>Enabled Modules</CardTitle>
          <CardDescription>
            Choose which modules are available for this group
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
                          {enabled ? 'Enabled' : 'Disabled'}
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
          <CardTitle>Privacy</CardTitle>
          <CardDescription>
            Manage group privacy and visibility
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Privacy Level</Label>
            <Badge variant="outline">{group.privacy}</Badge>
            <p className="text-sm text-muted-foreground">
              {group.privacy === 'public'
                ? 'Anyone can see this group and join'
                : group.privacy === 'unlisted'
                ? 'Only people with the link can see this group'
                : 'Invitation only - encrypted content'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
