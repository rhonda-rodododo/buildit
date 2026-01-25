import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserPlus, Link2, Copy, Check } from 'lucide-react'
import { db, type DBGroupInvitation, type DBGroupMember } from '@/core/storage/db'
import { useAuthStore } from '@/stores/authStore'
import { nanoid } from 'nanoid'

interface MemberInviteDialogProps {
  groupId: string
  groupName: string
  onInviteSent?: () => void
  trigger?: React.ReactNode
}

type MemberRole = DBGroupMember['role']

export const MemberInviteDialog: FC<MemberInviteDialogProps> = ({
  groupId,
  groupName,
  onInviteSent,
  trigger,
}) => {
  const { t } = useTranslation()
  const { currentIdentity } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Direct invite state
  const [inviteePubkey, setInviteePubkey] = useState('')
  const [message, setMessage] = useState('')
  const [role, setRole] = useState<MemberRole>('member')

  // Link invite state
  const [generatedLink, setGeneratedLink] = useState('')
  const [linkExpiry, setLinkExpiry] = useState('7') // days
  const [linkRole, setLinkRole] = useState<MemberRole>('member')

  const handleDirectInvite = async () => {
    if (!currentIdentity || !inviteePubkey.trim()) return

    setLoading(true)
    try {
      const invitation: DBGroupInvitation = {
        id: nanoid(),
        groupId,
        inviterPubkey: currentIdentity.publicKey,
        inviteePubkey: inviteePubkey.trim(),
        role,
        status: 'pending',
        message: message.trim() || undefined,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      }

      await db.groupInvitations.add(invitation)

      // Reset form
      setInviteePubkey('')
      setMessage('')
      setRole('member')

      onInviteSent?.()
      setOpen(false)
    } catch (error) {
      console.error('Failed to send invitation:', error)
      alert(t('memberInviteDialog.failedToSend'))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateLink = async () => {
    if (!currentIdentity) return

    setLoading(true)
    try {
      const code = nanoid(12).toUpperCase()
      const expiryDays = parseInt(linkExpiry)
      const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000

      const invitation: DBGroupInvitation = {
        id: nanoid(),
        groupId,
        inviterPubkey: currentIdentity.publicKey,
        code,
        role: linkRole,
        status: 'pending',
        createdAt: Date.now(),
        expiresAt,
      }

      await db.groupInvitations.add(invitation)

      // Generate shareable link
      const link = `${window.location.origin}/invite/${code}`
      setGeneratedLink(link)

      onInviteSent?.()
    } catch (error) {
      console.error('Failed to generate invite link:', error)
      alert(t('memberInviteDialog.failedToGenerate'))
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset state when closing
      setInviteePubkey('')
      setMessage('')
      setRole('member')
      setGeneratedLink('')
      setLinkExpiry('7')
      setLinkRole('member')
      setCopied(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            {t('memberInviteDialog.inviteMembers')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('memberInviteDialog.inviteTo', { name: groupName })}</DialogTitle>
          <DialogDescription>
            {t('memberInviteDialog.inviteDescription')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {t('memberInviteDialog.directTab')}
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {t('memberInviteDialog.linkTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="invitee-pubkey">{t('memberInviteDialog.publicKeyLabel')}</Label>
              <Input
                id="invitee-pubkey"
                value={inviteePubkey}
                onChange={(e) => setInviteePubkey(e.target.value)}
                placeholder={t('memberInviteDialog.publicKeyPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">{t('memberInviteDialog.roleLabel')}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t('memberInviteDialog.roles.member')}</SelectItem>
                  <SelectItem value="moderator">{t('memberInviteDialog.roles.moderator')}</SelectItem>
                  <SelectItem value="admin">{t('memberInviteDialog.roles.admin')}</SelectItem>
                  <SelectItem value="read-only">{t('memberInviteDialog.roles.readOnly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-message">{t('memberInviteDialog.messageLabel')}</Label>
              <Textarea
                id="invite-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('memberInviteDialog.messagePlaceholder')}
                rows={3}
              />
            </div>

            <Button
              onClick={handleDirectInvite}
              disabled={loading || !inviteePubkey.trim()}
              className="w-full"
            >
              {loading ? t('memberInviteDialog.sending') : t('memberInviteDialog.sendInvitation')}
            </Button>
          </TabsContent>

          <TabsContent value="link" className="space-y-4 mt-4">
            {!generatedLink ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="link-role">{t('memberInviteDialog.defaultRole')}</Label>
                  <Select value={linkRole} onValueChange={(v) => setLinkRole(v as MemberRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">{t('memberInviteDialog.roles.member')}</SelectItem>
                      <SelectItem value="read-only">{t('memberInviteDialog.roles.readOnly')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('memberInviteDialog.roleDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link-expiry">{t('memberInviteDialog.expiresIn')}</Label>
                  <Select value={linkExpiry} onValueChange={setLinkExpiry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{t('memberInviteDialog.expiryOptions.1day')}</SelectItem>
                      <SelectItem value="7">{t('memberInviteDialog.expiryOptions.7days')}</SelectItem>
                      <SelectItem value="30">{t('memberInviteDialog.expiryOptions.30days')}</SelectItem>
                      <SelectItem value="90">{t('memberInviteDialog.expiryOptions.90days')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerateLink}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? t('memberInviteDialog.generating') : t('memberInviteDialog.generateInviteLink')}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('memberInviteDialog.inviteLink')}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={generatedLink}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                      className="shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('memberInviteDialog.shareLink')}
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setGeneratedLink('')}
                  className="w-full"
                >
                  {t('memberInviteDialog.generateNewLink')}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
