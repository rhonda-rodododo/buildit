import { useCallback, useMemo, useEffect, useRef } from 'react'
import { useEventsStore } from '../eventsStore'
import { EventManager } from '../eventManager'
import { NostrClient, getNostrClient as getGlobalNostrClient } from '@/core/nostr/client'
import { createPrivateDM } from '@/core/crypto/nip17'
import { CreateEventFormData, RSVPStatus, AppEvent } from '../types'
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { bytesToHex } from '@noble/hashes/utils'

// Initialize Nostr client (singleton pattern)
let nostrClientInstance: NostrClient | null = null
function getNostrClient(): NostrClient {
  if (!nostrClientInstance) {
    nostrClientInstance = new NostrClient([
      { _v: '1.0.0', url: 'wss://relay.damus.io', read: true, write: true },
      { _v: '1.0.0', url: 'wss://relay.primal.net', read: true, write: true },
      { _v: '1.0.0', url: 'wss://nostr.band', read: true, write: true },
      { _v: '1.0.0', url: 'wss://nos.lol', read: true, write: true },
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
   * Check if the current user can view an event based on visibility settings
   */
  const canViewEvent = useCallback((event: AppEvent): boolean => {
    if (!currentIdentity) {
      return event.visibility === 'public'
    }

    const userPubkey = currentIdentity.publicKey

    switch (event.visibility) {
      case 'public':
        return true

      case 'group':
        if (!event.groupId) return true
        return userGroupIds.has(event.groupId)

      case 'private':
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

      // Convert CreateEventFormData updates to AppEvent updates
      const eventUpdates: Record<string, unknown> = { ...updates }
      if (updates.startTime) {
        eventUpdates.startAt = Math.floor(updates.startTime.getTime() / 1000)
        delete eventUpdates.startTime
      }
      if (updates.endTime) {
        eventUpdates.endAt = Math.floor(updates.endTime.getTime() / 1000)
        delete eventUpdates.endTime
      }
      if (updates.privacy) {
        eventUpdates.visibility = updates.privacy
        delete eventUpdates.privacy
      }
      if (updates.capacity !== undefined) {
        eventUpdates.maxAttendees = updates.capacity
        delete eventUpdates.capacity
      }
      if (updates.location !== undefined) {
        eventUpdates.location = updates.location ? { name: updates.location } : undefined
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
        const statusLabels: Record<string, string> = {
          going: 'Going',
          maybe: 'Maybe',
          not_going: 'Not Going',
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

  /**
   * Send event invitations to specific pubkeys via NIP-17 encrypted DMs
   *
   * Creates a gift-wrapped invitation message containing event details
   * and sends it to each specified pubkey.
   */
  const sendEventInvitation = useCallback(
    async (eventId: string, inviteePubkeys: string[], personalMessage?: string) => {
      if (!currentIdentity) {
        throw new Error('No identity selected')
      }

      const privateKey = getCurrentPrivateKey()
      if (!privateKey) {
        throw new Error('App is locked')
      }

      const event = getEventById(eventId)
      if (!event) {
        throw new Error('Event not found')
      }

      // Build invitation content as structured JSON
      const invitationContent = JSON.stringify({
        type: 'event_invitation',
        eventId: event.id,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        location: event.location,
        groupId: event.groupId,
        inviterPubkey: currentIdentity.publicKey,
        message: personalMessage || `You're invited to ${event.title}`,
        timestamp: Date.now(),
      })

      const client = getGlobalNostrClient()
      const results: { pubkey: string; success: boolean; error?: string }[] = []

      // Send individual NIP-17 gift-wrapped invitations to each invitee
      for (const pubkey of inviteePubkeys) {
        try {
          const giftWrap = createPrivateDM(
            invitationContent,
            privateKey,
            pubkey,
            [
              ['type', 'event_invitation'],
              ['e', eventId],
            ]
          )

          const publishResults = await client.publishDirectMessage(giftWrap)
          const hasSuccess = publishResults.some(r => r.success)

          results.push({
            pubkey,
            success: hasSuccess,
            error: hasSuccess ? undefined : 'All relays rejected the invitation',
          })
        } catch (error) {
          results.push({
            pubkey,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      // Notify the user about results
      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length

      if (successCount > 0) {
        addNotification({
          type: 'event_rsvp',
          title: 'Invitations Sent',
          message: `Sent ${successCount} invitation${successCount > 1 ? 's' : ''} for "${event.title}"${failureCount > 0 ? ` (${failureCount} failed)` : ''}`,
          metadata: {
            eventId,
            groupId: event.groupId,
          },
        })
      }

      if (failureCount > 0 && successCount === 0) {
        addNotification({
          type: 'event_rsvp',
          title: 'Invitations Failed',
          message: `Failed to send ${failureCount} invitation${failureCount > 1 ? 's' : ''} for "${event.title}"`,
          metadata: {
            eventId,
            groupId: event.groupId,
          },
        })
      }

      return results
    },
    [currentIdentity, getEventById, addNotification]
  )

  return {
    events: filteredEvents,
    publicEvents: filteredPublicEvents,
    upcomingEvents: filteredUpcomingEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    rsvpToEvent,
    sendEventInvitation,
    syncEvents,
    getEventById: getEventByIdFiltered,
    getEventWithRSVPs: getEventWithRSVPData,
    canViewEvent, // Export for external use if needed
  }
}
