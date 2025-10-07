import { NostrClient } from '@/core/nostr/client'
import { createEvent, generateEventId } from '@/core/nostr/nip01'
import { db } from '@/core/storage/db'
import { Event, RSVP, EVENT_KINDS, EventSchema, RSVPSchema, CreateEventFormData, RSVPStatus } from './types'
import type { Event as NostrEvent } from 'nostr-tools'

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
      locationRevealTime: formData.locationRevealTime?.getTime(),
      coHosts: [],
    }

    // Validate event
    EventSchema.parse(event)

    // Create Nostr event
    const nostrEvent = await this.createNostrEvent(event, privateKey)

    // Publish to relays
    await this.nostrClient.publish(nostrEvent)

    // Store in local database
    await db.events?.add({
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
      locationRevealTime: event.locationRevealTime,
    })

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
    const existingEvent = await db.events.get(eventId)
    if (!existingEvent) {
      throw new Error('Event not found')
    }

    // Check permissions (creator or co-host)
    if (existingEvent.createdBy !== updaterPubkey) {
      throw new Error('Not authorized to update this event')
    }

    const updatedEvent: Event = {
      id: existingEvent.id,
      groupId: existingEvent.groupId,
      title: updates.title || existingEvent.title,
      description: updates.description || existingEvent.description,
      location: updates.location !== undefined ? updates.location : existingEvent.location,
      startTime: updates.startTime || existingEvent.startTime,
      endTime: updates.endTime !== undefined ? updates.endTime : existingEvent.endTime,
      privacy: updates.privacy || existingEvent.privacy,
      capacity: updates.capacity !== undefined ? updates.capacity : existingEvent.capacity,
      createdBy: existingEvent.createdBy,
      createdAt: existingEvent.createdAt,
      updatedAt: Date.now(),
      tags: updates.tags || (existingEvent.tags ? existingEvent.tags.split(',') : []),
      imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : existingEvent.imageUrl,
      locationRevealTime: updates.locationRevealTime !== undefined ? updates.locationRevealTime : existingEvent.locationRevealTime,
      coHosts: updates.coHosts || [],
    }

    // Create and publish updated Nostr event
    const nostrEvent = await this.createNostrEvent(updatedEvent, privateKey)
    await this.nostrClient.publish(nostrEvent)

    // Update in database
    await db.events.update(eventId, {
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
      locationRevealTime: updatedEvent.locationRevealTime,
    })

    return updatedEvent
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, deleterPubkey: string): Promise<void> {
    const event = await db.events.get(eventId)
    if (!event) {
      throw new Error('Event not found')
    }

    if (event.createdBy !== deleterPubkey) {
      throw new Error('Not authorized to delete this event')
    }

    // Delete from database
    await db.events.delete(eventId)
    await db.rsvps.where('eventId').equals(eventId).delete()

    // NOTE: NIP-09 event deletion (kind 5) publishing deferred
    // Deletion only affects local database for now
    // Future: Publish deletion request to relays for distributed event removal
  }

  /**
   * RSVP to an event
   */
  async rsvpToEvent(
    eventId: string,
    userPubkey: string,
    status: RSVPStatus,
    privateKey: string,
    note?: string
  ): Promise<RSVP> {
    const event = await db.events.get(eventId)
    if (!event) {
      throw new Error('Event not found')
    }

    // Check capacity
    if (status === 'going' && event.capacity) {
      const goingCount = await db.rsvps
        .where(['eventId', 'status'])
        .equals([eventId, 'going'])
        .count()

      if (goingCount >= event.capacity) {
        throw new Error('Event is at capacity')
      }
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

    // Create Nostr RSVP event
    const nostrEvent = await this.createRSVPNostrEvent(rsvp, privateKey)
    await this.nostrClient.publish(nostrEvent)

    // Store in database (upsert)
    const existing = await db.rsvps
      .where({ eventId, userPubkey })
      .first()

    if (existing && existing.id) {
      await db.rsvps.update(existing.id, {
        status,
        timestamp: rsvp.timestamp,
        note,
      })
    } else {
      await db.rsvps?.add({
        eventId,
        userPubkey,
        status,
        timestamp: rsvp.timestamp,
        note,
      })
    }

    return rsvp
  }

  /**
   * Create Nostr event for an event
   */
  private async createNostrEvent(event: Event, privateKey: string): Promise<NostrEvent> {
    const content = JSON.stringify({
      title: event.title,
      description: event.description,
      location: event.privacy === 'direct-action' ? undefined : event.location,
      startTime: event.startTime,
      endTime: event.endTime,
      privacy: event.privacy,
      capacity: event.capacity,
      tags: event.tags,
      imageUrl: event.imageUrl,
      locationRevealTime: event.locationRevealTime,
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

    if (event.location && event.privacy !== 'direct-action') {
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
   * NOTE: Full relay synchronization deferred - using local-first approach
   */
  async syncEvents(): Promise<void> {
    // Local-first architecture: events are primarily stored in IndexedDB
    // Future enhancement: Query relays for group events using NIP-29 (Group Chat)
    // or NIP-72 (Moderated Communities) and sync to local database
    const events = await db.events.toArray()
    console.log('Loaded events from local DB:', events.length)
  }

  /**
   * Process an event received from Nostr
   * NOTE: Reserved for future relay sync implementation
   */
  private async _processEventFromNostr(nostrEvent: NostrEvent): Promise<void> {
    try {
      const dTag = nostrEvent.tags.find((t) => t[0] === 'd')?.[1]
      if (!dTag) return

      const content = JSON.parse(nostrEvent.content)

      const event: Event = {
        id: dTag,
        groupId: nostrEvent.tags.find((t) => t[0] === 'group')?.[1],
        title: content.title,
        description: content.description,
        location: content.location,
        startTime: content.startTime,
        endTime: content.endTime,
        privacy: content.privacy,
        capacity: content.capacity,
        createdBy: nostrEvent.pubkey,
        createdAt: nostrEvent.created_at * 1000,
        updatedAt: nostrEvent.created_at * 1000,
        tags: content.tags || [],
        imageUrl: content.imageUrl,
        locationRevealTime: content.locationRevealTime,
        coHosts: content.coHosts || [],
      }

      // Upsert to database
      const existing = await db.events.get(event.id)
      if (existing) {
        if (nostrEvent.created_at * 1000 > existing.updatedAt) {
          await db.events.update(event.id, {
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
            locationRevealTime: event.locationRevealTime,
          })
        }
      } else {
        await db.events?.add({
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
          locationRevealTime: event.locationRevealTime,
        })
      }
    } catch (error) {
      console.error('Error processing event from Nostr:', error)
    }
  }
}
