import { FC } from 'react'
import { GroupList } from './GroupList'
import { GroupView } from './GroupView'
import { CreateGroupDialog } from './CreateGroupDialog'
import { Button } from '@/components/ui/button'

export const GroupsView: FC = () => {
  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar - Group List */}
      <div className="w-80 border-r pr-4 flex flex-col">
        <div className="mb-4">
          <CreateGroupDialog trigger={<Button className="w-full">Create Group</Button>} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <GroupList />
        </div>
      </div>

      {/* Main - Group View */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <GroupView />
      </div>
    </div>
  )
}
