/**
 * BuildIt Network Nostr Relay Worker
 * Based on Nosflare (https://github.com/Spl0itable/nosflare)
 *
 * Main worker module handling HTTP requests, event processing,
 * database operations, and query handling.
 */

import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import type { NostrEvent, NostrFilter, QueryResult, ProcessEventResult, Env, EventRow } from './types';
import {
  relayInfo,
  CONTENT_HASH_DEDUP_ENABLED,
  CONTENT_HASH_WINDOW_MS,
  protectedKinds,
  PRUNE_MIN_AGE_DAYS,
  DB_MAX_SIZE_MB,
  COUNTRY_REGIONS,
  US_STATE_REGIONS,
  ENDPOINT_HINTS,
} from './config';

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

const SCHEMA_SQL = `
-- Main events table with denormalized tag columns for fast queries
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  kind INTEGER NOT NULL,
  tags TEXT NOT NULL,
  content TEXT NOT NULL,
  sig TEXT NOT NULL,
  p_tags TEXT,
  e_tags TEXT,
  a_tags TEXT,
  t_tags TEXT,
  d_tag TEXT,
  r_tags TEXT,
  L_tags TEXT,
  s_tags TEXT,
  u_tags TEXT,
  content_hash TEXT,
  indexed_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_pubkey_kind ON events(pubkey, kind);
CREATE INDEX IF NOT EXISTS idx_events_kind_created ON events(kind, created_at DESC);

-- Tag normalization table for flexible querying
CREATE TABLE IF NOT EXISTS event_tags (
  event_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  tag_value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_tags_name_value ON event_tags(tag_name, tag_value);
CREATE INDEX IF NOT EXISTS idx_event_tags_value ON event_tags(tag_value);
CREATE INDEX IF NOT EXISTS idx_event_tags_event ON event_tags(event_id);

-- Content hash for deduplication
CREATE TABLE IF NOT EXISTS content_hashes (
  hash TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_hashes_pubkey ON content_hashes(pubkey);
CREATE INDEX IF NOT EXISTS idx_content_hashes_created ON content_hashes(created_at);

-- Payment tracking
CREATE TABLE IF NOT EXISTS payments (
  pubkey TEXT PRIMARY KEY,
  paid_at INTEGER NOT NULL,
  expires_at INTEGER,
  amount_sats INTEGER NOT NULL,
  invoice_id TEXT
);

-- Deleted events tracking
CREATE TABLE IF NOT EXISTS deleted_events (
  event_id TEXT PRIMARY KEY,
  deleted_by TEXT NOT NULL,
  deleted_at INTEGER NOT NULL
);
`;

export async function initializeDatabase(db: D1Database): Promise<void> {
  try {
    // Split and execute each statement
    const statements = SCHEMA_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const sql of statements) {
      await db.prepare(sql).run();
    }

    console.log('Database schema initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// =============================================================================
// CRYPTOGRAPHIC VERIFICATION
// =============================================================================

/**
 * Verify a Nostr event signature using Schnorr
 */
export async function verifyEventSignature(event: NostrEvent): Promise<boolean> {
  try {
    // Compute event ID from canonical serialization
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);

    const hash = sha256(new TextEncoder().encode(serialized));
    const computedId = bytesToHex(hash);

    // Verify ID matches
    if (computedId !== event.id) {
      console.error(`Event ID mismatch: computed=${computedId}, provided=${event.id}`);
      return false;
    }

    // Verify Schnorr signature
    const pubkeyBytes = hexToBytes(event.pubkey);
    const sigBytes = hexToBytes(event.sig);
    const idBytes = hexToBytes(event.id);

    return schnorr.verify(sigBytes, idBytes, pubkeyBytes);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// =============================================================================
// EVENT PROCESSING
// =============================================================================

/**
 * Process and store a Nostr event
 */
export async function processEvent(
  event: NostrEvent,
  sessionId: string,
  env: Env
): Promise<ProcessEventResult> {
  const db = env.RELAY_DATABASE;

  try {
    // Check if event already exists
    const existing = await db
      .prepare('SELECT id FROM events WHERE id = ?')
      .bind(event.id)
      .first();

    if (existing) {
      return {
        success: true,
        message: 'duplicate: event already exists',
      };
    }

    // Check if event was deleted
    const deleted = await db
      .prepare('SELECT event_id FROM deleted_events WHERE event_id = ?')
      .bind(event.id)
      .first();

    if (deleted) {
      return {
        success: false,
        message: 'blocked: event was deleted',
      };
    }

    // Content hash deduplication
    if (CONTENT_HASH_DEDUP_ENABLED && event.content.length > 0) {
      const contentHash = bytesToHex(sha256(new TextEncoder().encode(event.content)));
      const windowStart = Math.floor(Date.now() / 1000) - Math.floor(CONTENT_HASH_WINDOW_MS / 1000);

      const duplicateContent = await db
        .prepare(`
          SELECT hash FROM content_hashes
          WHERE hash = ? AND pubkey = ? AND created_at > ?
        `)
        .bind(contentHash, event.pubkey, windowStart)
        .first();

      if (duplicateContent) {
        return {
          success: false,
          message: 'duplicate: identical content recently posted',
        };
      }

      // Store content hash
      await db
        .prepare(`
          INSERT OR REPLACE INTO content_hashes (hash, pubkey, created_at)
          VALUES (?, ?, ?)
        `)
        .bind(contentHash, event.pubkey, event.created_at)
        .run();
    }

    // Handle deletion events (kind 5)
    if (event.kind === 5) {
      await handleDeletionEvent(event, env);
    }

    // Handle replaceable events (NIP-16)
    if (isReplaceableKind(event.kind)) {
      await handleReplaceableEvent(event, env);
    }

    // Handle parameterized replaceable events (NIP-33)
    if (isParameterizedReplaceableKind(event.kind)) {
      await handleParameterizedReplaceableEvent(event, env);
    }

    // Extract tag values for denormalized columns
    const tagData = extractTagData(event.tags);

    // Insert event
    await db
      .prepare(`
        INSERT INTO events (
          id, pubkey, created_at, kind, tags, content, sig,
          p_tags, e_tags, a_tags, t_tags, d_tag, r_tags, L_tags, s_tags, u_tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        event.id,
        event.pubkey,
        event.created_at,
        event.kind,
        JSON.stringify(event.tags),
        event.content,
        event.sig,
        tagData.p,
        tagData.e,
        tagData.a,
        tagData.t,
        tagData.d,
        tagData.r,
        tagData.L,
        tagData.s,
        tagData.u
      )
      .run();

    // Insert normalized tags
    const tagInserts: D1PreparedStatement[] = [];
    for (const tag of event.tags) {
      if (tag.length >= 2 && tag[0].length === 1) {
        tagInserts.push(
          db
            .prepare(`
              INSERT INTO event_tags (event_id, tag_name, tag_value, created_at)
              VALUES (?, ?, ?, ?)
            `)
            .bind(event.id, tag[0], tag[1], event.created_at)
        );
      }
    }

    if (tagInserts.length > 0) {
      await db.batch(tagInserts);
    }

    return {
      success: true,
      message: '',
    };
  } catch (error) {
    console.error('Error processing event:', error);
    return {
      success: false,
      message: `error: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

function extractTagData(tags: string[][]): Record<string, string | null> {
  const result: Record<string, string | null> = {
    p: null,
    e: null,
    a: null,
    t: null,
    d: null,
    r: null,
    L: null,
    s: null,
    u: null,
  };

  const collected: Record<string, string[]> = {};

  for (const tag of tags) {
    if (tag.length >= 2) {
      const name = tag[0];
      const value = tag[1];

      if (name in result) {
        if (!collected[name]) {
          collected[name] = [];
        }
        collected[name].push(value);
      }
    }
  }

  // d-tag is single value, others are comma-separated
  for (const [name, values] of Object.entries(collected)) {
    if (name === 'd') {
      result.d = values[0] || null;
    } else {
      result[name] = values.join(',') || null;
    }
  }

  return result;
}

function isReplaceableKind(kind: number): boolean {
  return kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000);
}

function isParameterizedReplaceableKind(kind: number): boolean {
  return kind >= 30000 && kind < 40000;
}

async function handleDeletionEvent(event: NostrEvent, env: Env): Promise<void> {
  const db = env.RELAY_DATABASE;
  const eventIdsToDelete: string[] = [];
  const addressesToDelete: string[] = [];

  for (const tag of event.tags) {
    if (tag[0] === 'e' && tag[1]) {
      eventIdsToDelete.push(tag[1]);
    } else if (tag[0] === 'a' && tag[1]) {
      addressesToDelete.push(tag[1]);
    }
  }

  // Delete by event ID (verify ownership)
  for (const eventId of eventIdsToDelete) {
    const existingEvent = await db
      .prepare('SELECT pubkey FROM events WHERE id = ?')
      .bind(eventId)
      .first<{ pubkey: string }>();

    if (existingEvent && existingEvent.pubkey === event.pubkey) {
      await db.prepare('DELETE FROM events WHERE id = ?').bind(eventId).run();
      await db
        .prepare(`
          INSERT OR IGNORE INTO deleted_events (event_id, deleted_by, deleted_at)
          VALUES (?, ?, ?)
        `)
        .bind(eventId, event.pubkey, event.created_at)
        .run();
    }
  }

  // Delete by address (kind:pubkey:d-tag)
  for (const address of addressesToDelete) {
    const [kindStr, pubkey, dTag] = address.split(':');
    const kind = parseInt(kindStr, 10);

    if (pubkey === event.pubkey) {
      const toDelete = await db
        .prepare(`
          SELECT id FROM events
          WHERE kind = ? AND pubkey = ? AND d_tag = ?
        `)
        .bind(kind, pubkey, dTag || '')
        .all<{ id: string }>();

      for (const row of toDelete.results || []) {
        await db.prepare('DELETE FROM events WHERE id = ?').bind(row.id).run();
        await db
          .prepare(`
            INSERT OR IGNORE INTO deleted_events (event_id, deleted_by, deleted_at)
            VALUES (?, ?, ?)
          `)
          .bind(row.id, event.pubkey, event.created_at)
          .run();
      }
    }
  }
}

async function handleReplaceableEvent(event: NostrEvent, env: Env): Promise<void> {
  const db = env.RELAY_DATABASE;

  // Delete older events of same kind by same pubkey
  await db
    .prepare(`
      DELETE FROM events
      WHERE pubkey = ? AND kind = ? AND created_at < ?
    `)
    .bind(event.pubkey, event.kind, event.created_at)
    .run();
}

async function handleParameterizedReplaceableEvent(event: NostrEvent, env: Env): Promise<void> {
  const db = env.RELAY_DATABASE;

  // Find d-tag
  const dTag = event.tags.find(t => t[0] === 'd')?.[1] || '';

  // Delete older events with same kind, pubkey, and d-tag
  await db
    .prepare(`
      DELETE FROM events
      WHERE pubkey = ? AND kind = ? AND d_tag = ? AND created_at < ?
    `)
    .bind(event.pubkey, event.kind, dTag, event.created_at)
    .run();
}

// =============================================================================
// EVENT QUERIES
// =============================================================================

/**
 * Query events matching filters
 */
export async function queryEvents(
  filters: NostrFilter[],
  bookmark: string,
  env: Env
): Promise<QueryResult> {
  const db = env.RELAY_DATABASE;
  const allEvents: NostrEvent[] = [];
  const seenIds = new Set<string>();

  for (const filter of filters) {
    const { sql, params } = buildQuery(filter);

    try {
      const result = await db.prepare(sql).bind(...params).all<EventRow>();

      for (const row of result.results || []) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          allEvents.push({
            id: row.id,
            pubkey: row.pubkey,
            created_at: row.created_at,
            kind: row.kind,
            tags: JSON.parse(row.tags),
            content: row.content,
            sig: row.sig,
          });
        }
      }
    } catch (error) {
      console.error('Query error:', error, 'SQL:', sql);
    }
  }

  // Sort by created_at descending
  allEvents.sort((a, b) => b.created_at - a.created_at);

  return {
    events: allEvents,
    bookmark,
  };
}

function buildQuery(filter: NostrFilter): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Filter by IDs
  if (filter.ids && filter.ids.length > 0) {
    const placeholders = filter.ids.map(() => '?').join(', ');
    conditions.push(`id IN (${placeholders})`);
    params.push(...filter.ids);
  }

  // Filter by authors
  if (filter.authors && filter.authors.length > 0) {
    const placeholders = filter.authors.map(() => '?').join(', ');
    conditions.push(`pubkey IN (${placeholders})`);
    params.push(...filter.authors);
  }

  // Filter by kinds
  if (filter.kinds && filter.kinds.length > 0) {
    const placeholders = filter.kinds.map(() => '?').join(', ');
    conditions.push(`kind IN (${placeholders})`);
    params.push(...filter.kinds);
  }

  // Filter by time range
  if (filter.since) {
    conditions.push('created_at >= ?');
    params.push(filter.since);
  }

  if (filter.until) {
    conditions.push('created_at <= ?');
    params.push(filter.until);
  }

  // Handle tag filters - use denormalized columns for common tags
  const tagFilters = Object.entries(filter).filter(
    ([key, value]) => key.startsWith('#') && Array.isArray(value) && value.length > 0
  );

  for (const [key, values] of tagFilters) {
    const tagName = key.substring(1);
    // Input validation: limit tag values to prevent DoS
    const MAX_TAG_VALUES = 20;
    const MAX_TAG_VALUE_LENGTH = 256;
    const tagValues = (values as string[])
      .slice(0, MAX_TAG_VALUES)
      .filter(v => typeof v === 'string' && v.length <= MAX_TAG_VALUE_LENGTH);

    // Use denormalized columns for common tags
    if (['p', 'e', 'a', 't', 'd', 'r', 'L', 's', 'u'].includes(tagName)) {
      if (tagName === 'd') {
        // d-tag is single value
        const placeholders = tagValues.map(() => '?').join(', ');
        conditions.push(`d_tag IN (${placeholders})`);
        params.push(...tagValues);
      } else {
        // Other tags are comma-separated, use LIKE for each value
        const likeConditions = tagValues.map(() => `${tagName}_tags LIKE ?`);
        conditions.push(`(${likeConditions.join(' OR ')})`);
        params.push(...tagValues.map(v => `%${v}%`));
      }
    } else {
      // Fall back to normalized tags table
      const placeholders = tagValues.map(() => '?').join(', ');
      conditions.push(`
        id IN (
          SELECT event_id FROM event_tags
          WHERE tag_name = ? AND tag_value IN (${placeholders})
        )
      `);
      params.push(tagName, ...tagValues);
    }
  }

  const limit = Math.min(Math.max(1, Math.floor(Number(filter.limit) || 500)), 500);

  let sql = 'SELECT * FROM events';
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY created_at DESC';
  sql += ' LIMIT ?';
  params.push(limit);

  return { sql, params };
}

// =============================================================================
// PAYMENT VERIFICATION
// =============================================================================

/**
 * Check if a pubkey has paid for relay access
 */
export async function hasPaidForRelay(pubkey: string, env: Env): Promise<boolean> {
  const db = env.RELAY_DATABASE;

  try {
    const payment = await db
      .prepare(`
        SELECT expires_at FROM payments
        WHERE pubkey = ?
      `)
      .bind(pubkey)
      .first<{ expires_at: number | null }>();

    if (!payment) {
      return false;
    }

    // If no expiration, payment is valid forever
    if (!payment.expires_at) {
      return true;
    }

    // Check if not expired
    return payment.expires_at > Math.floor(Date.now() / 1000);
  } catch (error) {
    console.error('Payment check error:', error);
    return false;
  }
}

// =============================================================================
// DATABASE MAINTENANCE
// =============================================================================

/**
 * Prune old events to keep database size manageable
 */
export async function pruneDatabase(env: Env): Promise<void> {
  const db = env.RELAY_DATABASE;

  try {
    // Get approximate database size
    const sizeResult = await db
      .prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
      .first<{ size: number }>();

    const sizeMB = (sizeResult?.size || 0) / (1024 * 1024);
    console.log(`Database size: ${sizeMB.toFixed(2)} MB`);

    if (sizeMB < DB_MAX_SIZE_MB) {
      console.log('Database size within limits, skipping pruning');
      return;
    }

    // Calculate cutoff time
    const cutoffTime = Math.floor(Date.now() / 1000) - PRUNE_MIN_AGE_DAYS * 24 * 60 * 60;

    // Delete old events (except protected kinds) using parameterized queries
    const protectedArr = Array.from(protectedKinds);
    const placeholders = protectedArr.map(() => '?').join(', ');

    const result = await db
      .prepare(`
        DELETE FROM events
        WHERE created_at < ?
        AND kind NOT IN (${placeholders})
      `)
      .bind(cutoffTime, ...protectedArr)
      .run();

    console.log(`Pruned ${result.meta.changes} old events`);

    // Clean up orphaned tags
    await db.prepare(`
      DELETE FROM event_tags
      WHERE event_id NOT IN (SELECT id FROM events)
    `).run();

    // Clean up old content hashes
    const hashCutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    await db.prepare(`
      DELETE FROM content_hashes WHERE created_at < ?
    `).bind(hashCutoff).run();

    // Optimize database
    await db.prepare('PRAGMA optimize').run();

    console.log('Database maintenance complete');
  } catch (error) {
    console.error('Database pruning error:', error);
  }
}

// =============================================================================
// HTTP REQUEST HANDLING
// =============================================================================

/**
 * Handle incoming HTTP requests
 */
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: getCorsHeaders(),
    });
  }

  // NIP-11 relay information
  if (request.headers.get('Accept') === 'application/nostr+json') {
    const info = {
      ...relayInfo,
      pubkey: env.RELAY_PUBKEY || relayInfo.pubkey,
      contact: env.RELAY_CONTACT || relayInfo.contact,
    };

    return new Response(JSON.stringify(info), {
      headers: {
        'Content-Type': 'application/nostr+json',
        ...getCorsHeaders(),
      },
    });
  }

  // WebSocket upgrade
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader?.toLowerCase() === 'websocket') {
    return handleWebSocketUpgrade(request, env);
  }

  // Health check
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ status: 'healthy', timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() },
    });
  }

  // Database initialization (admin endpoint - requires ADMIN_SECRET)
  if (url.pathname === '/admin/init-db' && request.method === 'POST') {
    const authHeader = request.headers.get('Authorization');
    const adminSecret = (env as Record<string, unknown>).ADMIN_SECRET as string | undefined;
    if (!adminSecret || !authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    await initializeDatabase(env.RELAY_DATABASE);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Default response
  return new Response('BuildIt Network Nostr Relay\n\nConnect via WebSocket to use this relay.', {
    headers: {
      'Content-Type': 'text/plain',
      ...getCorsHeaders(),
    },
  });
}

const ALLOWED_ORIGINS = [
  'https://buildit.network',
  'https://www.buildit.network',
  'https://app.buildit.network',
  'tauri://localhost',        // Tauri desktop
  'http://localhost:1420',    // Tauri dev
  'http://localhost:5173',    // Vite dev
];

function getCorsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Vary': 'Origin',
  };
}

/**
 * Handle WebSocket upgrade and route to appropriate Durable Object
 */
async function handleWebSocketUpgrade(request: Request, env: Env): Promise<Response> {
  // Determine region from request
  const cf = request.cf as { country?: string; region?: string; colo?: string } | undefined;
  const country = cf?.country || 'US';
  const region = cf?.region || '';
  const colo = cf?.colo || 'default';

  // Select appropriate DO endpoint
  let doRegion = COUNTRY_REGIONS[country] || 'WNAM';

  // US state-level routing
  if (country === 'US' && region && US_STATE_REGIONS[region]) {
    doRegion = US_STATE_REGIONS[region];
  }

  const doName = `relay-${doRegion}-primary`;
  const locationHint = (ENDPOINT_HINTS[doName] || 'auto') as DurableObjectLocationHint;

  // Get Durable Object stub
  const id = env.RELAY_WEBSOCKET.idFromName(doName);
  const stub = env.RELAY_WEBSOCKET.get(id, { locationHint });

  // Forward request to DO
  const doUrl = new URL(request.url);
  doUrl.searchParams.set('region', doRegion);
  doUrl.searchParams.set('colo', colo);
  doUrl.searchParams.set('doName', doName);

  return stub.fetch(new Request(doUrl.toString(), request));
}

// =============================================================================
// SCHEDULED TASKS
// =============================================================================

/**
 * Handle scheduled cron triggers
 */
export async function handleScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`Scheduled task triggered at ${new Date(event.scheduledTime).toISOString()}`);

  ctx.waitUntil(pruneDatabase(env));
}
