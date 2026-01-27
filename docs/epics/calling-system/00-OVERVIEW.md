# Calling System Epic Series

> Privacy-first, end-to-end encrypted voice/video calling for BuildIt

## Vision

Enable secure real-time communication across all BuildIt clients with:
- **1:1 calls** - Voice and video between two users (Signal-like)
- **Group calls** - Small group conversations (mesh topology)
- **Conferences** - Large-scale meetings with advanced features (Jitsi/Zoom-like)
- **Hotline integration** - Real calling capabilities for dispatch/support
- **Messaging hotlines** - Text-based intake with SMS/RCS bridge
- **Message blasts** - Broadcast updates to groups and contact lists
- **PSTN bridge** - Connect to regular phone networks (critical for accessibility)

## Core Principles

All implementations MUST adhere to:

1. **E2EE by default** - All audio/video streams encrypted end-to-end
2. **Metadata protection** - Call signaling uses NIP-17 gift wrap
3. **Zero-knowledge server** - Infrastructure cannot access call content
4. **Offline resilience** - Graceful degradation, BLE fallback for signaling
5. **Self-hostable** - All server components can be self-hosted
6. **Cross-platform** - Web, Desktop, iOS, Android feature parity
7. **Protocol-first** - Schemas define all call events/states

## Epic Dependency Graph

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           CALLING SYSTEM EPICS                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  EPIC 1: Core Protocol & Infrastructure                                │   │
│  │  - Signaling protocol (NIP-17 wrapped)                                 │   │
│  │  - WebRTC foundation                                                   │   │
│  │  - STUN/TURN strategy                                                  │   │
│  │  - Protocol schemas                                                    │   │
│  └──────────────────────────────┬─────────────────────────────────────────┘   │
│                                 │                                              │
│                ┌────────────────┼────────────────┐                            │
│                ▼                ▼                ▼                            │
│  ┌─────────────────────┐ ┌───────────────┐ ┌─────────────────┐               │
│  │ EPIC 2: 1:1 Voice   │ │ EPIC 3: 1:1   │ │ EPIC 4: Small   │               │
│  │ - Audio streams     │ │ Video         │ │ Group Calls     │               │
│  │ - Call lifecycle    │ │ - Camera      │ │ - Mesh topology │               │
│  │ - Push notifs       │ │ - Screen share│ │ - <8 users      │               │
│  └──────────┬──────────┘ └───────┬───────┘ └────────┬────────┘               │
│             │                    │                  │                         │
│             └────────────────────┼──────────────────┘                         │
│                                  ▼                                            │
│                ┌─────────────────────────────────────┐                        │
│                │  EPIC 5: Conference Infrastructure  │                        │
│                │  - SFU architecture                 │                        │
│                │  - E2EE through SFU                 │                        │
│                │  - Self-hostable                    │                        │
│                └────────────────┬────────────────────┘                        │
│                                 │                                              │
│                ┌────────────────┼────────────────┐                            │
│                ▼                ▼                ▼                            │
│  ┌─────────────────────┐ ┌───────────────┐ ┌─────────────────┐               │
│  │ EPIC 6: Conf        │ │ EPIC 7:       │ │ EPIC 9:         │               │
│  │ Features            │ │ Hotline Voice │ │ Messaging       │               │
│  │ - Breakouts         │ │ - Real calls  │ │ Hotline/Blasts  │               │
│  │ - Moderation        │ │ - Queuing     │ │ - Text intake   │               │
│  │ - Recording         │ │ - Desktop CC  │ │ - Broadcasts    │               │
│  └─────────────────────┘ └───────┬───────┘ └────────┬────────┘               │
│                                  │                  │                         │
│                                  ▼                  │                         │
│                        ┌─────────────────┐          │                         │
│                        │ EPIC 8: PSTN    │◀─────────┘                         │
│                        │ Gateway         │                                    │
│                        │ - Twilio/Plivo  │  (Critical for accessibility:      │
│                        │ - Inbound/out   │   reaches those without             │
│                        │ - Self-host opt │   smartphones/data access)          │
│                        │ - SMS bridge    │                                    │
│                        └─────────────────┘                                    │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Epic Index

| Epic | Title | Status | Dependencies |
|------|-------|--------|--------------|
| [01](./01-CORE-PROTOCOL.md) | Core Protocol & Infrastructure | Planning | None |
| [02](./02-VOICE-CALLS.md) | 1:1 Voice Calls | Planning | Epic 1 |
| [03](./03-VIDEO-CALLS.md) | 1:1 Video Calls | Planning | Epic 2 |
| [04](./04-GROUP-CALLS.md) | Small Group Calls (Mesh) | Planning | Epic 2 |
| [05](./05-CONFERENCE-INFRA.md) | Conference Infrastructure (SFU) | Planning | Epics 2-4 |
| [06](./06-CONFERENCE-FEATURES.md) | Conference Features | Planning | Epic 5 |
| [07](./07-HOTLINE-CALLING.md) | Hotline Voice Calling | Planning | Epics 2, 5 |
| [08](./08-PSTN-GATEWAY.md) | PSTN Gateway Integration | Planning | Epics 7, 9 |
| [09](./09-MESSAGING-HOTLINE-BLASTS.md) | Messaging Hotline & Broadcasts | Planning | Epic 7 |

## Technology Stack Decisions

### Media Transport
- **WebRTC** - Industry standard, native browser/mobile support
- **Opus codec** - Audio (low latency, excellent quality)
- **VP9/AV1** - Video (efficient, open codecs)

### End-to-End Encryption
- **Insertable Streams API** - E2EE through any topology (mesh/SFU)
- **MLS (Message Layer Security)** - Group key agreement (IETF RFC 9420)
- **Double Ratchet** - Perfect forward secrecy for call keys

### Signaling
- **NIP-17 Gift Wrap** - Metadata-protected signaling over Nostr
- **BLE Mesh** - Fallback/primary in hostile network environments
- **Custom event kinds** - Call offer/answer/ice/hangup

### Server Infrastructure (Self-Hostable)
- **STUN** - coturn (lightweight NAT discovery)
- **TURN** - coturn (relay when direct connection fails)
- **SFU** - Jitsi Videobridge or Pion (Go-based, lightweight)
- **PSTN** - Asterisk/FreeSWITCH or managed (Twilio/Plivo)

## Security Threat Model Additions

The calling system introduces new attack vectors:

| Threat | Mitigation |
|--------|------------|
| Call metadata leakage | NIP-17 gift wrap for all signaling |
| MITM on media streams | E2EE with MLS key agreement |
| TURN server eavesdropping | E2EE - TURN only sees ciphertext |
| SFU compromise | Insertable Streams - SFU cannot decrypt |
| Overbilling attack (PSTN) | Rate limiting, prepaid credits, alerts |
| Spam calls | Contact-list filtering, reputation system |
| Location via ICE candidates | Relay-only mode option (always TURN) |

## Cross-Platform Implementation Strategy

```
Phase 1: Web + Desktop (shared WebRTC via Tauri webview)
Phase 2: iOS (native CallKit + WebRTC framework)
Phase 3: Android (native ConnectionService + WebRTC)

All platforms share:
- Protocol schemas (codegen)
- Signaling logic (via schemas)
- Encryption primitives (packages/crypto)
```

## Schema Namespace

New schemas will live in:
```
protocol/schemas/modules/calling/
├── v1/
│   ├── call-offer.json
│   ├── call-answer.json
│   ├── call-ice-candidate.json
│   ├── call-hangup.json
│   ├── call-state.json
│   ├── conference-state.json
│   └── ...
└── _registry.json
```

## Milestones

### M1: Foundation (Epics 1-2)
- [ ] Protocol schemas defined
- [ ] Signaling over Nostr working
- [ ] 1:1 voice calls functional (web)

### M2: Rich Calling (Epics 3-4)
- [ ] Video calls working
- [ ] Small group calls (mesh)
- [ ] iOS/Android 1:1 calls

### M3: Conferences (Epics 5-6)
- [ ] SFU infrastructure deployed
- [ ] Large group calls
- [ ] Breakout rooms, moderation

### M4: Hotline Voice (Epic 7)
- [ ] Hotline with real E2EE calling
- [ ] Desktop call center experience
- [ ] Queue management, dispatch

### M5: Multi-Channel (Epics 8-9)
- [ ] Messaging hotline intake
- [ ] Message broadcasts/blasts
- [ ] PSTN voice bridge
- [ ] SMS/RCS text bridge
- [ ] Production deployment guide

## Open Questions

1. **SFU selection**: Jitsi Videobridge vs Pion vs Mediasoup?
2. **MLS vs custom**: Use IETF MLS or simpler custom group key rotation?
3. **Recording**: Client-side only, or optional server-side for compliance?
4. **PSTN provider**: Twilio vs Plivo vs self-hosted Asterisk?
5. **Bandwidth adaptation**: Simulcast strategy for variable networks?

## References

- [WebRTC for the Curious](https://webrtcforthecurious.com/)
- [NIP-17 Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [MLS Protocol RFC 9420](https://www.rfc-editor.org/rfc/rfc9420.html)
- [Jitsi Architecture](https://jitsi.github.io/handbook/docs/architecture)
- [Pion WebRTC](https://github.com/pion/webrtc)
