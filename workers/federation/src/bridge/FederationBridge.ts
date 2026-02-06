/**
 * Federation Bridge — Durable Object
 *
 * Maintains a WebSocket connection to the BuildIt relay,
 * subscribes to public events from federation-enabled authors,
 * and enqueues them for federation processing.
 *
 * Uses hibernatable WebSocket API for cost efficiency.
 */

import type { Env, NostrEvent, QueueMessage } from '../types';
import { NOSTR_KINDS } from '../types';
import { BRIDGE_RECONNECT_DELAY, BRIDGE_SUBSCRIPTION_REFRESH, FEDERABLE_KINDS } from '../config';
import { shouldFederateEvent } from './eventFilter';
import { getFederationEnabledPubkeys, getIdentityByPubkey } from '../db';

interface BridgeState {
  connected: boolean;
  lastEventAt: number | null;
  subscriptionId: string | null;
  reconnectAttempts: number;
}

export class FederationBridge implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private ws: WebSocket | null = null;
  private bridgeState: BridgeState = {
    connected: false,
    lastEventAt: null,
    subscriptionId: null,
    reconnectAttempts: 0,
  };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/connect':
        return this.handleConnect();
      case '/status':
        return this.handleStatus();
      case '/ensure-connected':
        return this.handleEnsureConnected();
      case '/disconnect':
        return this.handleDisconnect();
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  private async handleConnect(): Promise<Response> {
    if (this.bridgeState.connected && this.ws) {
      return new Response(JSON.stringify({ status: 'already_connected' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      await this.connectToRelay();
      return new Response(
        JSON.stringify({ status: 'connected', relay: this.env.RELAY_URL }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ status: 'error', message: String(err) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  private handleStatus(): Response {
    return new Response(
      JSON.stringify({
        connected: this.bridgeState.connected,
        lastEventAt: this.bridgeState.lastEventAt,
        subscriptionId: this.bridgeState.subscriptionId,
        reconnectAttempts: this.bridgeState.reconnectAttempts,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  private async handleEnsureConnected(): Promise<Response> {
    if (!this.bridgeState.connected || !this.ws) {
      try {
        await this.connectToRelay();
      } catch (err) {
        console.error('Bridge reconnect failed:', err);
      }
    }
    return new Response(
      JSON.stringify({ connected: this.bridgeState.connected }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  private handleDisconnect(): Response {
    if (this.ws) {
      this.ws.close(1000, 'Disconnecting');
      this.ws = null;
    }
    this.bridgeState.connected = false;
    return new Response(JSON.stringify({ status: 'disconnected' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async connectToRelay(): Promise<void> {
    const resp = await fetch(this.env.RELAY_URL, {
      headers: { Upgrade: 'websocket' },
    });

    const ws = resp.webSocket;
    if (!ws) {
      throw new Error('Failed to establish WebSocket connection');
    }

    ws.accept();
    this.ws = ws;
    this.bridgeState.connected = true;
    this.bridgeState.reconnectAttempts = 0;

    ws.addEventListener('message', (event) => {
      this.handleRelayMessage(event.data as string);
    });

    ws.addEventListener('close', () => {
      this.bridgeState.connected = false;
      this.ws = null;
      this.scheduleReconnect();
    });

    ws.addEventListener('error', (err) => {
      console.error('Bridge WebSocket error:', err);
      this.bridgeState.connected = false;
      this.ws = null;
      this.scheduleReconnect();
    });

    // Subscribe to federation-eligible events
    await this.refreshSubscription();

    // Schedule periodic subscription refresh
    await this.state.storage.setAlarm(Date.now() + BRIDGE_SUBSCRIPTION_REFRESH);
  }

  private async refreshSubscription(): Promise<void> {
    if (!this.ws || !this.bridgeState.connected) return;

    // Get pubkeys of federation-enabled users
    const pubkeys = await getFederationEnabledPubkeys(this.env.FEDERATION_DB);
    if (pubkeys.length === 0) return;

    // Close existing subscription
    if (this.bridgeState.subscriptionId) {
      this.ws.send(JSON.stringify(['CLOSE', this.bridgeState.subscriptionId]));
    }

    const subId = `fed-${Date.now()}`;
    this.bridgeState.subscriptionId = subId;

    // Subscribe to public events from federation-enabled authors
    const filter = {
      authors: pubkeys,
      kinds: [...FEDERABLE_KINDS],
      since: Math.floor(Date.now() / 1000) - 60, // Last minute (for catching up)
    };

    this.ws.send(JSON.stringify(['REQ', subId, filter]));
  }

  private async handleRelayMessage(data: string): Promise<void> {
    try {
      const msg = JSON.parse(data) as unknown[];
      if (!Array.isArray(msg)) return;

      const [type] = msg;

      if (type === 'EVENT' && msg.length >= 3) {
        const event = msg[2] as NostrEvent;
        await this.processEvent(event);
      }
      // EOSE, NOTICE, etc. — we ignore these
    } catch (err) {
      console.error('Bridge message parse error:', err);
    }
  }

  private async processEvent(event: NostrEvent): Promise<void> {
    this.bridgeState.lastEventAt = Date.now();

    // Check if this event should be federated
    if (!shouldFederateEvent(event)) return;

    // Look up the identity
    const identity = await getIdentityByPubkey(this.env.FEDERATION_DB, event.pubkey);
    if (!identity) return;

    // Enqueue for each enabled protocol
    if (identity.ap_enabled) {
      const msg: QueueMessage = {
        type: event.kind === NOSTR_KINDS.DELETION
          ? 'ap_delete'
          : event.kind === NOSTR_KINDS.METADATA
            ? 'ap_profile_update'
            : 'ap_publish',
        ...(event.kind === NOSTR_KINDS.DELETION
          ? { nostrEventId: this.getDeletionTargets(event)[0] ?? event.id, username: identity.username }
          : { nostrEvent: event, username: identity.username }),
      } as QueueMessage;

      await this.env.FEDERATION_QUEUE.send(msg);
    }

    if (identity.at_enabled && event.kind !== NOSTR_KINDS.METADATA) {
      const msg: QueueMessage = event.kind === NOSTR_KINDS.DELETION
        ? { type: 'at_delete', nostrEventId: this.getDeletionTargets(event)[0] ?? event.id, nostrPubkey: event.pubkey }
        : { type: 'at_publish', nostrEvent: event, nostrPubkey: event.pubkey };

      await this.env.FEDERATION_QUEUE.send(msg);
    }
  }

  private getDeletionTargets(event: NostrEvent): string[] {
    return event.tags
      .filter((t) => t[0] === 'e')
      .map((t) => t[1]);
  }

  private scheduleReconnect(): void {
    this.bridgeState.reconnectAttempts++;
    const delay = Math.min(
      BRIDGE_RECONNECT_DELAY * Math.pow(2, this.bridgeState.reconnectAttempts - 1),
      60_000,
    );
    this.state.storage.setAlarm(Date.now() + delay);
  }

  /** Durable Object alarm handler — used for reconnection and subscription refresh */
  async alarm(): Promise<void> {
    if (!this.bridgeState.connected || !this.ws) {
      try {
        await this.connectToRelay();
      } catch (err) {
        console.error('Bridge alarm reconnect failed:', err);
        this.scheduleReconnect();
      }
    } else {
      // Refresh subscription filters
      await this.refreshSubscription();
      // Schedule next refresh
      await this.state.storage.setAlarm(Date.now() + BRIDGE_SUBSCRIPTION_REFRESH);
    }
  }
}
