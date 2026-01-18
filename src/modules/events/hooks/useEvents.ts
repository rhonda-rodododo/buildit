import { useCallback, useMemo, useEffect, useRef } from 'react'
import { useEventsStore } from '../eventsStore'
import { EventManager } from '../eventManager'
import { NostrClient } from '@/core/nostr/client'
import { CreateEventFormData, RSVPStatus, Event } from '../types'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { bytesToHex } from '@noble/hashes/utils'

// Initialize Nostr client (singleton pattern)
let nostrClientInstance: NostrClient | null = null
function getNostrClient(): NostrClient {
  if (!nostrClientInstance) {
    nostrClientInstance = new NostrClient([
      { url: 'wss://relay.damus.io', read: true, write: true },
      { url: 'wss://relay.primal.net', read: true, write: true },
      { url: 'wss://nostr.band', read: true, write: true },
      { url: 'wss://nos.lol', read: true, write: true },
    ])
  }
  return nostrClientInstance
}

const eventManager = new EventManager(getNostrClient())

export function useEvents(groupId?: string) {
  const { currentIdentity } = useAuthStore()
  const { groups, groupMembers } = useGroupsStore()
  const { addNotification } = useNotificationStore()
  const {
    events,
    addEvent,
    updateEvent: updateEventStore,
    deleteEvent: deleteEventStore,
    addRSVP,
    getEventById,
    getEventsByGroup,
    getPublicEvents,
    getUpcomingEvents,
    getEventWithRSVPs,
  } = useEventsStore()

  // Get the groups the current user is a member of
  const userGroupIds = useMemo(() => {
    if (!currentIdentity) return new Set<string>()
    const memberGroups = new Set<string>()

    // Check groupMembers map for user's memberships
    groupMembers.forEach((members, gId) => {
      if (members.some(m => m.pubkey === currentIdentity.publicKey)) {
        memberGroups.add(gId)
      }
    })

    // Also check groups where user is admin
    groups.forEach(g => {
      if (g.adminPubkeys.includes(currentIdentity.publicKey)) {
        memberGroups.add(g.id)
      }
    })

    return memberGroups
  }, [currentIdentity, groups, groupMembers])

  /**
   * Check if the current user can view an event based on privacy settings
   */
  const canViewEvent = useCallback((event: Event): boolean => {
    if (!currentIdentity) {
      // Only public events visible to non-authenticated users
      return event.privacy === 'public'
    }

    const userPubkey = currentIdentity.publicKey

    switch (event.privacy) {
      case 'public':
        // Public events are visible to everyone
        return true

      case 'group':
        // Group events visible only to group members
        if (!event.groupId) return true // No group = treat as public
        return userGroupIds.has(event.groupId)

      case 'private':
      case 'direct-action':
        // Private/direct-action events visible to:
        // - Creator
        // - Co-hosts
        // - Group members (if event has groupId)
        // - Explicitly invited users (TODO: implement invitation list)
        if (event.createdBy === userPubkey) return true
        if (event.coHosts?.includes(userPubkey)) return true
        if (event.groupId && userGroupIds.has(event.groupId)) return true
        return false

      default:
        return false
    }
  }, [currentIdentity, userGroupIds])

  // Filter events based on groupId and privacy
  const filteredEvents = useMemo(() => {
    const baseEvents = groupId ? getEventsByGroup(groupId) : events
    return baseEvents.filter(canViewEvent)
  }, [groupId, events, getEventsByGroup, canViewEvent])

  /**
   * Create a new event
   */
  const createEvent = useCallback(
    async (formData: CreateEventFormData) => {
      if (!currentIdentity) {
        throw new Error('No identity selected')
      }

      const privateKey = getCurrentPrivateKey()
      if (!privateKey) {
        throw new Error('App is locked')
      }

      const privateKeyHex = bytesToHex(privateKey)
      const event = await eventManager.createEvent(
        formData,
        currentIdentity.publicKey,
        privateKeyHex
      )

      addEvent(event)
      return event
    },
    [currentIdentity, addEvent]
  )

  /**
   * Update an existing event
   */
  const updateEvent = useCallback(
    async (eventId: string, updates: Partial<CreateEventFormData>) => {
      if (!currentIdentity) {
        throw new Error('No identity selected')
      }

      const privateKey = getCurrentPrivateKey()
      if (!privateKey) {
        throw new Error('App is locked')
      }

      const privateKeyHex = bytesToHex(privateKey)

      // Convert CreateEventFormData updates to Event updates
      const eventUpdates: any = { ...updates }
      if (updates.startTime) {
        eventUpdates.startTime = updates.startTime.getTime()
      }
      if (updates.endTime) {
        eventUpdates.endTime = updates.endTime.getTime()
      }
      if (updates.locationRevealTime) {
        eventUpdates.locationRevealTime = updates.locationRevealTime.getTime()
      }

      const event = await eventManager.updateEvent(
        eventId,
        eventUpdates,
        currentIdentity.publicKey,
        privateKeyHex
      )

      updateEventStore(eventId, event)
      return event
    },
    [currentIdentity, updateEventStore]
  )

  /**
   * Delete an event
   */
  const deleteEvent = useCallback(
    async (eventId: string) => {
      if (!currentIdentity) {
        throw new Error('No identity selected')
      }

      await eventManager.deleteEvent(eventId, currentIdentity.publicKey)
      deleteEventStore(eventId)
    },
    [currentIdentity, deleteEventStore]
  )

  /**
   * RSVP to an event
   */
  const rsvpToEvent = useCallback(
    async (eventId: string, status: RSVPStatus, note?: string) => {
      if (!currentIdentity) {
        throw new Error('No identity selected')
      }

      const privateKey = getCurrentPrivateKey()
      if (!privateKey) {
        throw new Error('App is locked')
      }

      const privateKeyHex = bytesToHex(privateKey)
      const rsvp = await eventManager.rsvpToEvent(
        eventId,
        currentIdentity.publicKey,
        status,
        privateKeyHex,
        note
      )

      addRSVP(rsvp)

      // Send confirmation notification
      const event = getEventById(eventId)
      if (event) {
        const statusLabels = {
          going: 'Going',
          maybe: 'Maybe',
          'not-going': 'Not Going',
        }
        addNotification({
          type: 'event_rsvp',
          title: 'RSVP Confirmed',
          message: `You marked "${event.title}" as ${statusLabels[status]}`,
          metadata: {
            eventId,
            groupId: event.groupId,
          },
        })
      }

      return rsvp
    },
    [currentIdentity, addRSVP, getEventById, addNotification]
  )

  /**
   * Sync events from Nostr relays
   */
  const syncEvents = useCallback(async () => {
    if (!currentIdentity) return

    await eventManager.syncEvents()

    // After syncing, reload from database
    // This is a simplified approach; in production, we'd want more granular updates
  }, [currentIdentity])

  /**
   * Get event with RSVP data
   */
  const getEventWithRSVPData = useCallback(
    (eventId: string) => {
      if (!currentIdentity) return undefined
      return getEventWithRSVPs(eventId, currentIdentity.publicKey)
    },
    [currentIdentity, getEventWithRSVPs]
  )

  // Track if initial sync has been done to prevent re-syncing on every render
  const hasSynced = useRef(false)

  // Auto-sync events on mount (once per component lifecycle)
  useEffect(() => {
    if (!currentIdentity || hasSynced.current) return

    hasSynced.current = true
    syncEvents().catch(error => {
      console.error('Failed to sync events:', error)
    })
  }, [currentIdentity, syncEvents])

  // Get filtered versions of helper functions
  const filteredPublicEvents = useMemo(() => {
    return getPublicEvents().filter(canViewEvent)
  }, [getPublicEvents, canViewEvent])

  const filteredUpcomingEvents = useMemo(() => {
    return getUpcomingEvents().filter(canViewEvent)
  }, [getUpcomingEvents, canViewEvent])

  // Wrap getEventById to respect privacy
  const getEventByIdFiltered = useCallback((eventId: string) => {
    const event = getEventById(eventId)
    if (!event) return undefined
    return canViewEvent(event) ? event : undefined
  }, [getEventById, canViewEvent])

  return {
    events: filteredEvents,
    publicEvents: filteredPublicEvents,
    upcomingEvents: filteredUpcomingEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    rsvpToEvent,
    syncEvents,
    getEventById: getEventByIdFiltered,
    getEventWithRSVPs: getEventWithRSVPData,
    canViewEvent, // Export for external use if needed
  }
}
