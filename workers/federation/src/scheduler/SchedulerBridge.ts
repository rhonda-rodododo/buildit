/**
 * SchedulerBridge — Durable Object for server-side scheduling
 *
 * Stores pre-signed Nostr events and publishes them at scheduled times.
 * Uses Durable Object alarms for precise wake-up at scheduled times.
 * Client pre-signs the event (server never has private keys — zero-knowledge).
 *
 * Design:
 * - POST /schedule — Schedule a pre-signed Nostr event
 * - DELETE /schedule/:id — Cancel a scheduled post
 * - GET /schedule/status — Get all scheduled posts for a pubkey
 * - GET /schedule/:id — Get single scheduled post status
 * - alarm() — Processes due posts, relays events, enqueues cross-posts
 */

import type { Env, NostrEvent, QueueMessage } from '../types';

interface ScheduledPost {
  id: string;
  nostr_pubkey: string;
  scheduled_at: number;
  status: 'pending' | 'published' | 'failed' | 'cancelled';
  signed_event: string;
  cross_post_ap: number;
  cross_post_at: number;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  published_at: string | null;
}

interface ScheduleRequest {
  id: string;
  nostrEvent: NostrEvent;
  scheduledAt: number;
  crossPostAP?: boolean;
  crossPostAT?: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [60_000, 300_000, 900_000]; // 1min, 5min, 15min

export class SchedulerBridge implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // POST /schedule
    if (url.pathname === '/schedule' && request.method === 'POST') {
      return this.handleSchedule(request);
    }

    // DELETE /schedule/:id
    if (url.pathname.startsWith('/schedule/') && request.method === 'DELETE') {
      const id = url.pathname.split('/schedule/')[1];
      return this.handleCancel(id);
    }

    // GET /schedule/status?pubkey=...
    if (url.pathname === '/schedule/status' && request.method === 'GET') {
      const pubkey = url.searchParams.get('pubkey');
      if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
        return new Response('Invalid pubkey', { status: 400 });
      }
      return this.handleGetStatus(pubkey);
    }

    // GET /schedule/:id
    if (url.pathname.startsWith('/schedule/') && request.method === 'GET') {
      const id = url.pathname.split('/schedule/')[1];
      return this.handleGetOne(id);
    }

    // POST /sweep (internal — called by scheduled() handler to process missed alarms)
    if (url.pathname === '/sweep' && request.method === 'POST') {
      return this.handleSweep();
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleSchedule(request: Request): Promise<Response> {
    let body: ScheduleRequest;
    try {
      body = await request.json() as ScheduleRequest;
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { id, nostrEvent, scheduledAt, crossPostAP, crossPostAT } = body;

    // Validate
    if (!id || !nostrEvent || !scheduledAt) {
      return new Response('Missing required fields: id, nostrEvent, scheduledAt', { status: 400 });
    }

    if (!/^[0-9a-f]{64}$/.test(nostrEvent.pubkey)) {
      return new Response('Invalid pubkey', { status: 400 });
    }

    if (scheduledAt <= Date.now()) {
      return new Response('scheduledAt must be in the future', { status: 400 });
    }

    // Verify event signature (basic check — could add nostr signature verification)
    if (!nostrEvent.id || !nostrEvent.sig) {
      return new Response('Event must be pre-signed (id and sig required)', { status: 400 });
    }

    // Store in D1
    try {
      await this.env.FEDERATION_DB.prepare(
        `INSERT INTO scheduled_posts (id, nostr_pubkey, scheduled_at, signed_event, cross_post_ap, cross_post_at, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')
         ON CONFLICT(id) DO UPDATE SET
           scheduled_at = excluded.scheduled_at,
           signed_event = excluded.signed_event,
           cross_post_ap = excluded.cross_post_ap,
           cross_post_at = excluded.cross_post_at,
           status = 'pending',
           retry_count = 0,
           error_message = NULL`
      )
        .bind(
          id,
          nostrEvent.pubkey,
          scheduledAt,
          JSON.stringify(nostrEvent),
          crossPostAP ? 1 : 0,
          crossPostAT ? 1 : 0,
        )
        .run();

      // Set alarm for the earliest scheduled post
      await this.updateAlarm();

      return new Response(
        JSON.stringify({ status: 'scheduled', id }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('Schedule error:', err);
      return new Response(
        JSON.stringify({ status: 'error', message: String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  private async handleCancel(id: string): Promise<Response> {
    try {
      const result = await this.env.FEDERATION_DB.prepare(
        `UPDATE scheduled_posts SET status = 'cancelled' WHERE id = ? AND status = 'pending'`
      )
        .bind(id)
        .run();

      if (result.meta.changes === 0) {
        return new Response('Not found or already processed', { status: 404 });
      }

      // Update alarm in case we cancelled the next scheduled item
      await this.updateAlarm();

      return new Response(
        JSON.stringify({ status: 'cancelled', id }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('Cancel error:', err);
      return new Response(
        JSON.stringify({ status: 'error', message: String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  private async handleGetStatus(pubkey: string): Promise<Response> {
    try {
      const results = await this.env.FEDERATION_DB.prepare(
        `SELECT id, scheduled_at, status, retry_count, error_message, created_at, published_at
         FROM scheduled_posts
         WHERE nostr_pubkey = ?
         ORDER BY scheduled_at ASC`
      )
        .bind(pubkey)
        .all<Pick<ScheduledPost, 'id' | 'scheduled_at' | 'status' | 'retry_count' | 'error_message' | 'created_at' | 'published_at'>>();

      return new Response(
        JSON.stringify({ posts: results.results }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('GetStatus error:', err);
      return new Response(
        JSON.stringify({ status: 'error', message: String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  private async handleGetOne(id: string): Promise<Response> {
    try {
      const post = await this.env.FEDERATION_DB.prepare(
        `SELECT id, nostr_pubkey, scheduled_at, status, cross_post_ap, cross_post_at, retry_count, error_message, created_at, published_at
         FROM scheduled_posts
         WHERE id = ?`
      )
        .bind(id)
        .first<Omit<ScheduledPost, 'signed_event'>>();

      if (!post) {
        return new Response('Not found', { status: 404 });
      }

      return new Response(
        JSON.stringify(post),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('GetOne error:', err);
      return new Response(
        JSON.stringify({ status: 'error', message: String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  private async handleSweep(): Promise<Response> {
    try {
      await this.processDuePosts();
      await this.updateAlarm();
      return new Response(
        JSON.stringify({ status: 'swept' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('Sweep error:', err);
      return new Response(
        JSON.stringify({ status: 'error', message: String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /** Durable Object alarm handler — processes due posts */
  async alarm(): Promise<void> {
    try {
      await this.processDuePosts();
    } catch (err) {
      console.error('Alarm processing error:', err);
    }

    // Set next alarm
    await this.updateAlarm();
  }

  /** Process all posts that are due now */
  private async processDuePosts(): Promise<void> {
    const now = Date.now();

    // Fetch all pending posts that are due
    const results = await this.env.FEDERATION_DB.prepare(
      `SELECT * FROM scheduled_posts
       WHERE status = 'pending' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC
       LIMIT 100`
    )
      .bind(now)
      .all<ScheduledPost>();

    for (const post of results.results) {
      try {
        await this.publishPost(post);
      } catch (err) {
        console.error(`Failed to publish post ${post.id}:`, err);
        await this.handlePublishError(post, String(err));
      }
    }
  }

  /** Publish a single post — relay Nostr event + enqueue cross-posts */
  private async publishPost(post: ScheduledPost): Promise<void> {
    const event: NostrEvent = JSON.parse(post.signed_event);

    // 1. Relay the Nostr event to the BuildIt relay
    try {
      const ws = await this.connectToRelay();
      ws.send(JSON.stringify(['EVENT', event]));

      // Wait for OK message (simple implementation — could add timeout)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Relay timeout')), 5000);
        ws.addEventListener('message', (msg) => {
          try {
            const data = JSON.parse(msg.data as string) as unknown[];
            if (Array.isArray(data) && data[0] === 'OK' && data[1] === event.id) {
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch {
            // Ignore parse errors
          }
        });
        ws.addEventListener('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (err) {
      throw new Error(`Relay publish failed: ${err}`);
    }

    // 2. Enqueue cross-posts if enabled
    const { getIdentityByPubkey } = await import('../db');
    const identity = await getIdentityByPubkey(this.env.FEDERATION_DB, post.nostr_pubkey);

    if (identity) {
      if (post.cross_post_ap && identity.ap_enabled) {
        const msg: QueueMessage = {
          type: 'ap_publish',
          nostrEvent: event,
          username: identity.username,
        };
        await this.env.FEDERATION_QUEUE.send(msg);
      }

      if (post.cross_post_at && identity.at_enabled) {
        const msg: QueueMessage = {
          type: 'at_publish',
          nostrEvent: event,
          nostrPubkey: post.nostr_pubkey,
        };
        await this.env.FEDERATION_QUEUE.send(msg);
      }
    }

    // 3. Mark as published
    await this.env.FEDERATION_DB.prepare(
      `UPDATE scheduled_posts
       SET status = 'published', published_at = datetime('now')
       WHERE id = ?`
    )
      .bind(post.id)
      .run();
  }

  /** Handle publish error with exponential backoff retry */
  private async handlePublishError(post: ScheduledPost, error: string): Promise<void> {
    const retryCount = post.retry_count + 1;

    if (retryCount >= MAX_RETRIES) {
      // Max retries reached — mark as failed
      await this.env.FEDERATION_DB.prepare(
        `UPDATE scheduled_posts
         SET status = 'failed', retry_count = ?, error_message = ?
         WHERE id = ?`
      )
        .bind(retryCount, error, post.id)
        .run();
    } else {
      // Retry later with exponential backoff
      const retryDelay = RETRY_DELAYS[retryCount - 1];
      const nextAttempt = Date.now() + retryDelay;

      await this.env.FEDERATION_DB.prepare(
        `UPDATE scheduled_posts
         SET retry_count = ?, error_message = ?, scheduled_at = ?
         WHERE id = ?`
      )
        .bind(retryCount, error, nextAttempt, post.id)
        .run();
    }
  }

  /** Update the alarm to wake up at the next scheduled post time */
  private async updateAlarm(): Promise<void> {
    // Find the earliest pending post
    const result = await this.env.FEDERATION_DB.prepare(
      `SELECT MIN(scheduled_at) as next_time
       FROM scheduled_posts
       WHERE status = 'pending'`
    )
      .first<{ next_time: number | null }>();

    if (result?.next_time) {
      await this.state.storage.setAlarm(result.next_time);
    } else {
      // No pending posts — clear alarm
      await this.state.storage.deleteAlarm();
    }
  }

  /** Connect to the BuildIt relay via WebSocket */
  private async connectToRelay(): Promise<WebSocket> {
    const resp = await fetch(this.env.RELAY_URL, {
      headers: { Upgrade: 'websocket' },
    });

    const ws = resp.webSocket;
    if (!ws) {
      throw new Error('Failed to establish WebSocket connection to relay');
    }

    ws.accept();
    return ws;
  }
}
