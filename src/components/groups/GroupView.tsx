import { FC } from 'react'
import { useGroupsStore } from '@/stores/groupsStore'

import { GroupSettingsDialog } from '@/components/groups/GroupSettingsDialog'
import { Outlet } from 'react-router-dom'


export const GroupView: FC = () => {
  const { activeGroup } = useGroupsStore()


  if (!activeGroup) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select a group to view details
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{activeGroup.name}</h2>
            <p className="text-muted-foreground mt-1">{activeGroup.description}</p>
          </div>
          <GroupSettingsDialog group={activeGroup} />
        </div>

        {/* Group Info */}
        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <span className="capitalize">{activeGroup.privacy} group</span>
          <span>•</span>
          <span>{activeGroup.adminPubkeys.length} members</span>
          {activeGroup.enabledModules.length > 0 && (
            <>
              <span>•</span>
              <span>{activeGroup.enabledModules.length} modules enabled</span>
            </>
          )}
        </div>
      </div>

      {/* Modules */}
      <div className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </div>
    </div>
  )
}
