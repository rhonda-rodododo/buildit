/**
 * AT Protocol publishing via queue
 *
 * Cross-posts Nostr events to Bluesky.
 */

import type { Env, ATPublishMessage, ATDeleteMessage } from '../types';
import { NOSTR_KINDS } from '../types';
import { nostrNoteToBlueskyPost, nostrArticleToBlueskyPost } from '../atproto/publisher';
import { createRecord, deleteRecord } from '../atproto/client';
import { getATSession } from '../atproto/sessionManager';
import {
  getIdentityByPubkey,
  isAlreadyFederated,
  recordFederatedPost,
  getFederatedPost,
  deleteFederatedPost,
} from '../db';

/**
 * Publish a Nostr event to Bluesky
 */
export async function publishToAT(
  message: ATPublishMessage,
  env: Env,
): Promise<void> {
  const { nostrEvent, nostrPubkey } = message;

  // Check for duplicate
  if (await isAlreadyFederated(env.FEDERATION_DB, nostrEvent.id, 'at')) {
    return;
  }

  const identity = await getIdentityByPubkey(env.FEDERATION_DB, nostrPubkey);
  if (!identity || !identity.at_enabled) return;

  const session = await getATSession(env, nostrPubkey);
  if (!session) {
    console.error(`No AT session for ${nostrPubkey.slice(0, 8)}`);
    return;
  }

  try {
    let record;
    switch (nostrEvent.kind) {
      case NOSTR_KINDS.SHORT_NOTE:
        record = nostrNoteToBlueskyPost(nostrEvent);
        break;
      case NOSTR_KINDS.LONG_FORM:
        record = nostrArticleToBlueskyPost(
          nostrEvent,
          env.FEDERATION_DOMAIN,
          identity.username,
        );
        break;
      default:
        return;
    }

    const ref = await createRecord(session, 'app.bsky.feed.post', record as unknown as Record<string, unknown>);

    await recordFederatedPost(
      env.FEDERATION_DB,
      nostrEvent.id,
      nostrPubkey,
      null,
      ref.uri,
      ref.cid,
    );
  } catch (err) {
    console.error(`AT publish failed for ${nostrPubkey.slice(0, 8)}:`, err);
    throw err; // Re-throw for retry
  }
}

/**
 * Delete a previously cross-posted record from Bluesky
 */
export async function deleteFromAT(
  message: ATDeleteMessage,
  env: Env,
): Promise<void> {
  const { nostrEventId, nostrPubkey } = message;

  const federatedPost = await getFederatedPost(env.FEDERATION_DB, nostrEventId);
  if (!federatedPost || !federatedPost.at_uri) return;

  const session = await getATSession(env, nostrPubkey);
  if (!session) return;

  try {
    // Extract rkey from AT URI: at://did:plc:xxx/app.bsky.feed.post/rkey
    const parts = federatedPost.at_uri.split('/');
    const rkey = parts[parts.length - 1];
    const collection = parts.slice(2, -1).join('/');

    await deleteRecord(session, collection, rkey);
    await deleteFederatedPost(env.FEDERATION_DB, nostrEventId);
  } catch (err) {
    console.error(`AT delete failed for ${nostrPubkey.slice(0, 8)}:`, err);
    throw err;
  }
}
