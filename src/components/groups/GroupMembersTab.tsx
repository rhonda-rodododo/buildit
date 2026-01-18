import { FC, useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { MemberInviteDialog } from './MemberInviteDialog'
import { db, type DBGroupMember, type DBGroupInvitation } from '@/core/storage/db'
import { useAuthStore } from '@/stores/authStore'
import { UserHandle } from '@/components/user/UserHandle'
import { Crown, Shield, User, Eye, UserMinus, Clock, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface GroupMembersTabProps {
  groupId: string
  groupName: string
  adminPubkeys: string[]
}

type MemberRole = DBGroupMember['role']

const roleIcons: Record<MemberRole, React.ReactNode> = {
  admin: <Crown className="h-3.5 w-3.5" />,
  moderator: <Shield className="h-3.5 w-3.5" />,
  member: <User className="h-3.5 w-3.5" />,
  'read-only': <Eye className="h-3.5 w-3.5" />,
}

const roleLabels: Record<MemberRole, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  member: 'Member',
  'read-only': 'Read Only',
}

const roleBadgeVariants: Record<MemberRole, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  moderator: 'secondary',
  member: 'outline',
  'read-only': 'outline',
}

export const GroupMembersTab: FC<GroupMembersTabProps> = ({
  groupId,
  groupName,
  adminPubkeys,
}) => {
  const { currentIdentity } = useAuthStore()
  const [members, setMembers] = useState<DBGroupMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<DBGroupInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [removingMember, setRemovingMember] = useState<DBGroupMember | null>(null)
  const [revokingInvite, setRevokingInvite] = useState<DBGroupInvitation | null>(null)

  const isAdmin = currentIdentity && adminPubkeys.includes(currentIdentity.publicKey)

  const loadData = async () => {
    setLoading(true)
    try {
      const [loadedMembers, loadedInvites] = await Promise.all([
        db.groupMembers.where('groupId').equals(groupId).toArray(),
        db.groupInvitations
          .where('groupId')
          .equals(groupId)
          .filter((inv) => inv.status === 'pending')
          .toArray(),
      ])
      setMembers(loadedMembers)
      setPendingInvites(loadedInvites)
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [groupId])

  const handleRoleChange = async (member: DBGroupMember, newRole: MemberRole) => {
    if (!member.id) return

    try {
      await db.groupMembers.update(member.id, { role: newRole })
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      )
    } catch (error) {
      console.error('Failed to update role:', error)
      alert('Failed to update member role')
    }
  }

  const handleRemoveMember = async () => {
    if (!removingMember?.id) return

    try {
      await db.groupMembers.delete(removingMember.id)
      setMembers((prev) => prev.filter((m) => m.id !== removingMember.id))
      setRemovingMember(null)
    } catch (error) {
      console.error('Failed to remove member:', error)
      alert('Failed to remove member')
    }
  }

  const handleRevokeInvite = async () => {
    if (!revokingInvite) return

    try {
      await db.groupInvitations.update(revokingInvite.id, { status: 'revoked' })
      setPendingInvites((prev) => prev.filter((inv) => inv.id !== revokingInvite.id))
      setRevokingInvite(null)
    } catch (error) {
      console.error('Failed to revoke invite:', error)
      alert('Failed to revoke invitation')
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading members...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header with Invite Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Members</h3>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''} in this group
          </p>
        </div>
        {isAdmin && (
          <MemberInviteDialog
            groupId={groupId}
            groupName={groupName}
            onInviteSent={loadData}
          />
        )}
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Pending Invitations ({pendingInvites.length})
            </h4>
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    {invite.inviteePubkey ? (
                      <UserHandle pubkey={invite.inviteePubkey} format="display-name" />
                    ) : invite.code ? (
                      <span className="font-mono text-sm">Invite Link: {invite.code}</span>
                    ) : (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {roleLabels[invite.role]}
                      </Badge>
                      {invite.expiresAt && (
                        <span>
                          Expires {formatDistanceToNow(invite.expiresAt, { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRevokingInvite(invite)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Member List */}
      <Separator />
      <div className="space-y-2">
        {members.map((member) => {
          const isCurrentUser = member.pubkey === currentIdentity?.publicKey
          const canEdit = isAdmin && !isCurrentUser

          return (
            <div
              key={member.id || member.pubkey}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.pubkey}`}
                  />
                  <AvatarFallback>
                    {member.pubkey.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <UserHandle
                      pubkey={member.pubkey}
                      format="display-name"
                      className="font-medium"
                    />
                    {isCurrentUser && (
                      <Badge variant="secondary" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge
                      variant={roleBadgeVariants[member.role]}
                      className="gap-1 text-xs"
                    >
                      {roleIcons[member.role]}
                      {roleLabels[member.role]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Joined {formatDistanceToNow(member.joined, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2">
                  <Select
                    value={member.role}
                    onValueChange={(v) => handleRoleChange(member, v as MemberRole)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="read-only">Read Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRemovingMember(member)}
                    className="text-destructive hover:text-destructive"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )
        })}

        {members.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No members found. Be the first to invite someone!
          </div>
        )}
      </div>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the group? They will need to be
              re-invited to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invite Confirmation */}
      <AlertDialog open={!!revokingInvite} onOpenChange={() => setRevokingInvite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this invitation? The invite link or direct
              invite will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeInvite}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
