import { useCallback} from 'react'
import { useEventsStore } from '../eventsStore'
import { EventManager } from '../eventManager'
import { NostrClient } from '@/core/nostr/client'
import { CreateEventFormData, RSVPStatus } from '../types'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
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

  // Filter events based on groupId if provided
  const filteredEvents = groupId ? getEventsByGroup(groupId) : events

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
      return rsvp
    },
    [currentIdentity, addRSVP]
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

  // Auto-sync events on mount only
  // Disabled auto-sync to prevent infinite loops
  // Users can manually sync using the syncEvents function
  // useEffect(() => {
  //   syncEvents()
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [])

  return {
    events: filteredEvents,
    publicEvents: getPublicEvents(),
    upcomingEvents: getUpcomingEvents(),
    createEvent,
    updateEvent,
    deleteEvent,
    rsvpToEvent,
    syncEvents,
    getEventById,
    getEventWithRSVPs: getEventWithRSVPData,
  }
}
