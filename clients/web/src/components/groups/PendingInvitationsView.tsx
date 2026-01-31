import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useGroupsStore } from '@/stores/groupsStore'
import { useAuthStore } from '@/stores/authStore'
import { dal } from '@/core/storage/dal'
import type { DBGroupInvitation, DBGroup } from '@/core/storage/db'
import { UserHandle } from '@/components/user/UserHandle'
import { Mail, Check, X, Clock, Users, Shield, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface InvitationWithGroup extends DBGroupInvitation {
  group?: DBGroup
}

export const PendingInvitationsView: FC = () => {
  const { t } = useTranslation()
  const { currentIdentity } = useAuthStore()
  const { acceptInvitation, declineInvitation, loadGroups } = useGroupsStore()
  const [invitations, setInvitations] = useState<InvitationWithGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const loadInvitations = async () => {
    if (!currentIdentity) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const now = Date.now()
      // Get pending invitations for current user
      const pendingInvites = await dal.queryCustom<DBGroupInvitation>({
        sql: `SELECT * FROM group_invitations WHERE invitee_pubkey = ? AND status = 'pending' AND (expires_at IS NULL OR expires_at > ?)`,
        params: [currentIdentity.publicKey, now],
        dexieFallback: async (db) => {
          return db.table('groupInvitations')
            .where('inviteePubkey')
            .equals(currentIdentity.publicKey)
            .filter((inv: DBGroupInvitation) => inv.status === 'pending' && (!inv.expiresAt || inv.expiresAt > now))
            .toArray();
        },
      })

      // Load group info for each invitation
      const groupIds = [...new Set(pendingInvites.map((inv) => inv.groupId))]
      const groups = groupIds.length > 0
        ? await dal.queryCustom<DBGroup>({
            sql: `SELECT * FROM groups WHERE id IN (${groupIds.map(() => '?').join(',')})`,
            params: groupIds,
            dexieFallback: async (db) => {
              return db.table('groups').where('id').anyOf(groupIds).toArray();
            },
          })
        : []
      const groupMap = new Map(groups.map((g) => [g.id, g]))

      const invitesWithGroups: InvitationWithGroup[] = pendingInvites.map((inv) => ({
        ...inv,
        group: groupMap.get(inv.groupId),
      }))

      setInvitations(invitesWithGroups)
    } catch (error) {
      console.error('Failed to load invitations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvitations()
  }, [currentIdentity?.publicKey])

  const handleAccept = async (invitation: InvitationWithGroup) => {
    if (!currentIdentity) return

    setProcessingIds((prev) => new Set(prev).add(invitation.id))
    try {
      await acceptInvitation(invitation.id, currentIdentity.publicKey)
      // Reload both invitations and groups
      await loadInvitations()
      await loadGroups(currentIdentity.publicKey)
    } catch (error) {
      console.error('Failed to accept invitation:', error)
      alert(t('pendingInvitations.errors.acceptFailed'))
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(invitation.id)
        return next
      })
    }
  }

  const handleDecline = async (invitation: InvitationWithGroup) => {
    setProcessingIds((prev) => new Set(prev).add(invitation.id))
    try {
      await declineInvitation(invitation.id)
      await loadInvitations()
    } catch (error) {
      console.error('Failed to decline invitation:', error)
      alert(t('pendingInvitations.errors.declineFailed'))
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(invitation.id)
        return next
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('pendingInvitations.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('pendingInvitations.title')}
          </CardTitle>
          <CardDescription>
            {t('pendingInvitations.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('pendingInvitations.empty.title')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('pendingInvitations.empty.description')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          {t('pendingInvitations.title')}
          <Badge variant="secondary" className="ml-2">
            {invitations.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          {t('pendingInvitations.reviewDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invitations.map((invitation, index) => {
            const isProcessing = processingIds.has(invitation.id)
            const isExpiringSoon =
              invitation.expiresAt && invitation.expiresAt - Date.now() < 24 * 60 * 60 * 1000

            return (
              <div key={invitation.id}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium truncate">
                        {invitation.group?.name || t('pendingInvitations.invitation.unknownGroup')}
                      </h4>
                      <Badge
                        variant={
                          invitation.group?.privacy === 'private' ? 'secondary' : 'outline'
                        }
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {invitation.group?.privacy || 'public'}
                      </Badge>
                      <Badge variant="outline">{invitation.role}</Badge>
                    </div>

                    {invitation.group?.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {invitation.group.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        {t('pendingInvitations.invitation.invitedBy')}{' '}
                        <UserHandle
                          pubkey={invitation.inviterPubkey}
                          format="display-name"
                          className="font-medium"
                        />
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(invitation.createdAt, { addSuffix: true })}
                      </span>
                      {invitation.expiresAt && (
                        <span
                          className={`flex items-center gap-1 ${isExpiringSoon ? 'text-destructive' : ''}`}
                        >
                          {isExpiringSoon && <AlertCircle className="h-3 w-3" />}
                          {t('pendingInvitations.invitation.expires', { time: formatDistanceToNow(invitation.expiresAt, { addSuffix: true }) })}
                        </span>
                      )}
                    </div>

                    {invitation.message && (
                      <p className="text-sm mt-2 italic bg-muted/50 p-2 rounded">
                        "{invitation.message}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecline(invitation)}
                      disabled={isProcessing}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('pendingInvitations.actions.decline')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(invitation)}
                      disabled={isProcessing}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t('pendingInvitations.actions.accept')}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
