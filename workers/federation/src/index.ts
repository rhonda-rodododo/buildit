/**
 * BuildIt Federation Worker
 *
 * Bridges public Nostr events to ActivityPub (Mastodon etc.) and AT Protocol (Bluesky).
 * Private/encrypted/group content is NEVER federated.
 */

import { createFederationBuilder, type Message } from '@fedify/fedify';
import { WorkersKvStore, WorkersMessageQueue } from '@fedify/fedify/x/cfworkers';
import type { Env, QueueMessage } from './types';
import { initializeDatabase } from './db';
import { configureActivityPub } from './activitypub/federation';
import { handleQueueMessage } from './queue/handlers';
import { refreshATSessions } from './atproto/sessionManager';
import { FederationBridge } from './bridge/FederationBridge';
import { SchedulerBridge } from './scheduler/SchedulerBridge';

export { FederationBridge, SchedulerBridge };

// Create the Fedify builder at module level (configured once, built per-request)
const builder = createFederationBuilder<Env>();
configureActivityPub(builder);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'buildit-federation' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Admin routes — require bearer token in production
    if (url.pathname.startsWith('/admin/')) {
      if (env.ADMIN_TOKEN) {
        const auth = request.headers.get('Authorization');
        if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
          return new Response('Unauthorized', { status: 401 });
        }
      } else if (env.ENVIRONMENT !== 'development') {
        return new Response('Forbidden: ADMIN_TOKEN not configured', { status: 403 });
      }

      if (url.pathname === '/admin/init-db') {
        await initializeDatabase(env.FEDERATION_DB);
        return new Response(JSON.stringify({ status: 'initialized' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/admin/start-bridge' && request.method === 'POST') {
        const bridgeId = env.FEDERATION_BRIDGE.idFromName('primary');
        const bridge = env.FEDERATION_BRIDGE.get(bridgeId);
        const res = await bridge.fetch(new Request('https://internal/connect', { method: 'POST' }));
        return new Response(await res.text(), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/admin/bridge-status') {
        const bridgeId = env.FEDERATION_BRIDGE.idFromName('primary');
        const bridge = env.FEDERATION_BRIDGE.get(bridgeId);
        const res = await bridge.fetch(new Request('https://internal/status'));
        return new Response(await res.text(), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    }

    // Federation API: Get interactions for a pubkey
    if (url.pathname.startsWith('/api/interactions/')) {
      const pubkey = url.pathname.split('/api/interactions/')[1];
      if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
        return new Response('Invalid pubkey', { status: 400 });
      }
      const { getInteractions } = await import('./db');
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') ?? '0');
      const interactions = await getInteractions(env.FEDERATION_DB, pubkey, limit, offset);
      return new Response(JSON.stringify(interactions), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Federation API: Get federation status for a pubkey
    if (url.pathname.startsWith('/api/status/')) {
      const pubkey = url.pathname.split('/api/status/')[1];
      if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
        return new Response('Invalid pubkey', { status: 400 });
      }
      const { getIdentityByPubkey } = await import('./db');
      const identity = await getIdentityByPubkey(env.FEDERATION_DB, pubkey);
      if (!identity) {
        return new Response(JSON.stringify({ federated: false }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
      return new Response(
        JSON.stringify({
          federated: true,
          ap_enabled: identity.ap_enabled,
          at_enabled: identity.at_enabled,
          at_handle: identity.at_handle,
          username: identity.username,
        }),
        {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    // Scheduler API: Forward all /api/schedule requests to SchedulerBridge DO
    if (url.pathname.startsWith('/api/schedule')) {
      const schedulerId = env.SCHEDULER_BRIDGE.idFromName('primary');
      const scheduler = env.SCHEDULER_BRIDGE.get(schedulerId);

      // Forward the request with the path rewritten to remove /api prefix
      const schedulerUrl = new URL(request.url);
      schedulerUrl.pathname = schedulerUrl.pathname.replace('/api', '');

      const schedulerRequest = new Request(schedulerUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      return await scheduler.fetch(schedulerRequest);
    }

    // All other paths: delegate to Fedify (handles WebFinger, actor, inbox, outbox, nodeinfo)
    try {
      const federation = await builder.build({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kv: new WorkersKvStore(env.FEDERATION_KV as any),
        queue: new WorkersMessageQueue(env.FEDERATION_QUEUE),
      });
      return await federation.fetch(request, { contextData: env });
    } catch (err) {
      console.error('Federation fetch error:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  /** Process queued federation messages */
  async queue(
    batch: MessageBatch<unknown>,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const federation = await builder.build({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kv: new WorkersKvStore(env.FEDERATION_KV as any),
      queue: new WorkersMessageQueue(env.FEDERATION_QUEUE),
    });

    for (const msg of batch.messages) {
      try {
        const body = msg.body as Record<string, unknown>;

        // Check if this is our custom queue message (has a known type field)
        const OUR_TYPES = ['ap_publish', 'at_publish', 'ap_delete', 'at_delete', 'ap_profile_update'];
        if (body && typeof body === 'object' && 'type' in body &&
          typeof body.type === 'string' && OUR_TYPES.includes(body.type)) {
          await handleQueueMessage(body as unknown as QueueMessage, env, federation);
        } else {
          // Fedify internal message (activity delivery, etc.)
          await federation.processQueuedTask(env, body as unknown as Message);
        }
        msg.ack();
      } catch (err) {
        console.error('Queue message error:', err);
        msg.retry();
      }
    }
  },

  /** Scheduled: refresh AT sessions + ensure bridge is connected + sweep scheduler */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Refresh Bluesky sessions
    ctx.waitUntil(refreshATSessions(env));

    // Ensure bridge is connected
    const bridgeId = env.FEDERATION_BRIDGE.idFromName('primary');
    const bridge = env.FEDERATION_BRIDGE.get(bridgeId);
    ctx.waitUntil(bridge.fetch(new Request('https://internal/ensure-connected', { method: 'POST' })));

    // Sweep scheduler for any missed alarms
    const schedulerId = env.SCHEDULER_BRIDGE.idFromName('primary');
    const scheduler = env.SCHEDULER_BRIDGE.get(schedulerId);
    ctx.waitUntil(scheduler.fetch(new Request('https://internal/sweep', { method: 'POST' })));
  },
};
