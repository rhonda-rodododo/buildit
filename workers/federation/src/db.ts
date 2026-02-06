/**
 * Federation D1 database schema and query helpers
 */

import type {
  Env,
  FederationIdentity,
  FederatedPost,
  APFollower,
  IncomingInteraction,
} from './types';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS federation_identities (
  nostr_pubkey TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  ap_enabled INTEGER NOT NULL DEFAULT 0,
  ap_actor_id TEXT,
  ap_private_key TEXT,
  at_enabled INTEGER NOT NULL DEFAULT 0,
  at_did TEXT,
  at_handle TEXT,
  at_session_encrypted TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ap_followers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_actor TEXT NOT NULL,
  remote_actor_id TEXT NOT NULL,
  remote_inbox TEXT NOT NULL,
  remote_shared_inbox TEXT,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(local_actor, remote_actor_id),
  FOREIGN KEY (local_actor) REFERENCES federation_identities(username)
);

CREATE TABLE IF NOT EXISTS federated_posts (
  nostr_event_id TEXT PRIMARY KEY,
  nostr_pubkey TEXT NOT NULL,
  ap_activity_id TEXT,
  at_uri TEXT,
  at_cid TEXT,
  federated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (nostr_pubkey) REFERENCES federation_identities(nostr_pubkey)
);

CREATE TABLE IF NOT EXISTS incoming_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_nostr_pubkey TEXT NOT NULL,
  target_nostr_event_id TEXT,
  source_protocol TEXT NOT NULL CHECK(source_protocol IN ('activitypub', 'atproto')),
  source_actor_id TEXT NOT NULL,
  source_actor_name TEXT,
  interaction_type TEXT NOT NULL CHECK(interaction_type IN ('reply', 'like', 'repost')),
  content TEXT,
  source_url TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (target_nostr_pubkey) REFERENCES federation_identities(nostr_pubkey)
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  nostr_pubkey TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'published', 'failed', 'cancelled')),
  signed_event TEXT,
  cross_post_ap INTEGER DEFAULT 0,
  cross_post_at INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ap_followers_local ON ap_followers(local_actor);
CREATE INDEX IF NOT EXISTS idx_federated_posts_pubkey ON federated_posts(nostr_pubkey);
CREATE INDEX IF NOT EXISTS idx_incoming_target ON incoming_interactions(target_nostr_pubkey, received_at);
CREATE INDEX IF NOT EXISTS idx_sched_status_time ON scheduled_posts(status, scheduled_at);
`;

/** Initialize D1 tables */
export async function initializeDatabase(db: D1Database): Promise<void> {
  const statements = SCHEMA_SQL
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sql of statements) {
    await db.prepare(sql).run();
  }
}

// ============================================================================
// Identity queries
// ============================================================================

export async function getIdentityByPubkey(
  db: D1Database,
  pubkey: string,
): Promise<FederationIdentity | null> {
  return db
    .prepare('SELECT * FROM federation_identities WHERE nostr_pubkey = ?')
    .bind(pubkey)
    .first<FederationIdentity>();
}

export async function getIdentityByUsername(
  db: D1Database,
  username: string,
): Promise<FederationIdentity | null> {
  return db
    .prepare('SELECT * FROM federation_identities WHERE username = ?')
    .bind(username)
    .first<FederationIdentity>();
}

export async function getFederationEnabledPubkeys(
  db: D1Database,
): Promise<string[]> {
  const results = await db
    .prepare(
      'SELECT nostr_pubkey FROM federation_identities WHERE ap_enabled = 1 OR at_enabled = 1',
    )
    .all<{ nostr_pubkey: string }>();
  return results.results.map((r) => r.nostr_pubkey);
}

export async function upsertIdentity(
  db: D1Database,
  identity: Partial<FederationIdentity> & { nostr_pubkey: string; username: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO federation_identities (nostr_pubkey, username, ap_enabled, at_enabled)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(nostr_pubkey) DO UPDATE SET
         username = excluded.username,
         ap_enabled = COALESCE(excluded.ap_enabled, ap_enabled),
         at_enabled = COALESCE(excluded.at_enabled, at_enabled),
         updated_at = datetime('now')`,
    )
    .bind(
      identity.nostr_pubkey,
      identity.username,
      identity.ap_enabled ? 1 : 0,
      identity.at_enabled ? 1 : 0,
    )
    .run();
}

export async function updateAPKeys(
  db: D1Database,
  pubkey: string,
  actorId: string,
  privateKey: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE federation_identities
       SET ap_actor_id = ?, ap_private_key = ?, ap_enabled = 1, updated_at = datetime('now')
       WHERE nostr_pubkey = ?`,
    )
    .bind(actorId, privateKey, pubkey)
    .run();
}

export async function updateATSession(
  db: D1Database,
  pubkey: string,
  did: string,
  handle: string,
  sessionEncrypted: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE federation_identities
       SET at_did = ?, at_handle = ?, at_session_encrypted = ?, at_enabled = 1, updated_at = datetime('now')
       WHERE nostr_pubkey = ?`,
    )
    .bind(did, handle, sessionEncrypted, pubkey)
    .run();
}

export async function disableFederation(
  db: D1Database,
  pubkey: string,
  protocol: 'ap' | 'at' | 'both',
): Promise<void> {
  if (protocol === 'ap' || protocol === 'both') {
    await db
      .prepare(
        `UPDATE federation_identities SET ap_enabled = 0, updated_at = datetime('now') WHERE nostr_pubkey = ?`,
      )
      .bind(pubkey)
      .run();
  }
  if (protocol === 'at' || protocol === 'both') {
    await db
      .prepare(
        `UPDATE federation_identities SET at_enabled = 0, updated_at = datetime('now') WHERE nostr_pubkey = ?`,
      )
      .bind(pubkey)
      .run();
  }
}

// ============================================================================
// Follower queries
// ============================================================================

export async function addFollower(
  db: D1Database,
  localActor: string,
  remoteActorId: string,
  remoteInbox: string,
  remoteSharedInbox: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO ap_followers (local_actor, remote_actor_id, remote_inbox, remote_shared_inbox)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(localActor, remoteActorId, remoteInbox, remoteSharedInbox)
    .run();
}

export async function removeFollower(
  db: D1Database,
  localActor: string,
  remoteActorId: string,
): Promise<void> {
  await db
    .prepare(
      'DELETE FROM ap_followers WHERE local_actor = ? AND remote_actor_id = ?',
    )
    .bind(localActor, remoteActorId)
    .run();
}

export async function getFollowers(
  db: D1Database,
  localActor: string,
): Promise<APFollower[]> {
  const results = await db
    .prepare('SELECT * FROM ap_followers WHERE local_actor = ?')
    .bind(localActor)
    .all<APFollower>();
  return results.results;
}

export async function getFollowerCount(
  db: D1Database,
  localActor: string,
): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM ap_followers WHERE local_actor = ?')
    .bind(localActor)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

/** Get unique shared inboxes for batch delivery */
export async function getSharedInboxes(
  db: D1Database,
  localActor: string,
): Promise<string[]> {
  const results = await db
    .prepare(
      `SELECT DISTINCT remote_shared_inbox FROM ap_followers
       WHERE local_actor = ? AND remote_shared_inbox IS NOT NULL`,
    )
    .bind(localActor)
    .all<{ remote_shared_inbox: string }>();
  return results.results.map((r) => r.remote_shared_inbox);
}

/** Get individual inboxes for followers without shared inboxes */
export async function getIndividualInboxes(
  db: D1Database,
  localActor: string,
): Promise<string[]> {
  const results = await db
    .prepare(
      `SELECT remote_inbox FROM ap_followers
       WHERE local_actor = ? AND remote_shared_inbox IS NULL`,
    )
    .bind(localActor)
    .all<{ remote_inbox: string }>();
  return results.results.map((r) => r.remote_inbox);
}

// ============================================================================
// Federated posts queries
// ============================================================================

export async function recordFederatedPost(
  db: D1Database,
  eventId: string,
  pubkey: string,
  apActivityId: string | null,
  atUri: string | null,
  atCid: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO federated_posts (nostr_event_id, nostr_pubkey, ap_activity_id, at_uri, at_cid)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(nostr_event_id) DO UPDATE SET
         ap_activity_id = COALESCE(excluded.ap_activity_id, ap_activity_id),
         at_uri = COALESCE(excluded.at_uri, at_uri),
         at_cid = COALESCE(excluded.at_cid, at_cid)`,
    )
    .bind(eventId, pubkey, apActivityId, atUri, atCid)
    .run();
}

export async function getFederatedPost(
  db: D1Database,
  eventId: string,
): Promise<FederatedPost | null> {
  return db
    .prepare('SELECT * FROM federated_posts WHERE nostr_event_id = ?')
    .bind(eventId)
    .first<FederatedPost>();
}

export async function isAlreadyFederated(
  db: D1Database,
  eventId: string,
  protocol: 'ap' | 'at',
): Promise<boolean> {
  const col = protocol === 'ap' ? 'ap_activity_id' : 'at_uri';
  const result = await db
    .prepare(
      `SELECT 1 FROM federated_posts WHERE nostr_event_id = ? AND ${col} IS NOT NULL`,
    )
    .bind(eventId)
    .first();
  return result !== null;
}

export async function getFederatedPostsByUsername(
  db: D1Database,
  username: string,
  limit = 20,
  offset = 0,
): Promise<{ posts: FederatedPost[]; total: number }> {
  const countResult = await db
    .prepare(
      `SELECT COUNT(*) as count FROM federated_posts fp
       JOIN federation_identities fi ON fp.nostr_pubkey = fi.nostr_pubkey
       WHERE fi.username = ? AND fp.ap_activity_id IS NOT NULL`,
    )
    .bind(username)
    .first<{ count: number }>();

  const results = await db
    .prepare(
      `SELECT fp.* FROM federated_posts fp
       JOIN federation_identities fi ON fp.nostr_pubkey = fi.nostr_pubkey
       WHERE fi.username = ? AND fp.ap_activity_id IS NOT NULL
       ORDER BY fp.federated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(username, limit, offset)
    .all<FederatedPost>();

  return { posts: results.results, total: countResult?.count ?? 0 };
}

export async function deleteFederatedPost(
  db: D1Database,
  eventId: string,
): Promise<FederatedPost | null> {
  const post = await getFederatedPost(db, eventId);
  if (post) {
    await db
      .prepare('DELETE FROM federated_posts WHERE nostr_event_id = ?')
      .bind(eventId)
      .run();
  }
  return post;
}

// ============================================================================
// Incoming interactions queries
// ============================================================================

export async function recordInteraction(
  db: D1Database,
  interaction: Omit<IncomingInteraction, 'id' | 'received_at'>,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO incoming_interactions
       (target_nostr_pubkey, target_nostr_event_id, source_protocol, source_actor_id, source_actor_name, interaction_type, content, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      interaction.target_nostr_pubkey,
      interaction.target_nostr_event_id,
      interaction.source_protocol,
      interaction.source_actor_id,
      interaction.source_actor_name,
      interaction.interaction_type,
      interaction.content,
      interaction.source_url,
    )
    .run();
}

export async function getInteractions(
  db: D1Database,
  pubkey: string,
  limit = 50,
  offset = 0,
): Promise<IncomingInteraction[]> {
  const results = await db
    .prepare(
      `SELECT * FROM incoming_interactions
       WHERE target_nostr_pubkey = ?
       ORDER BY received_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(pubkey, limit, offset)
    .all<IncomingInteraction>();
  return results.results;
}
