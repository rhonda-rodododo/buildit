import { FC, useState } from 'react'
import { useGroupsStore } from '@/stores/groupsStore'
import { useAuthStore } from '@/stores/authStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GroupPrivacyLevel, GroupModule } from '@/types/group'

interface CreateGroupDialogProps {
  trigger?: React.ReactNode
}

const AVAILABLE_MODULES: { value: GroupModule; label: string; description: string }[] = [
  { value: 'messaging', label: 'Messaging', description: 'Group chat and discussions' },
  { value: 'events', label: 'Events', description: 'Create and manage events' },
  { value: 'mutual-aid', label: 'Mutual Aid', description: 'Request and offer help' },
  { value: 'governance', label: 'Governance', description: 'Proposals and voting' },
  { value: 'wiki', label: 'Wiki', description: 'Shared knowledge base' },
  { value: 'crm', label: 'CRM', description: 'Contact management' },
]

export const CreateGroupDialog: FC<CreateGroupDialogProps> = ({ trigger }) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState<GroupPrivacyLevel>('private')
  const [selectedModules, setSelectedModules] = useState<GroupModule[]>(['messaging'])
  const [creating, setCreating] = useState(false)

  const { createGroup } = useGroupsStore()
  const { currentIdentity } = useAuthStore()

  const toggleModule = (module: GroupModule) => {
    if (selectedModules.includes(module)) {
      setSelectedModules(selectedModules.filter(m => m !== module))
    } else {
      setSelectedModules([...selectedModules, module])
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !currentIdentity || creating) return

    setCreating(true)
    try {
      await createGroup(
        {
          name: name.trim(),
          description: description.trim(),
          privacyLevel,
          enabledModules: selectedModules,
        },
        currentIdentity.privateKey,
        currentIdentity.publicKey
      )

      // Reset form
      setName('')
      setDescription('')
      setPrivacyLevel('private')
      setSelectedModules(['messaging'])
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the group..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="privacy">Privacy Level</Label>
              <Select value={privacyLevel} onValueChange={(value) => setPrivacyLevel(value as GroupPrivacyLevel)}>
                <SelectTrigger>
                  <SelectValue />
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
              {AVAILABLE_MODULES.map((module) => (
                <Card
                  key={module.value}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedModules.includes(module.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => toggleModule(module.value)}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(module.value)}
                      onChange={() => toggleModule(module.value)}
                      className="mt-1"
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || creating}>
              {creating ? 'Creating...' : 'Create Group'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
