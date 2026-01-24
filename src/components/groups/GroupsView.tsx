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
    <div className="h-full flex flex-col">
      {/* Pending Invitations Banner */}
      {invitationCount > 0 && (
        <div className="p-2 border-b">
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
            <CollapsibleContent className="mt-2">
              <PendingInvitationsView />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Main Groups Layout - fills remaining height */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[280px_1fr] min-h-0">
        {/* Sidebar - Group List */}
        <div className="border-b sm:border-b-0 sm:border-r flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <CreateGroupDialog trigger={<Button className="w-full text-sm">Create Group</Button>} />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <GroupList />
          </div>
        </div>

        {/* Main - Group View */}
        <div className="overflow-y-auto">
          <GroupView />
        </div>
      </div>
    </div>
  )
}
