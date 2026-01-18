import { FC, useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGroupsStore } from '@/stores/groupsStore'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
import { useModuleStore } from '@/stores/moduleStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Lock,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Package,
  Settings2,
  Info,
} from 'lucide-react'
import { loadAllSeeds, loadTemplateSeeds } from '@/core/storage/seedLoader'
import { db } from '@/core/storage/db'
import type { GroupPrivacyLevel, GroupModule } from '@/types/group'
import { getAllModules } from '@/lib/modules/registry'
import {
  templateRegistry,
  getComplexityLabel,
  getCategoryLabel,
  createDefaultSelection,
  type GroupTemplate,
  type TemplateSelection,
  type TemplateCategory,
  BUILTIN_TEMPLATES,
} from '@/core/groupTemplates'

interface CreateGroupDialogProps {
  trigger?: React.ReactNode
}

type CreationStep = 'template' | 'customize' | 'details'

const CATEGORY_ICONS: Record<TemplateCategory, string> = {
  community: '🏘️',
  'mutual-aid': '🤝',
  organizing: '✊',
  civic: '📢',
  governance: '🗳️',
}

export const CreateGroupDialog: FC<CreateGroupDialogProps> = ({ trigger }) => {
  const { t } = useTranslation()

  // Dialog state
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<CreationStep>('template')

  // Template selection state
  const [selectedTemplate, setSelectedTemplate] = useState<GroupTemplate | null>(null)
  const [selection, setSelection] = useState<TemplateSelection | null>(null)
  const [useManualMode, setUseManualMode] = useState(false)

  // Group details state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState<GroupPrivacyLevel>('private')
  const [selectedModules, setSelectedModules] = useState<GroupModule[]>(['messaging'])
  const [loadDemoData, setLoadDemoData] = useState(false)
  const [creating, setCreating] = useState(false)
  const [availableModules, setAvailableModules] = useState<{ value: GroupModule; label: string; description: string }[]>([])

  const { createGroup } = useGroupsStore()
  const { currentIdentity, lockState } = useAuthStore()

  // Load available modules from registry only once
  useEffect(() => {
    if (availableModules.length === 0) {
      const modules = getAllModules()
      const moduleOptions = modules
        .filter(m => !['custom-fields', 'public'].includes(m.metadata.id))
        .map(m => ({
          value: m.metadata.id as GroupModule,
          label: m.metadata.name,
          description: m.metadata.description,
        }))
      setAvailableModules(moduleOptions)
    }
  }, [availableModules.length])

  // Compute resolved modules from template selection
  const resolvedModules = useMemo(() => {
    if (!selectedTemplate || !selection) return []
    try {
      const resolved = templateRegistry.resolveTemplate(selection)
      return resolved.enabledModules
    } catch {
      return []
    }
  }, [selectedTemplate, selection])

  const isLocked = lockState !== 'unlocked'

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('template')
      setSelectedTemplate(null)
      setSelection(null)
      setUseManualMode(false)
      setName('')
      setDescription('')
      setPrivacyLevel('private')
      setSelectedModules(['messaging'])
      setLoadDemoData(false)
    }
  }, [open])

  const handleSelectTemplate = (template: GroupTemplate) => {
    setSelectedTemplate(template)
    setSelection(createDefaultSelection(template))
    setPrivacyLevel(template.defaultPrivacy)
    setLoadDemoData(template.demoData?.enabledByDefault ?? false)
  }

  const handleToggleEnhancement = (enhancementId: string) => {
    if (!selection) return
    const enabled = selection.enabledEnhancements.includes(enhancementId)
    setSelection({
      ...selection,
      enabledEnhancements: enabled
        ? selection.enabledEnhancements.filter(id => id !== enhancementId)
        : [...selection.enabledEnhancements, enhancementId],
    })
  }

  const toggleModule = (module: GroupModule) => {
    if (selectedModules.includes(module)) {
      setSelectedModules(selectedModules.filter(m => m !== module))
    } else {
      setSelectedModules([...selectedModules, module])
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !currentIdentity || creating) return

    const privateKey = getCurrentPrivateKey()
    if (!privateKey) {
      alert(t('groups.pleaseUnlockToCreate', 'Please unlock the app to create a group.'))
      return
    }

    setCreating(true)
    try {
      // Determine which modules to enable
      const modulesToEnable = useManualMode
        ? selectedModules
        : resolvedModules

      const group = await createGroup(
        {
          name: name.trim(),
          description: description.trim(),
          privacyLevel,
          enabledModules: modulesToEnable,
          templateId: !useManualMode && selectedTemplate ? selectedTemplate.id : undefined,
          templateEnhancements: !useManualMode && selection ? selection.enabledEnhancements : undefined,
          includeDemoData: loadDemoData,
        },
        privateKey,
        currentIdentity.publicKey
      )

      // Enable selected modules in module store
      if (group) {
        const { enableModule } = useModuleStore.getState()
        for (const moduleId of modulesToEnable) {
          try {
            await enableModule(group.id, moduleId)
          } catch (error) {
            console.error(`Failed to enable module ${moduleId}:`, error)
          }
        }
      }

      // Load demo data if requested
      if (loadDemoData && group) {
        console.info('📦 Loading demo data for new group...')
        if (!useManualMode && selection) {
          // Use template-specific seeds with includeDemoData flag
          await loadTemplateSeeds(db, group.id, currentIdentity.publicKey, {
            ...selection,
            includeDemoData: true,
          })
        } else {
          // Manual mode: load all available seeds for selected modules
          await loadAllSeeds(db, group.id, currentIdentity.publicKey, {
            moduleIds: modulesToEnable,
          })
        }
      }

      setOpen(false)
    } catch (error) {
      console.error('Failed to create group:', error)
      alert(t('groups.createGroupFailed', 'Failed to create group. Please try again.'))
    } finally {
      setCreating(false)
    }
  }

  const canProceedFromTemplate = selectedTemplate !== null || useManualMode
  const canCreate = name.trim().length > 0 && !isLocked

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Create Group</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('groups.createNewGroup', 'Create New Group')}
            {step !== 'template' && (
              <Badge variant="outline" className="ml-2">
                {step === 'customize' ? t('templates.customize', 'Customize') : t('groups.details', 'Details')}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLocked && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              {t('groups.unlockToCreate', 'Please unlock the app to create a group. Enter your password on the main screen.')}
            </AlertDescription>
          </Alert>
        )}

        <TooltipProvider>
          <div className="mt-4">
            {/* Step 1: Template Selection */}
            {step === 'template' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('templates.subtitle', 'Choose a template to get started quickly with pre-configured modules.')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="manual-mode" className="text-sm text-muted-foreground">
                      {t('templates.manualMode', 'Manual setup')}
                    </Label>
                    <Switch
                      id="manual-mode"
                      checked={useManualMode}
                      onCheckedChange={setUseManualMode}
                    />
                  </div>
                </div>

                {!useManualMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {BUILTIN_TEMPLATES.map((template) => {
                      const isSelected = selectedTemplate?.id === template.id
                      const { base: moduleCount } = templateRegistry.getModuleCount(template.id)

                      return (
                        <Card
                          key={template.id}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? 'ring-2 ring-primary bg-primary/5'
                              : 'hover:bg-accent'
                          }`}
                          onClick={() => handleSelectTemplate(template)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{template.icon}</span>
                                <CardTitle className="text-base">{template.name}</CardTitle>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {getComplexityLabel(template.complexity)}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <CardDescription className="text-xs mb-3">
                              {template.description}
                            </CardDescription>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Package className="h-3 w-3" />
                              <span>{moduleCount} {t('templates.modules', 'modules')}</span>
                              <span className="mx-1">•</span>
                              <span>{CATEGORY_ICONS[template.category]} {t(`templates.categories.${template.category}`, getCategoryLabel(template.category))}</span>
                            </div>
                            {template.enhancements && template.enhancements.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <Sparkles className="h-3 w-3" />
                                <span>+{template.enhancements.length} {t('templates.optionalEnhancements', 'optional enhancements')}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Alert>
                    <Settings2 className="h-4 w-4" />
                    <AlertDescription>
                      {t('templates.manualModeDescription', "Manual mode: You'll select individual modules in the next step.")}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    onClick={() => setStep(useManualMode ? 'details' : 'customize')}
                    disabled={!canProceedFromTemplate}
                  >
                    {useManualMode ? t('templates.continue', 'Continue') : t('templates.customize', 'Customize')}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Customize Template (only for template mode) */}
            {step === 'customize' && selectedTemplate && selection && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                  <div>
                    <h3 className="font-semibold">{selectedTemplate.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {resolvedModules.length} {t('templates.modulesEnabled', 'modules will be enabled')}
                    </p>
                  </div>
                </div>

                {/* Enhancements */}
                {selectedTemplate.enhancements && selectedTemplate.enhancements.length > 0 && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      {t('templates.optionalEnhancements', 'Optional Enhancements')}
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedTemplate.enhancements.map((enhancement) => {
                        const isEnabled = selection.enabledEnhancements.includes(enhancement.id)
                        return (
                          <Card
                            key={enhancement.id}
                            className={`cursor-pointer transition-all ${
                              isEnabled
                                ? 'ring-2 ring-primary bg-primary/5'
                                : 'hover:bg-accent'
                            }`}
                            onClick={() => handleToggleEnhancement(enhancement.id)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={isEnabled}
                                  className="mt-0.5 pointer-events-none"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span>{enhancement.icon || '📦'}</span>
                                    <span className="font-medium text-sm">{enhancement.name}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {enhancement.description}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Enabled Modules Preview */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('templates.modulesToEnable', 'Modules to Enable')}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {resolvedModules.map((moduleId) => {
                      const module = availableModules.find(m => m.value === moduleId)
                      return (
                        <Tooltip key={moduleId}>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-help">
                              {module?.label || moduleId}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{module?.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>

                {/* Demo Data Option */}
                {selectedTemplate.demoData?.available && (
                  <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
                    <Checkbox
                      id="demo-data-template"
                      checked={loadDemoData}
                      onCheckedChange={(checked) => setLoadDemoData(checked as boolean)}
                    />
                    <div className="flex-1">
                      <Label htmlFor="demo-data-template" className="text-sm font-medium">
                        {t('templates.includeSampleData', 'Include sample data')}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedTemplate.demoData.description ||
                          t('templates.sampleDataDescription', 'Populate the group with example content to help you get started')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setStep('template')}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    {t('common.back', 'Back')}
                  </Button>
                  <Button onClick={() => setStep('details')}>
                    {t('templates.continue', 'Continue')}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Group Details */}
            {step === 'details' && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('groups.groupName', 'Group Name')} *</Label>
                    <Input
                      id="name"
                      placeholder={t('groups.enterGroupName', 'Enter group name...')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isLocked}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{t('groups.description', 'Description')}</Label>
                    <Input
                      id="description"
                      placeholder={t('groups.briefDescription', 'Brief description of the group...')}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={isLocked}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="privacy">{t('groups.privacyLevel', 'Privacy Level')}</Label>
                    <Select
                      value={privacyLevel}
                      onValueChange={(value) => setPrivacyLevel(value as GroupPrivacyLevel)}
                      disabled={isLocked}
                    >
                      <SelectTrigger id="privacy">
                        <SelectValue placeholder={t('groups.selectPrivacyLevel', 'Select privacy level')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">{t('groups.privacy.public', 'Public - Anyone can discover and join')}</SelectItem>
                        <SelectItem value="private">{t('groups.privacy.private', 'Private - Invite only, discoverable')}</SelectItem>
                        <SelectItem value="secret">{t('groups.privacy.secret', 'Secret - Invite only, hidden')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Manual Module Selection (only in manual mode) */}
                {useManualMode && (
                  <div className="space-y-2">
                    <Label id="module-selection-label">{t('groups.enableModules', 'Enable Modules')}</Label>
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      role="group"
                      aria-labelledby="module-selection-label"
                    >
                      {availableModules.map((module) => {
                        const isSelected = selectedModules.includes(module.value)
                        return (
                          <Card
                            key={module.value}
                            className={`p-3 cursor-pointer transition-colors min-h-[64px] ${
                              isSelected
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                                : 'hover:bg-accent'
                            } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !isLocked && toggleModule(module.value)}
                            tabIndex={isLocked ? -1 : 0}
                            role="checkbox"
                            aria-checked={isSelected}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                className={`mt-0.5 pointer-events-none ${
                                  isSelected
                                    ? 'border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary'
                                    : ''
                                }`}
                              />
                              <div className="flex-1">
                                <p className="font-medium text-sm">{module.label}</p>
                                <p className="text-xs opacity-90">{module.description}</p>
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>

                    {/* Demo Data Option (manual mode) */}
                    <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg mt-4">
                      <Checkbox
                        id="demo-data-manual"
                        checked={loadDemoData}
                        onCheckedChange={(checked) => setLoadDemoData(checked as boolean)}
                        disabled={isLocked}
                      />
                      <div className="flex-1">
                        <Label htmlFor="demo-data-manual" className="text-sm font-medium">
                          {t('templates.includeSampleData', 'Include sample data')}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('templates.sampleDataDescription', 'Populate the group with example content to help you get started')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary (template mode) */}
                {!useManualMode && selectedTemplate && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('common.summary', 'Summary')}</span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        {t('templates.template', 'Template')}: <span className="font-medium text-foreground">{selectedTemplate.icon} {selectedTemplate.name}</span>
                      </p>
                      <p>
                        {t('templates.modules', 'Modules')}: <span className="font-medium text-foreground">{resolvedModules.length} {t('templates.enabled', 'enabled')}</span>
                      </p>
                      {selection && selection.enabledEnhancements.length > 0 && (
                        <p>
                          {t('templates.enhancements', 'Enhancements')}: <span className="font-medium text-foreground">{selection.enabledEnhancements.length} {t('templates.added', 'added')}</span>
                        </p>
                      )}
                      {loadDemoData && (
                        <p className="text-green-600">{t('templates.demoDataWillBeLoaded', 'Demo data will be loaded')}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setStep(useManualMode ? 'template' : 'customize')}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    {t('common.back', 'Back')}
                  </Button>
                  <Button onClick={handleCreate} disabled={!canCreate || creating}>
                    {creating ? t('groups.creating', 'Creating...') : t('groups.createGroup', 'Create Group')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  )
}
