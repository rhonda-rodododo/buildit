# Epic 5: Conference Infrastructure (SFU)

> Scalable video conferencing for large groups using Selective Forwarding Units

## Overview

Implement SFU-based conferencing to support large meetings (10-100+ participants) that exceed mesh topology limits. The SFU receives media from each participant and selectively forwards it to others, dramatically reducing client bandwidth requirements while maintaining E2EE through Insertable Streams.

## Dependencies

- **Epic 2**: 1:1 Voice Calls (WebRTC foundation)
- **Epic 3**: 1:1 Video Calls (video pipeline)
- **Epic 4**: Group Calls (group signaling patterns)

## Unlocks

- Epic 6: Conference Features (breakouts, recording, moderation)
- Epic 7: Hotline Calling (high-volume scenarios)

---

## Why SFU?

```
┌─────────────────────────────────────────────────────────────────┐
│                 TOPOLOGY COMPARISON AT SCALE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MESH (Epic 4)                    SFU (This Epic)                │
│                                                                  │
│  10 participants:                 10 participants:               │
│  - 45 connections total           - 10 connections total         │
│  - 9 Mbps upload per user         - 1 Mbps upload per user       │
│  - 9 Mbps download per user       - 9 Mbps download per user*    │
│                                                                  │
│  50 participants:                 50 participants:               │
│  - 1,225 connections              - 50 connections               │
│  - 49 Mbps upload (impossible!)   - 1 Mbps upload per user       │
│  - 49 Mbps download               - Variable download            │
│                                                                  │
│  * SFU can intelligently reduce download via:                    │
│    - Simulcast layer selection                                   │
│    - Only forward visible speakers                               │
│    - Pause off-screen video                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Architecture

### 1.1 SFU Selection

| Option | Language | E2EE Support | Deployment | License |
|--------|----------|--------------|------------|---------|
| **Jitsi Videobridge** | Java | Insertable Streams | Docker/K8s | Apache 2.0 |
| **Pion SFU** | Go | Insertable Streams | Binary/Docker | MIT |
| **mediasoup** | C++/Node | Insertable Streams | Docker | ISC |
| **LiveKit** | Go | Insertable Streams | Docker/Cloud | Apache 2.0 |
| **Cloudflare Calls** | Managed | Limited | Managed | Proprietary |

**Recommendation**: **LiveKit** - Modern, well-documented, easy deployment, strong E2EE support.

Alternative: **Pion** for maximum self-hosting control (Go, very lightweight).

### 1.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SFU ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Cloudflare Workers                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │ Room Manager │  │  Auth/Token  │  │  Analytics   │    │   │
│  │  │  - Create    │  │  - Validate  │  │  - Usage     │    │   │
│  │  │  - List      │  │  - Generate  │  │  - Quality   │    │   │
│  │  │  - Delete    │  │  - Revoke    │  │  - Billing   │    │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │   │
│  └────────────────────────────┬─────────────────────────────┘   │
│                               │                                  │
│                               ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     SFU Cluster                           │   │
│  │                                                           │   │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐              │   │
│  │   │ SFU #1  │    │ SFU #2  │    │ SFU #3  │  ...         │   │
│  │   │ (US-E)  │    │ (US-W)  │    │ (EU)    │              │   │
│  │   └────┬────┘    └────┬────┘    └────┬────┘              │   │
│  │        │              │              │                    │   │
│  │        └──────────────┼──────────────┘                    │   │
│  │                       │                                   │   │
│  │              Inter-SFU mesh (for multi-region)            │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                               ▲                                  │
│                               │                                  │
│        ┌──────────────────────┼──────────────────────┐          │
│        │                      │                      │          │
│  ┌─────┴─────┐          ┌─────┴─────┐          ┌─────┴─────┐    │
│  │ Client A  │          │ Client B  │          │ Client C  │    │
│  │           │          │           │          │           │    │
│  │ E2EE ───▶ │ ─────────│ SFU ──────│─────────▶│ ──▶ E2EE │    │
│  │ Encrypt   │          │(forwards) │          │ Decrypt   │    │
│  └───────────┘          └───────────┘          └───────────┘    │
│                                                                  │
│  Key: SFU only sees encrypted frames (ciphertext)               │
│       Cannot decrypt without participant keys                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Zero-Knowledge SFU

```
┌─────────────────────────────────────────────────────────────────┐
│                 WHAT THE SFU KNOWS vs DOESN'T                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SFU KNOWS:                       SFU DOES NOT KNOW:             │
│  ─────────────────────────────────────────────────────────────   │
│  ✓ IP addresses of participants   ✗ Content of audio/video      │
│  ✓ Bandwidth usage                ✗ Who is saying what           │
│  ✓ Connection timestamps          ✗ Screen share content         │
│  ✓ Room IDs                       ✗ Participant identities*      │
│  ✓ Participant count              ✗ Conversation topics          │
│  ✓ Media packet sizes             ✗ Encryption keys              │
│                                                                  │
│  * With privacy tokens, even identity can be hidden              │
│                                                                  │
│  Mitigation for IP exposure:                                     │
│  - VPN/Tor before connecting to SFU                              │
│  - Onion-routed signaling                                        │
│  - Ephemeral connection tokens                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Room Management (Cloudflare Workers)

### 2.1 Room API

```typescript
// workers/conference/src/rooms.ts

interface ConferenceRoom {
  id: string;
  name: string;
  createdBy: string;        // Pubkey (hashed for privacy)
  sfuServer: string;        // Assigned SFU endpoint
  maxParticipants: number;
  settings: RoomSettings;
  createdAt: number;
  expiresAt: number;        // Auto-cleanup
}

interface RoomSettings {
  requireApproval: boolean;   // Waiting room
  allowScreenShare: boolean;
  allowRecording: boolean;
  locked: boolean;
  e2eeRequired: boolean;      // Always true for BuildIt
}

// Room creation endpoint
export async function createRoom(request: Request, env: Env): Promise<Response> {
  const { name, settings, groupId } = await request.json();

  // Validate auth token (from NIP-98 HTTP auth or similar)
  const pubkey = await validateAuth(request);
  if (!pubkey) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Select optimal SFU based on geography
  const sfuServer = await selectOptimalSFU(request, env);

  const room: ConferenceRoom = {
    id: crypto.randomUUID(),
    name,
    createdBy: await hashPubkey(pubkey),  // Don't store raw pubkey
    sfuServer,
    maxParticipants: settings.maxParticipants ?? 100,
    settings: {
      requireApproval: settings.requireApproval ?? false,
      allowScreenShare: settings.allowScreenShare ?? true,
      allowRecording: settings.allowRecording ?? false,
      locked: false,
      e2eeRequired: true,  // Always required
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,  // 24 hour default
  };

  // Store in Durable Object or KV
  await env.ROOMS.put(room.id, JSON.stringify(room));

  // Generate join token
  const token = await generateJoinToken(room.id, pubkey, 'host', env);

  return Response.json({
    roomId: room.id,
    joinToken: token,
    sfuEndpoint: room.sfuServer,
  });
}
```

### 2.2 Join Token Generation

```typescript
// JWT-based token for SFU authentication

interface JoinTokenPayload {
  roomId: string;
  participantId: string;    // Ephemeral ID (not pubkey)
  role: 'host' | 'moderator' | 'participant' | 'viewer';
  permissions: {
    publish: boolean;
    subscribe: boolean;
    screenShare: boolean;
    record: boolean;
  };
  exp: number;
}

async function generateJoinToken(
  roomId: string,
  pubkey: string,
  role: string,
  env: Env
): Promise<string> {
  // Generate ephemeral participant ID
  const participantId = await generateEphemeralId(pubkey, roomId);

  const payload: JoinTokenPayload = {
    roomId,
    participantId,
    role,
    permissions: getPermissionsForRole(role),
    exp: Math.floor(Date.now() / 1000) + 3600,  // 1 hour
  };

  // Sign with SFU secret
  return await signJWT(payload, env.SFU_SECRET);
}

// Ephemeral ID prevents SFU from learning real pubkeys
async function generateEphemeralId(pubkey: string, roomId: string): Promise<string> {
  const data = new TextEncoder().encode(pubkey + roomId);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash.slice(0, 16))));
}
```

### 2.3 SFU Selection

```typescript
// Geographic routing to optimal SFU

interface SFURegion {
  id: string;
  endpoint: string;
  region: string;
  capacity: number;
  currentLoad: number;
}

async function selectOptimalSFU(request: Request, env: Env): Promise<string> {
  // Get client location from CF headers
  const country = request.cf?.country || 'US';
  const continent = request.cf?.continent || 'NA';

  // Get available SFUs
  const sfus: SFURegion[] = await env.SFU_REGISTRY.list();

  // Filter by capacity
  const available = sfus.filter(s => s.currentLoad < s.capacity * 0.8);

  // Sort by proximity
  const sorted = available.sort((a, b) => {
    const aScore = getProximityScore(a.region, country, continent);
    const bScore = getProximityScore(b.region, country, continent);
    return bScore - aScore;
  });

  return sorted[0]?.endpoint || env.DEFAULT_SFU;
}

function getProximityScore(sfuRegion: string, country: string, continent: string): number {
  // Same country = 100, same continent = 50, other = 10
  if (sfuRegion.includes(country)) return 100;
  if (sfuRegion.includes(continent)) return 50;
  return 10;
}
```

---

## Part 3: SFU Integration (LiveKit Example)

### 3.1 Client Connection

```typescript
// Connect to SFU with E2EE enabled

import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  Track,
  E2EEOptions,
} from 'livekit-client';

class SFUConferenceManager {
  private room: Room;
  private keyProvider: ExternalE2EEKeyProvider;

  async joinRoom(roomId: string, joinToken: string): Promise<void> {
    // Set up E2EE with our own key provider
    this.keyProvider = new ExternalE2EEKeyProvider();

    const e2eeOptions: E2EEOptions = {
      keyProvider: this.keyProvider,
      worker: new Worker(new URL('livekit-client/e2ee-worker', import.meta.url)),
    };

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      e2ee: e2eeOptions,
    });

    // Set up event handlers
    this.room.on(RoomEvent.ParticipantConnected, this.handleParticipantConnected);
    this.room.on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed);
    this.room.on(RoomEvent.Disconnected, this.handleDisconnected);

    // Get SFU endpoint from room manager
    const { sfuEndpoint } = await this.getRoomInfo(roomId);

    // Connect
    await this.room.connect(sfuEndpoint, joinToken);

    // Set encryption key (from our group key exchange)
    const roomKey = await this.deriveRoomKey(roomId);
    await this.keyProvider.setKey(roomKey);
  }

  private async deriveRoomKey(roomId: string): Promise<CryptoKey> {
    // Use MLS or sender keys for group key
    // See Epic 4 for key management details
    return this.groupKeyManager.getRoomKey(roomId);
  }

  async publishTracks(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    // Publish with simulcast for adaptive quality
    await this.room.localParticipant.publishTrack(stream.getAudioTracks()[0]);
    await this.room.localParticipant.publishTrack(stream.getVideoTracks()[0], {
      simulcast: true,
      videoCodec: 'vp9',
    });
  }

  private handleTrackSubscribed = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    // Track is automatically decrypted by E2EE layer
    this.emit('track-received', {
      participantId: participant.identity,
      track,
      kind: track.kind,
    });
  };
}
```

### 3.2 Simulcast Configuration

```typescript
// Send multiple quality layers, SFU selects per receiver

const simulcastConfig = {
  videoEncoding: [
    // Low quality (for small tiles, bad connections)
    {
      rid: 'q',
      maxBitrate: 150_000,
      maxFramerate: 15,
      scaleResolutionDownBy: 4,
    },
    // Medium quality (default for most views)
    {
      rid: 'h',
      maxBitrate: 500_000,
      maxFramerate: 30,
      scaleResolutionDownBy: 2,
    },
    // High quality (for active speaker, good connections)
    {
      rid: 'f',
      maxBitrate: 1_500_000,
      maxFramerate: 30,
    },
  ],
};

// Client requests quality based on tile size
function setSubscriptionQuality(
  participantId: string,
  quality: 'low' | 'medium' | 'high'
) {
  const publication = room.getParticipantByIdentity(participantId)
    ?.getTrack(Track.Source.Camera);

  if (publication) {
    publication.setVideoQuality(
      quality === 'high' ? VideoQuality.HIGH :
      quality === 'medium' ? VideoQuality.MEDIUM :
      VideoQuality.LOW
    );
  }
}
```

---

## Part 4: E2EE Through SFU

### 4.1 MLS for Conference Rooms

For large conferences, we use MLS (Message Layer Security) for efficient group key agreement:

```
┌─────────────────────────────────────────────────────────────────┐
│                 MLS KEY TREE                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MLS uses a binary tree for O(log n) key updates                 │
│                                                                  │
│                    [Root Key]                                    │
│                    /        \                                    │
│              [Key 1]        [Key 2]                              │
│              /    \          /    \                              │
│           [A]    [B]      [C]    [D]                             │
│                                                                  │
│  When participant joins/leaves:                                  │
│  - Only need to update O(log n) keys                             │
│  - Much more efficient than sender keys for large groups         │
│                                                                  │
│  BuildIt MLS integration:                                        │
│  1. Use Nostr keypairs as MLS identity keys                      │
│  2. MLS messages sent via NIP-17 (metadata protected)            │
│  3. Derived epoch keys used for frame encryption                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 MLS Implementation

```typescript
// Using @aspect/mls-rs-wasm for MLS operations

import { Client, Group, CipherSuite } from '@aspect/mls-rs-wasm';

class MLSKeyManager {
  private client: Client;
  private group: Group | null = null;

  async initialize(privateKey: Uint8Array, pubkey: string): Promise<void> {
    // Initialize MLS client with Nostr identity
    this.client = await Client.new(
      CipherSuite.MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519,
      privateKey,
      pubkey
    );
  }

  async createGroup(roomId: string): Promise<Uint8Array> {
    this.group = await this.client.createGroup(roomId);

    // Return welcome message for initial member
    return this.group.welcome;
  }

  async joinGroup(welcome: Uint8Array): Promise<void> {
    this.group = await this.client.joinGroup(welcome);
  }

  async addMember(pubkey: string, keyPackage: Uint8Array): Promise<Uint8Array> {
    if (!this.group) throw new Error('Not in a group');

    // Generate commit adding new member
    const commit = await this.group.addMember(keyPackage);

    // Return commit message to broadcast
    return commit;
  }

  async removeMember(pubkey: string): Promise<Uint8Array> {
    if (!this.group) throw new Error('Not in a group');

    const commit = await this.group.removeMember(pubkey);
    return commit;
  }

  async processCommit(commit: Uint8Array): Promise<void> {
    if (!this.group) throw new Error('Not in a group');

    await this.group.processCommit(commit);
  }

  getCurrentEpochKey(): CryptoKey {
    if (!this.group) throw new Error('Not in a group');

    return this.group.exportSecret('buildit-frame-encryption', 32);
  }
}
```

### 4.3 Frame Encryption with Epoch Keys

```typescript
// Encrypt frames using current MLS epoch key

class ConferenceFrameEncryptor {
  private keyManager: MLSKeyManager;
  private currentEpoch: number = 0;
  private epochKey: CryptoKey | null = null;

  async onEpochChange(): Promise<void> {
    this.currentEpoch++;
    this.epochKey = await this.keyManager.getCurrentEpochKey();
  }

  createEncryptTransform(): TransformStream {
    let frameCounter = 0;

    return new TransformStream({
      transform: async (frame: RTCEncodedVideoFrame, controller) => {
        if (!this.epochKey) {
          controller.enqueue(frame);  // Pass through unencrypted if no key
          return;
        }

        // Header: epoch (4 bytes) + counter (8 bytes)
        const header = new Uint8Array(12);
        new DataView(header.buffer).setUint32(0, this.currentEpoch);
        new DataView(header.buffer).setBigUint64(4, BigInt(frameCounter++));

        // Use header as IV (unique per frame)
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: header },
          this.epochKey,
          frame.data
        );

        // Prepend header to encrypted data
        const output = new Uint8Array(header.length + encrypted.byteLength);
        output.set(header);
        output.set(new Uint8Array(encrypted), header.length);

        frame.data = output.buffer;
        controller.enqueue(frame);
      }
    });
  }

  createDecryptTransform(): TransformStream {
    return new TransformStream({
      transform: async (frame: RTCEncodedVideoFrame, controller) => {
        const data = new Uint8Array(frame.data);

        // Extract header
        const header = data.slice(0, 12);
        const epoch = new DataView(header.buffer).getUint32(0);

        // Get key for this epoch (may need to cache old epoch keys)
        const key = await this.getKeyForEpoch(epoch);
        if (!key) {
          console.warn('No key for epoch', epoch);
          return;  // Drop frame
        }

        // Decrypt
        const encrypted = data.slice(12);
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: header },
          key,
          encrypted
        );

        frame.data = decrypted;
        controller.enqueue(frame);
      }
    });
  }
}
```

---

## Part 5: Scalability & Deployment

### 5.1 SFU Deployment (Kubernetes)

```yaml
# k8s/sfu-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: livekit-sfu
  labels:
    app: livekit
spec:
  replicas: 3
  selector:
    matchLabels:
      app: livekit
  template:
    metadata:
      labels:
        app: livekit
    spec:
      containers:
      - name: livekit
        image: livekit/livekit-server:latest
        ports:
        - containerPort: 7880  # HTTP/WebSocket
        - containerPort: 7881  # RTC (UDP)
        env:
        - name: LIVEKIT_KEYS
          valueFrom:
            secretKeyRef:
              name: livekit-secrets
              key: api-keys
        - name: LIVEKIT_REDIS_HOST
          value: "redis-cluster:6379"
        resources:
          requests:
            cpu: "2"
            memory: "4Gi"
          limits:
            cpu: "4"
            memory: "8Gi"
        volumeMounts:
        - name: config
          mountPath: /etc/livekit
      volumes:
      - name: config
        configMap:
          name: livekit-config

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: livekit-config
data:
  config.yaml: |
    port: 7880
    rtc:
      port_range_start: 50000
      port_range_end: 60000
      use_external_ip: true
      enable_loopback_candidate: false
    redis:
      address: redis-cluster:6379
    turn:
      enabled: true
      domain: turn.buildit.network
      tls_port: 5349
    room:
      max_participants: 100
      empty_timeout: 300
```

### 5.2 Multi-Region Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 MULTI-REGION SFU DEPLOYMENT                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│          US-East                  EU-West                        │
│    ┌─────────────────┐      ┌─────────────────┐                  │
│    │   SFU Cluster   │◀────▶│   SFU Cluster   │                  │
│    │  (3 instances)  │      │  (3 instances)  │                  │
│    └────────┬────────┘      └────────┬────────┘                  │
│             │                        │                           │
│    ┌────────┴────────┐      ┌────────┴────────┐                  │
│    │   US-East-1     │      │   EU-West-1     │                  │
│    │   Users         │      │   Users         │                  │
│    └─────────────────┘      └─────────────────┘                  │
│                                                                  │
│  Inter-region routing:                                           │
│  - Small rooms: single region (lower latency)                    │
│  - Large rooms: cascade across regions                           │
│  - Media forwarded between SFUs (still E2EE)                     │
│                                                                  │
│  Cloudflare Workers for:                                         │
│  - Geographic routing to nearest SFU                             │
│  - Room-to-SFU mapping                                           │
│  - Failover coordination                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Capacity Planning

```typescript
// SFU resource estimation

interface SFUCapacity {
  // Per SFU instance (4 CPU, 8GB RAM)
  maxPublishers: 50;        // Video publishers
  maxSubscribers: 200;      // Total subscribers
  maxRoomsPerInstance: 10;

  // Bandwidth per instance
  ingressBandwidth: '500 Mbps';   // From publishers
  egressBandwidth: '2 Gbps';      // To subscribers

  // Typical room profiles
  smallRoom: {
    participants: 10,
    instances: 1,
  };
  mediumRoom: {
    participants: 50,
    instances: 1,
  };
  largeRoom: {
    participants: 200,
    instances: 4,  // Cascaded
  };
}
```

---

## Part 6: Quality & Reliability

### 6.1 Adaptive Bitrate

```typescript
// SFU dynamically adjusts quality based on receiver conditions

interface SubscriberQualityHints {
  // From client to SFU
  availableBandwidth: number;
  preferredQuality: 'low' | 'medium' | 'high';
  visibleParticipants: string[];  // Only send video for visible
}

// Client sends quality hints periodically
function sendQualityHints(room: Room) {
  setInterval(async () => {
    const bandwidth = await estimateBandwidth();
    const visible = getVisibleParticipants();

    room.localParticipant.setSubscriberQuality({
      availableBandwidth: bandwidth,
      preferredQuality: bandwidth > 2_000_000 ? 'high' : 'medium',
      visibleParticipants: visible,
    });
  }, 5000);
}
```

### 6.2 Connection Resilience

```typescript
// Handle SFU reconnection

class ConferenceReconnector {
  private maxRetries = 5;
  private retryDelay = 1000;

  async handleDisconnect(room: Room): Promise<void> {
    let retries = 0;

    while (retries < this.maxRetries) {
      retries++;

      try {
        // Exponential backoff
        await this.delay(this.retryDelay * Math.pow(2, retries - 1));

        // Get fresh token (may need new SFU if original failed)
        const { joinToken, sfuEndpoint } = await this.refreshConnection(room.name);

        // Reconnect
        await room.connect(sfuEndpoint, joinToken);

        // Re-publish tracks
        await this.republishTracks(room);

        console.log('Reconnected to conference');
        return;

      } catch (error) {
        console.warn(`Reconnect attempt ${retries} failed:`, error);
      }
    }

    // All retries failed
    this.emit('reconnect-failed');
  }
}
```

---

## Part 7: Monitoring & Analytics

### 7.1 Metrics Collection (Cloudflare Workers)

```typescript
// workers/conference/src/analytics.ts

interface ConferenceMetrics {
  roomId: string;
  timestamp: number;
  participantCount: number;
  publisherCount: number;
  avgBitrate: number;
  avgLatency: number;
  packetLossRate: number;
  e2eeEnabled: boolean;
}

// Aggregate metrics (no PII)
async function recordMetrics(metrics: ConferenceMetrics, env: Env) {
  // Store in Analytics Engine
  env.ANALYTICS.writeDataPoint({
    blobs: [metrics.roomId],
    doubles: [
      metrics.participantCount,
      metrics.publisherCount,
      metrics.avgBitrate,
      metrics.avgLatency,
      metrics.packetLossRate,
    ],
    indexes: [metrics.e2eeEnabled ? 'e2ee' : 'plain'],
  });
}
```

### 7.2 Health Checks

```typescript
// SFU health endpoint

interface SFUHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  load: number;           // 0-1
  activeRooms: number;
  activeParticipants: number;
  cpuUsage: number;
  memoryUsage: number;
  networkIn: number;
  networkOut: number;
}

// Cloudflare Worker health aggregator
async function checkSFUHealth(env: Env): Promise<SFUHealth[]> {
  const sfus = await env.SFU_REGISTRY.list();

  return Promise.all(
    sfus.map(async (sfu) => {
      try {
        const response = await fetch(`${sfu.endpoint}/health`, {
          cf: { cacheTtl: 30 },
        });
        return await response.json();
      } catch {
        return { status: 'unhealthy', endpoint: sfu.endpoint };
      }
    })
  );
}
```

---

## Implementation Tasks

### Phase 1: Infrastructure
- [ ] SFU selection and evaluation (LiveKit vs Pion)
- [ ] Kubernetes deployment manifests
- [ ] Cloudflare Workers for room management
- [ ] TURN server integration with SFU

### Phase 2: Client Integration
- [ ] SFU client library integration (LiveKit SDK)
- [ ] Simulcast encoding configuration
- [ ] Quality hint signaling
- [ ] Reconnection handling

### Phase 3: E2EE
- [ ] MLS library integration
- [ ] Epoch key derivation
- [ ] Frame encryption with epoch keys
- [ ] Key rotation on participant change

### Phase 4: Multi-Region
- [ ] Geographic SFU routing
- [ ] Inter-SFU cascading
- [ ] Failover handling
- [ ] Load balancing

### Phase 5: Operations
- [ ] Monitoring dashboards
- [ ] Alerting rules
- [ ] Capacity auto-scaling
- [ ] Cost tracking

---

## Success Criteria

- [ ] 50-person conference works smoothly
- [ ] E2EE verified (SFU cannot decrypt)
- [ ] Graceful quality adaptation
- [ ] Reconnection works within 10 seconds
- [ ] Multi-region latency acceptable (<200ms added)
- [ ] Self-hosted deployment documented

## Open Questions

1. **SFU vendor**: LiveKit vs self-hosted Pion?
2. **MLS library**: Which Rust/WASM implementation?
3. **Recording**: Client-side only or server-side option?
4. **Cost model**: Per-minute? Per-participant? Flat?
5. **Breakout transition**: How to move participants between rooms?
