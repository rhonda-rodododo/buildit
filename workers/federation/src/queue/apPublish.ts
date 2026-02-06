/**
 * ActivityPub publishing via queue
 *
 * Uses Fedify's ctx.sendActivity() for proper HTTP Signature signing and delivery.
 * Fedify handles shared inbox batching, retries, and signature generation.
 */

import {
  Create,
  Delete,
  Update,
  Note,
  Article,
  Person,
  Image,
  Source,
  Tombstone,
  PUBLIC_COLLECTION,
  type Federation,
} from '@fedify/fedify';
import type { Env, APPublishMessage, APDeleteMessage, APProfileUpdateMessage } from '../types';
import { NOSTR_KINDS } from '../types';
import { nostrNoteToAPNote, nostrArticleToAPArticle } from '../activitypub/outbox';
import { nostrProfileToAPProfile } from '../activitypub/actorDispatcher';
import {
  getIdentityByUsername,
  isAlreadyFederated,
  recordFederatedPost,
  deleteFederatedPost,
} from '../db';

/**
 * Publish a Nostr event as an AP activity to all followers.
 * Uses Fedify's sendActivity which handles HTTP Signatures, retries, and shared inbox batching.
 */
export async function publishToAP(
  message: APPublishMessage,
  env: Env,
  federation: Federation<Env>,
): Promise<void> {
  const { nostrEvent, username } = message;
  const domain = env.FEDERATION_DOMAIN;

  // Check for duplicate
  if (await isAlreadyFederated(env.FEDERATION_DB, nostrEvent.id, 'ap')) {
    return;
  }

  const identity = await getIdentityByUsername(env.FEDERATION_DB, username);
  if (!identity || !identity.ap_enabled) return;

  // Build the Fedify context for sending
  const ctx = federation.createContext(
    new Request(`https://${domain}/`),
    env,
  );

  const actorUri = ctx.getActorUri(username);
  const followersUri = ctx.getFollowersUri(username);

  // Convert Nostr event to AP object based on kind
  let apObject: Note | Article;

  switch (nostrEvent.kind) {
    case NOSTR_KINDS.SHORT_NOTE: {
      const raw = nostrNoteToAPNote(nostrEvent, username, domain);
      apObject = new Note({
        id: new URL(raw.id),
        attribution: actorUri,
        content: raw.content,
        to: PUBLIC_COLLECTION,
        cc: followersUri,
        url: raw.url ? new URL(raw.url) : undefined,
        source: raw.source ? new Source({
          content: raw.source.content,
          mediaType: raw.source.mediaType,
        }) : undefined,
      });
      break;
    }
    case NOSTR_KINDS.LONG_FORM: {
      const raw = nostrArticleToAPArticle(nostrEvent, username, domain);
      apObject = new Article({
        id: new URL(raw.id),
        attribution: actorUri,
        name: raw.name,
        content: raw.content,
        to: PUBLIC_COLLECTION,
        cc: followersUri,
        url: raw.url ? new URL(raw.url) : undefined,
        source: raw.source ? new Source({
          content: raw.source.content,
          mediaType: raw.source.mediaType,
        }) : undefined,
      });
      break;
    }
    default:
      return;
  }

  const activityId = `https://${domain}/ap/users/${username}/activities/${nostrEvent.id}`;

  // Send to all followers via Fedify — handles HTTP Signatures automatically
  await ctx.sendActivity(
    { identifier: username },
    'followers',
    new Create({
      id: new URL(activityId),
      actor: actorUri,
      to: PUBLIC_COLLECTION,
      cc: followersUri,
      object: apObject,
    }),
    { preferSharedInbox: true },
  );

  // Record the federation
  await recordFederatedPost(env.FEDERATION_DB, nostrEvent.id, nostrEvent.pubkey, activityId, null, null);
}

/**
 * Send a Delete activity for a previously federated post
 */
export async function deleteFromAP(
  message: APDeleteMessage,
  env: Env,
  federation: Federation<Env>,
): Promise<void> {
  const { nostrEventId, username } = message;
  const domain = env.FEDERATION_DOMAIN;

  const federatedPost = await deleteFederatedPost(env.FEDERATION_DB, nostrEventId);
  if (!federatedPost || !federatedPost.ap_activity_id) return;

  const ctx = federation.createContext(
    new Request(`https://${domain}/`),
    env,
  );

  const actorUri = ctx.getActorUri(username);
  const objectUrl = `https://${domain}/ap/users/${username}/posts/${nostrEventId}`;

  await ctx.sendActivity(
    { identifier: username },
    'followers',
    new Delete({
      id: new URL(`${actorUri.href}/activities/delete/${Date.now()}`),
      actor: actorUri,
      to: PUBLIC_COLLECTION,
      object: new Tombstone({
        id: new URL(objectUrl),
      }),
    }),
    { preferSharedInbox: true },
  );
}

/**
 * Update the AP actor profile from a Nostr kind:0 event.
 * Sends Update{Person} activity to all followers so remote servers refresh the cached profile.
 */
export async function updateAPProfile(
  message: APProfileUpdateMessage,
  env: Env,
  federation: Federation<Env>,
): Promise<void> {
  const { nostrEvent, username } = message;
  const domain = env.FEDERATION_DOMAIN;

  const identity = await getIdentityByUsername(env.FEDERATION_DB, username);
  if (!identity || !identity.ap_enabled) return;

  const ctx = federation.createContext(
    new Request(`https://${domain}/`),
    env,
  );

  const actorUri = ctx.getActorUri(username);
  const profile = nostrProfileToAPProfile(nostrEvent, username, domain);

  // Build the updated Person object with profile fields from Nostr metadata
  const person = new Person({
    id: actorUri,
    preferredUsername: username,
    name: profile.name,
    summary: profile.summary,
    url: new URL(`https://${domain}/@${username}`),
    inbox: ctx.getInboxUri(username),
    outbox: ctx.getOutboxUri(username),
    followers: ctx.getFollowersUri(username),
    icon: profile.icon ? new Image({ url: new URL(profile.icon) }) : undefined,
    image: profile.image ? new Image({ url: new URL(profile.image) }) : undefined,
  });

  await ctx.sendActivity(
    { identifier: username },
    'followers',
    new Update({
      id: new URL(`${actorUri.href}/activities/update/${Date.now()}`),
      actor: actorUri,
      to: PUBLIC_COLLECTION,
      object: person,
    }),
    { preferSharedInbox: true },
  );
}
