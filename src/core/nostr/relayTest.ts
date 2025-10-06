/**
 * Relay connectivity testing utilities
 */

import { getNostrClient } from './client';

/**
 * Test connectivity to a specific relay
 */
export async function testRelayConnection(relayUrl: string): Promise<{
  success: boolean;
  latency?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    let ws: WebSocket | null = null;
    let timeoutId: NodeJS.Timeout;

    try {
      ws = new WebSocket(relayUrl);

      // Set a timeout for connection
      timeoutId = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
          ws.close();
          resolve({
            success: false,
            error: 'Connection timeout (10s)',
          });
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        console.log(`✅ Connected to ${relayUrl} (${latency}ms)`);

        // Send a REQ to test functionality
        const subId = 'test_' + Math.random().toString(36).substring(7);
        ws?.send(JSON.stringify(['REQ', subId, { limit: 1 }]));

        // Close after brief test
        setTimeout(() => {
          ws?.close();
          resolve({
            success: true,
            latency,
          });
        }, 1000);
      };

      ws.onerror = (error) => {
        clearTimeout(timeoutId);
        console.error(`❌ Error connecting to ${relayUrl}:`, error);
        resolve({
          success: false,
          error: 'WebSocket error',
        });
      };

      ws.onclose = (event) => {
        clearTimeout(timeoutId);
        if (!event.wasClean) {
          resolve({
            success: false,
            error: `Connection closed: ${event.code} ${event.reason}`,
          });
        }
      };
    } catch (error) {
      clearTimeout(timeoutId!);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

/**
 * Test all configured relays
 */
export async function testAllRelays(): Promise<Map<string, { success: boolean; latency?: number; error?: string }>> {
  const client = getNostrClient();
  const relayStatuses = client.getRelayStatuses();
  const results = new Map<string, { success: boolean; latency?: number; error?: string }>();

  console.log('🔍 Testing relay connectivity...');

  for (const relay of relayStatuses) {
    const result = await testRelayConnection(relay.url);
    results.set(relay.url, result);
  }

  return results;
}

/**
 * Get list of working relays
 */
export async function getWorkingRelays(): Promise<string[]> {
  const results = await testAllRelays();
  return Array.from(results.entries())
    .filter(([_, result]) => result.success)
    .map(([url, _]) => url);
}

/**
 * Common Nostr relay list for fallback
 */
export const POPULAR_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.current.fyi',
  'wss://nostr.wine',
  'wss://relay.nostr.info',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.orangepill.dev',
] as const;

/**
 * Test and return best performing relays
 */
export async function getBestRelays(count = 4): Promise<string[]> {
  console.log(`🔍 Testing ${POPULAR_RELAYS.length} popular relays...`);

  const results = await Promise.all(
    POPULAR_RELAYS.map(async (url) => ({
      url,
      ...(await testRelayConnection(url)),
    }))
  );

  // Sort by success and latency
  const working = results
    .filter((r) => r.success)
    .sort((a, b) => (a.latency || 999999) - (b.latency || 999999))
    .slice(0, count)
    .map((r) => r.url);

  console.log(`✅ Best ${count} relays:`, working);
  return working;
}
