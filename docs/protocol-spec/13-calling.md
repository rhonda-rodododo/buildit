# 13. Real-Time Calling Protocol

This document specifies the BuildIt real-time voice and video calling protocol, which provides end-to-end encrypted (E2EE) communication using WebRTC with NIP-17 metadata-protected signaling.

## Overview

BuildIt's calling system supports:
- **1:1 Calls**: Direct voice/video calls between two users
- **Group Calls**: Small group calls (2-8 participants) using mesh topology
- **Conferences**: Large meetings (10-100+) using SFU (Selective Forwarding Unit)
- **Hotlines**: Operator-managed call queues for support/crisis lines
- **Message Broadcasts**: Send messages to groups/contact lists

## Core Principles

1. **End-to-End Encryption**: All media is encrypted end-to-end
2. **Metadata Protection**: Signaling uses NIP-17 gift wrapping to protect who is calling whom
3. **Decentralized**: P2P WebRTC connections, no central call server for 1:1/mesh calls
4. **Progressive Enhancement**: Falls back gracefully when features unavailable

## Signaling Protocol

### Event Kinds

Calling uses Nostr event kinds 24300-24399:

| Kind | Name | Description |
|------|------|-------------|
| 24300 | Call Offer | WebRTC SDP offer (initiating call) |
| 24301 | Call Answer | WebRTC SDP answer (accepting call) |
| 24302 | ICE Candidate | WebRTC ICE candidate for NAT traversal |
| 24303 | Call Hangup | End/reject call with reason |
| 24304 | Call State | Current call state update |
| 24310 | Group Call Create | Create a new group call room |
| 24311 | Group Call Join | Join an existing group call |
| 24312 | Group Call Leave | Leave a group call |
| 24320 | Sender Key Distribution | Distribute E2EE keys for group calls |
| 24330 | Hotline Call State | Hotline-specific call state |
| 24331 | Hotline Operator Status | Operator availability status |
| 24332 | Hotline Queue State | Queue position and wait times |
| 24340 | Messaging Thread | Messaging hotline thread state |
| 24350 | Broadcast | Message broadcast to group/list |
| 24360 | Conference Room | Conference room configuration |
| 24361 | Breakout Config | Breakout room configuration |

### Message Format

All signaling messages are wrapped in NIP-17 gift wrap for metadata protection:

```
Gift Wrap (kind 1059)
└── Seal (encrypted to recipient)
    └── Rumor (kind 24300-24399)
        └── Content (JSON payload per schema)
```

### Call Offer (Kind 24300)

```json
{
  "_v": "1.0.0",
  "callId": "uuid",
  "callType": "voice" | "video",
  "sdp": "SDP offer string",
  "timestamp": 1706234567890,
  "groupId": "optional-group-id",
  "roomId": "optional-room-id",
  "hotlineId": "optional-hotline-id",
  "isReconnect": false,
  "isRenegotiation": false,
  "capabilities": {
    "video": true,
    "screenShare": true,
    "e2ee": true,
    "insertableStreams": true
  }
}
```

### Call Answer (Kind 24301)

```json
{
  "_v": "1.0.0",
  "callId": "uuid",
  "sdp": "SDP answer string",
  "timestamp": 1706234567890
}
```

### ICE Candidate (Kind 24302)

```json
{
  "_v": "1.0.0",
  "callId": "uuid",
  "candidate": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0,
    "usernameFragment": "..."
  }
}
```

### Call Hangup (Kind 24303)

```json
{
  "_v": "1.0.0",
  "callId": "uuid",
  "reason": "completed" | "busy" | "rejected" | "no_answer" | "cancelled" | "network_failure" | "media_failure",
  "timestamp": 1706234567890
}
```

## WebRTC Configuration

### ICE Servers

Clients should support configurable ICE servers:

```typescript
{
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.example.com',
      username: 'user',
      credential: 'pass'
    }
  ],
  iceTransportPolicy: 'all' | 'relay'  // relay-only for privacy
}
```

### Relay-Only Mode

For enhanced privacy (hiding IP addresses), users can enable "relay-only" mode which forces all traffic through TURN servers:

```typescript
{
  iceTransportPolicy: 'relay'
}
```

## End-to-End Encryption

### Transport Encryption

WebRTC provides transport-level encryption via DTLS-SRTP:
- All media is encrypted between peers
- Key exchange happens during DTLS handshake
- Provides confidentiality and integrity

### Frame-Level Encryption (Insertable Streams)

For true E2EE through SFU/TURN servers, use Insertable Streams API:

```typescript
// Check support
const supportsE2EE = 'RTCRtpScriptTransform' in window ||
                     'createEncodedStreams' in RTCRtpSender.prototype;

// Encryption transform
const encryptFrame = async (encodedFrame, controller) => {
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: generateIV() },
    encryptionKey,
    encodedFrame.data
  );
  encodedFrame.data = encrypted;
  controller.enqueue(encodedFrame);
};
```

### Key Distribution for Group Calls

Group calls use sender keys for efficient encryption:

```json
{
  "_v": "1.0.0",
  "roomId": "uuid",
  "senderPubkey": "hex-pubkey",
  "keyId": 1,
  "encryptedKeys": {
    "recipient-pubkey-1": "encrypted-key-for-1",
    "recipient-pubkey-2": "encrypted-key-for-2"
  },
  "timestamp": 1706234567890
}
```

Each sender:
1. Generates a symmetric key for their media
2. Encrypts it to each participant's public key
3. Distributes via kind 24320 message
4. Rotates key when participants join/leave

## Call Topologies

### 1:1 Calls (Direct P2P)

```
User A ←——WebRTC——→ User B
```

- Direct peer-to-peer connection
- Signaling via NIP-17 through Nostr relays
- STUN for NAT traversal, TURN if needed

### Group Calls (Mesh, 2-8 participants)

```
     User A
    ↙     ↘
User B ←→ User C
    ↘     ↙
     User D
```

- Each participant connects to all others
- N*(N-1)/2 connections for N participants
- Works well for small groups (≤8)
- E2EE via sender keys

### Conferences (SFU, 10-100+ participants)

```
         SFU Server
       ↙  ↓  ↓  ↘
     A    B  C    D  ...
```

- Participants send to SFU, receive from SFU
- SFU forwards selectively (bandwidth efficient)
- Frame-level E2EE via Insertable Streams
- Requires server infrastructure

## Hotline System

### Architecture

```
           ┌─────────────────┐
           │   Hotline       │
           │   Queue         │
           └────────┬────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
Operator A     Operator B     Operator C
(Available)    (On Call)      (Break)
```

### Operator Status

```json
{
  "_v": "1.0.0",
  "hotlineId": "uuid",
  "pubkey": "operator-pubkey",
  "status": "available" | "on_call" | "wrap_up" | "break" | "offline",
  "currentCallId": "uuid-if-on-call",
  "callCount": 5,
  "shiftStart": 1706234567890,
  "shiftEnd": 1706270967890,
  "timestamp": 1706234567890
}
```

### Queue State

```json
{
  "_v": "1.0.0",
  "hotlineId": "uuid",
  "calls": [
    {
      "callId": "uuid",
      "queuedAt": 1706234567890,
      "callerName": "Anonymous",
      "priority": "normal",
      "position": 1
    }
  ],
  "operatorsAvailable": 2,
  "estimatedWaitTime": 120,
  "timestamp": 1706234567890
}
```

## Message Broadcasts

### Broadcast Message

```json
{
  "_v": "1.0.0",
  "broadcastId": "uuid",
  "content": "Message content",
  "title": "Optional title",
  "targetType": "group" | "contact_list" | "public_channel" | "emergency",
  "targetIds": ["group-1", "group-2"],
  "createdBy": "sender-pubkey",
  "scheduledAt": 1706234567890,
  "sentAt": 1706234567890,
  "status": "draft" | "scheduled" | "sending" | "sent" | "failed",
  "priority": "normal" | "high" | "emergency",
  "analytics": {
    "totalRecipients": 100,
    "delivered": 95,
    "read": 50,
    "replied": 10
  }
}
```

## Client Implementation

### Required Capabilities

All clients must implement:
1. NIP-17 gift wrap for signaling
2. WebRTC peer connection management
3. ICE candidate gathering and exchange
4. Local media capture (audio/video)
5. Call state machine

### Recommended Capabilities

Clients should implement when platform supports:
1. Insertable Streams for frame-level E2EE
2. Screen sharing
3. Picture-in-picture
4. Background audio

### Platform-Specific Notes

#### Web/Desktop (Tauri)
- Full WebRTC support
- Insertable Streams API available
- Use `getUserMedia()` for media capture

#### iOS
- Use `RTCPeerConnection` from WebRTC framework
- `RTCAudioSession` for audio routing
- CallKit integration for system call UI
- Background modes for ongoing calls

#### Android
- Use `PeerConnection` from WebRTC library
- `ConnectionService` for telecom integration
- Foreground service for ongoing calls
- Handle audio focus properly

## Security Considerations

1. **Verify Identity**: Check caller pubkey against contacts
2. **Reject Unknown Callers**: Option to only accept from contacts
3. **Timeout Offers**: Reject offers older than 60 seconds
4. **Rate Limit**: Prevent call spam
5. **IP Protection**: Use relay-only mode when needed
6. **Key Rotation**: Rotate sender keys on participant changes

## Test Vectors

See `protocol/test-vectors/calling/` for:
- Call offer/answer examples
- ICE candidate format
- Hangup reason codes
- Group call key distribution

## Version History

- **1.0.0**: Initial specification
  - 1:1 voice/video calls
  - Group calls (mesh)
  - Hotline system
  - Message broadcasts
