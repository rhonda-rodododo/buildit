# Epic 1: Core Calling Protocol & Infrastructure

> Foundation layer for all calling features in BuildIt

## Overview

This epic establishes the fundamental building blocks:
- Protocol schemas for call signaling
- E2EE signaling over Nostr (NIP-17 wrapped)
- BLE fallback signaling for hostile networks
- STUN/TURN infrastructure decisions
- WebRTC abstraction layer for all platforms

## Dependencies

- None (this is the foundation)

## Unlocks

- Epic 2: 1:1 Voice Calls
- Epic 3: 1:1 Video Calls
- Epic 4: Small Group Calls

---

## Part 1: Protocol Schema Design

### 1.1 Call Signaling Events

All call signaling uses Nostr event kinds, wrapped in NIP-17 for metadata protection.

**Proposed Event Kinds** (in private range 24xxx):

| Kind | Name | Description |
|------|------|-------------|
| 24300 | call-offer | Initiator sends SDP offer |
| 24301 | call-answer | Recipient accepts with SDP answer |
| 24302 | call-ice | ICE candidate exchange |
| 24303 | call-hangup | Either party ends call |
| 24304 | call-reject | Recipient declines call |
| 24305 | call-busy | Recipient already in call |
| 24306 | call-ringing | Recipient received, ringing |
| 24307 | call-hold | Put call on hold |
| 24308 | call-resume | Resume from hold |
| 24310 | call-group-offer | Group call invitation |
| 24311 | call-group-join | Join existing group call |
| 24312 | call-group-leave | Leave group call |

### 1.2 Schema: call-offer.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://buildit.network/schemas/calling/v1/call-offer.json",
  "title": "CallOffer",
  "description": "WebRTC call offer with SDP",
  "type": "object",
  "required": ["callId", "sdp", "callType", "timestamp"],
  "properties": {
    "callId": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier for this call session"
    },
    "sdp": {
      "type": "string",
      "description": "SDP offer (Session Description Protocol)"
    },
    "callType": {
      "type": "string",
      "enum": ["voice", "video"],
      "description": "Type of call being initiated"
    },
    "timestamp": {
      "type": "integer",
      "description": "Unix timestamp of offer creation"
    },
    "groupId": {
      "type": "string",
      "description": "Optional group context for the call"
    },
    "relayHint": {
      "type": "string",
      "format": "uri",
      "description": "Preferred TURN relay if known"
    },
    "capabilities": {
      "$ref": "#/$defs/CallCapabilities"
    }
  },
  "$defs": {
    "CallCapabilities": {
      "type": "object",
      "properties": {
        "video": { "type": "boolean" },
        "screenShare": { "type": "boolean" },
        "e2ee": { "type": "boolean", "default": true },
        "recording": { "type": "boolean" }
      }
    }
  }
}
```

### 1.3 Schema: call-state.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://buildit.network/schemas/calling/v1/call-state.json",
  "title": "CallState",
  "description": "Current state of a call (local storage)",
  "type": "object",
  "required": ["callId", "state", "direction", "remotePubkey", "startedAt"],
  "properties": {
    "callId": {
      "type": "string",
      "format": "uuid"
    },
    "state": {
      "type": "string",
      "enum": [
        "initiating",
        "ringing",
        "connecting",
        "connected",
        "on-hold",
        "reconnecting",
        "ended"
      ]
    },
    "direction": {
      "type": "string",
      "enum": ["outgoing", "incoming"]
    },
    "callType": {
      "type": "string",
      "enum": ["voice", "video"]
    },
    "remotePubkey": {
      "type": "string",
      "description": "Nostr pubkey of the other party"
    },
    "startedAt": {
      "type": "integer",
      "description": "Unix timestamp when call was initiated"
    },
    "connectedAt": {
      "type": "integer",
      "description": "Unix timestamp when call connected"
    },
    "endedAt": {
      "type": "integer",
      "description": "Unix timestamp when call ended"
    },
    "endReason": {
      "type": "string",
      "enum": [
        "completed",
        "rejected",
        "busy",
        "no-answer",
        "network-failure",
        "cancelled"
      ]
    },
    "quality": {
      "$ref": "#/$defs/CallQuality"
    }
  },
  "$defs": {
    "CallQuality": {
      "type": "object",
      "properties": {
        "packetLoss": { "type": "number" },
        "jitter": { "type": "number" },
        "roundTripTime": { "type": "number" },
        "bandwidth": { "type": "integer" }
      }
    }
  }
}
```

### 1.4 Full Schema List

| Schema | Purpose |
|--------|---------|
| `call-offer.json` | SDP offer with capabilities |
| `call-answer.json` | SDP answer |
| `call-ice-candidate.json` | ICE candidate trickle |
| `call-hangup.json` | Call termination with reason |
| `call-state.json` | Local call state tracking |
| `call-history.json` | Persistent call log entry |
| `call-settings.json` | User call preferences |
| `group-call-state.json` | Multi-party call coordination |
| `conference-room.json` | Large conference metadata |

---

## Part 2: Signaling Architecture

### 2.1 NIP-17 Wrapped Signaling

All call signaling MUST be wrapped in NIP-17 gift wrap for metadata protection:

```
┌─────────────────────────────────────────────────────────────────┐
│                     SIGNALING FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Caller                              Callee                      │
│    │                                    │                        │
│    │  1. Create call-offer (kind 24300) │                        │
│    │     with SDP                       │                        │
│    │                                    │                        │
│    │  2. Wrap in NIP-17 gift wrap       │                        │
│    │     - Seal with NIP-44             │                        │
│    │     - Gift wrap (kind 1059)        │                        │
│    │                                    │                        │
│    │  3. Publish to relays              │                        │
│    │─────────────────────────────────────▶│                        │
│    │                                    │                        │
│    │                   4. Receive gift wrap                      │
│    │                      Unwrap → call-offer                    │
│    │                                    │                        │
│    │                   5. Show incoming call UI                  │
│    │                      User accepts                           │
│    │                                    │                        │
│    │◀─────────────────────────────────────│ 6. Send call-answer   │
│    │         (also NIP-17 wrapped)      │    with SDP            │
│    │                                    │                        │
│    │◀────────────────────────────────────▶│ 7. Exchange ICE       │
│    │         candidates (kind 24302)    │    (multiple)          │
│    │                                    │                        │
│    │══════════════════════════════════════│ 8. WebRTC connected   │
│    │         Direct P2P or via TURN     │    Media flows         │
│    │                                    │                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 BLE Fallback Signaling

When Nostr relays are unavailable (network outage, censorship), signaling falls back to BLE mesh:

```
┌─────────────────────────────────────────────────────────────────┐
│                   BLE SIGNALING MODE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Same call events, but transported via:                          │
│                                                                  │
│  1. BLE characteristic writes to nearby peers                    │
│  2. Mesh propagation with TTL                                    │
│  3. Device-to-device encryption (existing BLE layer)             │
│                                                                  │
│  Limitations:                                                    │
│  - Only works if caller/callee are within BLE mesh range         │
│  - Higher latency for signaling                                  │
│  - Media still requires IP connectivity (WebRTC)                 │
│                                                                  │
│  Use case: Call coordination in protest/action scenarios         │
│  where internet is cut but local mesh exists                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Signaling State Machine

```
                    ┌──────────┐
                    │  IDLE    │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          │ make call    │              │ receive offer
          ▼              │              ▼
    ┌──────────┐         │        ┌──────────┐
    │INITIATING│         │        │ RINGING  │
    └────┬─────┘         │        └────┬─────┘
         │               │             │
         │ receive       │             │ user accepts
         │ ringing       │             │
         ▼               │             ▼
    ┌──────────┐         │        ┌──────────┐
    │ RINGING  │         │        │CONNECTING│◀────┐
    │ (remote) │         │        └────┬─────┘     │
    └────┬─────┘         │             │           │ ICE restart
         │               │             │           │
         │ receive       │             │ ICE       │
         │ answer        │             │ connected │
         ▼               │             ▼           │
    ┌──────────┐         │        ┌──────────┐    │
    │CONNECTING│─────────┼───────▶│CONNECTED │────┘
    └────┬─────┘         │        └────┬─────┘
         │               │             │
         │               │             │ hold
         │               │             ▼
         │               │        ┌──────────┐
         │               │        │ ON_HOLD  │
         │               │        └────┬─────┘
         │               │             │ resume
         │               │             │
         ▼               ▼             ▼
    ┌──────────────────────────────────────┐
    │              ENDED                    │
    │  (completed|rejected|busy|timeout|    │
    │   network-failure|cancelled)          │
    └──────────────────────────────────────┘
```

---

## Part 3: WebRTC Infrastructure

### 3.1 STUN/TURN Strategy

**STUN** (Session Traversal Utilities for NAT):
- Lightweight, helps discover public IP
- Many free public servers available
- We'll run our own as well

**TURN** (Traversal Using Relays around NAT):
- Required when direct P2P fails (symmetric NAT, firewalls)
- More expensive (bandwidth costs)
- MUST be self-hostable for privacy

**Recommended Setup**:

```yaml
# Self-hosted coturn configuration
stun_servers:
  - stun:stun.buildit.network:3478
  - stun:stun.l.google.com:19302  # Fallback public

turn_servers:
  - turn:turn.buildit.network:3478
  - turns:turn.buildit.network:5349  # TLS

# coturn config for self-hosting
realm: buildit.network
fingerprint: true
lt-cred-mech: true
use-auth-secret: true
static-auth-secret: ${TURN_SECRET}
total-quota: 100
bps-capacity: 0  # Unlimited
stale-nonce: 600
```

### 3.2 TURN Deployment Options

| Option | Pros | Cons |
|--------|------|------|
| Self-hosted coturn | Full control, privacy | Ops burden, bandwidth costs |
| Cloudflare Calls | Simple, scalable | Vendor dependency |
| Twilio TURN | Reliable, global | Cost, vendor dependency |
| Metered.ca | Affordable | Less control |

**Recommendation**: Self-hosted coturn with Cloudflare Calls as fallback.

### 3.3 ICE Candidate Filtering

For maximum privacy, users can opt into "relay-only" mode:

```typescript
const iceConfig = {
  iceServers: getIceServers(),
  iceTransportPolicy: privacyMode ? 'relay' : 'all'
};

// 'relay' mode: Only use TURN servers, never expose local IP
// 'all' mode: Try direct connection first (faster, less private)
```

### 3.4 WebRTC Abstraction Layer

Create a cross-platform abstraction:

```typescript
// packages/calling/src/rtc-adapter.ts

interface RTCAdapter {
  // Connection management
  createPeerConnection(config: RTCConfig): PeerConnection;

  // Media
  getUserMedia(constraints: MediaConstraints): Promise<MediaStream>;
  getDisplayMedia(): Promise<MediaStream>;

  // Encryption
  enableE2EE(connection: PeerConnection, keyMaterial: Uint8Array): void;

  // Stats
  getStats(connection: PeerConnection): Promise<RTCStats>;
}

// Platform implementations:
// - WebRTCAdapter (browsers, Tauri webview)
// - IOSRTCAdapter (WebRTC.framework wrapper)
// - AndroidRTCAdapter (libwebrtc wrapper)
```

---

## Part 4: End-to-End Encryption

### 4.1 Encryption Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENCRYPTION LAYERS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Signaling (NIP-17)                                     │
│  ├── Gift wrap encrypts call events                              │
│  ├── Relay cannot see who's calling whom                         │
│  └── Uses NIP-44 (ChaCha20-Poly1305)                             │
│                                                                  │
│  Layer 2: DTLS-SRTP (WebRTC default)                             │
│  ├── Encrypts media between endpoints                            │
│  ├── Keys negotiated in SDP                                      │
│  └── Protects against network eavesdropping                      │
│                                                                  │
│  Layer 3: Insertable Streams E2EE (our addition)                 │
│  ├── Encrypts media BEFORE it enters WebRTC                      │
│  ├── TURN/SFU only sees ciphertext                               │
│  ├── Uses sender keys derived from shared secret                 │
│  └── Survives infrastructure compromise                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Agreement for 1:1 Calls

```typescript
// Simple key derivation for 1:1 calls
// Uses existing NIP-44 shared secret

async function deriveCallKey(
  localPrivkey: Uint8Array,
  remotePubkey: Uint8Array,
  callId: string
): Promise<Uint8Array> {
  // Get NIP-44 conversation key
  const conversationKey = nip44.getConversationKey(localPrivkey, remotePubkey);

  // Derive call-specific key using HKDF
  return hkdf(
    conversationKey,
    callId,           // salt
    'buildit-call-e2ee-v1'  // info
  );
}
```

### 4.3 Insertable Streams Implementation

```typescript
// E2EE transform for WebRTC encoded frames

const encryptTransform = new TransformStream({
  transform: async (frame, controller) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      callKey,
      frame.data
    );

    // Prepend IV to encrypted data
    const output = new Uint8Array(iv.length + encrypted.byteLength);
    output.set(iv);
    output.set(new Uint8Array(encrypted), iv.length);

    frame.data = output.buffer;
    controller.enqueue(frame);
  }
});

// Apply to sender
const sender = peerConnection.getSenders()[0];
const streams = sender.createEncodedStreams();
streams.readable
  .pipeThrough(encryptTransform)
  .pipeTo(streams.writable);
```

---

## Part 5: Platform Implementation Guides

### 5.1 Web/Desktop (Tauri)

```typescript
// Shared implementation via web APIs
// Works in both browser and Tauri webview

import { CallingManager } from '@buildit/calling';

const calling = new CallingManager({
  signaling: nostrSignaling,  // or bleSignaling
  iceServers: getIceServers(),
  e2eeEnabled: true
});

// Make a call
const call = await calling.call(remotePubkey, { video: false });
call.on('connected', () => console.log('Call connected'));
call.on('ended', (reason) => console.log('Call ended:', reason));
```

### 5.2 iOS (Swift)

```swift
// Uses WebRTC.framework + CallKit

import WebRTC
import CallKit

class CallManager: NSObject {
    private let rtcFactory: RTCPeerConnectionFactory
    private let callController: CXCallController

    func startCall(to pubkey: String, hasVideo: Bool) async throws {
        // 1. Create offer via WebRTC
        let connection = createPeerConnection()
        let offer = try await connection.offer(for: constraints)

        // 2. Send via NIP-17
        try await signaling.sendOffer(to: pubkey, sdp: offer.sdp)

        // 3. Report to CallKit
        let handle = CXHandle(type: .generic, value: pubkey)
        let action = CXStartCallAction(call: callId, handle: handle)
        try await callController.request(CXTransaction(action: action))
    }
}
```

### 5.3 Android (Kotlin)

```kotlin
// Uses libwebrtc + ConnectionService

class CallService : ConnectionService() {
    private val peerConnectionFactory: PeerConnectionFactory

    override fun onCreateOutgoingConnection(
        account: PhoneAccountHandle,
        request: ConnectionRequest
    ): Connection {
        val pubkey = request.extras.getString("pubkey")

        return CallConnection(pubkey).apply {
            setCallerDisplayName(getDisplayName(pubkey), PRESENTATION_ALLOWED)
            setInitializing()

            // Start WebRTC negotiation
            lifecycleScope.launch {
                startWebRTCCall(pubkey)
            }
        }
    }
}
```

---

## Part 6: Testing Strategy

### 6.1 Test Vectors

Add to `protocol/test-vectors/calling/`:

```json
{
  "name": "call-offer-roundtrip",
  "description": "Verify call offer serialization",
  "input": {
    "callId": "550e8400-e29b-41d4-a716-446655440000",
    "sdp": "v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\n...",
    "callType": "voice",
    "timestamp": 1700000000
  },
  "expected": {
    "valid": true,
    "nostrKind": 24300
  }
}
```

### 6.2 Integration Tests

- [ ] Signaling roundtrip (offer → answer → connected)
- [ ] ICE candidate exchange
- [ ] TURN fallback when P2P fails
- [ ] E2EE encryption/decryption
- [ ] Call state machine transitions
- [ ] Timeout handling (no answer, network failure)

### 6.3 Cross-Platform Tests

- [ ] Web ↔ Web calls
- [ ] Web ↔ iOS calls
- [ ] Web ↔ Android calls
- [ ] iOS ↔ Android calls
- [ ] Desktop ↔ Mobile calls

---

## Part 7: Implementation Tasks

### Phase 1: Schemas & Signaling

- [ ] Create `protocol/schemas/modules/calling/` directory
- [ ] Define all call event schemas
- [ ] Add to schema registry
- [ ] Run codegen for all platforms
- [ ] Implement NIP-17 wrapped signaling (web)
- [ ] Add call signaling to BLE message types

### Phase 2: WebRTC Foundation

- [ ] Create `packages/calling/` shared package
- [ ] Implement RTCAdapter interface
- [ ] Web RTCAdapter implementation
- [ ] STUN/TURN configuration management
- [ ] ICE candidate handling
- [ ] Connection state machine

### Phase 3: E2EE Layer

- [ ] Call key derivation using NIP-44 base
- [ ] Insertable Streams encryption (web)
- [ ] Verify encryption with test vectors
- [ ] Privacy mode (relay-only) option

### Phase 4: Infrastructure

- [ ] coturn deployment configuration
- [ ] Docker compose for local development
- [ ] Kubernetes manifests for production
- [ ] Monitoring and metrics

---

## Success Criteria

- [ ] Call signaling works over Nostr (NIP-17 wrapped)
- [ ] WebRTC connections establish with STUN
- [ ] TURN fallback works when P2P fails
- [ ] E2EE verified (TURN cannot decrypt media)
- [ ] All schemas pass validation
- [ ] Test vectors pass on all platforms
- [ ] Documentation complete

## Open Questions

1. Should we use existing NIP-17 event kinds or register new ones?
2. TURN bandwidth budget per organization?
3. Call quality metrics storage (local only vs. aggregated)?
4. Ringing timeout duration (30s? configurable?)?

## References

- [WebRTC 1.0 Specification](https://www.w3.org/TR/webrtc/)
- [Insertable Streams API](https://w3c.github.io/webrtc-insertable-streams/)
- [coturn Documentation](https://github.com/coturn/coturn)
- [NIP-44 Encrypted Payloads](https://github.com/nostr-protocol/nips/blob/master/44.md)
