import { FC, useState } from 'react'
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
      alert('Failed to send invitation')
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
      alert('Failed to generate invite link')
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
            Invite Members
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {groupName}</DialogTitle>
          <DialogDescription>
            Invite new members to join this group
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Direct
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="invitee-pubkey">Public Key or npub</Label>
              <Input
                id="invitee-pubkey"
                value={inviteePubkey}
                onChange={(e) => setInviteePubkey(e.target.value)}
                placeholder="npub1... or hex public key"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="read-only">Read Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-message">Message (optional)</Label>
              <Textarea
                id="invite-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal message..."
                rows={3}
              />
            </div>

            <Button
              onClick={handleDirectInvite}
              disabled={loading || !inviteePubkey.trim()}
              className="w-full"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </TabsContent>

          <TabsContent value="link" className="space-y-4 mt-4">
            {!generatedLink ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="link-role">Default Role</Label>
                  <Select value={linkRole} onValueChange={(v) => setLinkRole(v as MemberRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="read-only">Read Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Role assigned to anyone who joins via this link
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link-expiry">Expires In</Label>
                  <Select value={linkExpiry} onValueChange={setLinkExpiry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerateLink}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Generating...' : 'Generate Invite Link'}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Invite Link</Label>
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
                    Share this link with people you want to invite
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setGeneratedLink('')}
                  className="w-full"
                >
                  Generate New Link
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
