/**
 * @buildit/sdk - Core Types
 *
 * Shared type definitions for BuildIt Network.
 */

/**
 * Nostr keypair
 */
export interface NostrKeypair {
  privateKey: Uint8Array
  publicKey: string
  privateKeyHex: string
}

/**
 * User identity (minimal, portable)
 */
export interface NostrIdentity {
  pubkey: string
  name?: string
  displayName?: string
  about?: string
  picture?: string
  nip05?: string
}

/**
 * Group membership role
 */
export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member' | 'viewer'

/**
 * Group membership
 */
export interface GroupMembership {
  pubkey: string
  role: GroupRole
  joinedAt: number
  invitedBy?: string
}

/**
 * Privacy level for content
 */
export type PrivacyLevel = 'public' | 'unlisted' | 'group' | 'private'

/**
 * Message status
 */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

/**
 * Direct message (portable)
 */
export interface DirectMessage {
  id: string
  content: string
  senderPubkey: string
  recipientPubkey: string
  createdAt: number
  status: MessageStatus
  replyToId?: string
}

/**
 * Group message (portable)
 */
export interface GroupMessage {
  id: string
  content: string
  groupId: string
  senderPubkey: string
  createdAt: number
  status: MessageStatus
  replyToId?: string
}

/**
 * Device info for multi-device sync
 */
export interface DeviceInfo {
  id: string
  name: string
  type: 'web' | 'mobile' | 'desktop'
  platform?: string
  lastSeen: number
  createdAt: number
}

/**
 * NIP-46 permission types
 */
export type Nip46Permission =
  | 'sign_event'
  | 'nip04_encrypt'
  | 'nip04_decrypt'
  | 'nip44_encrypt'
  | 'nip44_decrypt'
  | 'get_public_key'
  | 'get_relays'
  | 'connect'

/**
 * NIP-46 bunker connection
 */
export interface BunkerConnection {
  id: string
  name: string
  pubkey: string
  relayUrl: string
  permissions: Nip46Permission[]
  autoApprove: boolean
  createdAt: number
  lastUsed: number
}
