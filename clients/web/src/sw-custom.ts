/**
 * Custom Service Worker Extensions
 * Epic 60: Offline Mode Enhancement
 *
 * This file extends the default VitePWA service worker with:
 * - Background Sync API for offline queue processing
 * - Enhanced caching strategies
 * - Cache management
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Dev-only logging for service worker
const SW_DEV_MODE = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
const swLog = SW_DEV_MODE ? console.log.bind(console) : () => {};

// Background Sync tag for offline queue
const OFFLINE_QUEUE_SYNC_TAG = 'buildit-offline-queue';

// Cache names
const CACHE_NAMES = {
  runtime: 'buildit-runtime-v1',
  api: 'buildit-api-v1',
  images: 'buildit-images-v1',
  documents: 'buildit-documents-v1',
};

// Maximum cache size limits (in bytes)
const CACHE_LIMITS = {
  runtime: 10 * 1024 * 1024, // 10MB
  api: 5 * 1024 * 1024, // 5MB
  images: 50 * 1024 * 1024, // 50MB
  documents: 30 * 1024 * 1024, // 30MB
};

/**
 * Handle Background Sync events
 * This is triggered when the browser regains connectivity
 */
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === OFFLINE_QUEUE_SYNC_TAG) {
    event.waitUntil(processOfflineQueue());
  }
});

/**
 * Process offline queue items
 * Called by Background Sync when connectivity is restored
 */
async function processOfflineQueue(): Promise<void> {
  swLog('[SW] Processing offline queue via Background Sync');

  try {
    // Post message to all clients to trigger queue processing
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'BACKGROUND_SYNC_TRIGGERED',
        tag: OFFLINE_QUEUE_SYNC_TAG,
      });
    }
  } catch (error) {
    console.error('[SW] Failed to process offline queue:', error);
    // Throwing will cause the sync to be retried
    throw error;
  }
}

/**
 * Listen for messages from the main thread
 */
self.addEventListener('message', async (event: ExtendableMessageEvent) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      await self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      await clearCache(payload?.cacheNames);
      event.ports[0]?.postMessage({ success: true });
      break;

    case 'GET_CACHE_SIZE':
      const size = await getCacheSize(payload?.cacheName);
      event.ports[0]?.postMessage({ size });
      break;

    case 'EVICT_OLD_CACHE':
      const evicted = await evictOldCacheEntries(payload?.maxAgeDays || 30);
      event.ports[0]?.postMessage({ evicted });
      break;
  }
});

/**
 * Clear specific caches or all caches
 */
async function clearCache(cacheNames?: string[]): Promise<void> {
  const keys = await caches.keys();
  const toDelete = cacheNames?.length ? keys.filter((k) => cacheNames.includes(k)) : keys;

  await Promise.all(toDelete.map((key) => caches.delete(key)));
  swLog('[SW] Cleared caches:', toDelete);
}

/**
 * Get total size of a cache or all caches
 */
async function getCacheSize(cacheName?: string): Promise<number> {
  let totalSize = 0;

  const keys = cacheName ? [cacheName] : await caches.keys();

  for (const key of keys) {
    const cache = await caches.open(key);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

/**
 * Evict cache entries older than maxAgeDays
 * Uses the date header or cache metadata to determine age
 */
async function evictOldCacheEntries(maxAgeDays: number): Promise<number> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let evictedCount = 0;

  const keys = await caches.keys();

  for (const key of keys) {
    // Skip precache (managed by workbox)
    if (key.includes('workbox-precache')) continue;

    const cache = await caches.open(key);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const cacheDate = new Date(dateHeader).getTime();
          if (cacheDate < cutoff) {
            await cache.delete(request);
            evictedCount++;
          }
        }
      }
    }
  }

  swLog(`[SW] Evicted ${evictedCount} old cache entries`);
  return evictedCount;
}

/**
 * Handle fetch events with cache-first strategy for static assets
 * and network-first for API calls
 */
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests except for allowed CDNs
  if (url.origin !== self.location.origin) {
    const allowedOrigins = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'cdn.jsdelivr.net',
    ];
    if (!allowedOrigins.some((origin) => url.hostname.includes(origin))) {
      return;
    }
  }

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, CACHE_NAMES.api));
    return;
  }

  // Images: cache-first with network fallback
  if (request.destination === 'image') {
    event.respondWith(cacheFirstWithNetwork(request, CACHE_NAMES.images));
    return;
  }

  // Documents (PDFs, etc.): cache-first
  if (
    url.pathname.endsWith('.pdf') ||
    url.pathname.endsWith('.doc') ||
    url.pathname.endsWith('.docx')
  ) {
    event.respondWith(cacheFirstWithNetwork(request, CACHE_NAMES.documents));
    return;
  }
});

/**
 * Network-first caching strategy with cache fallback
 */
async function networkFirstWithCache(
  request: Request,
  cacheName: string
): Promise<Response> {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const offlineFallback = await caches.match('/offline.html');
      return offlineFallback || Response.error();
    }

    throw error;
  }
}

/**
 * Cache-first caching strategy with network fallback
 */
async function cacheFirstWithNetwork(
  request: Request,
  cacheName: string
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Return cached response and update cache in background
    updateCacheInBackground(request, cache);
    return cachedResponse;
  }

  // Not in cache, fetch from network
  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

/**
 * Update cache entry in background (stale-while-revalidate)
 */
async function updateCacheInBackground(
  request: Request,
  cache: Cache
): Promise<void> {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse);
    }
  } catch {
    // Network request failed, keep using cached version
  }
}

/**
 * Periodic Background Sync for cache maintenance (if supported)
 */
self.addEventListener('periodicsync', (event: PeriodicSyncEvent) => {
  if (event.tag === 'cache-maintenance') {
    event.waitUntil(performCacheMaintenance());
  }
});

interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string;
}

/**
 * Perform cache maintenance tasks
 */
async function performCacheMaintenance(): Promise<void> {
  swLog('[SW] Performing periodic cache maintenance');

  // Evict old entries
  await evictOldCacheEntries(30);

  // Check cache sizes and evict if over limit
  for (const [name, limit] of Object.entries(CACHE_LIMITS)) {
    const cacheName = CACHE_NAMES[name as keyof typeof CACHE_NAMES];
    if (!cacheName) continue;

    const size = await getCacheSize(cacheName);
    if (size > limit) {
      swLog(`[SW] Cache ${cacheName} over limit (${size}/${limit}), evicting`);
      await evictLRUFromCache(cacheName, limit * 0.7); // Evict to 70% of limit
    }
  }
}

/**
 * Evict least recently used entries from a cache until target size is reached
 */
async function evictLRUFromCache(
  cacheName: string,
  targetSize: number
): Promise<void> {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();

  // Get all responses with their dates
  const entries: Array<{ request: Request; date: number; size: number }> = [];
  let currentSize = 0;

  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const dateHeader = response.headers.get('date');
      const date = dateHeader ? new Date(dateHeader).getTime() : 0;
      const blob = await response.blob();
      entries.push({ request, date, size: blob.size });
      currentSize += blob.size;
    }
  }

  // Sort by date (oldest first)
  entries.sort((a, b) => a.date - b.date);

  // Delete oldest entries until we're under target
  for (const entry of entries) {
    if (currentSize <= targetSize) break;
    await cache.delete(entry.request);
    currentSize -= entry.size;
  }
}

// Type definitions for Background Sync
interface SyncEvent extends ExtendableEvent {
  tag: string;
}

declare global {
  interface ServiceWorkerGlobalScope {
    addEventListener(
      type: 'sync',
      listener: (event: SyncEvent) => void
    ): void;
    addEventListener(
      type: 'periodicsync',
      listener: (event: PeriodicSyncEvent) => void
    ): void;
  }
}

export {};
