import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { dal } from '@/core/storage/dal'
import type { DBGroupMember, DBGroupInvitation } from '@/core/storage/db'
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

// Role labels are handled via i18n: t('groupMembersTab.roles.{role}')

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
  const { t } = useTranslation()
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
        dal.query<DBGroupMember>('groupMembers', { whereClause: { groupId } }),
        dal.queryCustom<DBGroupInvitation>({
          sql: `SELECT * FROM group_invitations WHERE group_id = ? AND status = 'pending'`,
          params: [groupId],
          dexieFallback: async (db) => {
            return db.table('groupInvitations')
              .where('groupId')
              .equals(groupId)
              .filter((inv: DBGroupInvitation) => inv.status === 'pending')
              .toArray();
          },
        }),
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
      await dal.update('groupMembers', member.id, { role: newRole })
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      )
    } catch (error) {
      console.error('Failed to update role:', error)
      alert(t('groupMembersTab.alerts.failedToUpdateRole'))
    }
  }

  const handleRemoveMember = async () => {
    if (!removingMember?.id) return

    try {
      await dal.delete('groupMembers', removingMember.id)
      setMembers((prev) => prev.filter((m) => m.id !== removingMember.id))
      setRemovingMember(null)
    } catch (error) {
      console.error('Failed to remove member:', error)
      alert(t('groupMembersTab.alerts.failedToRemoveMember'))
    }
  }

  const handleRevokeInvite = async () => {
    if (!revokingInvite) return

    try {
      await dal.update('groupInvitations', revokingInvite.id, { status: 'revoked' })
      setPendingInvites((prev) => prev.filter((inv) => inv.id !== revokingInvite.id))
      setRevokingInvite(null)
    } catch (error) {
      console.error('Failed to revoke invite:', error)
      alert(t('groupMembersTab.alerts.failedToRevokeInvite'))
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">{t('groupMembersTab.loading')}</div>
  }

  return (
    <div className="space-y-6">
      {/* Header with Invite Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t('groupMembersTab.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('groupMembersTab.memberCount', { count: members.length })}
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
              {t('groupMembersTab.pendingInvitations', { count: pendingInvites.length })}
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
                      <span className="font-mono text-sm">{t('groupMembersTab.inviteLink', { code: invite.code })}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('groupMembersTab.unknown')}</span>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {t(`groupMembersTab.roles.${invite.role}`)}
                      </Badge>
                      {invite.expiresAt && (
                        <span>
                          {t('groupMembersTab.expires', { time: formatDistanceToNow(invite.expiresAt, { addSuffix: true }) })}
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
                        {t('groupMembersTab.you')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge
                      variant={roleBadgeVariants[member.role]}
                      className="gap-1 text-xs"
                    >
                      {roleIcons[member.role]}
                      {t(`groupMembersTab.roles.${member.role}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t('groupMembersTab.joined', { time: formatDistanceToNow(member.joined, { addSuffix: true }) })}
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
                      <SelectItem value="admin">{t('groupMembersTab.roles.admin')}</SelectItem>
                      <SelectItem value="moderator">{t('groupMembersTab.roles.moderator')}</SelectItem>
                      <SelectItem value="member">{t('groupMembersTab.roles.member')}</SelectItem>
                      <SelectItem value="read-only">{t('groupMembersTab.roles.read-only')}</SelectItem>
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
            {t('groupMembersTab.noMembers')}
          </div>
        )}
      </div>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('groupMembersTab.removeDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('groupMembersTab.removeDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('groupMembersTab.removeDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('groupMembersTab.removeDialog.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invite Confirmation */}
      <AlertDialog open={!!revokingInvite} onOpenChange={() => setRevokingInvite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('groupMembersTab.revokeDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('groupMembersTab.revokeDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('groupMembersTab.revokeDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeInvite}>{t('groupMembersTab.revokeDialog.revoke')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
