/**
 * BuildIt Network Relay - Durable Object
 * Based on Nosflare (https://github.com/Spl0itable/nosflare)
 *
 * Handles WebSocket connections with hibernation support,
 * subscription management, and cross-region event broadcasting.
 */

import type {
  NostrEvent,
  NostrFilter,
  RateLimiter as IRateLimiter,
  WebSocketSession,
  Env,
  DOBroadcastRequest,
  QueryResult,
} from './types';
import { RateLimiter } from './types';
import {
  PUBKEY_RATE_LIMIT,
  REQ_RATE_LIMIT,
  PAY_TO_RELAY_ENABLED,
  AUTH_REQUIRED,
  AUTH_TIMEOUT_MS,
  isPubkeyAllowed,
  isEventKindAllowed,
  containsBlockedContent,
  isTagAllowed,
  excludedRateLimitKinds,
  REGIONAL_ENDPOINTS,
  ENDPOINT_HINTS,
} from './config';
import {
  verifyEventSignature,
  hasPaidForRelay,
  processEvent,
  queryEvents,
} from './relay-worker';

interface SessionAttachment {
  sessionId: string;
  bookmark: string;
  host: string;
  doName: string;
  hasPaid?: boolean;
}

interface CacheEntry {
  result: QueryResult;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface PaymentCacheEntry {
  hasPaid: boolean;
  timestamp: number;
}

/**
 * RelayWebSocket Durable Object
 *
 * Manages WebSocket connections using Cloudflare's hibernatable WebSocket API.
 * Implements NIP-01 (basic protocol), NIP-42 (auth), and handles subscription
 * management with intelligent caching.
 */
export class RelayWebSocket implements DurableObject {
  private sessions: Map<string, WebSocketSession>;
  private env: Env;
  private state: DurableObjectState;
  private region: string;
  private doId: string;
  private doName: string;
  private processedEvents: Map<string, number> = new Map();

  // Query caching
  private queryCache: Map<string, CacheEntry> = new Map();
  private readonly QUERY_CACHE_TTL = 60000; // 1 minute
  private readonly MAX_CACHE_SIZE = 100;
  private queryCacheIndex: Map<string, Set<string>> = new Map();
  private activeQueries: Map<string, Promise<QueryResult>> = new Map();

  // Payment caching
  private paymentCache: Map<string, PaymentCacheEntry> = new Map();
  private readonly PAYMENT_CACHE_TTL = 60000;

  // Idle timeout for cleanup
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private lastActivityTime: number = Date.now();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
    this.env = env;
    this.doId = crypto.randomUUID();
    this.region = 'unknown';
    this.doName = 'unknown';
  }

  // =========================================================================
  // LIFECYCLE METHODS
  // =========================================================================

  async alarm(): Promise<void> {
    console.log(`Alarm triggered for DO ${this.doName}`);

    const now = Date.now();
    const idleTime = now - this.lastActivityTime;
    const activeWebSockets = this.state.getWebSockets();
    const activeCount = activeWebSockets.length;

    console.log(`DO ${this.doName} - Active: ${activeCount}, Idle: ${idleTime}ms`);

    if (activeCount === 0) {
      await this.cleanup();
      return;
    }

    // Schedule next alarm
    await this.state.storage.setAlarm(now + this.IDLE_TIMEOUT);
  }

  private async cleanup(): Promise<void> {
    console.log(`Running cleanup for DO ${this.doName}`);

    this.queryCache.clear();
    this.queryCacheIndex.clear();
    this.activeQueries.clear();
    this.paymentCache.clear();
    this.processedEvents.clear();
    this.sessions.clear();

    await this.cleanupOrphanedSubscriptions();
  }

  private async cleanupOrphanedSubscriptions(): Promise<void> {
    try {
      const allKeys = await this.state.storage.list();
      const activeWebSockets = this.state.getWebSockets();
      const activeSessionIds = new Set<string>();

      for (const ws of activeWebSockets) {
        const attachment = ws.deserializeAttachment() as SessionAttachment | null;
        if (attachment) {
          activeSessionIds.add(attachment.sessionId);
        }
      }

      const keysToDelete: string[] = [];
      for (const [key] of allKeys) {
        if (key.startsWith('subs:')) {
          const sessionId = key.substring(5);
          if (!activeSessionIds.has(sessionId)) {
            keysToDelete.push(key);
          }
        }
      }

      if (keysToDelete.length > 0) {
        await this.state.storage.delete(keysToDelete);
        console.log(`Cleaned up ${keysToDelete.length} orphaned subscriptions`);
      }
    } catch (error) {
      console.error('Error cleaning up orphaned subscriptions:', error);
    }
  }

  private async scheduleAlarmIfNeeded(): Promise<void> {
    const existingAlarm = await this.state.storage.getAlarm();
    if (existingAlarm === null) {
      await this.state.storage.setAlarm(Date.now() + this.IDLE_TIMEOUT);
    }
  }

  // =========================================================================
  // SUBSCRIPTION PERSISTENCE
  // =========================================================================

  private async saveSubscriptions(
    sessionId: string,
    subscriptions: Map<string, NostrFilter[]>
  ): Promise<void> {
    const key = `subs:${sessionId}`;
    const data = Array.from(subscriptions.entries());
    await this.state.storage.put(key, data);
  }

  private async loadSubscriptions(
    sessionId: string
  ): Promise<Map<string, NostrFilter[]>> {
    const key = `subs:${sessionId}`;
    const data = await this.state.storage.get<[string, NostrFilter[]][]>(key);
    return new Map(data || []);
  }

  private async deleteSubscriptions(sessionId: string): Promise<void> {
    await this.state.storage.delete(`subs:${sessionId}`);
  }

  // =========================================================================
  // PAYMENT CACHING
  // =========================================================================

  private async getCachedPaymentStatus(pubkey: string): Promise<boolean | null> {
    const cached = this.paymentCache.get(pubkey);
    if (cached && Date.now() - cached.timestamp < this.PAYMENT_CACHE_TTL) {
      return cached.hasPaid;
    }
    if (cached) {
      this.paymentCache.delete(pubkey);
    }
    return null;
  }

  private setCachedPaymentStatus(pubkey: string, hasPaid: boolean): void {
    this.paymentCache.set(pubkey, { hasPaid, timestamp: Date.now() });

    // Evict old entries if cache is too large
    if (this.paymentCache.size > 1000) {
      const sorted = Array.from(this.paymentCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = Math.floor(this.paymentCache.size * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.paymentCache.delete(sorted[i][0]);
      }
    }
  }

  // =========================================================================
  // QUERY CACHING
  // =========================================================================

  private async getCachedOrQuery(
    filters: NostrFilter[],
    bookmark: string
  ): Promise<QueryResult> {
    const cacheKey = JSON.stringify({ filters, bookmark });

    // Check for in-flight query (deduplication)
    if (this.activeQueries.has(cacheKey)) {
      return await this.activeQueries.get(cacheKey)!;
    }

    // Check local cache
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.QUERY_CACHE_TTL) {
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      return cached.result;
    }

    // Execute query
    const queryPromise = queryEvents(filters, bookmark, this.env);
    this.activeQueries.set(cacheKey, queryPromise);

    try {
      const result = await queryPromise;

      this.queryCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
      });

      this.addToCacheIndex(cacheKey, filters);

      if (this.queryCache.size > this.MAX_CACHE_SIZE) {
        this.cleanupQueryCache();
      }

      return result;
    } finally {
      this.activeQueries.delete(cacheKey);
    }
  }

  private addToCacheIndex(cacheKey: string, filters: NostrFilter[]): void {
    for (const filter of filters) {
      if (filter.kinds) {
        for (const kind of filter.kinds) {
          const indexKey = `kind:${kind}`;
          if (!this.queryCacheIndex.has(indexKey)) {
            this.queryCacheIndex.set(indexKey, new Set());
          }
          this.queryCacheIndex.get(indexKey)!.add(cacheKey);
        }
      }

      if (filter.authors) {
        for (const author of filter.authors) {
          const indexKey = `author:${author}`;
          if (!this.queryCacheIndex.has(indexKey)) {
            this.queryCacheIndex.set(indexKey, new Set());
          }
          this.queryCacheIndex.get(indexKey)!.add(cacheKey);
        }
      }
    }
  }

  private removeFromCacheIndex(cacheKey: string): void {
    for (const [indexKey, cacheKeys] of this.queryCacheIndex.entries()) {
      cacheKeys.delete(cacheKey);
      if (cacheKeys.size === 0) {
        this.queryCacheIndex.delete(indexKey);
      }
    }
  }

  private cleanupQueryCache(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > this.QUERY_CACHE_TTL) {
        this.queryCache.delete(key);
        this.removeFromCacheIndex(key);
      }
    }

    // If still too large, use LFU eviction
    if (this.queryCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.queryCache.entries());
      const scored = entries.map(([key, entry]) => {
        const recencyScore = (now - entry.lastAccessed) / 1000;
        const frequencyScore = entry.accessCount * 10;
        return { key, score: frequencyScore - recencyScore / 60 };
      });

      scored.sort((a, b) => a.score - b.score);
      const toRemove = Math.floor(this.MAX_CACHE_SIZE * 0.2);

      for (let i = 0; i < toRemove; i++) {
        this.queryCache.delete(scored[i].key);
        this.removeFromCacheIndex(scored[i].key);
      }
    }
  }

  private invalidateRelevantCaches(event: NostrEvent): void {
    const keysToInvalidate = new Set<string>();

    const kindKey = `kind:${event.kind}`;
    if (this.queryCacheIndex.has(kindKey)) {
      for (const cacheKey of this.queryCacheIndex.get(kindKey)!) {
        keysToInvalidate.add(cacheKey);
      }
    }

    const authorKey = `author:${event.pubkey}`;
    if (this.queryCacheIndex.has(authorKey)) {
      for (const cacheKey of this.queryCacheIndex.get(authorKey)!) {
        keysToInvalidate.add(cacheKey);
      }
    }

    for (const key of keysToInvalidate) {
      this.queryCache.delete(key);
      this.removeFromCacheIndex(key);
    }

    if (keysToInvalidate.size > 0) {
      console.log(`Invalidated ${keysToInvalidate.size} cache entries for event ${event.id}`);
    }
  }

  // =========================================================================
  // HTTP/WEBSOCKET HANDLING
  // =========================================================================

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Extract DO name from URL params
    const urlDoName = url.searchParams.get('doName');
    if (urlDoName && urlDoName !== 'unknown') {
      this.doName = urlDoName;
    }

    // Handle DO-to-DO broadcast
    if (url.pathname === '/do-broadcast') {
      return await this.handleDOBroadcast(request);
    }

    // Require WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    this.region = url.searchParams.get('region') || 'unknown';
    const colo = url.searchParams.get('colo') || 'default';

    console.log(`WebSocket connection to DO: ${this.doName} (region: ${this.region}, colo: ${colo})`);

    // Create WebSocket pair
    const { 0: client, 1: server } = new WebSocketPair();

    const sessionId = crypto.randomUUID();
    const host = request.headers.get('host') || url.host;

    const session: WebSocketSession = {
      id: sessionId,
      webSocket: server,
      subscriptions: new Map(),
      pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
      reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
      bookmark: 'first-unconstrained',
      host,
      challenge: AUTH_REQUIRED ? this.generateAuthChallenge() : undefined,
      authenticatedPubkeys: new Set(),
    };

    this.sessions.set(sessionId, session);

    const attachment: SessionAttachment = {
      sessionId,
      bookmark: session.bookmark,
      host,
      doName: this.doName,
    };
    server.serializeAttachment(attachment);

    this.state.acceptWebSocket(server);

    if (AUTH_REQUIRED && session.challenge) {
      this.sendAuth(server, session.challenge);
    }

    this.lastActivityTime = Date.now();
    await this.scheduleAlarmIfNeeded();

    return new Response(null, { status: 101, webSocket: client });
  }

  // =========================================================================
  // WEBSOCKET MESSAGE HANDLERS
  // =========================================================================

  // Maximum allowed WebSocket message size (64KB) to prevent abuse
  private readonly MAX_MESSAGE_SIZE = 65536;

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    this.lastActivityTime = Date.now();

    // Enforce maximum message size to prevent memory exhaustion attacks
    const messageSize = typeof message === 'string' ? message.length : message.byteLength;
    if (messageSize > this.MAX_MESSAGE_SIZE) {
      this.sendError(ws, `Message too large: ${messageSize} bytes exceeds ${this.MAX_MESSAGE_SIZE} byte limit`);
      return;
    }

    const attachment = ws.deserializeAttachment() as SessionAttachment | null;
    if (!attachment) {
      ws.close(1011, 'Session not found');
      return;
    }

    let session = this.sessions.get(attachment.sessionId);
    if (!session) {
      // Restore session from hibernation
      const subscriptions = await this.loadSubscriptions(attachment.sessionId);
      session = {
        id: attachment.sessionId,
        webSocket: ws,
        subscriptions,
        pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
        reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
        bookmark: attachment.bookmark,
        host: attachment.host,
        challenge: AUTH_REQUIRED ? this.generateAuthChallenge() : undefined,
        authenticatedPubkeys: new Set(),
      };
      this.sessions.set(attachment.sessionId, session);

      if (AUTH_REQUIRED && session.challenge) {
        this.sendAuth(ws, session.challenge);
      }
    }

    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const parsed = JSON.parse(text);

      await this.handleMessage(session, parsed);

      // Update attachment
      ws.serializeAttachment({
        ...attachment,
        bookmark: session.bookmark,
      });
    } catch (error) {
      console.error('Error handling message:', error);
      if (error instanceof SyntaxError) {
        this.sendError(ws, 'Invalid JSON format');
      } else {
        this.sendError(ws, 'Failed to process message');
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SessionAttachment | null;
    if (attachment) {
      console.log(`WebSocket closed: ${attachment.sessionId}`);
      this.sessions.delete(attachment.sessionId);
      await this.deleteSubscriptions(attachment.sessionId);

      if (this.state.getWebSockets().length === 0) {
        await this.state.storage.deleteAlarm();
      }
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const attachment = ws.deserializeAttachment() as SessionAttachment | null;
    if (attachment) {
      console.error(`WebSocket error for ${attachment.sessionId}:`, error);
      this.sessions.delete(attachment.sessionId);
    }
  }

  // =========================================================================
  // MESSAGE ROUTING
  // =========================================================================

  private async handleMessage(session: WebSocketSession, message: unknown[]): Promise<void> {
    if (!Array.isArray(message)) {
      this.sendError(session.webSocket, 'Invalid message format');
      return;
    }

    const [type, ...args] = message;

    switch (type) {
      case 'EVENT':
        await this.handleEvent(session, args[0] as NostrEvent);
        break;
      case 'REQ':
        await this.handleReq(session, message);
        break;
      case 'CLOSE':
        await this.handleClose(session, args[0] as string);
        break;
      case 'AUTH':
        await this.handleAuth(session, args[0] as NostrEvent);
        break;
      default:
        this.sendError(session.webSocket, `Unknown message type: ${type}`);
    }
  }

  // =========================================================================
  // EVENT HANDLING
  // =========================================================================

  private async handleEvent(session: WebSocketSession, event: NostrEvent): Promise<void> {
    // Validate event structure
    if (!event || typeof event !== 'object') {
      this.sendOK(session.webSocket, '', false, 'invalid: event object required');
      return;
    }

    if (!event.id || !event.pubkey || !event.sig || !event.created_at ||
        event.kind === undefined || !Array.isArray(event.tags)) {
      this.sendOK(session.webSocket, event.id || '', false, 'invalid: missing required fields');
      return;
    }

    // Reject auth events as regular events
    if (event.kind === 22242) {
      this.sendOK(session.webSocket, event.id, false, 'invalid: use AUTH command');
      return;
    }

    // Check authentication if required
    if (AUTH_REQUIRED && !session.authenticatedPubkeys.has(event.pubkey)) {
      this.sendOK(session.webSocket, event.id, false, 'auth-required: authenticate first');
      return;
    }

    // Rate limiting
    if (!excludedRateLimitKinds.has(event.kind)) {
      if (!session.pubkeyRateLimiter.removeToken()) {
        this.sendOK(session.webSocket, event.id, false, 'rate-limited: slow down');
        return;
      }
    }

    // Verify signature
    const isValid = await verifyEventSignature(event);
    if (!isValid) {
      this.sendOK(session.webSocket, event.id, false, 'invalid: signature verification failed');
      return;
    }

    // Payment check
    if (PAY_TO_RELAY_ENABLED) {
      let hasPaid = await this.getCachedPaymentStatus(event.pubkey);
      if (hasPaid === null) {
        hasPaid = await hasPaidForRelay(event.pubkey, this.env);
        this.setCachedPaymentStatus(event.pubkey, hasPaid);
      }
      if (!hasPaid) {
        this.sendOK(session.webSocket, event.id, false, 'blocked: payment required');
        return;
      }
    }

    // Moderation checks
    if (event.kind !== 1059 && !isPubkeyAllowed(event.pubkey)) {
      this.sendOK(session.webSocket, event.id, false, 'blocked: pubkey not allowed');
      return;
    }

    if (!isEventKindAllowed(event.kind)) {
      this.sendOK(session.webSocket, event.id, false, `blocked: kind ${event.kind} not allowed`);
      return;
    }

    if (containsBlockedContent(event)) {
      this.sendOK(session.webSocket, event.id, false, 'blocked: content not allowed');
      return;
    }

    for (const tag of event.tags) {
      if (!isTagAllowed(tag[0])) {
        this.sendOK(session.webSocket, event.id, false, `blocked: tag ${tag[0]} not allowed`);
        return;
      }
    }

    // Process and store event
    const result = await processEvent(event, session.id, this.env);

    if (result.bookmark) {
      session.bookmark = result.bookmark;
    }

    if (result.success) {
      this.sendOK(session.webSocket, event.id, true, result.message);
      this.processedEvents.set(event.id, Date.now());
      this.invalidateRelevantCaches(event);
      await this.broadcastEvent(event);
    } else {
      this.sendOK(session.webSocket, event.id, false, result.message);
    }
  }

  // =========================================================================
  // REQ HANDLING
  // =========================================================================

  private async handleReq(session: WebSocketSession, message: unknown[]): Promise<void> {
    const [, subscriptionId, ...filters] = message as [string, string, ...NostrFilter[]];

    if (!subscriptionId || typeof subscriptionId !== 'string' || subscriptionId.length > 64) {
      this.sendError(session.webSocket, 'Invalid subscription ID');
      return;
    }

    if (AUTH_REQUIRED && session.authenticatedPubkeys.size === 0) {
      this.sendClosed(session.webSocket, subscriptionId, 'auth-required');
      return;
    }

    if (!session.reqRateLimiter.removeToken()) {
      this.sendClosed(session.webSocket, subscriptionId, 'rate-limited');
      return;
    }

    if (filters.length === 0) {
      this.sendClosed(session.webSocket, subscriptionId, 'error: at least one filter required');
      return;
    }

    // Validate filters
    for (const filter of filters) {
      if (typeof filter !== 'object' || filter === null) {
        this.sendClosed(session.webSocket, subscriptionId, 'invalid: filter must be object');
        return;
      }

      if (filter.kinds) {
        const blockedKinds = filter.kinds.filter(k => !isEventKindAllowed(k));
        if (blockedKinds.length > 0) {
          this.sendClosed(session.webSocket, subscriptionId, `blocked: kinds ${blockedKinds.join(',')}`);
          return;
        }
      }

      // Enforce limits
      if (filter.limit && filter.limit > 500) {
        filter.limit = 500;
      } else if (!filter.limit) {
        filter.limit = 500;
      }
    }

    // Store subscription
    session.subscriptions.set(subscriptionId, filters);
    await this.saveSubscriptions(session.id, session.subscriptions);

    // Execute query
    try {
      const result = await this.getCachedOrQuery(filters, session.bookmark);

      if (result.bookmark) {
        session.bookmark = result.bookmark;
      }

      for (const event of result.events) {
        this.sendEvent(session.webSocket, subscriptionId, event);
      }

      this.sendEOSE(session.webSocket, subscriptionId);
    } catch (error) {
      console.error('Query error:', error);
      this.sendClosed(session.webSocket, subscriptionId, 'error: database error');
    }
  }

  // =========================================================================
  // CLOSE HANDLING
  // =========================================================================

  private async handleClose(session: WebSocketSession, subscriptionId: string): Promise<void> {
    if (!subscriptionId) {
      this.sendError(session.webSocket, 'Invalid subscription ID');
      return;
    }

    const deleted = session.subscriptions.delete(subscriptionId);
    if (deleted) {
      await this.saveSubscriptions(session.id, session.subscriptions);
    }
    this.sendClosed(session.webSocket, subscriptionId, deleted ? 'closed' : 'not found');
  }

  // =========================================================================
  // AUTH HANDLING (NIP-42)
  // =========================================================================

  private async handleAuth(session: WebSocketSession, authEvent: NostrEvent): Promise<void> {
    if (!authEvent || authEvent.kind !== 22242) {
      this.sendOK(session.webSocket, authEvent?.id || '', false, 'invalid: must be kind 22242');
      return;
    }

    const isValid = await verifyEventSignature(authEvent);
    if (!isValid) {
      this.sendOK(session.webSocket, authEvent.id, false, 'invalid: signature failed');
      return;
    }

    // Check timestamp
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - authEvent.created_at);
    if (timeDiff > AUTH_TIMEOUT_MS / 1000) {
      this.sendOK(session.webSocket, authEvent.id, false, 'invalid: timestamp too old');
      return;
    }

    // Verify challenge
    const challengeTag = authEvent.tags.find(t => t[0] === 'challenge');
    if (!challengeTag || challengeTag[1] !== session.challenge) {
      this.sendOK(session.webSocket, authEvent.id, false, 'invalid: challenge mismatch');
      return;
    }

    // Verify relay URL
    const relayTag = authEvent.tags.find(t => t[0] === 'relay');
    if (!relayTag) {
      this.sendOK(session.webSocket, authEvent.id, false, 'invalid: missing relay tag');
      return;
    }

    try {
      const relayUrl = new URL(relayTag[1]);
      const sessionHost = session.host.toLowerCase().replace(/:\d+$/, '');
      const authHost = relayUrl.host.toLowerCase().replace(/:\d+$/, '');

      if (authHost !== sessionHost) {
        this.sendOK(session.webSocket, authEvent.id, false, 'invalid: relay mismatch');
        return;
      }
    } catch {
      this.sendOK(session.webSocket, authEvent.id, false, 'invalid: malformed relay URL');
      return;
    }

    session.authenticatedPubkeys.add(authEvent.pubkey);
    this.sendOK(session.webSocket, authEvent.id, true, '');
  }

  private generateAuthChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  // =========================================================================
  // BROADCASTING
  // =========================================================================

  private async broadcastEvent(event: NostrEvent): Promise<void> {
    await this.broadcastToLocalSessions(event);
    await this.broadcastToOtherDOs(event);
  }

  private async broadcastToLocalSessions(event: NostrEvent): Promise<void> {
    let count = 0;
    const activeWebSockets = this.state.getWebSockets();

    for (const ws of activeWebSockets) {
      const attachment = ws.deserializeAttachment() as SessionAttachment | null;
      if (!attachment) continue;

      let session = this.sessions.get(attachment.sessionId);
      if (!session) {
        const subscriptions = await this.loadSubscriptions(attachment.sessionId);
        session = {
          id: attachment.sessionId,
          webSocket: ws,
          subscriptions,
          pubkeyRateLimiter: new RateLimiter(PUBKEY_RATE_LIMIT.rate, PUBKEY_RATE_LIMIT.capacity),
          reqRateLimiter: new RateLimiter(REQ_RATE_LIMIT.rate, REQ_RATE_LIMIT.capacity),
          bookmark: attachment.bookmark,
          host: attachment.host,
          authenticatedPubkeys: new Set(),
        };
        this.sessions.set(attachment.sessionId, session);
      }

      for (const [subscriptionId, filters] of session.subscriptions) {
        if (this.matchesFilters(event, filters)) {
          try {
            this.sendEvent(ws, subscriptionId, event);
            count++;
          } catch (error) {
            console.error('Broadcast error:', error);
          }
        }
      }
    }

    if (count > 0) {
      console.log(`Broadcast event ${event.id} to ${count} local subscriptions`);
    }
  }

  private async broadcastToOtherDOs(event: NostrEvent): Promise<void> {
    const broadcasts: Promise<Response>[] = [];

    for (const endpoint of REGIONAL_ENDPOINTS) {
      if (endpoint === this.doName) continue;
      broadcasts.push(this.sendToSpecificDO(endpoint, event));
    }

    const results = await Promise.allSettled(
      broadcasts.map(p => Promise.race([
        p,
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        ),
      ]))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Broadcast event ${event.id} to ${successful}/${broadcasts.length} remote DOs`);
  }

  private async sendToSpecificDO(doName: string, event: NostrEvent): Promise<Response> {
    const id = this.env.RELAY_WEBSOCKET.idFromName(doName);
    const locationHint = (ENDPOINT_HINTS[doName] || 'auto') as DurableObjectLocationHint;
    const stub = this.env.RELAY_WEBSOCKET.get(id, { locationHint });

    const url = new URL('https://internal/do-broadcast');
    url.searchParams.set('doName', doName);

    return stub.fetch(new Request(url.toString(), {
      method: 'POST',
      body: JSON.stringify({
        event,
        sourceDoId: this.doId,
      } as DOBroadcastRequest),
    }));
  }

  private async handleDOBroadcast(request: Request): Promise<Response> {
    try {
      const data: DOBroadcastRequest = await request.json();
      const { event, sourceDoId } = data;

      if (this.processedEvents.has(event.id)) {
        return new Response(JSON.stringify({ success: true, duplicate: true }));
      }

      this.processedEvents.set(event.id, Date.now());
      await this.broadcastToLocalSessions(event);

      // Clean old processed events
      const fiveMinutesAgo = Date.now() - 300000;
      for (const [eventId, timestamp] of this.processedEvents) {
        if (timestamp < fiveMinutesAgo) {
          this.processedEvents.delete(eventId);
        }
      }

      return new Response(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('DO broadcast error:', error);
      return new Response(JSON.stringify({ success: false }), { status: 500 });
    }
  }

  // =========================================================================
  // FILTER MATCHING
  // =========================================================================

  private matchesFilters(event: NostrEvent, filters: NostrFilter[]): boolean {
    return filters.some(f => this.matchesFilter(event, f));
  }

  private matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
    if (filter.ids?.length && !filter.ids.includes(event.id)) return false;
    if (filter.authors?.length && !filter.authors.includes(event.pubkey)) return false;
    if (filter.kinds?.length && !filter.kinds.includes(event.kind)) return false;
    if (filter.since && event.created_at < filter.since) return false;
    if (filter.until && event.created_at > filter.until) return false;

    // Tag filters
    for (const [key, values] of Object.entries(filter)) {
      if (key.startsWith('#') && Array.isArray(values) && values.length > 0) {
        const tagName = key.substring(1);
        const eventTagValues = event.tags
          .filter(t => t[0] === tagName)
          .map(t => t[1]);

        if (!values.some(v => eventTagValues.includes(v))) {
          return false;
        }
      }
    }

    return true;
  }

  // =========================================================================
  // MESSAGE SENDING HELPERS
  // =========================================================================

  private sendAuth(ws: WebSocket, challenge: string): void {
    try { ws.send(JSON.stringify(['AUTH', challenge])); } catch {}
  }

  private sendOK(ws: WebSocket, eventId: string, success: boolean, message: string): void {
    try { ws.send(JSON.stringify(['OK', eventId, success, message])); } catch {}
  }

  private sendError(ws: WebSocket, message: string): void {
    try { ws.send(JSON.stringify(['NOTICE', message])); } catch {}
  }

  private sendEvent(ws: WebSocket, subscriptionId: string, event: NostrEvent): void {
    try { ws.send(JSON.stringify(['EVENT', subscriptionId, event])); } catch {}
  }

  private sendEOSE(ws: WebSocket, subscriptionId: string): void {
    try { ws.send(JSON.stringify(['EOSE', subscriptionId])); } catch {}
  }

  private sendClosed(ws: WebSocket, subscriptionId: string, message: string): void {
    try { ws.send(JSON.stringify(['CLOSED', subscriptionId, message])); } catch {}
  }
}
