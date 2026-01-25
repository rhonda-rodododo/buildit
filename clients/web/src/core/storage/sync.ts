/**
 * Nostr <-> IndexedDB Sync Service
 * Subscribes to Nostr events and syncs them to local database
 *
 * Includes:
 * - Group data sync (events, proposals, wiki, etc.)
 * - NIP-17 message receiving
 */

import { getNostrClient } from '@/core/nostr/client';
import { db } from './db';
import type { Event as NostrEvent, Filter } from 'nostr-tools';
import { useAuthStore, getCurrentPrivateKey } from '@/stores/authStore';
import { startMessageReceiver, stopMessageReceiver, fetchMessageHistory } from '@/core/messaging/messageReceiver';

import { logger } from '@/lib/logger';
/**
 * Event kind definitions for BuildIt Network
 */
export const BUILD_IT_KINDS = {
  EVENT: 31922, // Parameterized replaceable event for events
  RSVP: 31923, // Parameterized replaceable event for RSVPs
  PROPOSAL: 31924, // Parameterized replaceable event for proposals
  WIKI_PAGE: 31925, // Parameterized replaceable event for wiki pages
  MUTUAL_AID: 31926, // Parameterized replaceable event for mutual aid requests
  DATABASE_RECORD: 31927, // Parameterized replaceable event for database records
} as const;

/**
 * Active subscriptions
 */
const activeSubscriptions = new Map<string, string>();

/**
 * Start syncing events from Nostr for a specific group
 */
export function startGroupSync(groupId: string): void {
  if (activeSubscriptions.has(groupId)) {
    logger.info(`Already syncing group ${groupId}`);
    return;
  }

  const client = getNostrClient();
  const { currentIdentity } = useAuthStore.getState();

  if (!currentIdentity) {
    logger.warn('Cannot sync: no identity');
    return;
  }

  // Subscribe to all BuildIt event kinds for this group
  const filters: Filter[] = [
    {
      kinds: Object.values(BUILD_IT_KINDS),
      '#group': [groupId],
      since: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60, // Last 30 days
    },
  ];

  const subId = client.subscribe(
    filters,
    async (event: NostrEvent) => {
      try {
        await processNostrEvent(event, groupId);
      } catch (error) {
        console.error('Error processing Nostr event:', error);
      }
    },
    () => {
      logger.info(`📡 Sync established for group ${groupId}`);
    }
  );

  activeSubscriptions.set(groupId, subId);
  logger.info(`🔄 Started syncing group ${groupId}`);
}

/**
 * Stop syncing a group
 */
export function stopGroupSync(groupId: string): void {
  const subId = activeSubscriptions.get(groupId);
  if (subId) {
    const client = getNostrClient();
    client.unsubscribe(subId);
    activeSubscriptions.delete(groupId);
    logger.info(`⏹️  Stopped syncing group ${groupId}`);
  }
}

/**
 * Process a Nostr event and sync to database
 */
async function processNostrEvent(event: NostrEvent, groupId: string): Promise<void> {
  switch (event.kind) {
    case BUILD_IT_KINDS.EVENT:
      await syncEvent(event, groupId);
      break;
    case BUILD_IT_KINDS.RSVP:
      await syncRSVP(event);
      break;
    case BUILD_IT_KINDS.PROPOSAL:
      await syncProposal(event, groupId);
      break;
    case BUILD_IT_KINDS.WIKI_PAGE:
      await syncWikiPage(event, groupId);
      break;
    case BUILD_IT_KINDS.MUTUAL_AID:
      await syncMutualAid(event, groupId);
      break;
    case BUILD_IT_KINDS.DATABASE_RECORD:
      await syncDatabaseRecord(event, groupId);
      break;
    default:
      logger.warn(`Unknown event kind: ${event.kind}`);
  }
}

/**
 * Sync event to database
 */
async function syncEvent(nostrEvent: NostrEvent, groupId: string): Promise<void> {
  const dTag = nostrEvent.tags.find((t) => t[0] === 'd')?.[1];
  if (!dTag) return;

  try {
    const content = JSON.parse(nostrEvent.content);

    const eventData = {
      id: dTag,
      groupId,
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
      tags: content.tags?.join(',') || '',
      imageUrl: content.imageUrl,
      locationRevealTime: content.locationRevealTime,
    };

    // Check if event exists
    const existing = await db.events?.get(dTag);

    if (existing) {
      // Only update if Nostr event is newer
      if (nostrEvent.created_at * 1000 > existing.updatedAt) {
        await db.events?.update(dTag, eventData);
        logger.info(`📥 Updated event: ${content.title}`);
      }
    } else {
      // Create new event
      await db.events?.add(eventData);
      logger.info(`📥 New event: ${content.title}`);
    }
  } catch (error) {
    console.error('Failed to sync event:', error);
  }
}

/**
 * Sync RSVP to database
 */
async function syncRSVP(nostrEvent: NostrEvent): Promise<void> {
  const dTag = nostrEvent.tags.find((t) => t[0] === 'd')?.[1];
  const eventIdTag = nostrEvent.tags.find((t) => t[0] === 'e')?.[1];
  const statusTag = nostrEvent.tags.find((t) => t[0] === 'status')?.[1];

  if (!dTag || !eventIdTag || !statusTag) return;

  try {
    const rsvpData = {
      eventId: eventIdTag,
      userPubkey: nostrEvent.pubkey,
      status: statusTag as 'going' | 'maybe' | 'not-going',
      timestamp: nostrEvent.created_at * 1000,
      note: nostrEvent.content,
    };

    // Upsert RSVP
    const existing = await db.rsvps?.where({ eventId: eventIdTag, userPubkey: nostrEvent.pubkey }).first();

    if (existing && existing.id) {
      if (nostrEvent.created_at * 1000 > existing.timestamp) {
        await db.rsvps?.update(existing.id, rsvpData);
        logger.info(`📥 Updated RSVP for event ${eventIdTag}`);
      }
    } else {
      await db.rsvps?.add(rsvpData);
      logger.info(`📥 New RSVP for event ${eventIdTag}`);
    }
  } catch (error) {
    console.error('Failed to sync RSVP:', error);
  }
}

/**
 * Sync proposal to database
 */
async function syncProposal(nostrEvent: NostrEvent, groupId: string): Promise<void> {
  const dTag = nostrEvent.tags.find((t) => t[0] === 'd')?.[1];
  if (!dTag) return;

  try {
    const content = JSON.parse(nostrEvent.content);

    const proposalData = {
      id: dTag,
      groupId,
      title: content.title,
      description: content.description,
      type: content.type,
      status: content.status,
      createdBy: nostrEvent.pubkey,
      createdAt: nostrEvent.created_at * 1000,
      updatedAt: nostrEvent.created_at * 1000,
      options: JSON.stringify(content.options),
      votingDeadline: content.votingDeadline,
      discussionDeadline: content.discussionDeadline,
    };

    const existing = await db.proposals?.get(dTag);

    if (existing) {
      if (nostrEvent.created_at * 1000 > existing.updatedAt) {
        await db.proposals?.update(dTag, proposalData);
        logger.info(`📥 Updated proposal: ${content.title}`);
      }
    } else {
      await db.proposals?.add(proposalData);
      logger.info(`📥 New proposal: ${content.title}`);
    }
  } catch (error) {
    console.error('Failed to sync proposal:', error);
  }
}

/**
 * Sync wiki page to database
 */
async function syncWikiPage(nostrEvent: NostrEvent, groupId: string): Promise<void> {
  const dTag = nostrEvent.tags.find((t) => t[0] === 'd')?.[1];
  if (!dTag) return;

  try {
    const content = JSON.parse(nostrEvent.content);

    const wikiPageData = {
      id: dTag,
      groupId,
      title: content.title,
      content: content.content,
      category: content.category,
      tags: content.tags?.join(',') || '',
      createdBy: nostrEvent.pubkey,
      createdAt: nostrEvent.created_at * 1000,
      updatedAt: nostrEvent.created_at * 1000,
      version: content.version || 1,
    };

    const existing = await db.wikiPages?.get(dTag);

    if (existing) {
      if (nostrEvent.created_at * 1000 > existing.updatedAt) {
        await db.wikiPages?.update(dTag, wikiPageData);
        logger.info(`📥 Updated wiki page: ${content.title}`);
      }
    } else {
      await db.wikiPages?.add(wikiPageData);
      logger.info(`📥 New wiki page: ${content.title}`);
    }
  } catch (error) {
    console.error('Failed to sync wiki page:', error);
  }
}

/**
 * Sync mutual aid request to database
 */
async function syncMutualAid(nostrEvent: NostrEvent, groupId: string): Promise<void> {
  const dTag = nostrEvent.tags.find((t) => t[0] === 'd')?.[1];
  if (!dTag) return;

  try {
    const content = JSON.parse(nostrEvent.content);

    const mutualAidData = {
      id: dTag,
      groupId,
      type: content.type,
      title: content.title,
      description: content.description,
      status: content.status,
      createdBy: nostrEvent.pubkey,
      createdAt: nostrEvent.created_at * 1000,
      updatedAt: nostrEvent.created_at * 1000,
      location: content.location,
      urgency: content.urgency,
      tags: content.tags?.join(',') || '',
    };

    const existing = await db.mutualAidRequests?.get(dTag);

    if (existing) {
      if (nostrEvent.created_at * 1000 > existing.updatedAt) {
        await db.mutualAidRequests?.update(dTag, mutualAidData);
        logger.info(`📥 Updated mutual aid: ${content.title}`);
      }
    } else {
      await db.mutualAidRequests?.add(mutualAidData);
      logger.info(`📥 New mutual aid: ${content.title}`);
    }
  } catch (error) {
    console.error('Failed to sync mutual aid:', error);
  }
}

/**
 * Sync database record to database
 */
async function syncDatabaseRecord(nostrEvent: NostrEvent, groupId: string): Promise<void> {
  const dTag = nostrEvent.tags.find((t) => t[0] === 'd')?.[1];
  const tableIdTag = nostrEvent.tags.find((t) => t[0] === 'table')?.[1];

  if (!dTag || !tableIdTag) return;

  try {
    const content = JSON.parse(nostrEvent.content);

    const recordData = {
      id: dTag,
      tableId: tableIdTag,
      groupId,
      data: JSON.stringify(content.data),
      createdBy: nostrEvent.pubkey,
      createdAt: nostrEvent.created_at * 1000,
      updatedAt: nostrEvent.created_at * 1000,
    };

    const existing = await db.databaseRecords?.get(dTag);

    if (existing) {
      if (nostrEvent.created_at * 1000 > existing.updatedAt) {
        await db.databaseRecords?.update(dTag, recordData);
        logger.info(`📥 Updated database record in table ${tableIdTag}`);
      }
    } else {
      await db.databaseRecords?.add(recordData);
      logger.info(`📥 New database record in table ${tableIdTag}`);
    }
  } catch (error) {
    console.error('Failed to sync database record:', error);
  }
}

/**
 * Start syncing all groups for current user
 */
export async function startAllGroupsSync(): Promise<void> {
  const { currentIdentity } = useAuthStore.getState();

  if (!currentIdentity) {
    logger.warn('Cannot sync: no identity');
    return;
  }

  // Get all groups user is a member of
  const memberships = await db.groupMembers?.where('pubkey').equals(currentIdentity.publicKey).toArray();

  if (!memberships || memberships.length === 0) {
    logger.info('No groups to sync');
    return;
  }

  const groupIds = memberships.map((m) => m.groupId);

  for (const groupId of groupIds) {
    startGroupSync(groupId);
  }

  logger.info(`🔄 Started syncing ${groupIds.length} groups`);
}

/**
 * Stop all syncs (including messages)
 */
export function stopAllSyncs(): void {
  // Stop group syncs
  for (const groupId of activeSubscriptions.keys()) {
    stopGroupSync(groupId);
  }

  // Stop message receiver
  stopMessageReceiver();

  logger.info('⏹️  All syncs stopped');
}

/**
 * Start message sync for current user
 * Subscribes to NIP-17 gift-wrapped DMs
 */
export function startMessageSync(): void {
  const { currentIdentity } = useAuthStore.getState();

  if (!currentIdentity) {
    logger.warn('Cannot start message sync: no identity');
    return;
  }

  // Check if app is unlocked
  if (!getCurrentPrivateKey()) {
    logger.warn('Cannot start message sync: app is locked');
    return;
  }

  startMessageReceiver(currentIdentity.publicKey);
}

/**
 * Stop message sync
 */
export function stopMessageSync(): void {
  stopMessageReceiver();
}

/**
 * Fetch historical messages (catch up after being offline)
 */
export async function fetchHistoricalMessages(since?: number): Promise<number> {
  const { currentIdentity } = useAuthStore.getState();

  if (!currentIdentity) {
    logger.warn('Cannot fetch messages: no identity');
    return 0;
  }

  if (!getCurrentPrivateKey()) {
    logger.warn('Cannot fetch messages: app is locked');
    return 0;
  }

  return fetchMessageHistory(currentIdentity.publicKey, since);
}

/**
 * Start all syncs (groups + messages)
 * Call this after unlock
 */
export async function startAllSyncs(): Promise<void> {
  // Start group syncs
  await startAllGroupsSync();

  // Start message sync
  startMessageSync();

  // Fetch recent historical messages
  await fetchHistoricalMessages();
}
