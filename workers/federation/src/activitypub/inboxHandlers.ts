/**
 * ActivityPub inbox handlers
 *
 * Process incoming Follow, Create, Like, Announce, and Undo activities.
 */

import {
  type InboxContext,
  Follow,
  Create,
  Like,
  Announce,
  Undo,
  Accept,
  Note,
  type Actor,
} from '@fedify/fedify';
import type { Env } from '../types';
import { addFollower, removeFollower, getIdentityByUsername, recordInteraction } from '../db';

/** Extract username from an actor URI like https://domain/ap/users/{username} */
function extractUsername(actorUri: URL | null, domain: string): string | null {
  if (!actorUri) return null;
  const match = actorUri.href.match(new RegExp(`https://${domain.replace('.', '\\.')}/ap/users/([^/]+)`));
  return match ? match[1] : null;
}

/** Safely extract a display string from a Fedify name property */
function toDisplayString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value) return String(value);
  return 'Unknown';
}

/** Handle Follow — auto-accept and record follower */
export async function handleFollow(
  ctx: InboxContext<Env>,
  follow: Follow,
): Promise<void> {
  const env = ctx.data;
  const objectUri = follow.objectId;
  if (!objectUri) return;

  // Extract local username from the followed actor URI
  const identifier = extractUsername(objectUri, env.FEDERATION_DOMAIN);
  if (!identifier) return;

  const identity = await getIdentityByUsername(env.FEDERATION_DB, identifier);
  if (!identity || !identity.ap_enabled) return;

  // Get the remote actor info
  const actor = await follow.getActor();
  if (!actor) return;

  const actorId = actor.id?.href;
  if (!actorId) return;

  // Resolve inbox URLs
  const inbox = actor.inboxId?.href;
  if (!inbox) return;

  // Try to get shared inbox from endpoints
  let sharedInbox: string | null = null;
  try {
    const endpoints = actor.endpoints;
    if (endpoints) {
      const sharedInboxId = (endpoints as { sharedInbox?: URL }).sharedInbox;
      sharedInbox = sharedInboxId?.href ?? null;
    }
  } catch {
    // Shared inbox is optional
  }

  // Store follower
  await addFollower(env.FEDERATION_DB, identifier, actorId, inbox, sharedInbox);

  // Auto-accept the follow
  await ctx.sendActivity(
    { identifier },
    actor,
    new Accept({
      id: new URL(`${ctx.getActorUri(identifier).href}/accept/${Date.now()}`),
      actor: ctx.getActorUri(identifier),
      object: follow,
    }),
  );
}

/** Handle Create — incoming reply from fediverse */
export async function handleCreate(
  ctx: InboxContext<Env>,
  create: Create,
): Promise<void> {
  const env = ctx.data;
  const object = await create.getObject();
  if (!(object instanceof Note)) return;

  // Check if this is a reply to one of our posts
  const inReplyToId = object.replyTargetId;
  if (!inReplyToId) return;

  const inReplyToHref = inReplyToId.href;
  if (!inReplyToHref) return;

  // Extract the local identifier from inReplyTo URL to find our user
  // Expected format: https://domain/ap/users/{user}/posts/{eventId}
  const match = inReplyToHref.match(/\/ap\/users\/([^/]+)\/posts\/([^/]+)/);
  if (!match) return;

  const [, username, nostrEventId] = match;
  const identity = await getIdentityByUsername(env.FEDERATION_DB, username);
  if (!identity) return;

  const actor = await create.getActor();
  const actorName = actor ? toDisplayString((actor as Actor).name ?? (actor as Actor).preferredUsername) : 'Unknown';
  const actorId = actor?.id?.href ?? 'unknown';

  await recordInteraction(env.FEDERATION_DB, {
    target_nostr_pubkey: identity.nostr_pubkey,
    target_nostr_event_id: nostrEventId,
    source_protocol: 'activitypub',
    source_actor_id: actorId,
    source_actor_name: actorName,
    interaction_type: 'reply',
    content: object.content ? toDisplayString(object.content) : null,
    source_url: object.id?.href ?? null,
  });
}

/** Handle Like — incoming like from fediverse */
export async function handleLike(
  ctx: InboxContext<Env>,
  like: Like,
): Promise<void> {
  const env = ctx.data;
  const objectUri = like.objectId?.href;
  if (!objectUri) return;

  const match = objectUri.match(/\/ap\/users\/([^/]+)\/posts\/([^/]+)/);
  if (!match) return;

  const [, username, nostrEventId] = match;
  const identity = await getIdentityByUsername(env.FEDERATION_DB, username);
  if (!identity) return;

  const actor = await like.getActor();
  const actorName = actor ? toDisplayString((actor as Actor).name ?? (actor as Actor).preferredUsername) : 'Unknown';
  const actorId = actor?.id?.href ?? 'unknown';

  await recordInteraction(env.FEDERATION_DB, {
    target_nostr_pubkey: identity.nostr_pubkey,
    target_nostr_event_id: nostrEventId,
    source_protocol: 'activitypub',
    source_actor_id: actorId,
    source_actor_name: actorName,
    interaction_type: 'like',
    content: null,
    source_url: null,
  });
}

/** Handle Announce (boost) — incoming repost from fediverse */
export async function handleAnnounce(
  ctx: InboxContext<Env>,
  announce: Announce,
): Promise<void> {
  const env = ctx.data;
  const objectUri = announce.objectId?.href;
  if (!objectUri) return;

  const match = objectUri.match(/\/ap\/users\/([^/]+)\/posts\/([^/]+)/);
  if (!match) return;

  const [, username, nostrEventId] = match;
  const identity = await getIdentityByUsername(env.FEDERATION_DB, username);
  if (!identity) return;

  const actor = await announce.getActor();
  const actorName = actor ? toDisplayString((actor as Actor).name ?? (actor as Actor).preferredUsername) : 'Unknown';
  const actorId = actor?.id?.href ?? 'unknown';

  await recordInteraction(env.FEDERATION_DB, {
    target_nostr_pubkey: identity.nostr_pubkey,
    target_nostr_event_id: nostrEventId,
    source_protocol: 'activitypub',
    source_actor_id: actorId,
    source_actor_name: actorName,
    interaction_type: 'repost',
    content: null,
    source_url: announce.id?.href ?? null,
  });
}

/** Handle Undo — unfollow, unlike, un-boost */
export async function handleUndo(
  ctx: InboxContext<Env>,
  undo: Undo,
): Promise<void> {
  const env = ctx.data;
  const object = await undo.getObject();
  if (!object) return;

  if (object instanceof Follow) {
    const objectUri = object.objectId;
    if (!objectUri) return;

    const identifier = extractUsername(objectUri, env.FEDERATION_DOMAIN);
    if (!identifier) return;

    const actor = await undo.getActor();
    const actorId = actor?.id?.href;
    if (!actorId) return;

    await removeFollower(env.FEDERATION_DB, identifier, actorId);
  }
}
