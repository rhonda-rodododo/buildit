/**
 * Groups Store - Organization Management
 *
 * Manages groups/organizations the user belongs to.
 * Uses Nostr events for group metadata and membership.
 */

import { create } from 'zustand'
import type { Event, Filter } from 'nostr-tools'
import { relayService, DEFAULT_RELAYS } from '../services/nostrRelay'
import { setSecureItem, getSecureItem, STORAGE_KEYS } from '../storage/secureStorage'

// NIP-29 Group event kinds
const KIND_GROUP_METADATA = 39001
const KIND_GROUP_MEMBERS = 39002
const KIND_GROUP_ADMINS = 39003

export type GroupRole = 'admin' | 'moderator' | 'member' | 'read-only'

export interface GroupMember {
  pubkey: string
  role: GroupRole
  displayName?: string
  joinedAt: number
}

export interface Group {
  id: string
  name: string
  description?: string
  picture?: string
  memberCount: number
  myRole: GroupRole
  lastActivity: number
  unreadCount: number
  createdAt: number
  relays: string[]
}

interface GroupsState {
  // State
  groups: Group[]
  activeGroup: Group | null
  members: Map<string, GroupMember[]>
  isLoading: boolean
  isConnected: boolean
  error: string | null

  // Actions
  initialize: (userPubkey: string) => Promise<void>
  loadGroups: () => Promise<void>
  loadGroupMembers: (groupId: string) => Promise<void>
  setActiveGroup: (group: Group | null) => void
  createGroup: (options: { name: string; description?: string; privacy: string }) => Promise<Group>
  joinGroup: (groupId: string, relays?: string[]) => Promise<void>
  leaveGroup: (groupId: string) => Promise<void>
  markGroupAsRead: (groupId: string) => void
  disconnect: () => void
}

// Current user pubkey
let currentUserPubkey: string | null = null
let subscriptionId: string | null = null

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  activeGroup: null,
  members: new Map(),
  isLoading: false,
  isConnected: false,
  error: null,

  initialize: async (userPubkey: string) => {
    set({ isLoading: true, error: null })
    currentUserPubkey = userPubkey

    try {
      // Load cached groups from storage
      const cached = await getSecureItem(STORAGE_KEYS.PRIVATE_KEY) // Proxy check
      if (cached) {
        try {
          const cachedGroups = await getSecureItem(STORAGE_KEYS.GROUPS_CACHE)
          if (cachedGroups) {
            const groups: Group[] = JSON.parse(cachedGroups)
            set({ groups })
          }
        } catch {
          // Ignore cache errors
        }
      }

      // Connect to relays
      await relayService.connect(DEFAULT_RELAYS)

      // Subscribe to group events where user is a member
      const filters: Filter[] = [
        {
          kinds: [KIND_GROUP_METADATA],
          '#p': [userPubkey],
          limit: 100,
        },
      ]

      subscriptionId = relayService.subscribe(
        filters,
        (event) => handleGroupEvent(event, set, get),
        () => {
          set({ isLoading: false, isConnected: true })
        }
      )

      set({ isConnected: true })
    } catch (error) {
      console.error('Failed to initialize groups store:', error)
      set({
        error: 'Failed to connect to relays',
        isLoading: false,
      })
    }
  },

  loadGroups: async () => {
    const { groups } = get()
    if (!currentUserPubkey) return

    set({ isLoading: true })

    try {
      // Re-fetch group metadata from relays
      const filters: Filter[] = [
        {
          kinds: [KIND_GROUP_METADATA],
          '#p': [currentUserPubkey],
          limit: 100,
        },
      ]

      // This will trigger handleGroupEvent for each result
      if (subscriptionId) {
        relayService.unsubscribe(subscriptionId)
      }

      subscriptionId = relayService.subscribe(
        filters,
        (event) => handleGroupEvent(event, set, get),
        () => {
          set({ isLoading: false })
          // Cache groups after loading
          const { groups } = get()
          setSecureItem(STORAGE_KEYS.GROUPS_CACHE, JSON.stringify(groups)).catch(() => {})
        }
      )
    } catch (error) {
      console.error('Failed to load groups:', error)
      set({ error: 'Failed to load groups', isLoading: false })
    }
  },

  loadGroupMembers: async (groupId: string) => {
    if (!currentUserPubkey) return

    try {
      const filter: Filter = {
        kinds: [KIND_GROUP_MEMBERS, KIND_GROUP_ADMINS],
        '#d': [groupId],
        limit: 500,
      }

      const members: GroupMember[] = []

      relayService.subscribe(
        [filter],
        (event) => {
          // Parse member list from event
          const pubkeys = event.tags
            .filter((t) => t[0] === 'p')
            .map((t) => ({
              pubkey: t[1],
              role: (event.kind === KIND_GROUP_ADMINS ? 'admin' : 'member') as GroupRole,
              joinedAt: event.created_at,
            }))

          members.push(...pubkeys)
        },
        () => {
          // Deduplicate and update members map
          const uniqueMembers = new Map<string, GroupMember>()
          for (const member of members) {
            const existing = uniqueMembers.get(member.pubkey)
            if (!existing || (member.role === 'admin' && existing.role !== 'admin')) {
              uniqueMembers.set(member.pubkey, member)
            }
          }

          set((state) => {
            const newMembers = new Map(state.members)
            newMembers.set(groupId, Array.from(uniqueMembers.values()))
            return { members: newMembers }
          })
        }
      )
    } catch (error) {
      console.error('Failed to load group members:', error)
    }
  },

  setActiveGroup: (group: Group | null) => {
    set({ activeGroup: group, error: null })
  },

  createGroup: async (options: { name: string; description?: string; privacy: string }) => {
    if (!currentUserPubkey) {
      throw new Error('Not initialized')
    }

    // Generate a unique group ID
    const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2)}`

    // Create the new group
    const newGroup: Group = {
      id: groupId,
      name: options.name,
      description: options.description,
      memberCount: 1,
      myRole: 'admin', // Creator is always admin
      lastActivity: Date.now(),
      unreadCount: 0,
      createdAt: Date.now(),
      relays: DEFAULT_RELAYS,
    }

    // Add to groups list
    const { groups } = get()
    const updatedGroups = [...groups, newGroup]
    set({ groups: updatedGroups })

    // Persist to cache
    await setSecureItem(STORAGE_KEYS.GROUPS_CACHE, JSON.stringify(updatedGroups))

    // TODO: In a full implementation, publish group creation event to relays
    // using NIP-29 format

    return newGroup
  },

  joinGroup: async (groupId: string, relays?: string[]) => {
    if (!currentUserPubkey) {
      throw new Error('Not initialized')
    }

    // For now, just add to local groups list
    // In a full implementation, this would send a join request event
    const { groups } = get()

    // Check if already a member
    if (groups.some((g) => g.id === groupId)) {
      throw new Error('You are already a member of this group')
    }

    const groupRelays = relays && relays.length > 0 ? relays : DEFAULT_RELAYS

    const newGroup: Group = {
      id: groupId,
      name: 'New Group', // Will be updated from relay metadata
      memberCount: 1,
      myRole: 'member',
      lastActivity: Date.now(),
      unreadCount: 0,
      createdAt: Date.now(),
      relays: groupRelays,
    }

    const updatedGroups = [...groups, newGroup]
    set({ groups: updatedGroups })

    // Persist to cache
    await setSecureItem(STORAGE_KEYS.GROUPS_CACHE, JSON.stringify(updatedGroups))
  },

  leaveGroup: async (groupId: string) => {
    const { groups, activeGroup } = get()

    const updatedGroups = groups.filter((g) => g.id !== groupId)
    set({
      groups: updatedGroups,
      activeGroup: activeGroup?.id === groupId ? null : activeGroup,
    })

    // Persist to cache
    await setSecureItem(STORAGE_KEYS.GROUPS_CACHE, JSON.stringify(updatedGroups))
  },

  markGroupAsRead: (groupId: string) => {
    const { groups } = get()
    const updatedGroups = groups.map((g) =>
      g.id === groupId ? { ...g, unreadCount: 0 } : g
    )
    set({ groups: updatedGroups })
  },

  disconnect: () => {
    if (subscriptionId) {
      relayService.unsubscribe(subscriptionId)
      subscriptionId = null
    }
    currentUserPubkey = null
    set({
      groups: [],
      activeGroup: null,
      members: new Map(),
      isConnected: false,
    })
  },
}))

// Handle incoming group events from relays
function handleGroupEvent(
  event: Event,
  set: (state: Partial<GroupsState> | ((state: GroupsState) => Partial<GroupsState>)) => void,
  get: () => GroupsState
): void {
  if (!currentUserPubkey) return

  try {
    if (event.kind === KIND_GROUP_METADATA) {
      // Parse group metadata
      const content = JSON.parse(event.content)
      const groupId = event.tags.find((t) => t[0] === 'd')?.[1] || event.id

      const group: Group = {
        id: groupId,
        name: content.name || 'Unnamed Group',
        description: content.about || content.description,
        picture: content.picture,
        memberCount: 0, // Will be updated when members are loaded
        myRole: 'member', // Default, will be updated
        lastActivity: event.created_at * 1000,
        unreadCount: 0,
        createdAt: event.created_at * 1000,
        relays: event.tags.filter((t) => t[0] === 'relay').map((t) => t[1]),
      }

      // Check if user is admin
      const adminTag = event.tags.find(
        (t) => t[0] === 'p' && t[1] === currentUserPubkey && t[3] === 'admin'
      )
      if (adminTag) {
        group.myRole = 'admin'
      }

      set((state) => {
        const existingIndex = state.groups.findIndex((g) => g.id === groupId)
        let updatedGroups: Group[]

        if (existingIndex >= 0) {
          // Update existing group
          updatedGroups = [...state.groups]
          updatedGroups[existingIndex] = {
            ...updatedGroups[existingIndex],
            ...group,
          }
        } else {
          // Add new group
          updatedGroups = [...state.groups, group]
        }

        return { groups: updatedGroups }
      })
    }
  } catch (error) {
    console.error('Error handling group event:', error)
  }
}
