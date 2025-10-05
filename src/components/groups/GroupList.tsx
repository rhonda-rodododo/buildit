import { FC, useEffect } from 'react'
import { useGroupsStore } from '@/stores/groupsStore'
import { useAuthStore } from '@/stores/authStore'
import { Card } from '@/components/ui/card'

interface GroupListProps {
  onSelectGroup?: (groupId: string) => void
}

export const GroupList: FC<GroupListProps> = ({ onSelectGroup }) => {
  const { groups, activeGroup, setActiveGroup, loadGroups, isLoading } = useGroupsStore()
  const { currentIdentity } = useAuthStore()

  useEffect(() => {
    if (!currentIdentity) return

    loadGroups(currentIdentity.publicKey)
  }, [currentIdentity, loadGroups])

  const handleSelectGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (group) {
      setActiveGroup(group)
      onSelectGroup?.(groupId)
    }
  }

  if (!currentIdentity) {
    return <div>Please log in to view groups</div>
  }

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8">Loading groups...</div>
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold mb-4">Your Groups</h2>
      {groups.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No groups yet. Create one to get started!
        </Card>
      ) : (
        groups.map((group) => {
          const isActive = activeGroup?.id === group.id
          const memberCount = group.adminPubkeys.length // Simplified

          return (
            <Card
              key={group.id}
              className={`p-4 cursor-pointer transition-colors hover:bg-accent ${
                isActive ? 'bg-accent border-primary' : ''
              }`}
              onClick={() => handleSelectGroup(group.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{group.name}</p>
                    {group.privacy === 'private' && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">Private</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {group.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                    {group.enabledModules.length > 0 && (
                      <span>• {group.enabledModules.length} modules</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}
