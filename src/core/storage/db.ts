import Dexie, { type Table } from 'dexie'

// Database schema interfaces
export interface DBIdentity {
  publicKey: string // primary key
  encryptedPrivateKey: string
  name: string
  created: number
  lastUsed: number
}

export interface DBGroup {
  id: string // primary key
  name: string
  description: string
  adminPubkeys: string[]
  created: number
  privacy: 'public' | 'private'
  encryptedGroupKey?: string
  enabledModules: string[]
}

export interface DBGroupMember {
  id?: number
  groupId: string
  pubkey: string
  role: 'admin' | 'moderator' | 'member' | 'read-only'
  joined: number
}

export interface DBMessage {
  id: string // event id
  groupId: string | null
  authorPubkey: string
  recipientPubkey?: string
  content: string
  kind: number
  timestamp: number
  tags: string[][]
  parentId?: string
  threadId?: string
}

export interface DBEvent {
  id: string // event id
  groupId: string
  title: string
  description: string
  startTime: number
  endTime: number
  location?: string
  privacy: 'public' | 'group' | 'private' | 'direct-action'
  capacity?: number
  createdBy: string
  created: number
  tags: string[]
}

export interface DBRSVP {
  id?: number
  eventId: string
  pubkey: string
  status: 'going' | 'maybe' | 'not-going'
  timestamp: number
}

export interface DBProposal {
  id: string // event id
  groupId: string
  title: string
  description: string
  status: 'draft' | 'discussion' | 'voting' | 'decided'
  votingMethod: 'simple' | 'ranked-choice' | 'quadratic' | 'dh ondt' | 'consensus'
  votingDeadline?: number
  createdBy: string
  created: number
}

export interface DBVote {
  id?: number
  proposalId: string
  voterPubkey: string
  encryptedBallot: string
  timestamp: number
}

export interface DBContact {
  id: string // uuid
  groupId: string
  name: string
  email?: string
  phone?: string
  notes?: string
  customFields: Record<string, unknown>
  tags: string[]
  created: number
  updated: number
}

export interface DBWikiPage {
  id: string // uuid
  groupId: string
  title: string
  content: string // markdown
  category?: string
  tags: string[]
  version: number
  created: number
  updated: number
  updatedBy: string
}

export interface DBMutualAidRequest {
  id: string // event id
  groupId: string
  type: 'request' | 'offer'
  category: string // food, housing, transport, skills, etc.
  title: string
  description: string
  status: 'open' | 'matched' | 'fulfilled' | 'closed'
  location?: string
  createdBy: string
  created: number
  expiresAt?: number
}

export interface DBNostrEvent {
  id: string // primary key
  kind: number
  pubkey: string
  created_at: number
  content: string
  tags: string[][]
  sig: string
}

/**
 * BuildIt Network Database
 */
export class BuildItDB extends Dexie {
  identities!: Table<DBIdentity, string>
  groups!: Table<DBGroup, string>
  groupMembers!: Table<DBGroupMember, number>
  messages!: Table<DBMessage, string>
  events!: Table<DBEvent, string>
  rsvps!: Table<DBRSVP, number>
  proposals!: Table<DBProposal, string>
  votes!: Table<DBVote, number>
  contacts!: Table<DBContact, string>
  wikiPages!: Table<DBWikiPage, string>
  mutualAidRequests!: Table<DBMutualAidRequest, string>
  nostrEvents!: Table<DBNostrEvent, string>

  constructor() {
    super('BuildItNetworkDB')

    this.version(1).stores({
      identities: 'publicKey, name, created, lastUsed',
      groups: 'id, name, created, privacy',
      groupMembers: '++id, [groupId+pubkey], groupId, pubkey, role',
      messages: 'id, groupId, authorPubkey, recipientPubkey, timestamp, threadId',
      events: 'id, groupId, startTime, createdBy, privacy',
      rsvps: '++id, [eventId+pubkey], eventId, pubkey, status',
      proposals: 'id, groupId, status, created, createdBy',
      votes: '++id, [proposalId+voterPubkey], proposalId, voterPubkey',
      contacts: 'id, groupId, name, email, created, updated',
      wikiPages: 'id, groupId, title, category, updated, updatedBy',
      mutualAidRequests: 'id, groupId, type, category, status, created, createdBy',
      nostrEvents: 'id, kind, pubkey, created_at',
    })
  }

  /**
   * Clear all data (use with caution!)
   */
  async clearAll(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all(this.tables.map(table => table.clear()))
    })
  }

  /**
   * Get database size estimate
   */
  async getSize(): Promise<{ name: string; records: number }[]> {
    const sizes = await Promise.all(
      this.tables.map(async (table) => ({
        name: table.name,
        records: await table.count(),
      }))
    )
    return sizes
  }
}

// Singleton instance
export const db = new BuildItDB()

/**
 * Initialize database (call this on app startup)
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open()
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  await db.close()
}
