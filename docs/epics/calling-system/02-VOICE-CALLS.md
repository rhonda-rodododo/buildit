# Epic 2: 1:1 Voice Calls

> Signal-like private voice calls between two users

## Overview

Implement end-to-end encrypted voice calls between two BuildIt users. This is the foundational calling experience that all other features build upon.

## Dependencies

- **Epic 1**: Core Protocol & Infrastructure (signaling, WebRTC, E2EE)

## Unlocks

- Epic 3: 1:1 Video Calls
- Epic 4: Small Group Calls
- Epic 7: Hotline Calling (partial)

---

## User Stories

### Caller Experience

```
AS a BuildIt user
I WANT to call another user by voice
SO THAT we can have a private real-time conversation

Acceptance Criteria:
- Can initiate call from contact profile or conversation
- See calling UI with ringtone indicator
- Call connects within reasonable time (< 5s typical)
- Can end call at any time
- Clear indication of E2EE status
```

### Callee Experience

```
AS a BuildIt user receiving a call
I WANT to be notified and accept/decline
SO THAT I control when I'm available

Acceptance Criteria:
- Incoming call notification (push on mobile)
- See caller identity (name, avatar)
- Accept or decline buttons
- Call connects quickly after accept
- Can end call at any time
```

### Call Quality

```
AS a user on a call
I WANT clear audio quality
SO THAT conversation is effective

Acceptance Criteria:
- Opus codec at appropriate bitrate
- Echo cancellation enabled
- Noise suppression available
- Graceful quality degradation on poor networks
- Reconnection on temporary network loss
```

---

## Part 1: Audio Pipeline

### 1.1 Codec Configuration

```typescript
// Opus is the standard for WebRTC voice
const audioConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    // Opus settings via SDP munging
    channelCount: 1,        // Mono for voice
    sampleRate: 48000,      // Opus native
  }
};

// SDP parameters for Opus
const opusParams = {
  maxaveragebitrate: 32000,   // 32 kbps for voice
  useinbandfec: 1,            // Forward error correction
  usedtx: 1,                  // Discontinuous transmission
  stereo: 0,                  // Mono
  sprop_stereo: 0
};
```

### 1.2 Audio Processing Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIO PROCESSING                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Microphone → AEC → AGC → NS → Opus Encode → E2EE → WebRTC      │
│                                                                  │
│  AEC: Acoustic Echo Cancellation                                 │
│       - Removes speaker audio picked up by mic                   │
│       - Critical for speakerphone/laptop use                     │
│                                                                  │
│  AGC: Automatic Gain Control                                     │
│       - Normalizes volume levels                                 │
│       - Handles quiet/loud speakers                              │
│                                                                  │
│  NS: Noise Suppression                                           │
│       - Reduces background noise                                 │
│       - Configurable aggressiveness                              │
│                                                                  │
│  Opus: Audio codec                                               │
│       - 6-510 kbps, we use ~32 kbps for voice                    │
│       - Built-in FEC for packet loss resilience                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Bandwidth Adaptation

```typescript
interface BandwidthAdapter {
  // Target bitrates based on network conditions
  readonly profiles: {
    excellent: { audio: 48000 },   // > 500 kbps available
    good: { audio: 32000 },        // 100-500 kbps
    fair: { audio: 24000 },        // 50-100 kbps
    poor: { audio: 16000 },        // < 50 kbps
  };

  // Adaptation triggers
  onPacketLoss(percentage: number): void;
  onJitterIncrease(ms: number): void;
  onBandwidthEstimate(bps: number): void;
}
```

---

## Part 2: Call Lifecycle

### 2.1 State Machine (Detailed)

```
┌─────────────────────────────────────────────────────────────────┐
│                 VOICE CALL STATE MACHINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                        ┌──────────┐                              │
│                        │   IDLE   │                              │
│                        └────┬─────┘                              │
│                             │                                    │
│            ┌────────────────┼────────────────┐                   │
│            │ initiateCall() │                │ incomingOffer()   │
│            ▼                │                ▼                   │
│      ┌───────────┐          │          ┌───────────┐             │
│      │ OFFERING  │          │          │ INCOMING  │             │
│      └─────┬─────┘          │          └─────┬─────┘             │
│            │                │                │                   │
│            │ remoteRinging  │                │ accept()/reject() │
│            ▼                │                ▼                   │
│      ┌───────────┐          │          ┌───────────┐             │
│      │  RINGING  │          │          │ ANSWERING │ ──reject──▶ │
│      └─────┬─────┘          │          └─────┬─────┘             │
│            │                │                │                   │
│            │ remoteAnswer   │                │ answerSent        │
│            ▼                ▼                ▼                   │
│      ┌─────────────────────────────────────────┐                 │
│      │              CONNECTING                  │                 │
│      │  - ICE candidate exchange               │                 │
│      │  - DTLS handshake                       │                 │
│      │  - E2EE key establishment               │                 │
│      └────────────────┬────────────────────────┘                 │
│                       │                                          │
│                       │ iceConnected                             │
│                       ▼                                          │
│      ┌─────────────────────────────────────────┐                 │
│      │              CONNECTED                   │                 │
│      │  - Audio flowing                        │                 │
│      │  - Quality monitoring                   │                 │
│      └────────────────┬────────────────────────┘                 │
│                       │                                          │
│         ┌─────────────┼─────────────┐                            │
│         │ hold()      │             │ iceDisconnected            │
│         ▼             │             ▼                            │
│   ┌──────────┐        │      ┌─────────────┐                     │
│   │ ON_HOLD  │        │      │ RECONNECTING│                     │
│   └────┬─────┘        │      └──────┬──────┘                     │
│        │ resume()     │             │                            │
│        └──────────────┤             │ iceReconnected             │
│                       │             └──────────────┐             │
│                       │                            │             │
│                       ▼                            │             │
│      ┌─────────────────────────────────────────┐  │             │
│      │               ENDED                      │◀─┘             │
│      │  reason: completed | rejected | busy |  │                 │
│      │          no_answer | network_failure |  │                 │
│      │          cancelled | timeout            │                 │
│      └─────────────────────────────────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Timeout Configuration

```typescript
const callTimeouts = {
  // How long to wait for remote to start ringing
  offerTimeout: 10_000,       // 10 seconds

  // How long to ring before giving up
  ringingTimeout: 45_000,     // 45 seconds

  // ICE connection establishment
  iceTimeout: 30_000,         // 30 seconds

  // Reconnection attempts
  reconnectTimeout: 60_000,   // 60 seconds
  reconnectInterval: 2_000,   // 2 seconds between attempts

  // Inactivity (no audio packets)
  inactivityTimeout: 120_000, // 2 minutes
};
```

### 2.3 Call Manager Implementation

```typescript
// clients/web/src/modules/calling/callManager.ts

export class CallManager extends EventEmitter {
  private currentCall: Call | null = null;
  private signaling: SignalingService;
  private rtc: RTCAdapter;

  async initiateCall(remotePubkey: string): Promise<Call> {
    if (this.currentCall) {
      throw new Error('Already in a call');
    }

    const callId = crypto.randomUUID();
    const call = new Call({
      id: callId,
      direction: 'outgoing',
      remotePubkey,
      state: 'offering'
    });

    this.currentCall = call;

    try {
      // 1. Get local media
      const stream = await this.rtc.getUserMedia({ audio: true });
      call.setLocalStream(stream);

      // 2. Create peer connection
      const pc = this.rtc.createPeerConnection(this.getIceConfig());
      call.setPeerConnection(pc);

      // 3. Add audio track
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // 4. Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await this.signaling.sendCallOffer({
        callId,
        sdp: offer.sdp!,
        callType: 'voice',
        timestamp: Date.now()
      }, remotePubkey);

      // 5. Set up ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.signaling.sendIceCandidate({
            callId,
            candidate: event.candidate.toJSON()
          }, remotePubkey);
        }
      };

      // 6. Start ringing timeout
      call.startRingingTimeout();

      return call;
    } catch (error) {
      call.end('network_failure');
      this.currentCall = null;
      throw error;
    }
  }

  async handleIncomingOffer(offer: CallOffer, senderPubkey: string): Promise<void> {
    if (this.currentCall) {
      // Already in a call, send busy
      await this.signaling.sendBusy(offer.callId, senderPubkey);
      return;
    }

    const call = new Call({
      id: offer.callId,
      direction: 'incoming',
      remotePubkey: senderPubkey,
      state: 'incoming'
    });

    this.currentCall = call;
    call.setRemoteOffer(offer);

    // Emit event for UI to show incoming call
    this.emit('incoming-call', call);
  }

  async acceptCall(): Promise<void> {
    const call = this.currentCall;
    if (!call || call.state !== 'incoming') {
      throw new Error('No incoming call to accept');
    }

    call.setState('answering');

    // 1. Get local media
    const stream = await this.rtc.getUserMedia({ audio: true });
    call.setLocalStream(stream);

    // 2. Create peer connection
    const pc = this.rtc.createPeerConnection(this.getIceConfig());
    call.setPeerConnection(pc);

    // 3. Add tracks
    stream.getAudioTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // 4. Set remote description
    await pc.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: call.remoteOffer!.sdp
    }));

    // 5. Create and send answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await this.signaling.sendCallAnswer({
      callId: call.id,
      sdp: answer.sdp!
    }, call.remotePubkey);

    // 6. ICE handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate({
          callId: call.id,
          candidate: event.candidate.toJSON()
        }, call.remotePubkey);
      }
    };

    call.setState('connecting');
  }

  async endCall(reason: CallEndReason = 'completed'): Promise<void> {
    const call = this.currentCall;
    if (!call) return;

    // Send hangup signal
    await this.signaling.sendHangup({
      callId: call.id,
      reason
    }, call.remotePubkey);

    call.end(reason);
    this.currentCall = null;
  }
}
```

---

## Part 3: Push Notifications

### 3.1 Notification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 INCOMING CALL NOTIFICATION                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Caller sends NIP-17 wrapped call-offer                       │
│                                                                  │
│  2. If recipient is online:                                      │
│     └─▶ Nostr subscription receives event                        │
│     └─▶ Show in-app incoming call UI                             │
│                                                                  │
│  3. If recipient is offline (mobile):                            │
│     └─▶ Push notification service receives from Nostr relay      │
│     └─▶ Sends high-priority push to device                       │
│     └─▶ Device wakes app                                         │
│     └─▶ Show system call UI (CallKit/ConnectionService)          │
│                                                                  │
│  Privacy consideration:                                          │
│  - Push payload should NOT contain caller identity               │
│  - App fetches call details after wake                           │
│  - Use "Incoming call" as generic notification                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 iOS CallKit Integration

```swift
// clients/ios/BuildIt/Modules/Calling/CallKitManager.swift

class CallKitManager: NSObject, CXProviderDelegate {
    private let provider: CXProvider
    private let callController = CXCallController()

    func reportIncomingCall(
        callId: UUID,
        callerPubkey: String,
        hasVideo: Bool
    ) async throws {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: callerPubkey)
        update.localizedCallerName = getContactName(for: callerPubkey)
        update.hasVideo = hasVideo
        update.supportsDTMF = false
        update.supportsHolding = true
        update.supportsGrouping = false
        update.supportsUngrouping = false

        try await provider.reportNewIncomingCall(with: callId, update: update)
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        // User answered via CallKit UI
        Task {
            try await CallManager.shared.acceptCall(action.callUUID)
            action.fulfill()
        }
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        // User ended via CallKit UI
        Task {
            try await CallManager.shared.endCall(action.callUUID)
            action.fulfill()
        }
    }
}
```

### 3.3 Android ConnectionService

```kotlin
// clients/android/app/src/main/java/network/buildit/calling/CallConnectionService.kt

class CallConnectionService : ConnectionService() {

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest
    ): Connection {
        val callId = request.extras.getString(EXTRA_CALL_ID)!!
        val callerPubkey = request.extras.getString(EXTRA_CALLER_PUBKEY)!!

        return CallConnection(callId, callerPubkey).apply {
            setCallerDisplayName(
                getContactName(callerPubkey),
                TelecomManager.PRESENTATION_ALLOWED
            )
            setAddress(
                Uri.fromParts("buildit", callerPubkey, null),
                TelecomManager.PRESENTATION_ALLOWED
            )
            setRinging()
        }
    }

    override fun onCreateOutgoingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest
    ): Connection {
        val calleePubkey = request.extras.getString(EXTRA_CALLEE_PUBKEY)!!

        return CallConnection(UUID.randomUUID().toString(), calleePubkey).apply {
            setDialing()
        }
    }
}
```

---

## Part 4: User Interface

### 4.1 Call UI Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    CALL UI STATES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OUTGOING CALL                    INCOMING CALL                  │
│  ┌─────────────────────┐          ┌─────────────────────┐        │
│  │                     │          │                     │        │
│  │      [Avatar]       │          │      [Avatar]       │        │
│  │                     │          │                     │        │
│  │    Contact Name     │          │    Contact Name     │        │
│  │    "Calling..."     │          │   "Incoming call"   │        │
│  │                     │          │                     │        │
│  │      [🔴 End]       │          │  [🔴 End] [🟢 Accept]│        │
│  │                     │          │                     │        │
│  └─────────────────────┘          └─────────────────────┘        │
│                                                                  │
│  CONNECTED                        ON HOLD                        │
│  ┌─────────────────────┐          ┌─────────────────────┐        │
│  │                     │          │                     │        │
│  │      [Avatar]       │          │      [Avatar]       │        │
│  │                     │          │                     │        │
│  │    Contact Name     │          │    Contact Name     │        │
│  │      02:34 🔒       │          │      "On Hold"      │        │
│  │                     │          │                     │        │
│  │ [🔇][📞][🔊][⏸️]    │          │     [▶️ Resume]     │        │
│  │      [🔴 End]       │          │      [🔴 End]       │        │
│  │                     │          │                     │        │
│  └─────────────────────┘          └─────────────────────┘        │
│                                                                  │
│  🔇 = Mute    📞 = Keypad (hidden for E2EE calls)               │
│  🔊 = Speaker  ⏸️ = Hold  🔒 = E2EE indicator                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Web Component Structure

```typescript
// clients/web/src/modules/calling/components/

CallScreen/
├── CallScreen.tsx          // Main container, state routing
├── OutgoingCall.tsx        // "Calling..." UI
├── IncomingCall.tsx        // Accept/Decline UI
├── ActiveCall.tsx          // Connected call controls
├── CallOnHold.tsx          // Hold state UI
├── CallEnded.tsx           // Post-call summary
├── CallQualityIndicator.tsx // Network quality display
├── E2EEBadge.tsx           // Encryption status
└── CallControls.tsx        // Mute, Speaker, Hold buttons

CallNotification/
├── IncomingCallBanner.tsx  // Desktop notification
└── CallToast.tsx           // Minimal notification

AudioVisualizer/
├── AudioLevel.tsx          // Speaking indicator
└── WaveformDisplay.tsx     // Optional visualization
```

### 4.3 Call Controls Implementation

```typescript
// clients/web/src/modules/calling/components/CallControls.tsx

interface CallControlsProps {
  call: Call;
  onMute: (muted: boolean) => void;
  onSpeaker: (enabled: boolean) => void;
  onHold: () => void;
  onEnd: () => void;
}

export function CallControls({ call, onMute, onSpeaker, onHold, onEnd }: CallControlsProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  const handleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    onMute(newMuted);
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <CallButton
        icon={isMuted ? MicOff : Mic}
        label={isMuted ? t('unmute') : t('mute')}
        active={isMuted}
        onClick={handleMute}
      />

      <CallButton
        icon={isSpeaker ? Volume2 : VolumeX}
        label={t('speaker')}
        active={isSpeaker}
        onClick={() => {
          setIsSpeaker(!isSpeaker);
          onSpeaker(!isSpeaker);
        }}
      />

      <CallButton
        icon={Pause}
        label={t('hold')}
        onClick={onHold}
        disabled={call.state !== 'connected'}
      />

      <CallButton
        icon={PhoneOff}
        label={t('end')}
        variant="destructive"
        onClick={onEnd}
      />
    </div>
  );
}
```

---

## Part 5: Call Quality & Reliability

### 5.1 Quality Monitoring

```typescript
interface CallQualityMetrics {
  // Network metrics
  roundTripTime: number;      // ms
  jitter: number;             // ms
  packetLoss: number;         // percentage 0-100

  // Audio metrics
  audioLevel: number;         // 0-1
  audioEnergy: number;        // dBFS

  // Connection info
  connectionType: 'direct' | 'relay';
  localCandidateType: string;
  remoteCandidateType: string;
}

class CallQualityMonitor {
  private interval: number | null = null;
  private metrics: CallQualityMetrics[] = [];

  start(pc: RTCPeerConnection, callback: (metrics: CallQualityMetrics) => void) {
    this.interval = setInterval(async () => {
      const stats = await pc.getStats();
      const metrics = this.parseStats(stats);
      this.metrics.push(metrics);
      callback(metrics);
    }, 1000);
  }

  getQualityLevel(metrics: CallQualityMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
    if (metrics.packetLoss > 10 || metrics.roundTripTime > 400) return 'poor';
    if (metrics.packetLoss > 5 || metrics.roundTripTime > 200) return 'fair';
    if (metrics.packetLoss > 2 || metrics.roundTripTime > 100) return 'good';
    return 'excellent';
  }
}
```

### 5.2 Reconnection Strategy

```typescript
class CallReconnectionManager {
  private reconnectAttempts = 0;
  private maxAttempts = 5;

  async handleDisconnection(call: Call): Promise<void> {
    call.setState('reconnecting');

    while (this.reconnectAttempts < this.maxAttempts) {
      this.reconnectAttempts++;

      try {
        // Try ICE restart
        const pc = call.peerConnection;
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);

        // Send new offer
        await this.signaling.sendCallOffer({
          callId: call.id,
          sdp: offer.sdp!,
          callType: 'voice',
          timestamp: Date.now(),
          isReconnect: true
        }, call.remotePubkey);

        // Wait for answer with timeout
        const answer = await this.waitForAnswer(call.id, 10000);
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: answer.sdp
        }));

        // Success!
        call.setState('connected');
        this.reconnectAttempts = 0;
        return;

      } catch (error) {
        console.log(`Reconnect attempt ${this.reconnectAttempts} failed`);
        await this.delay(2000 * this.reconnectAttempts); // Exponential backoff
      }
    }

    // All attempts failed
    call.end('network_failure');
  }
}
```

---

## Part 6: Platform-Specific Implementation

### 6.1 Implementation Matrix

| Feature | Web | Desktop | iOS | Android |
|---------|-----|---------|-----|---------|
| Audio capture | WebRTC API | WebRTC API | AVAudioSession | AudioRecord |
| Audio playback | Web Audio | Web Audio | AVAudioSession | AudioTrack |
| Echo cancellation | Browser AEC | Browser AEC | iOS AEC | Android AEC |
| Push notification | Web Push | Tauri notification | APNS | FCM |
| System call UI | N/A | N/A | CallKit | ConnectionService |
| Background audio | Limited | Full | Full | Full |
| Lock screen controls | N/A | N/A | CallKit | MediaSession |

### 6.2 iOS Audio Session

```swift
func configureAudioSession() throws {
    let session = AVAudioSession.sharedInstance()

    try session.setCategory(
        .playAndRecord,
        mode: .voiceChat,
        options: [
            .allowBluetooth,
            .allowBluetoothA2DP,
            .defaultToSpeaker
        ]
    )

    try session.setActive(true)
}
```

### 6.3 Android Audio Focus

```kotlin
fun requestAudioFocus(): Boolean {
    val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

    val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        .setOnAudioFocusChangeListener { focusChange ->
            when (focusChange) {
                AudioManager.AUDIOFOCUS_LOSS -> endCall()
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> holdCall()
                AudioManager.AUDIOFOCUS_GAIN -> resumeCall()
            }
        }
        .build()

    return audioManager.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
}
```

---

## Part 7: Testing

### 7.1 Test Scenarios

**Unit Tests**:
- [ ] Call state machine transitions
- [ ] Audio constraint generation
- [ ] Quality metrics parsing
- [ ] Timeout handling

**Integration Tests**:
- [ ] Full call flow (offer → answer → connected → ended)
- [ ] Mute/unmute during call
- [ ] Hold/resume
- [ ] Reconnection after network drop
- [ ] Proper cleanup on call end

**E2E Tests**:
- [ ] Web ↔ Web voice call
- [ ] Call quality acceptable on various network conditions
- [ ] Push notification wakes mobile app
- [ ] CallKit/ConnectionService integration

### 7.2 Network Simulation

```typescript
// Test with various network conditions
const networkProfiles = {
  '4G': { bandwidth: 10_000_000, latency: 50, packetLoss: 0.1 },
  '3G': { bandwidth: 1_500_000, latency: 100, packetLoss: 1 },
  'Edge': { bandwidth: 250_000, latency: 300, packetLoss: 5 },
  'Lossy': { bandwidth: 5_000_000, latency: 50, packetLoss: 10 },
};
```

---

## Implementation Tasks

### Phase 1: Core Audio
- [ ] Audio capture/playback abstraction
- [ ] Echo cancellation verification
- [ ] Opus codec configuration
- [ ] Audio level monitoring

### Phase 2: Call Flow
- [ ] CallManager implementation (web)
- [ ] Signaling integration with NIP-17
- [ ] State machine with all transitions
- [ ] Timeout handling

### Phase 3: UI
- [ ] Incoming call screen
- [ ] Outgoing call screen
- [ ] Active call controls
- [ ] Call quality indicator
- [ ] E2EE badge

### Phase 4: Mobile Integration
- [ ] iOS CallKit integration
- [ ] iOS audio session handling
- [ ] Android ConnectionService
- [ ] Android audio focus
- [ ] Push notification for incoming calls

### Phase 5: Reliability
- [ ] Reconnection logic
- [ ] Quality monitoring
- [ ] Graceful degradation
- [ ] Call history persistence

---

## Success Criteria

- [ ] Can make voice call between any two BuildIt users
- [ ] Call quality acceptable on 3G networks
- [ ] E2EE verified (encryption badge shown)
- [ ] Mobile devices ring for incoming calls
- [ ] Calls survive brief network interruptions
- [ ] All platforms have feature parity

## Open Questions

1. Maximum call duration limit? (for resource management)
2. Do-not-disturb integration strategy?
3. Call history retention period?
4. Should we show caller ID for unknown numbers?
