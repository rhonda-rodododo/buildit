import { FC, useEffect, useState } from 'react'
import { GroupList } from './GroupList'
import { GroupView } from './GroupView'
import { CreateGroupDialog } from './CreateGroupDialog'
import { PendingInvitationsView } from './PendingInvitationsView'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Mail } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { db } from '@/core/storage/db'

export const GroupsView: FC = () => {
  const { currentIdentity } = useAuthStore()
  const [invitationCount, setInvitationCount] = useState(0)
  const [invitationsOpen, setInvitationsOpen] = useState(false)

  // Check for pending invitations
  useEffect(() => {
    const checkInvitations = async () => {
      if (!currentIdentity) {
        setInvitationCount(0)
        return
      }

      try {
        const now = Date.now()
        const count = await db.groupInvitations
          .where('inviteePubkey')
          .equals(currentIdentity.publicKey)
          .filter((inv) => inv.status === 'pending' && (!inv.expiresAt || inv.expiresAt > now))
          .count()
        setInvitationCount(count)
        // Auto-open if there are invitations
        if (count > 0) {
          setInvitationsOpen(true)
        }
      } catch (error) {
        console.error('Failed to count invitations:', error)
      }
    }

    checkInvitations()
  }, [currentIdentity?.publicKey])

  return (
    <div className="space-y-4">
      {/* Pending Invitations Banner */}
      {invitationCount > 0 && (
        <Collapsible open={invitationsOpen} onOpenChange={setInvitationsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                You have pending group invitations
                <Badge variant="secondary">{invitationCount}</Badge>
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${invitationsOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <PendingInvitationsView />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Main Groups Layout */}
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
    </div>
  )
}
