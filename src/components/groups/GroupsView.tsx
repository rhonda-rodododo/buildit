import { FC } from 'react'
import { GroupList } from './GroupList'
import { GroupView } from './GroupView'
import { CreateGroupDialog } from './CreateGroupDialog'
import { Button } from '@/components/ui/button'

export const GroupsView: FC = () => {
  return (
    <div className="flex flex-col sm:flex-row h-[calc(100vh-14rem)] sm:h-[calc(100vh-10rem)] gap-4">
      {/* Sidebar - Group List */}
      <div className="w-full sm:w-80 border-b sm:border-b-0 sm:border-r pb-4 sm:pb-0 sm:pr-4 flex flex-col max-h-64 sm:max-h-none">
        <div className="mb-4">
          <CreateGroupDialog trigger={<Button className="w-full text-sm">Create Group</Button>} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <GroupList />
        </div>
      </div>

      {/* Main - Group View */}
      <div className="flex-1 border rounded-lg overflow-hidden min-h-[300px]">
        <GroupView />
      </div>
    </div>
  )
}
