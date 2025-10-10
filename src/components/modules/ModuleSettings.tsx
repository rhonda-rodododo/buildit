import { useState, useEffect } from 'react';
import { useModuleStore } from '@/stores/moduleStore';
import { useGroupsStore } from '@/stores/groupsStore';
import { getAllModules } from '@/lib/modules/registry';
import { canManageModules } from '@/lib/modules/permissions';
import { useAuthStore } from '@/stores/authStore';
import type { ModulePlugin } from '@/types/modules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, CheckCircle2, XCircle } from 'lucide-react';

interface ModuleSettingsProps {
  groupId: string;
}

export default function ModuleSettings({ groupId }: ModuleSettingsProps) {
  const [canManage, setCanManage] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModulePlugin | null>(null);
  const [moduleConfig, setModuleConfig] = useState<Record<string, unknown>>({});

  const currentIdentity = useAuthStore((state: { currentIdentity: { publicKey: string } | null }) => state.currentIdentity);
  const { toggleModule: toggleGroupModule } = useGroupsStore();
  const {
    isModuleEnabled,
    getModuleInstance,
    updateModuleConfig,
  } = useModuleStore();

  const allModules = getAllModules();

  useEffect(() => {
    const checkPermissions = async () => {
      if (currentIdentity) {
        const hasPermission = await canManageModules(currentIdentity.publicKey, groupId);
        setCanManage(hasPermission);
      }
    };
    checkPermissions();
  }, [currentIdentity, groupId]);

  const handleToggleModule = async (module: ModulePlugin) => {
    if (!canManage) {
      alert('You do not have permission to manage modules');
      return;
    }

    try {
      // Use groupsStore.toggleModule which syncs both stores
      await toggleGroupModule(groupId, module.metadata.id);
    } catch (error) {
      console.error('Failed to toggle module:', error);
      alert('Failed to toggle module: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleConfigureModule = (module: ModulePlugin) => {
    const instance = getModuleInstance(groupId, module.metadata.id);
    setSelectedModule(module);
    setModuleConfig(instance?.config || module.getDefaultConfig?.() || {});
    setConfigDialogOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedModule || !canManage) return;

    try {
      await updateModuleConfig(groupId, selectedModule.metadata.id, moduleConfig);
      setConfigDialogOpen(false);
      setSelectedModule(null);
    } catch (error) {
      console.error('Failed to update module config:', error);
      alert('Failed to update configuration: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleConfigFieldChange = (key: string, value: unknown) => {
    setModuleConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const renderConfigField = (field: ModulePlugin['metadata']['configSchema'][0]) => {
    const value = moduleConfig[field.key];

    switch (field.type) {
      case 'boolean':
        return (
          <div className="flex items-center justify-between">
            <Label htmlFor={field.key} className="flex-1">
              {field.label}
              {field.description && (
                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
              )}
            </Label>
            <Switch
              id={field.key}
              checked={value as boolean}
              onCheckedChange={(checked: boolean) => handleConfigFieldChange(field.key, checked)}
            />
          </div>
        );

      case 'number':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.description && (
                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
              )}
            </Label>
            <Input
              id={field.key}
              type="number"
              value={value as number}
              onChange={(e) => handleConfigFieldChange(field.key, Number(e.target.value))}
            />
          </div>
        );

      case 'string':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.description && (
                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
              )}
            </Label>
            <Input
              id={field.key}
              type="text"
              value={value as string}
              onChange={(e) => handleConfigFieldChange(field.key, e.target.value)}
            />
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.description && (
                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
              )}
            </Label>
            <Select
              value={value as string}
              onValueChange={(newValue) => handleConfigFieldChange(field.key, newValue)}
            >
              <SelectTrigger id={field.key}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.description && (
                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
              )}
            </Label>
            <div className="flex flex-wrap gap-2">
              {field.options?.map((option) => {
                const selected = (value as string[])?.includes(option.value);
                return (
                  <Badge
                    key={option.value}
                    variant={selected ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      const current = (value as string[]) || [];
                      const updated = selected
                        ? current.filter((v) => v !== option.value)
                        : [...current, option.value];
                      handleConfigFieldChange(field.key, updated);
                    }}
                  >
                    {option.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Module Settings</CardTitle>
          <CardDescription>You do not have permission to manage modules for this group.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-2">Module Settings</h2>
        <p className="text-muted-foreground">
          Enable and configure modules for your group. Each module provides different features and capabilities.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {allModules.map((module) => {
          const enabled = isModuleEnabled(groupId, module.metadata.id);
          const instance = getModuleInstance(groupId, module.metadata.id);

          return (
            <Card key={module.metadata.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {module.metadata.name}
                      {enabled ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </CardTitle>
                    <CardDescription>{module.metadata.description}</CardDescription>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => handleToggleModule(module)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Capabilities:</h4>
                    <div className="flex flex-wrap gap-1">
                      {module.metadata.capabilities.map((cap) => (
                        <Badge key={cap.id} variant="secondary" className="text-xs">
                          {cap.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {enabled && module.metadata.configSchema.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConfigureModule(module)}
                      className="w-full"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                  )}

                  {instance?.state === 'error' && (
                    <p className="text-sm text-destructive">Error: {instance.lastError}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure {selectedModule?.metadata.name}</DialogTitle>
            <DialogDescription>{selectedModule?.metadata.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedModule?.metadata.configSchema.map((field) => (
              <div key={field.key}>{renderConfigField(field)}</div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig}>Save Configuration</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
