import { useState, useEffect, useMemo, useCallback } from 'react';
import { useModuleStore } from '@/stores/moduleStore';
import { useGroupsStore } from '@/stores/groupsStore';
import { getAllModules } from '@/lib/modules/registry';
import { canManageModules } from '@/lib/modules/permissions';
import { useAuthStore } from '@/stores/authStore';
import type { ModulePlugin, ModuleDependency } from '@/types/modules';
import { normalizeDependency } from '@/types/modules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import {
  Settings,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Sparkles,
  Lock,
  Puzzle,
  Lightbulb,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ModuleSettingsProps {
  groupId: string;
}

export default function ModuleSettings({ groupId }: ModuleSettingsProps) {
  const { t } = useTranslation();
  const [canManage, setCanManage] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModulePlugin | null>(null);
  const [moduleConfig, setModuleConfig] = useState<Record<string, unknown>>({});
  const currentIdentity = useAuthStore((state: { currentIdentity: { publicKey: string } | null }) => state.currentIdentity);
  const { toggleModule: toggleGroupModule } = useGroupsStore();

  // Use selectors to avoid subscribing to all store changes
  const isModuleEnabled = useModuleStore(state => state.isModuleEnabled);
  const getModuleInstance = useModuleStore(state => state.getModuleInstance);
  const updateModuleConfig = useModuleStore(state => state.updateModuleConfig);

  // Memoize modules to prevent re-fetching on every render
  const allModules = useMemo(() => getAllModules(), []);

  // Create a map of module ID to module for quick lookup
  const moduleMap = useMemo(() => {
    const map = new Map<string, ModulePlugin>();
    allModules.forEach(m => map.set(m.metadata.id, m));
    return map;
  }, [allModules]);

  // Get dependencies for a module (normalized to new format)
  const getDependencies = useCallback((module: ModulePlugin): ModuleDependency[] => {
    const rawDeps = module.metadata.dependencies || [];
    return rawDeps.map(normalizeDependency);
  }, []);

  // Get enhancing modules for a module
  const getEnhancingModules = useCallback((moduleId: string): string[] => {
    const enhancing: string[] = [];
    for (const m of allModules) {
      // Check enhances array in metadata
      if (m.metadata.enhances?.includes(moduleId)) {
        enhancing.push(m.metadata.id);
        continue;
      }
      // Check 'enhances' relationship in dependencies
      const deps = getDependencies(m);
      if (deps.some(d => d.moduleId === moduleId && d.relationship === 'enhances')) {
        enhancing.push(m.metadata.id);
      }
    }
    return enhancing;
  }, [allModules, getDependencies]);


  // Check if all required dependencies are enabled
  const areDependenciesSatisfied = useCallback((module: ModulePlugin): { satisfied: boolean; missing: string[] } => {
    const deps = getDependencies(module);
    const missing: string[] = [];

    for (const dep of deps) {
      if (dep.relationship === 'requires' && !isModuleEnabled(groupId, dep.moduleId)) {
        const depModule = moduleMap.get(dep.moduleId);
        missing.push(depModule?.metadata.name || dep.moduleId);
      }
    }

    return { satisfied: missing.length === 0, missing };
  }, [getDependencies, isModuleEnabled, groupId, moduleMap]);

  // Check if any enabled modules have required dependency on this module
  const hasEnabledDependents = useCallback((moduleId: string): string[] => {
    const enabledDependents: string[] = [];

    for (const m of allModules) {
      const deps = getDependencies(m);
      const hasRequiredDep = deps.some(
        d => d.moduleId === moduleId && d.relationship === 'requires'
      );
      if (hasRequiredDep && isModuleEnabled(groupId, m.metadata.id)) {
        enabledDependents.push(m.metadata.name);
      }
    }

    return enabledDependents;
  }, [allModules, getDependencies, isModuleEnabled, groupId]);

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
      alert(t('modules.noPermissionAlert', 'You do not have permission to manage modules'));
      return;
    }

    try {
      // Use groupsStore.toggleModule which syncs both stores
      await toggleGroupModule(groupId, module.metadata.id);
    } catch (error) {
      console.error('Failed to toggle module:', error);
      alert(t('modules.failedToToggle', 'Failed to toggle module') + ': ' + (error instanceof Error ? error.message : t('errors.unknownError', 'Unknown error')));
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
      alert(t('modules.failedToUpdateConfig', 'Failed to update configuration') + ': ' + (error instanceof Error ? error.message : t('errors.unknownError', 'Unknown error')));
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
          <CardTitle>{t('modules.title', 'Module Settings')}</CardTitle>
          <CardDescription>{t('modules.noPermission', 'You do not have permission to manage modules for this group.')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('modules.title', 'Module Settings')}</h2>
        <p className="text-muted-foreground">
          {t('modules.description', 'Enable and configure modules for your group. Each module provides different features and capabilities.')}
        </p>
      </div>

      <TooltipProvider delayDuration={300}>
        <div className="grid gap-4 md:grid-cols-2">
          {allModules.map((module) => {
            const enabled = isModuleEnabled(groupId, module.metadata.id);
            const instance = getModuleInstance(groupId, module.metadata.id);
            const dependencies = getDependencies(module);
            const { satisfied: depsSatisfied, missing: missingDeps } = areDependenciesSatisfied(module);
            const enabledDependents = hasEnabledDependents(module.metadata.id);

            return (
              <Card key={module.metadata.id} className={!enabled && !depsSatisfied ? 'border-amber-500/50' : ''}>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={() => handleToggleModule(module)}
                            disabled={enabled && enabledDependents.length > 0}
                          />
                        </div>
                      </TooltipTrigger>
                      {enabled && enabledDependents.length > 0 && (
                        <TooltipContent>
                          <p>{t('modules.cannotDisable', 'Cannot disable: {{modules}} depends on this', { modules: enabledDependents.join(', ') })}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Dependencies section - grouped by relationship type */}
                    {dependencies.length > 0 && (
                      <div className="space-y-2">
                        {/* Required dependencies */}
                        {dependencies.filter(d => d.relationship === 'requires').length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                              <Lock className="h-3.5 w-3.5" />
                              {t('modules.required', 'Required:')}
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {dependencies.filter(d => d.relationship === 'requires').map((dep) => {
                                const depModule = moduleMap.get(dep.moduleId);
                                const depEnabled = isModuleEnabled(groupId, dep.moduleId);
                                return (
                                  <Tooltip key={dep.moduleId}>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant={depEnabled ? 'default' : 'destructive'}
                                        className="text-xs cursor-help"
                                      >
                                        <Lock className={`h-3 w-3 mr-1 ${depEnabled ? 'text-green-400' : 'text-red-400'}`} />
                                        {depModule?.metadata.name || dep.moduleId}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{dep.reason || t('modules.isRequired', '{{module}} is required', { module: depModule?.metadata.name || dep.moduleId })}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Optional enhancements */}
                        {dependencies.filter(d => d.relationship === 'optional').length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                              <Puzzle className="h-3.5 w-3.5" />
                              {t('modules.enhancedBy', 'Enhanced by:')}
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {dependencies.filter(d => d.relationship === 'optional').map((dep) => {
                                const depModule = moduleMap.get(dep.moduleId);
                                const depEnabled = isModuleEnabled(groupId, dep.moduleId);
                                return (
                                  <Tooltip key={dep.moduleId}>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant={depEnabled ? 'default' : 'outline'}
                                        className={`text-xs cursor-help ${depEnabled ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' : ''}`}
                                      >
                                        <Puzzle className={`h-3 w-3 mr-1 ${depEnabled ? 'text-purple-500' : 'text-muted-foreground'}`} />
                                        {depModule?.metadata.name || dep.moduleId}
                                        {depEnabled && <Sparkles className="h-3 w-3 ml-1 text-purple-400" />}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {depEnabled
                                          ? t('modules.enhancedByModule', 'Enhanced by {{module}}', { module: depModule?.metadata.name || dep.moduleId })
                                          : dep.reason || t('modules.enableForFeatures', 'Enable {{module}} for more features', { module: depModule?.metadata.name || dep.moduleId })}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Recommended modules */}
                        {dependencies.filter(d => d.relationship === 'recommendedWith').length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-1 flex items-center gap-1">
                              <Lightbulb className="h-3.5 w-3.5 text-blue-500" />
                              {t('modules.recommended', 'Recommended:')}
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {dependencies.filter(d => d.relationship === 'recommendedWith').map((dep) => {
                                const depModule = moduleMap.get(dep.moduleId);
                                const depEnabled = isModuleEnabled(groupId, dep.moduleId);
                                return (
                                  <Tooltip key={dep.moduleId}>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className={`text-xs cursor-help border-blue-400/50 ${depEnabled ? 'bg-blue-500/10' : ''}`}
                                      >
                                        <Lightbulb className={`h-3 w-3 mr-1 ${depEnabled ? 'text-blue-500' : 'text-blue-400'}`} />
                                        {depModule?.metadata.name || dep.moduleId}
                                        {depEnabled && <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{dep.reason || t('modules.worksWellWith', '{{module}} works well with this module', { module: depModule?.metadata.name || dep.moduleId })}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Modules that enhance this one */}
                    {enabled && getEnhancingModules(module.metadata.id).filter(id => isModuleEnabled(groupId, id)).length > 0 && (
                      <Alert className="py-2 bg-purple-500/10 border-purple-500/20">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        <AlertDescription className="text-xs">
                          {t('modules.enhancedBy', 'Enhanced by:')} {getEnhancingModules(module.metadata.id)
                            .filter(id => isModuleEnabled(groupId, id))
                            .map(id => moduleMap.get(id)?.metadata.name || id)
                            .join(', ')}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Warning when dependencies not satisfied */}
                    {!enabled && !depsSatisfied && (
                      <Alert variant="destructive" className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {t('modules.enableFirst', 'Enable {{modules}} first', { modules: missingDeps.join(', ') })}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Info about dependents when enabled */}
                    {enabled && enabledDependents.length > 0 && (
                      <Alert className="py-2 bg-blue-500/10 border-blue-500/20">
                        <Info className="h-4 w-4 text-blue-500" />
                        <AlertDescription className="text-xs">
                          {t('modules.requiredBy', 'Required by:')} {enabledDependents.join(', ')}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <h4 className="text-sm font-medium mb-2">{t('modules.capabilities', 'Capabilities:')}</h4>
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
                        {t('modules.configure', 'Configure')}
                      </Button>
                    )}

                    {instance?.state === 'error' && (
                      <p className="text-sm text-destructive">{t('modules.error', 'Error: {{message}}', { message: instance.lastError })}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('modules.configureModule', 'Configure {{module}}', { module: selectedModule?.metadata.name })}</DialogTitle>
            <DialogDescription>{selectedModule?.metadata.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedModule?.metadata.configSchema.map((field) => (
              <div key={field.key}>{renderConfigField(field)}</div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSaveConfig}>{t('modules.saveConfiguration', 'Save Configuration')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
