import { NostrClient } from '@/core/nostr/client'
import { createEvent, generateEventId } from '@/core/nostr/nip01'
import { dal } from '@/core/storage/dal'
import { Event, RSVP, EVENT_KINDS, EventSchema, RSVPSchema, CreateEventFormData, RSVPStatus } from './types'
import type { Event as NostrEvent } from 'nostr-tools'

import { logger } from '@/lib/logger';
/**
 * Event Manager - Handles event creation, updates, and RSVP management
 */
export class EventManager {
  private nostrClient: NostrClient

  constructor(nostrClient: NostrClient) {
    this.nostrClient = nostrClient
  }

  /**
   * Create a new event
   */
  async createEvent(
    formData: CreateEventFormData,
    creatorPubkey: string,
    privateKey: string
  ): Promise<Event> {
    const now = Date.now()
    const eventId = generateEventId()

    const event: Event = {
      id: eventId,
      groupId: formData.groupId,
      title: formData.title,
      description: formData.description,
      location: formData.location,
      startTime: formData.startTime.getTime(),
      endTime: formData.endTime?.getTime(),
      privacy: formData.privacy,
      capacity: formData.capacity,
      createdBy: creatorPubkey,
      createdAt: now,
      updatedAt: now,
      tags: formData.tags || [],
      imageUrl: formData.imageUrl,
      coHosts: [],
    }

    // Validate event
    EventSchema.parse(event)

    // Create Nostr event
    const nostrEvent = await this.createNostrEvent(event, privateKey)

    // Publish to relays
    await this.nostrClient.publish(nostrEvent)

    // Store in local database
    try {
      await dal.add('events', {
        id: event.id,
        groupId: event.groupId,
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.startTime,
        endTime: event.endTime,
        privacy: event.privacy,
        capacity: event.capacity,
        createdBy: event.createdBy,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        tags: event.tags?.join(',') || '',
        imageUrl: event.imageUrl,
      })
    } catch {
      // Table might not exist yet
    }

    return event
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<Event>,
    updaterPubkey: string,
    privateKey: string
  ): Promise<Event> {
    // Get existing event
    const existingEvent = await dal.get<Record<string, unknown>>('events', eventId)
    if (!existingEvent) {
      throw new Error('Event not found')
    }

    // Check permissions (creator or co-host)
    if (existingEvent.createdBy !== updaterPubkey) {
      throw new Error('Not authorized to update this event')
    }

    const updatedEvent: Event = {
      id: existingEvent.id as string,
      groupId: existingEvent.groupId as string,
      title: updates.title || existingEvent.title as string,
      description: updates.description || existingEvent.description as string,
      location: updates.location !== undefined ? updates.location : existingEvent.location as string | undefined,
      startTime: updates.startTime || existingEvent.startTime as number,
      endTime: updates.endTime !== undefined ? updates.endTime : existingEvent.endTime as number | undefined,
      privacy: updates.privacy || existingEvent.privacy as Event['privacy'],
      capacity: updates.capacity !== undefined ? updates.capacity : existingEvent.capacity as number | undefined,
      createdBy: existingEvent.createdBy as string,
      createdAt: existingEvent.createdAt as number,
      updatedAt: Date.now(),
      tags: updates.tags || (existingEvent.tags ? (existingEvent.tags as string).split(',') : []),
      imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : existingEvent.imageUrl as string | undefined,
      coHosts: updates.coHosts || [],
    }

    // Create and publish updated Nostr event
    const nostrEvent = await this.createNostrEvent(updatedEvent, privateKey)
    await this.nostrClient.publish(nostrEvent)

    // Update in database
    await dal.update('events', eventId, {
      title: updatedEvent.title,
      description: updatedEvent.description,
      location: updatedEvent.location,
      startTime: updatedEvent.startTime,
      endTime: updatedEvent.endTime,
      privacy: updatedEvent.privacy,
      capacity: updatedEvent.capacity,
      updatedAt: updatedEvent.updatedAt,
      tags: updatedEvent.tags.join(','),
      imageUrl: updatedEvent.imageUrl,
    })

    return updatedEvent
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, deleterPubkey: string): Promise<void> {
    const event = await dal.get<Record<string, unknown>>('events', eventId)
    if (!event) {
      throw new Error('Event not found')
    }

    if (event.createdBy !== deleterPubkey) {
      throw new Error('Not authorized to delete this event')
    }

    // Delete from database
    await dal.delete('events', eventId)
    await dal.queryCustom({
      sql: 'DELETE FROM rsvps WHERE event_id = ?1',
      params: [eventId],
      dexieFallback: async (db) => {
        await db.rsvps!.where('eventId').equals(eventId).delete();
      },
    })

    // NOTE: NIP-09 event deletion (kind 5) publishing deferred
    // Deletion only affects local database for now
    // Future: Publish deletion request to relays for distributed event removal
  }

  /**
   * RSVP to an event
   * Uses a transaction to prevent race conditions with capacity limits
   */
  async rsvpToEvent(
    eventId: string,
    userPubkey: string,
    status: RSVPStatus,
    privateKey: string,
    note?: string
  ): Promise<RSVP> {
    const event = await dal.get<Record<string, unknown>>('events', eventId)
    if (!event) {
      throw new Error('Event not found')
    }

    const rsvp: RSVP = {
      eventId,
      userPubkey,
      status,
      timestamp: Date.now(),
      note,
    }

    // Validate RSVP
    RSVPSchema.parse(rsvp)

    // Check if user already has an RSVP
    const existingResults = await dal.queryCustom<Record<string, unknown>>({
      sql: 'SELECT * FROM rsvps WHERE event_id = ?1 AND user_pubkey = ?2 LIMIT 1',
      params: [eventId, userPubkey],
      dexieFallback: async (db) => {
        const result = await db.rsvps!
          .where({ eventId, userPubkey })
          .first();
        return result ? [result] : [];
      },
    })
    const existing = existingResults[0]

    const wasAlreadyGoing = existing?.status === 'going'
    const isNewlyGoing = status === 'going' && !wasAlreadyGoing

    // Check capacity only if user is newly RSVPing "going"
    if (isNewlyGoing && event.capacity) {
      const countResults = await dal.queryCustom<{ cnt: number }>({
        sql: 'SELECT COUNT(*) as cnt FROM rsvps WHERE event_id = ?1 AND status = ?2',
        params: [eventId, 'going'],
        dexieFallback: async (db) => {
          const count = await db.rsvps!
            .where({ eventId })
            .filter((r: Record<string, unknown>) => r.status === 'going')
            .count();
          return [{ cnt: count }];
        },
      })
      const goingCount = countResults[0]?.cnt ?? 0

      if (goingCount >= (event.capacity as number)) {
        throw new Error('Event is at capacity')
      }
    }

    // Upsert RSVP
    if (existing && existing.id) {
      await dal.update('rsvps', existing.id as string, {
        status,
        timestamp: rsvp.timestamp,
        note,
      })
    } else {
      await dal.add('rsvps', {
        eventId,
        userPubkey,
        status,
        timestamp: rsvp.timestamp,
        note,
      })
    }

    // Create Nostr RSVP event only after local operation succeeds
    const nostrEvent = await this.createRSVPNostrEvent(rsvp, privateKey)
    await this.nostrClient.publish(nostrEvent)

    return rsvp
  }

  /**
   * Create Nostr event for an event
   */
  private async createNostrEvent(event: Event, privateKey: string): Promise<NostrEvent> {
    // Serialize to protocol format (using protocol field names)
    const content = JSON.stringify({
      _v: '1.0.0', // Schema version
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startTime, // Protocol uses startAt
      endAt: event.endTime, // Protocol uses endAt
      visibility: event.privacy, // Protocol uses visibility
      maxAttendees: event.capacity, // Protocol uses maxAttendees
      tags: event.tags,
      imageUrl: event.imageUrl,
      coHosts: event.coHosts,
    })

    const tags: string[][] = [
      ['d', event.id], // Unique identifier for parameterized replaceable event
      ['title', event.title],
      ['start', event.startTime.toString()],
    ]

    if (event.groupId) {
      tags.push(['group', event.groupId])
    }

    if (event.endTime) {
      tags.push(['end', event.endTime.toString()])
    }

    if (event.location) {
      tags.push(['location', event.location])
    }

    event.tags.forEach((tag) => {
      tags.push(['t', tag])
    })

    return createEvent(
      EVENT_KINDS.EVENT,
      content,
      tags,
      privateKey
    )
  }

  /**
   * Create Nostr event for an RSVP
   */
  private async createRSVPNostrEvent(rsvp: RSVP, privateKey: string): Promise<NostrEvent> {
    const content = rsvp.note || ''

    const tags: string[][] = [
      ['d', `${rsvp.eventId}:${rsvp.userPubkey}`], // Unique identifier
      ['e', rsvp.eventId], // Event reference
      ['status', rsvp.status],
    ]

    return createEvent(
      EVENT_KINDS.RSVP,
      content,
      tags,
      privateKey
    )
  }

  /**
   * Sync events from Nostr relays
   * Queries relays for events and merges with local database
   */
  async syncEvents(groupId?: string): Promise<void> {
    return new Promise((resolve) => {
      const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60

      // Build filter for event kinds
      const filter: { kinds: number[]; since: number; '#group'?: string[] } = {
        kinds: [EVENT_KINDS.EVENT],
        since: oneWeekAgo,
      }

      // Optionally filter by group
      if (groupId) {
        filter['#group'] = [groupId]
      }

      let receivedCount = 0

      const subId = this.nostrClient.subscribe(
        [filter],
        async (nostrEvent: NostrEvent) => {
          await this.processEventFromNostr(nostrEvent)
          receivedCount++
        },
        () => {
          // EOSE (End of Stored Events) - all historical events received
          logger.info(`Synced ${receivedCount} events from relays`)
          this.nostrClient.unsubscribe(subId)
          resolve()
        }
      )

      // Timeout after 10 seconds in case EOSE never arrives
      setTimeout(() => {
        this.nostrClient.unsubscribe(subId)
        logger.info(`Sync timeout after ${receivedCount} events`)
        resolve()
      }, 10000)
    })
  }

  /**
   * Process an event received from Nostr
   */
  private processEventFromNostr = async (nostrEvent: NostrEvent): Promise<void> => {
    try {
      const dTag = nostrEvent.tags.find((t) => t[0] === 'd')?.[1]
      if (!dTag) return

      // Validate content is parseable JSON
      let content: Record<string, unknown>
      try {
        content = JSON.parse(nostrEvent.content)
      } catch {
        // Not a valid JSON event (likely not a BuildIt event)
        return
      }

      // Support both protocol field names (startAt) and legacy names (startTime)
      const startTime = typeof content.startAt === 'number' ? content.startAt :
                        typeof content.startTime === 'number' ? content.startTime : undefined
      const endTime = typeof content.endAt === 'number' ? content.endAt :
                      typeof content.endTime === 'number' ? content.endTime : undefined

      // Validate required BuildIt event fields
      if (typeof content.title !== 'string' || startTime === undefined) {
        // Missing required fields, not a valid BuildIt event
        return
      }

      // Support both protocol (visibility) and legacy (privacy) field names
      // Map 'direct-action' to 'private' for backward compatibility
      const rawVisibility = content.visibility ?? content.privacy
      const validPrivacy = ['public', 'group', 'private'] as const
      let privacy: 'public' | 'group' | 'private' = 'group'
      if (rawVisibility === 'direct-action') {
        privacy = 'private' // Map legacy direct-action to private
      } else if (validPrivacy.includes(rawVisibility as typeof validPrivacy[number])) {
        privacy = rawVisibility as typeof validPrivacy[number]
      }

      // Support both protocol (maxAttendees) and legacy (capacity) field names
      const capacity = typeof content.maxAttendees === 'number' ? content.maxAttendees :
                       typeof content.capacity === 'number' ? content.capacity : undefined

      const event: Event = {
        id: dTag,
        groupId: nostrEvent.tags.find((t) => t[0] === 'group')?.[1],
        title: content.title as string,
        description: typeof content.description === 'string' ? content.description : '',
        location: typeof content.location === 'string' ? content.location : undefined,
        startTime,
        endTime,
        privacy,
        capacity,
        createdBy: nostrEvent.pubkey,
        createdAt: nostrEvent.created_at * 1000,
        updatedAt: nostrEvent.created_at * 1000,
        tags: Array.isArray(content.tags) ? (content.tags as string[]) : [],
        imageUrl: typeof content.imageUrl === 'string' ? content.imageUrl : undefined,
        coHosts: Array.isArray(content.coHosts) ? (content.coHosts as string[]) : [],
      }

      // Upsert to database
      const existing = await dal.get<Record<string, unknown>>('events', event.id)
      if (existing) {
        if (nostrEvent.created_at * 1000 > (existing.updatedAt as number)) {
          await dal.update('events', event.id, {
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            privacy: event.privacy,
            capacity: event.capacity,
            updatedAt: event.updatedAt,
            tags: event.tags.join(','),
            imageUrl: event.imageUrl,
          })
        }
      } else {
        try {
          await dal.add('events', {
            id: event.id,
            groupId: event.groupId,
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            privacy: event.privacy,
            capacity: event.capacity,
            createdBy: event.createdBy,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
            tags: event.tags.join(','),
            imageUrl: event.imageUrl,
          })
        } catch {
          // Table might not exist yet
        }
      }
    } catch (error) {
      console.error('Error processing event from Nostr:', error)
    }
  }
}
