# Epic 4: Small Group Calls (Mesh Topology)

> Secure group conversations for small teams (2-8 participants)

## Overview

Enable encrypted group voice/video calls using peer-to-peer mesh topology. Each participant connects directly to every other participant, providing maximum privacy and eliminating the need for a central media server.

## Dependencies

- **Epic 2**: 1:1 Voice Calls (WebRTC foundation, signaling)
- **Epic 3**: 1:1 Video Calls (video pipeline)

## Unlocks

- Epic 5: Conference Infrastructure (for larger groups)
- Epic 7: Hotline Calling (multi-operator scenarios)

---

## Why Mesh for Small Groups?

```
┌─────────────────────────────────────────────────────────────────┐
│                 MESH vs SFU COMPARISON                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MESH TOPOLOGY (this epic)           SFU TOPOLOGY (Epic 5)       │
│                                                                  │
│       A ──────── B                        A                      │
│       │ \      / │                        │                      │
│       │  \    /  │                        ▼                      │
│       │   \  /   │                    ┌───────┐                  │
│       │    \/    │                    │  SFU  │                  │
│       │    /\    │                    │Server │                  │
│       │   /  \   │                    └───┬───┘                  │
│       │  /    \  │                     /  │  \                   │
│       │ /      \ │                    ▼   ▼   ▼                  │
│       D ──────── C                   B    C    D                 │
│                                                                  │
│  Pros:                               Pros:                       │
│  ✓ True E2EE (no server)             ✓ Scales to many users      │
│  ✓ No infrastructure                 ✓ Lower client bandwidth    │
│  ✓ Maximum privacy                   ✓ Server-side features      │
│  ✓ Works offline (BLE mesh)          ✓ Easier NAT traversal      │
│                                                                  │
│  Cons:                               Cons:                       │
│  ✗ O(n²) connections                 ✗ Requires server           │
│  ✗ High upload bandwidth             ✗ Single point of failure   │
│  ✗ ~8 participant limit              ✗ Must trust or verify E2EE │
│  ✗ Complex NAT scenarios                                         │
│                                                                  │
│  Use mesh for: <8 people, high privacy needs, offline scenarios  │
│  Use SFU for: >8 people, variable bandwidth, public events       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Mesh Architecture

### 1.1 Connection Topology

```
4 participants = 6 connections (n(n-1)/2)
6 participants = 15 connections
8 participants = 28 connections

Each participant:
- Sends audio/video to (n-1) peers
- Receives from (n-1) peers
- Upload bandwidth = bitrate × (n-1)
- Download bandwidth = bitrate × (n-1)

Example: 4-person video call @ 1 Mbps per stream
- Upload: 3 Mbps
- Download: 3 Mbps
- Total: 6 Mbps per participant
```

### 1.2 Signaling for Mesh

```
┌─────────────────────────────────────────────────────────────────┐
│                 GROUP CALL SIGNALING                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  NEW: Group Call Event Kinds                                     │
│                                                                  │
│  24310: group-call-create                                        │
│         - Creates a new group call room                          │
│         - Contains room ID, creator, invited pubkeys             │
│                                                                  │
│  24311: group-call-join                                          │
│         - Participant announces joining                          │
│         - Contains room ID, participant pubkey                   │
│                                                                  │
│  24312: group-call-leave                                         │
│         - Participant announces leaving                          │
│         - Contains room ID, participant pubkey                   │
│                                                                  │
│  24313: group-call-participants                                  │
│         - Current participant list (for late joiners)            │
│         - Broadcast periodically or on change                    │
│                                                                  │
│  Existing kinds still used per-peer:                             │
│  24300: call-offer (peer to peer within room)                    │
│  24301: call-answer                                              │
│  24302: call-ice                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Schema: group-call-state.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://buildit.network/schemas/calling/v1/group-call-state.json",
  "title": "GroupCallState",
  "description": "State of a mesh group call",
  "type": "object",
  "required": ["roomId", "participants", "createdAt"],
  "properties": {
    "roomId": {
      "type": "string",
      "format": "uuid"
    },
    "groupId": {
      "type": "string",
      "description": "Optional BuildIt group context"
    },
    "createdBy": {
      "type": "string",
      "description": "Pubkey of call creator"
    },
    "participants": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/GroupCallParticipant"
      },
      "maxItems": 8
    },
    "maxParticipants": {
      "type": "integer",
      "minimum": 2,
      "maximum": 8,
      "default": 8
    },
    "callType": {
      "type": "string",
      "enum": ["voice", "video"]
    },
    "createdAt": {
      "type": "integer"
    },
    "endedAt": {
      "type": "integer"
    }
  },
  "$defs": {
    "GroupCallParticipant": {
      "type": "object",
      "required": ["pubkey", "joinedAt", "state"],
      "properties": {
        "pubkey": { "type": "string" },
        "joinedAt": { "type": "integer" },
        "state": {
          "type": "string",
          "enum": ["connecting", "connected", "reconnecting", "left"]
        },
        "audioEnabled": { "type": "boolean" },
        "videoEnabled": { "type": "boolean" },
        "screenSharing": { "type": "boolean" }
      }
    }
  }
}
```

---

## Part 2: Connection Management

### 2.1 Mesh Connection Manager

```typescript
// Manages all peer connections in a group call

class MeshCallManager extends EventEmitter {
  private roomId: string;
  private localPubkey: string;
  private connections: Map<string, RTCPeerConnection> = new Map();
  private participants: Map<string, ParticipantState> = new Map();
  private localStream: MediaStream | null = null;

  async createRoom(options: CreateRoomOptions): Promise<string> {
    this.roomId = crypto.randomUUID();

    // Announce room creation
    await this.signaling.sendGroupCallCreate({
      roomId: this.roomId,
      createdBy: this.localPubkey,
      callType: options.video ? 'video' : 'voice',
      invitedPubkeys: options.invitees,
      maxParticipants: options.maxParticipants ?? 8,
    });

    // Get local media
    this.localStream = await this.rtc.getUserMedia({
      audio: true,
      video: options.video,
    });

    return this.roomId;
  }

  async joinRoom(roomId: string): Promise<void> {
    this.roomId = roomId;

    // Announce joining
    await this.signaling.sendGroupCallJoin({
      roomId,
      pubkey: this.localPubkey,
    });

    // Get local media
    this.localStream = await this.rtc.getUserMedia({
      audio: true,
      video: true, // Will be determined by room type
    });

    // Wait for participant list, then connect to each
    const participants = await this.getParticipants(roomId);

    for (const participant of participants) {
      if (participant.pubkey !== this.localPubkey) {
        await this.connectToPeer(participant.pubkey);
      }
    }
  }

  private async connectToPeer(remotePubkey: string): Promise<void> {
    // Avoid duplicate connections
    if (this.connections.has(remotePubkey)) return;

    // Determine who initiates (lower pubkey creates offer)
    const shouldInitiate = this.localPubkey < remotePubkey;

    const pc = this.rtc.createPeerConnection(this.getIceConfig());
    this.connections.set(remotePubkey, pc);

    // Add local tracks
    this.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });

    // Handle incoming tracks
    pc.ontrack = (event) => {
      this.emit('remote-track', {
        pubkey: remotePubkey,
        track: event.track,
        streams: event.streams,
      });
    };

    // ICE handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate({
          roomId: this.roomId,
          callId: `${this.roomId}-${remotePubkey}`,
          candidate: event.candidate.toJSON(),
        }, remotePubkey);
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      this.handleConnectionStateChange(remotePubkey, pc.connectionState);
    };

    if (shouldInitiate) {
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await this.signaling.sendCallOffer({
        roomId: this.roomId,
        callId: `${this.roomId}-${remotePubkey}`,
        sdp: offer.sdp!,
        callType: 'video',
        timestamp: Date.now(),
      }, remotePubkey);
    }
    // Otherwise, wait for offer from remote
  }

  async handlePeerJoined(pubkey: string): Promise<void> {
    this.participants.set(pubkey, {
      pubkey,
      state: 'connecting',
      joinedAt: Date.now(),
    });

    await this.connectToPeer(pubkey);
    this.emit('participant-joined', pubkey);
  }

  async handlePeerLeft(pubkey: string): Promise<void> {
    const pc = this.connections.get(pubkey);
    if (pc) {
      pc.close();
      this.connections.delete(pubkey);
    }

    this.participants.delete(pubkey);
    this.emit('participant-left', pubkey);
  }

  async leaveRoom(): Promise<void> {
    // Announce leaving
    await this.signaling.sendGroupCallLeave({
      roomId: this.roomId,
      pubkey: this.localPubkey,
    });

    // Close all connections
    for (const [pubkey, pc] of this.connections) {
      pc.close();
    }
    this.connections.clear();

    // Stop local media
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
  }
}
```

### 2.2 Connection Ordering (Avoid Duplicate Connections)

```typescript
// Deterministic connection initiation
// Lower pubkey always initiates to avoid both sides offering simultaneously

function shouldInitiateConnection(localPubkey: string, remotePubkey: string): boolean {
  return localPubkey.localeCompare(remotePubkey) < 0;
}

// Example:
// Alice (pubkey: "aaa...") connects to Bob (pubkey: "bbb...")
// Alice initiates (sends offer) because "aaa" < "bbb"
// Bob waits for offer from Alice
```

### 2.3 Late Joiner Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                 LATE JOINER FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Existing call: Alice ←→ Bob ←→ Carol                            │
│                                                                  │
│  1. Dave joins                                                   │
│     └─▶ Sends group-call-join to room                            │
│                                                                  │
│  2. Alice (or any participant) responds with participant list    │
│     └─▶ Dave learns about Alice, Bob, Carol                      │
│                                                                  │
│  3. Dave initiates connections based on pubkey ordering          │
│     └─▶ Connects to those with higher pubkeys                    │
│     └─▶ Waits for offers from those with lower pubkeys           │
│                                                                  │
│  4. Alice, Bob, Carol each connect to Dave                       │
│     └─▶ Each follows same ordering rule                          │
│                                                                  │
│  5. Mesh complete:                                               │
│     Alice ←→ Bob ←→ Carol                                        │
│       ↑       ↑       ↑                                          │
│       └───────┼───────┘                                          │
│               ↓                                                  │
│             Dave                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Group Key Management

### 3.1 Group E2EE Challenge

In 1:1 calls, we derive a key from NIP-44 shared secret. For groups, we need a key everyone shares but no single party controls.

**Options**:

| Approach | Pros | Cons |
|----------|------|------|
| Sender keys | Simple, efficient | Key rotation complex |
| Pairwise keys | Maximum security | O(n²) encrypt operations |
| MLS | Standard, efficient | Complex implementation |
| Simple group key | Easy | Single point of compromise |

### 3.2 Sender Keys Approach (Recommended for MVP)

```typescript
// Each participant generates their own sender key
// Shares it encrypted to each other participant using NIP-44

interface SenderKeyDistribution {
  roomId: string;
  senderPubkey: string;
  keyId: number;  // Increments on rotation
  encryptedKeys: {
    [recipientPubkey: string]: string;  // NIP-44 encrypted key
  };
}

class GroupKeyManager {
  private senderKeys: Map<string, CryptoKey> = new Map();
  private myKeyId = 0;
  private mySenderKey: CryptoKey | null = null;

  async generateAndDistributeSenderKey(participants: string[]): Promise<void> {
    // Generate random 256-bit key
    this.mySenderKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    this.myKeyId++;

    const rawKey = await crypto.subtle.exportKey('raw', this.mySenderKey);

    // Encrypt key to each participant using NIP-44
    const encryptedKeys: Record<string, string> = {};
    for (const pubkey of participants) {
      encryptedKeys[pubkey] = await nip44.encrypt(
        this.localPrivkey,
        pubkey,
        Buffer.from(rawKey).toString('base64')
      );
    }

    // Broadcast distribution
    await this.signaling.sendSenderKeyDistribution({
      roomId: this.roomId,
      senderPubkey: this.localPubkey,
      keyId: this.myKeyId,
      encryptedKeys,
    });
  }

  async handleSenderKeyDistribution(dist: SenderKeyDistribution): Promise<void> {
    // Decrypt key intended for us
    const encryptedKey = dist.encryptedKeys[this.localPubkey];
    if (!encryptedKey) return;

    const keyBase64 = await nip44.decrypt(
      this.localPrivkey,
      dist.senderPubkey,
      encryptedKey
    );

    const key = await crypto.subtle.importKey(
      'raw',
      Buffer.from(keyBase64, 'base64'),
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    this.senderKeys.set(`${dist.senderPubkey}:${dist.keyId}`, key);
  }

  // Encrypt outgoing frame with our sender key
  async encryptFrame(frame: Uint8Array): Promise<Uint8Array> {
    // ... (similar to 1:1, but include keyId in header)
  }

  // Decrypt incoming frame using sender's key
  async decryptFrame(senderPubkey: string, frame: Uint8Array): Promise<Uint8Array> {
    const keyId = extractKeyId(frame);
    const key = this.senderKeys.get(`${senderPubkey}:${keyId}`);
    // ... decrypt
  }
}
```

### 3.3 Key Rotation

```
┌─────────────────────────────────────────────────────────────────┐
│                 KEY ROTATION TRIGGERS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Rotate sender keys when:                                        │
│                                                                  │
│  1. Participant leaves                                           │
│     └─▶ All remaining participants rotate their keys             │
│     └─▶ Departed participant can't decrypt future frames         │
│                                                                  │
│  2. Participant joins (optional, for forward secrecy)            │
│     └─▶ Prevents new joiner from decrypting past frames          │
│     └─▶ Trade-off: adds latency, may skip for UX                 │
│                                                                  │
│  3. Time-based rotation (e.g., every 30 minutes)                 │
│     └─▶ Limits exposure window if key is compromised             │
│                                                                  │
│  4. Explicit request (suspected compromise)                      │
│     └─▶ Any participant can trigger rotation                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Audio Mixing

### 4.1 Client-Side Audio Mixing

```typescript
// Mix multiple audio streams for speaker output
// Each peer connection provides one audio stream

class AudioMixer {
  private audioContext: AudioContext;
  private gainNodes: Map<string, GainNode> = new Map();
  private destination: MediaStreamAudioDestinationNode;

  constructor() {
    this.audioContext = new AudioContext();
    this.destination = this.audioContext.createMediaStreamDestination();
  }

  addParticipant(pubkey: string, stream: MediaStream): void {
    const source = this.audioContext.createMediaStreamSource(stream);
    const gain = this.audioContext.createGain();

    gain.gain.value = 1.0;  // Default volume

    source.connect(gain);
    gain.connect(this.destination);

    this.gainNodes.set(pubkey, gain);
  }

  removeParticipant(pubkey: string): void {
    const gain = this.gainNodes.get(pubkey);
    if (gain) {
      gain.disconnect();
      this.gainNodes.delete(pubkey);
    }
  }

  setParticipantVolume(pubkey: string, volume: number): void {
    const gain = this.gainNodes.get(pubkey);
    if (gain) {
      gain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getMixedStream(): MediaStream {
    return this.destination.stream;
  }
}
```

### 4.2 Active Speaker Detection

```typescript
// Detect who is currently speaking for UI highlighting

class ActiveSpeakerDetector {
  private audioLevels: Map<string, number[]> = new Map();
  private readonly windowSize = 10;  // Rolling window
  private readonly speakingThreshold = -40;  // dB

  updateLevel(pubkey: string, level: number): void {
    if (!this.audioLevels.has(pubkey)) {
      this.audioLevels.set(pubkey, []);
    }

    const levels = this.audioLevels.get(pubkey)!;
    levels.push(level);

    if (levels.length > this.windowSize) {
      levels.shift();
    }
  }

  getActiveSpeakers(): string[] {
    const speakers: { pubkey: string; avgLevel: number }[] = [];

    for (const [pubkey, levels] of this.audioLevels) {
      if (levels.length === 0) continue;

      const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;

      if (avgLevel > this.speakingThreshold) {
        speakers.push({ pubkey, avgLevel });
      }
    }

    // Sort by loudness, return pubkeys
    return speakers
      .sort((a, b) => b.avgLevel - a.avgLevel)
      .map(s => s.pubkey);
  }

  getDominantSpeaker(): string | null {
    const speakers = this.getActiveSpeakers();
    return speakers[0] ?? null;
  }
}
```

---

## Part 5: Video Layout

### 5.1 Grid Layouts

```
┌─────────────────────────────────────────────────────────────────┐
│                 VIDEO GRID LAYOUTS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2 participants          3 participants          4 participants  │
│  ┌─────────────────┐    ┌───────┬───────┐      ┌───────┬───────┐ │
│  │        │        │    │       │       │      │       │       │ │
│  │   A    │   B    │    │   A   │   B   │      │   A   │   B   │ │
│  │        │        │    │       │       │      │       │       │ │
│  └─────────────────┘    ├───────┴───────┤      ├───────┼───────┤ │
│                         │       C       │      │   C   │   D   │ │
│                         └───────────────┘      └───────┴───────┘ │
│                                                                  │
│  5 participants          6 participants          7-8 participants│
│  ┌─────┬─────┬─────┐    ┌─────┬─────┬─────┐    ┌───┬───┬───┬───┐ │
│  │  A  │  B  │  C  │    │  A  │  B  │  C  │    │ A │ B │ C │ D │ │
│  ├─────┴──┬──┴─────┤    ├─────┼─────┼─────┤    ├───┼───┼───┼───┤ │
│  │   D    │   E    │    │  D  │  E  │  F  │    │ E │ F │ G │ H │ │
│  └────────┴────────┘    └─────┴─────┴─────┘    └───┴───┴───┴───┘ │
│                                                                  │
│  SPEAKER VIEW (dominant speaker large)                           │
│  ┌───────────────────────────────────┐                           │
│  │                                   │                           │
│  │                                   │                           │
│  │         Active Speaker            │ ┌───┐                     │
│  │                                   │ │ B │                     │
│  │                                   │ ├───┤                     │
│  │                                   │ │ C │                     │
│  └───────────────────────────────────┘ └───┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Layout Component

```typescript
interface GroupCallLayoutProps {
  participants: ParticipantVideo[];
  dominantSpeaker: string | null;
  layout: 'grid' | 'speaker' | 'sidebar';
  localPubkey: string;
}

function GroupCallLayout({
  participants,
  dominantSpeaker,
  layout,
  localPubkey
}: GroupCallLayoutProps) {
  const sortedParticipants = useMemo(() => {
    // Put dominant speaker first, self last
    return [...participants].sort((a, b) => {
      if (a.pubkey === dominantSpeaker) return -1;
      if (b.pubkey === dominantSpeaker) return 1;
      if (a.pubkey === localPubkey) return 1;
      if (b.pubkey === localPubkey) return -1;
      return 0;
    });
  }, [participants, dominantSpeaker, localPubkey]);

  if (layout === 'speaker' && dominantSpeaker) {
    return <SpeakerLayout participants={sortedParticipants} />;
  }

  return (
    <div className={getGridClassName(participants.length)}>
      {sortedParticipants.map(p => (
        <ParticipantTile
          key={p.pubkey}
          participant={p}
          isSpeaking={p.pubkey === dominantSpeaker}
          isLocal={p.pubkey === localPubkey}
        />
      ))}
    </div>
  );
}

function getGridClassName(count: number): string {
  switch (count) {
    case 2: return 'grid grid-cols-2';
    case 3: return 'grid grid-cols-2 [&>*:last-child]:col-span-2';
    case 4: return 'grid grid-cols-2 grid-rows-2';
    case 5:
    case 6: return 'grid grid-cols-3 grid-rows-2';
    default: return 'grid grid-cols-4 grid-rows-2';
  }
}
```

### 5.3 Participant Tile

```typescript
interface ParticipantTileProps {
  participant: ParticipantVideo;
  isSpeaking: boolean;
  isLocal: boolean;
}

function ParticipantTile({ participant, isSpeaking, isLocal }: ParticipantTileProps) {
  const { pubkey, stream, audioEnabled, videoEnabled, displayName, avatar } = participant;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-gray-900',
        isSpeaking && 'ring-2 ring-green-500',
      )}
    >
      {videoEnabled && stream ? (
        <VideoStream
          stream={stream}
          muted={isLocal}
          mirror={isLocal}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Avatar src={avatar} name={displayName} size="xl" />
        </div>
      )}

      {/* Name overlay */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded bg-black/50 px-2 py-1">
        {!audioEnabled && <MicOff className="h-4 w-4 text-red-400" />}
        <span className="text-sm text-white">
          {isLocal ? t('you') : displayName}
        </span>
      </div>

      {/* Speaking indicator */}
      {isSpeaking && audioEnabled && (
        <div className="absolute top-2 right-2">
          <AudioLevelIndicator pubkey={pubkey} />
        </div>
      )}
    </div>
  );
}
```

---

## Part 6: Group Call Controls

### 6.1 Host Controls

```typescript
// Group call creator has additional controls

interface HostControls {
  // Mute a participant (request, not force)
  requestMute(pubkey: string): Promise<void>;

  // Remove participant from call
  removeParticipant(pubkey: string): Promise<void>;

  // Lock room (no new joins)
  lockRoom(): Promise<void>;

  // End call for everyone
  endCall(): Promise<void>;
}

// Non-host participants
interface ParticipantControls {
  // Standard controls
  toggleMute(): void;
  toggleCamera(): void;
  shareScreen(): Promise<void>;

  // Leave call (doesn't affect others)
  leave(): Promise<void>;
}
```

### 6.2 Mute Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 MUTE REQUEST (privacy-respecting)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Host cannot forcibly mute - only request                        │
│  (respects user autonomy, participant controls their mic)        │
│                                                                  │
│  Flow:                                                           │
│  1. Host clicks "Request mute" on participant                    │
│  2. Signaling sends mute-request to participant                  │
│  3. Participant sees toast: "Host requested you mute"            │
│  4. Participant can accept (mute) or ignore                      │
│                                                                  │
│  Alternative: Soft audio ducking                                 │
│  - Reduce unmuted participant's volume for host                  │
│  - Per-user volume control                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 7: Bandwidth Management

### 7.1 Per-Participant Quality Control

```typescript
// Adapt quality based on each connection's conditions

class BandwidthManager {
  private connectionQualities: Map<string, QualityLevel> = new Map();

  async updateQuality(pubkey: string, pc: RTCPeerConnection): Promise<void> {
    const stats = await pc.getStats();
    const quality = this.calculateQuality(stats);

    if (this.connectionQualities.get(pubkey) !== quality) {
      this.connectionQualities.set(pubkey, quality);

      // Adjust sender parameters for this connection
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        const params = sender.getParameters();
        params.encodings[0].maxBitrate = this.getBitrate(quality);
        await sender.setParameters(params);
      }
    }
  }

  private getBitrate(quality: QualityLevel): number {
    switch (quality) {
      case 'high': return 1_500_000;
      case 'medium': return 750_000;
      case 'low': return 300_000;
      case 'audio-only': return 0;  // Disable video
    }
  }
}
```

### 7.2 Automatic Video Disabling

```typescript
// Disable video when bandwidth is critical

class AutoQualityManager {
  private threshold = {
    packetLoss: 15,      // %
    roundTripTime: 500,  // ms
  };

  shouldDisableVideo(metrics: ConnectionMetrics): boolean {
    return (
      metrics.packetLoss > this.threshold.packetLoss ||
      metrics.roundTripTime > this.threshold.roundTripTime
    );
  }

  // When one connection is bad, may need to disable video to all
  // to preserve audio quality
  shouldEnterAudioOnlyMode(allMetrics: ConnectionMetrics[]): boolean {
    const badConnections = allMetrics.filter(m => this.shouldDisableVideo(m));
    return badConnections.length >= allMetrics.length / 2;
  }
}
```

---

## Part 8: Testing

### 8.1 Test Scenarios

- [ ] 2-person mesh call (baseline)
- [ ] 4-person mesh call (standard group)
- [ ] 8-person mesh call (maximum)
- [ ] Late joiner connects to all existing participants
- [ ] Participant leaves, others remain connected
- [ ] Key rotation on participant leave
- [ ] Host removes participant
- [ ] Network degradation to audio-only
- [ ] Reconnection after brief disconnect

### 8.2 Load Testing

```typescript
// Simulate mesh with varying participant counts

async function loadTestMesh(participantCount: number) {
  const connections = participantCount * (participantCount - 1) / 2;
  const uploadBandwidth = 1_000_000 * (participantCount - 1);
  const downloadBandwidth = 1_000_000 * (participantCount - 1);

  console.log(`
    Participants: ${participantCount}
    Total connections: ${connections}
    Upload bandwidth per user: ${uploadBandwidth / 1_000_000} Mbps
    Download bandwidth per user: ${downloadBandwidth / 1_000_000} Mbps
  `);

  // Verify client can handle this many connections
  // Verify CPU usage acceptable
  // Verify memory usage acceptable
}
```

---

## Implementation Tasks

### Phase 1: Mesh Connection
- [ ] MeshCallManager implementation
- [ ] Connection ordering (deterministic initiation)
- [ ] Late joiner handling
- [ ] Participant state tracking

### Phase 2: Signaling
- [ ] Group call event schemas
- [ ] Room creation/join/leave signaling
- [ ] Participant list synchronization
- [ ] NIP-17 wrapping for group events

### Phase 3: E2EE
- [ ] Sender key generation
- [ ] Sender key distribution (NIP-44 encrypted)
- [ ] Frame encryption with sender keys
- [ ] Key rotation on participant change

### Phase 4: Audio/Video
- [ ] Audio mixing
- [ ] Active speaker detection
- [ ] Grid video layout
- [ ] Speaker view layout
- [ ] Per-participant volume control

### Phase 5: Controls
- [ ] Host controls (mute request, remove, lock, end)
- [ ] Participant controls
- [ ] Layout switching UI
- [ ] Bandwidth adaptation

---

## Success Criteria

- [ ] 4-person video calls work reliably
- [ ] 8-person audio calls work reliably
- [ ] Sender key E2EE verified
- [ ] Late joiners connect within 5 seconds
- [ ] Participant departure doesn't disrupt others
- [ ] Active speaker detection accurate

## Open Questions

1. Should host be able to forcibly mute? (privacy vs. moderation)
2. Allow >8 participants with degraded experience?
3. How to handle asymmetric bandwidth (some on WiFi, some on cellular)?
4. Should we implement breakout rooms at mesh level or only SFU?
