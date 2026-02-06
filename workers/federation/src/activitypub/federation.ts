/**
 * Fedify federation builder configuration
 *
 * Sets up actor dispatchers, inbox handlers, and WebFinger resolution.
 * The builder is configured once at module level and built per-request
 * (required pattern for Cloudflare Workers).
 */

import {
  type FederationBuilder,
  Endpoints,
  Person,
  Follow,
  Create,
  Note,
  Like,
  Announce,
  Undo,
  PUBLIC_COLLECTION,
  parseSemVer,
  type Recipient,
} from '@fedify/fedify';
import type { Env } from '../types';
import { handleFollow, handleCreate, handleLike, handleAnnounce, handleUndo } from './inboxHandlers';
import { loadKeyPairs } from './actorDispatcher';
import { getIdentityByUsername, getFollowerCount, getFollowers, getFederatedPostsByUsername } from '../db';
import { SOFTWARE_INFO } from '../config';

export function configureActivityPub(builder: FederationBuilder<Env>): void {
  // Set up the NodeInfo dispatcher
  builder.setNodeInfoDispatcher('/nodeinfo/2.1', async (_ctx) => {
    return {
      software: {
        name: SOFTWARE_INFO.name,
        version: parseSemVer(SOFTWARE_INFO.version),
        homepage: new URL(SOFTWARE_INFO.repository),
      },
      protocols: ['activitypub'] as const,
      usage: {
        users: { total: 0, activeMonth: 0, activeHalfyear: 0 },
        localPosts: 0,
        localComments: 0,
      },
    };
  });

  // Actor dispatcher — resolves /ap/users/{identifier} to a Person
  builder.setActorDispatcher('/ap/users/{identifier}', async (ctx, identifier) => {
    const env = ctx.data;
    const identity = await getIdentityByUsername(env.FEDERATION_DB, identifier);
    if (!identity || !identity.ap_enabled) return null;

    // Load key pairs for this actor (used for HTTP Signatures)
    const keys = await ctx.getActorKeyPairs(identifier);

    return new Person({
      id: ctx.getActorUri(identifier),
      preferredUsername: identifier,
      name: identifier,
      summary: `BuildIt user @${identifier}`,
      url: new URL(`https://${env.FEDERATION_DOMAIN}/@${identifier}`),
      inbox: ctx.getInboxUri(identifier),
      outbox: ctx.getOutboxUri(identifier),
      followers: ctx.getFollowersUri(identifier),
      endpoints: new Endpoints({
        sharedInbox: ctx.getInboxUri(),
      }),
      // Attach the public key for HTTP Signature verification by remote servers
      publicKey: keys[0]?.cryptographicKey,
      assertionMethods: keys.map((k) => k.multikey),
    });
  })
  .setKeyPairsDispatcher(async (ctx, identifier) => {
    const env = ctx.data;
    const identity = await getIdentityByUsername(env.FEDERATION_DB, identifier);
    if (!identity || !identity.ap_private_key) return [];

    try {
      return await loadKeyPairs(identity.ap_private_key);
    } catch {
      return [];
    }
  });

  // Followers collection dispatcher — returns the list of followers for an actor
  builder
    .setFollowersDispatcher(
      '/ap/users/{identifier}/followers',
      async (ctx, identifier) => {
        const env = ctx.data;
        const followers = await getFollowers(env.FEDERATION_DB, identifier);
        const items: Recipient[] = followers.map((f) => ({
          id: new URL(f.remote_actor_id),
          inboxId: new URL(f.remote_inbox),
          endpoints: f.remote_shared_inbox
            ? { sharedInbox: new URL(f.remote_shared_inbox) }
            : null,
        }));
        return { items };
      },
    )
    .setCounter(async (ctx, identifier) => {
      const env = ctx.data;
      return await getFollowerCount(env.FEDERATION_DB, identifier);
    });

  // Outbox collection dispatcher — returns federated activities for an actor
  builder
    .setOutboxDispatcher(
      '/ap/users/{identifier}/outbox',
      async (ctx, identifier, cursor) => {
        const env = ctx.data;
        const identity = await getIdentityByUsername(env.FEDERATION_DB, identifier);
        if (!identity || !identity.ap_enabled) return { items: [] };

        const pageSize = 20;
        const offset = cursor ? parseInt(cursor, 10) : 0;
        const { posts, total } = await getFederatedPostsByUsername(
          env.FEDERATION_DB,
          identifier,
          pageSize,
          offset,
        );

        const actorUri = ctx.getActorUri(identifier);
        const followersUri = ctx.getFollowersUri(identifier);

        const items = posts
          .filter((p) => p.ap_activity_id)
          .map((p) => {
            const noteId = `https://${env.FEDERATION_DOMAIN}/ap/users/${identifier}/posts/${p.nostr_event_id}`;
            return new Create({
              id: new URL(p.ap_activity_id!),
              actor: actorUri,
              to: PUBLIC_COLLECTION,
              cc: followersUri,
              object: new Note({
                id: new URL(noteId),
                attribution: actorUri,
              }),
            });
          });

        const nextOffset = offset + pageSize;
        return {
          items,
          nextCursor: nextOffset < total ? String(nextOffset) : null,
        };
      },
    )
    .setCounter(async (ctx, identifier) => {
      const env = ctx.data;
      const { total } = await getFederatedPostsByUsername(env.FEDERATION_DB, identifier, 0, 0);
      return total;
    })
    .setFirstCursor(async (_ctx, _identifier) => '0');

  // Inbox handlers — process incoming AP activities
  builder
    .setInboxListeners('/ap/users/{identifier}/inbox', '/ap/inbox')
    .on(Follow, handleFollow)
    .on(Create, handleCreate)
    .on(Like, handleLike)
    .on(Announce, handleAnnounce)
    .on(Undo, handleUndo);
}
