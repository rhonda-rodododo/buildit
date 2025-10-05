export type NotificationType =
  | 'new_dm'
  | 'new_group_message'
  | 'group_invitation'
  | 'event_rsvp'
  | 'proposal_update'
  | 'vote_reminder'
  | 'mention'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: number
  read: boolean
  actionUrl?: string

  // Metadata for different notification types
  metadata?: {
    conversationId?: string
    threadId?: string
    groupId?: string
    eventId?: string
    proposalId?: string
    fromPubkey?: string
  }
}
