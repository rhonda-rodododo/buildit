import { FC, useState, useEffect } from 'react'
import { useGroupsStore } from '@/stores/groupsStore'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
import { useModuleStore } from '@/stores/moduleStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock } from 'lucide-react'
import { loadAllSeeds } from '@/core/storage/seedLoader'
import { db } from '@/core/storage/db'
import type { GroupPrivacyLevel, GroupModule } from '@/types/group'
import { getAllModules } from '@/lib/modules/registry'

interface CreateGroupDialogProps {
  trigger?: React.ReactNode
}

export const CreateGroupDialog: FC<CreateGroupDialogProps> = ({ trigger }) => {
  const [open, setOpen] = useState(false)
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
    // Only load if we haven't loaded yet
    if (availableModules.length === 0) {
      const modules = getAllModules()
      const moduleOptions = modules
        .filter(m => !['custom-fields', 'public'].includes(m.metadata.id)) // Exclude always-on modules
        .map(m => ({
          value: m.metadata.id as GroupModule,
          label: m.metadata.name,
          description: m.metadata.description,
        }))
      setAvailableModules(moduleOptions)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  const toggleModule = (module: GroupModule) => {
    if (selectedModules.includes(module)) {
      setSelectedModules(selectedModules.filter(m => m !== module))
    } else {
      setSelectedModules([...selectedModules, module])
    }
  }

  const isLocked = lockState !== 'unlocked'

  const handleCreate = async () => {
    if (!name.trim() || !currentIdentity || creating) return

    // Check if app is unlocked
    const privateKey = getCurrentPrivateKey()
    if (!privateKey) {
      alert('Please unlock the app to create a group.')
      return
    }

    setCreating(true)
    try {
      const group = await createGroup(
        {
          name: name.trim(),
          description: description.trim(),
          privacyLevel,
          enabledModules: selectedModules,
        },
        privateKey,
        currentIdentity.publicKey
      )

      // Enable selected modules in module store
      if (group) {
        const { enableModule } = useModuleStore.getState()
        for (const moduleId of selectedModules) {
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
        await loadAllSeeds(db, group.id, currentIdentity.publicKey, {
          moduleIds: selectedModules,
        })
      }

      // Reset form
      setName('')
      setDescription('')
      setPrivacyLevel('private')
      setSelectedModules(['messaging'])
      setLoadDemoData(false)
      setOpen(false)
    } catch (error) {
      console.error('Failed to create group:', error)
      alert('Failed to create group. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Create Group</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>

        {isLocked && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Please unlock the app to create a group. Enter your password on the main screen.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6 mt-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input
                id="name"
                placeholder="Enter group name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLocked}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the group..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLocked}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="privacy">Privacy Level</Label>
              <Select
                value={privacyLevel}
                onValueChange={(value) => setPrivacyLevel(value as GroupPrivacyLevel)}
                disabled={isLocked}
              >
                <SelectTrigger id="privacy">
                  <SelectValue placeholder="Select privacy level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public - Anyone can discover and join</SelectItem>
                  <SelectItem value="private">Private - Invite only, discoverable</SelectItem>
                  <SelectItem value="secret">Secret - Invite only, hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Module Selection */}
          <div className="space-y-2">
            <Label>Enable Modules</Label>
            <div className="grid grid-cols-2 gap-3">
              {availableModules.map((module) => (
                <Card
                  key={module.value}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedModules.includes(module.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  } ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => !isLocked && toggleModule(module.value)}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(module.value)}
                      onChange={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 pointer-events-none"
                      readOnly
                      disabled={isLocked}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{module.label}</p>
                      <p className="text-xs opacity-90">{module.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Demo Data Option */}
          <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
            <Checkbox
              id="demo-data"
              checked={loadDemoData}
              onCheckedChange={(checked) => setLoadDemoData(checked as boolean)}
              disabled={isLocked}
            />
            <div className="flex-1">
              <Label
                htmlFor="demo-data"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Load demo data
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Populate the group with example events, wiki pages, proposals, and resources to help you get started
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || creating || isLocked}>
              {creating ? 'Creating...' : 'Create Group'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
