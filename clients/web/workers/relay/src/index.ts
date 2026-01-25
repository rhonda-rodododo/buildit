/**
 * BuildIt Network Nostr Relay
 * Entry point for Cloudflare Workers
 *
 * Based on Nosflare (https://github.com/Spl0itable/nosflare)
 */

import { handleRequest, handleScheduled, initializeDatabase } from './relay-worker';
import { RelayWebSocket } from './durable-object';
import type { Env } from './types';

// Export the Durable Object class
export { RelayWebSocket };

// Worker entry point
export default {
  /**
   * Handle HTTP requests
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('Request error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  /**
   * Handle scheduled cron triggers
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleScheduled(event, env, ctx);
  },
};
