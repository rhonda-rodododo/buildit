/**
 * Federation Worker type definitions
 *
 * Protocol types (NostrEvent) are imported from generated schemas.
 * Database row types use snake_case to match D1 column names and are
 * defined locally since they differ from the camelCase protocol types.
 */

import type { NostrEvent as GeneratedNostrEvent } from '../../shared/generated/schemas/nostr';

// Re-export NostrEvent with _v made optional. Raw events from the relay
// do not include the schema version field.
export type NostrEvent = Omit<GeneratedNostrEvent, '_v'> & { _v?: string };

// Cloudflare Workers environment bindings
export interface Env {
  FEDERATION_DB: D1Database;
  FEDERATION_KV: KVNamespace;
  FEDERATION_QUEUE: Queue;
  FEDERATION_BRIDGE: DurableObjectNamespace;
  SCHEDULER_BRIDGE: DurableObjectNamespace;

  ENVIRONMENT: string;
  FEDERATION_DOMAIN: string;
  RELAY_URL: string;

  ADMIN_TOKEN?: string;
  ATPROTO_ENCRYPTION_KEY?: string;
}

// ---------------------------------------------------------------------------
// D1 row types (snake_case to match database column names)
// These intentionally differ from the camelCase generated protocol types
// (FederationIdentity, APFollower, FederatedPost, FederationInteraction)
// because D1 returns columns exactly as named in the SQL schema.
// ---------------------------------------------------------------------------

/** Federation identity row — maps a Nostr pubkey to AP/AT accounts */
export interface FederationIdentity {
  nostr_pubkey: string;
  username: string;
  ap_enabled: boolean;
  ap_actor_id: string | null;
  ap_private_key: string | null;
  at_enabled: boolean;
  at_did: string | null;
  at_handle: string | null;
  at_session_encrypted: string | null;
  created_at: string;
  updated_at: string;
}

/** ActivityPub follower row */
export interface APFollower {
  id: number;
  local_actor: string;
  remote_actor_id: string;
  remote_inbox: string;
  remote_shared_inbox: string | null;
  accepted_at: string;
}

/** Federated post tracking row */
export interface FederatedPost {
  nostr_event_id: string;
  nostr_pubkey: string;
  ap_activity_id: string | null;
  at_uri: string | null;
  at_cid: string | null;
  federated_at: string;
}

/** Incoming interaction row from AP/AT flowing back to clients */
export interface IncomingInteraction {
  id: number;
  target_nostr_pubkey: string;
  target_nostr_event_id: string | null;
  source_protocol: 'activitypub' | 'atproto';
  source_actor_id: string;
  source_actor_name: string | null;
  interaction_type: 'reply' | 'like' | 'repost';
  content: string | null;
  source_url: string | null;
  received_at: string;
}

/** Queue message types */
export type QueueMessage =
  | APPublishMessage
  | ATPublishMessage
  | APDeleteMessage
  | ATDeleteMessage
  | APProfileUpdateMessage;

export interface APPublishMessage {
  type: 'ap_publish';
  nostrEvent: NostrEvent;
  username: string;
}

export interface ATPublishMessage {
  type: 'at_publish';
  nostrEvent: NostrEvent;
  nostrPubkey: string;
}

export interface APDeleteMessage {
  type: 'ap_delete';
  nostrEventId: string;
  username: string;
}

export interface ATDeleteMessage {
  type: 'at_delete';
  nostrEventId: string;
  nostrPubkey: string;
}

export interface APProfileUpdateMessage {
  type: 'ap_profile_update';
  nostrEvent: NostrEvent;
  username: string;
}

/** Nostr event kinds we care about */
export const NOSTR_KINDS = {
  METADATA: 0,
  SHORT_NOTE: 1,
  LONG_FORM: 30023,
  DELETION: 5,
} as const;
