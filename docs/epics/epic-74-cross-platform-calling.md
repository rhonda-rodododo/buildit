# Epic 74: Cross-Platform Calling Completion

**Status**: Not Started
**Priority**: P1 - Core Feature Gap
**Effort**: 25-35 hours
**Platforms**: iOS, Android, Web
**Dependencies**: None (calling infrastructure exists on all platforms)

---

## Context

The calling module has been implemented across all platforms but several critical integration points remain as TODOs. iOS lacks native system call UI (CallKit), SMS/RCS broadcast gateways are simulated, Android's PSTN bridge is a placeholder, and training module notifications don't send join links to RSVPed users.

---

## Tasks

### iOS: CallKit Integration (8-10h)
- [ ] Implement `CXProvider` and `CXCallController` for system call UI
- [ ] Handle incoming call notifications via CallKit
- [ ] Implement background audio session management
- [ ] Support call actions from lock screen and notification center
- [ ] Handle call interruptions (other calls, system events)
- **File**: `clients/ios/BuildIt/Modules/Calling/Views/IncomingCallView.swift:259`

### iOS: SMS Gateway Integration (4-6h)
- [ ] Integrate Twilio (or equivalent) SMS API for broadcast messages
- [ ] Implement rate limiting for outbound SMS
- [ ] Handle delivery receipts and failure callbacks
- [ ] Add opt-out/unsubscribe handling
- **File**: `clients/ios/BuildIt/Modules/Calling/BroadcastManager.swift:546`

### iOS: RCS Business Messaging Integration (4-6h)
- [ ] Integrate RCS Business Messaging API
- [ ] Support rich media in broadcast messages
- [ ] Handle RCS fallback to SMS
- [ ] Delivery tracking and analytics
- **File**: `clients/ios/BuildIt/Modules/Calling/BroadcastManager.swift:573`

### Android: WebRTC SIP Bridge (6-8h)
- [ ] Implement `RTCPeerConnection` setup for PSTN calling
- [ ] Bridge WebRTC audio to SIP server
- [ ] Handle SRTP encryption for call audio
- [ ] Implement DTMF tone sending
- [ ] Handle network transitions (WiFi ↔ cellular) during calls
- **File**: `clients/android/app/src/main/java/network/buildit/modules/calling/services/PSTNCallManager.kt:336`

### Web: Training Session Notifications (3-5h)
- [ ] Send join link notifications to RSVPed users when training session starts
- [ ] Route notifications through messaging module (NIP-17)
- [ ] Include conference room URL in notification payload
- [ ] Handle late-join scenarios
- **File**: `clients/web/src/modules/training/integrations/callingIntegration.ts:112`

---

## Acceptance Criteria

- [ ] iOS incoming calls display native system call UI via CallKit
- [ ] SMS broadcasts deliver to real phone numbers (not simulated)
- [ ] RCS broadcasts deliver with rich media, fallback to SMS
- [ ] Android PSTN calls connect through WebRTC SIP bridge
- [ ] Training session RSVPed users receive join link notifications
- [ ] All calling paths work offline-first with retry on reconnect

---

## Technical Notes

- CallKit requires `voip` background mode in Info.plist
- SMS/RCS gateways require server-side API keys - may depend on Epic 62 (Backend Setup) or can use direct client-side integration with key management
- WebRTC SIP bridge needs STUN/TURN server configuration
- Consider privacy implications of SMS gateway seeing phone numbers

---

**Git Commit Format**: `feat(calling): complete cross-platform calling integration (Epic 74)`
**Git Tag**: `v0.74.0-calling-complete`
