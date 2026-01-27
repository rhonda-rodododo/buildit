# Epic 3: 1:1 Video Calls

> Face-to-face encrypted video communication

## Overview

Extend voice calling with video capabilities, including camera switching, screen sharing, and bandwidth-adaptive quality.

## Dependencies

- **Epic 2**: 1:1 Voice Calls (call infrastructure, signaling, UI patterns)

## Unlocks

- Epic 4: Small Group Calls (with video)
- Epic 5: Conference Infrastructure
- Epic 6: Conference Features (screen sharing patterns)

---

## User Stories

### Video Calling

```
AS a BuildIt user
I WANT to make video calls
SO THAT I can see the person I'm communicating with

Acceptance Criteria:
- Can start call as video or upgrade voice to video
- Local preview shows my camera
- Remote video displays clearly
- Can toggle camera on/off mid-call
- E2EE applies to video as well as audio
```

### Camera Controls

```
AS a user on a video call
I WANT to control my camera
SO THAT I have privacy control

Acceptance Criteria:
- Can switch front/back camera (mobile)
- Can turn camera off (audio-only)
- Can blur background (optional enhancement)
- Camera off state clearly communicated to remote
```

### Screen Sharing

```
AS a user needing to share content
I WANT to share my screen
SO THAT I can collaborate visually

Acceptance Criteria:
- Can share entire screen or specific window
- Remote sees shared content clearly
- Can stop sharing and return to camera
- Audio can optionally be shared (system audio)
```

---

## Part 1: Video Pipeline

### 1.1 Codec Selection

```typescript
// Video codec preference order
const videoCodecPreference = [
  'video/AV1',    // Best compression, newer
  'video/VP9',    // Good compression, widely supported
  'video/VP8',    // Fallback, universal support
  'video/H264',   // Hardware acceleration common
];

// Apply codec preference to SDP
function setCodecPreference(sdp: string, codecs: string[]): string {
  // Reorder m=video line codec list
  // Implementation varies by platform
}
```

### 1.2 Resolution Profiles

```typescript
const videoProfiles = {
  high: {
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 2_500_000,  // 2.5 Mbps
  },
  medium: {
    width: 640,
    height: 480,
    frameRate: 30,
    bitrate: 1_000_000,  // 1 Mbps
  },
  low: {
    width: 320,
    height: 240,
    frameRate: 15,
    bitrate: 300_000,    // 300 kbps
  },
  minimal: {
    width: 160,
    height: 120,
    frameRate: 10,
    bitrate: 100_000,    // 100 kbps
  }
};
```

### 1.3 Adaptive Bitrate

```
┌─────────────────────────────────────────────────────────────────┐
│                 ADAPTIVE VIDEO QUALITY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Available Bandwidth        Target Resolution    Target Bitrate  │
│  ─────────────────────────────────────────────────────────────   │
│  > 3 Mbps                   720p @ 30fps         2.5 Mbps        │
│  1.5 - 3 Mbps               480p @ 30fps         1.0 Mbps        │
│  500 kbps - 1.5 Mbps        240p @ 15fps         300 kbps        │
│  < 500 kbps                 Audio only           32 kbps         │
│                                                                  │
│  Adaptation triggers:                                            │
│  - Bandwidth estimation change                                   │
│  - Packet loss > 5%                                              │
│  - Encoder overload (CPU)                                        │
│  - Explicit user request                                         │
│                                                                  │
│  Smoothing: Don't oscillate rapidly. Hold new quality for        │
│  at least 10 seconds before reconsidering.                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Simulcast (Future Enhancement)

```typescript
// Send multiple quality layers, receiver selects
const simulcastConfig = {
  encodings: [
    { rid: 'low', maxBitrate: 150_000, scaleResolutionDownBy: 4 },
    { rid: 'medium', maxBitrate: 500_000, scaleResolutionDownBy: 2 },
    { rid: 'high', maxBitrate: 2_000_000 },
  ]
};

// Useful for group calls where SFU selects quality per receiver
```

---

## Part 2: Camera Management

### 2.1 Device Enumeration

```typescript
interface CameraDevice {
  deviceId: string;
  label: string;
  facing: 'user' | 'environment' | 'unknown';
}

async function enumerateCameras(): Promise<CameraDevice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter(d => d.kind === 'videoinput')
    .map(d => ({
      deviceId: d.deviceId,
      label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
      facing: inferFacing(d.label),
    }));
}

function inferFacing(label: string): 'user' | 'environment' | 'unknown' {
  const lower = label.toLowerCase();
  if (lower.includes('front') || lower.includes('user') || lower.includes('facetime')) {
    return 'user';
  }
  if (lower.includes('back') || lower.includes('rear') || lower.includes('environment')) {
    return 'environment';
  }
  return 'unknown';
}
```

### 2.2 Camera Switching

```typescript
class VideoManager {
  private currentCameraId: string | null = null;
  private localStream: MediaStream | null = null;

  async switchCamera(deviceId: string): Promise<void> {
    if (this.currentCameraId === deviceId) return;

    // Get new stream
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false, // Keep existing audio track
    });

    // Replace track in peer connection
    const newTrack = newStream.getVideoTracks()[0];
    const sender = this.peerConnection
      .getSenders()
      .find(s => s.track?.kind === 'video');

    if (sender) {
      await sender.replaceTrack(newTrack);
    }

    // Stop old track
    this.localStream?.getVideoTracks().forEach(t => t.stop());

    // Update state
    this.localStream = newStream;
    this.currentCameraId = deviceId;
  }

  async toggleCamera(enabled: boolean): Promise<void> {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled;
    }

    // Notify remote of camera state
    await this.signaling.sendCameraState({
      callId: this.callId,
      cameraEnabled: enabled,
    });
  }
}
```

### 2.3 Mobile Camera Handling

```swift
// iOS: Switch between front and back cameras
func switchCamera() {
    guard let currentInput = captureSession.inputs.first as? AVCaptureDeviceInput else { return }

    let newPosition: AVCaptureDevice.Position = currentInput.device.position == .front ? .back : .front

    guard let newDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: newPosition),
          let newInput = try? AVCaptureDeviceInput(device: newDevice) else { return }

    captureSession.beginConfiguration()
    captureSession.removeInput(currentInput)
    captureSession.addInput(newInput)
    captureSession.commitConfiguration()

    // Update WebRTC track
    updateVideoSource(with: newDevice)
}
```

---

## Part 3: Screen Sharing

### 3.1 Screen Capture API

```typescript
interface ScreenShareOptions {
  video: {
    displaySurface?: 'monitor' | 'window' | 'browser';
    logicalSurface?: boolean;
    cursor?: 'always' | 'motion' | 'never';
  };
  audio?: boolean;  // System audio capture
  selfBrowserSurface?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
  systemAudio?: 'include' | 'exclude';
}

async function startScreenShare(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'monitor',
      cursor: 'always',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: true,  // Request system audio if available
  });

  // Handle user stopping share via browser UI
  stream.getVideoTracks()[0].onended = () => {
    this.stopScreenShare();
  };

  return stream;
}
```

### 3.2 Screen Share Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 SCREEN SHARE FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User clicks "Share Screen"                                   │
│     └─▶ Browser shows screen picker dialog                       │
│                                                                  │
│  2. User selects screen/window                                   │
│     └─▶ getDisplayMedia() returns stream                         │
│                                                                  │
│  3. Replace or add video track                                   │
│     ├─▶ Option A: Replace camera track (exclusive)               │
│     └─▶ Option B: Add second video track (camera + screen)       │
│                                                                  │
│  4. Signal to remote that screen share is active                 │
│     └─▶ Remote UI shows "Screen" label on video                  │
│                                                                  │
│  5. User stops sharing (or closes shared window)                 │
│     ├─▶ Stop screen track                                        │
│     ├─▶ Restore camera track (if was replaced)                   │
│     └─▶ Signal screen share ended                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Screen Share State

```typescript
interface ScreenShareState {
  isSharing: boolean;
  shareType: 'screen' | 'window' | 'tab' | null;
  hasAudio: boolean;
  sharedBy: 'local' | 'remote';
}

// Signaling for screen share state
interface ScreenShareEvent {
  callId: string;
  action: 'start' | 'stop';
  shareType?: 'screen' | 'window' | 'tab';
  hasAudio?: boolean;
}
```

### 3.4 Mobile Screen Share

```swift
// iOS: Use ReplayKit for screen sharing
import ReplayKit

func startScreenShare() async throws {
    let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 50, height: 50))
    picker.preferredExtension = "network.buildit.broadcast"
    picker.showsMicrophoneButton = false

    // Trigger the picker
    for subview in picker.subviews {
        if let button = subview as? UIButton {
            button.sendActions(for: .touchUpInside)
        }
    }
}
```

---

## Part 4: Video UI

### 4.1 Layout Patterns

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIDEO CALL LAYOUTS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STANDARD (both cameras on)         SCREEN SHARE                 │
│  ┌─────────────────────────┐        ┌─────────────────────────┐  │
│  │                         │        │                         │  │
│  │                         │        │     Shared Screen       │  │
│  │     Remote Video        │        │        (large)          │  │
│  │                         │        │                         │  │
│  │   ┌─────────┐           │        │   ┌─────────┐           │  │
│  │   │  Local  │           │        │   │ Remote  │           │  │
│  │   │ Preview │           │        │   │  Video  │           │  │
│  │   └─────────┘           │        │   └─────────┘           │  │
│  └─────────────────────────┘        └─────────────────────────┘  │
│                                                                  │
│  CAMERA OFF                         AUDIO ONLY                   │
│  ┌─────────────────────────┐        ┌─────────────────────────┐  │
│  │                         │        │                         │  │
│  │                         │        │      ┌───────────┐      │  │
│  │      [Avatar]           │        │      │ [Avatar]  │      │  │
│  │       Camera off        │        │      └───────────┘      │  │
│  │                         │        │       Contact Name      │  │
│  │   ┌─────────┐           │        │         02:34           │  │
│  │   │  Local  │           │        │                         │  │
│  │   │ Preview │           │        │                         │  │
│  │   └─────────┘           │        └─────────────────────────┘  │
│  └─────────────────────────┘                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Video Components

```typescript
// clients/web/src/modules/calling/components/video/

VideoCall/
├── VideoCall.tsx           // Main video call container
├── RemoteVideo.tsx         // Remote video stream display
├── LocalPreview.tsx        // Self-view (draggable pip)
├── ScreenShareView.tsx     // Full-screen share display
├── VideoControls.tsx       // Camera, screen share buttons
├── CameraSwitcher.tsx      // Camera selection dropdown
└── VideoPlaceholder.tsx    // Avatar when camera off

// Video rendering component
interface VideoStreamProps {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  fit?: 'cover' | 'contain';
  placeholder?: React.ReactNode;
}

function VideoStream({ stream, muted, mirror, fit, placeholder }: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) {
    return <div className="video-placeholder">{placeholder}</div>;
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={cn(
        'w-full h-full object-cover',
        mirror && 'scale-x-[-1]',
        fit === 'contain' && 'object-contain'
      )}
    />
  );
}
```

### 4.3 Picture-in-Picture Local Preview

```typescript
function LocalPreview({ stream, position, onDrag }: LocalPreviewProps) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Draggable
      position={position}
      onDrag={(e, data) => {
        setIsDragging(true);
        onDrag({ x: data.x, y: data.y });
      }}
      onStop={() => setIsDragging(false)}
      bounds="parent"
    >
      <div
        className={cn(
          'absolute w-32 h-24 rounded-lg overflow-hidden shadow-lg',
          'border-2 border-white/20',
          'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-80'
        )}
      >
        <VideoStream
          stream={stream}
          muted // Always mute local preview
          mirror // Mirror for natural self-view
        />
      </div>
    </Draggable>
  );
}
```

---

## Part 5: Video Controls

### 5.1 Control Bar

```typescript
interface VideoControlsProps {
  call: VideoCall;
  isCameraOn: boolean;
  isMuted: boolean;
  isScreenSharing: boolean;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onToggleScreenShare: () => void;
  onSwitchCamera: () => void;
  onEndCall: () => void;
}

function VideoControls({
  call,
  isCameraOn,
  isMuted,
  isScreenSharing,
  onToggleCamera,
  onToggleMute,
  onToggleScreenShare,
  onSwitchCamera,
  onEndCall,
}: VideoControlsProps) {
  const cameras = useCameras();
  const hasMultipleCameras = cameras.length > 1;

  return (
    <div className="flex items-center justify-center gap-2 p-4 bg-black/50">
      {/* Mute */}
      <ControlButton
        icon={isMuted ? MicOff : Mic}
        active={isMuted}
        onClick={onToggleMute}
        tooltip={isMuted ? t('unmute') : t('mute')}
      />

      {/* Camera */}
      <ControlButton
        icon={isCameraOn ? Video : VideoOff}
        active={!isCameraOn}
        onClick={onToggleCamera}
        tooltip={isCameraOn ? t('camera_off') : t('camera_on')}
      />

      {/* Switch Camera (mobile) */}
      {hasMultipleCameras && (
        <ControlButton
          icon={SwitchCamera}
          onClick={onSwitchCamera}
          tooltip={t('switch_camera')}
        />
      )}

      {/* Screen Share (desktop) */}
      {!isMobile() && (
        <ControlButton
          icon={isScreenSharing ? MonitorOff : Monitor}
          active={isScreenSharing}
          onClick={onToggleScreenShare}
          tooltip={isScreenSharing ? t('stop_sharing') : t('share_screen')}
        />
      )}

      {/* End Call */}
      <ControlButton
        icon={PhoneOff}
        variant="destructive"
        onClick={onEndCall}
        tooltip={t('end_call')}
      />
    </div>
  );
}
```

### 5.2 Gesture Controls (Mobile)

```typescript
// Double-tap to switch camera
// Pinch to zoom (if supported)
// Swipe to toggle PiP position

function useVideoGestures(videoRef: RefObject<HTMLVideoElement>) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const hammer = new Hammer(video);

    // Double tap to switch camera
    hammer.on('doubletap', () => {
      switchCamera();
    });

    // Pinch to zoom
    hammer.get('pinch').set({ enable: true });
    hammer.on('pinch', (e) => {
      if (e.scale > 1.5) {
        setZoomLevel(Math.min(zoomLevel + 0.5, 3));
      } else if (e.scale < 0.7) {
        setZoomLevel(Math.max(zoomLevel - 0.5, 1));
      }
    });

    return () => hammer.destroy();
  }, []);
}
```

---

## Part 6: Voice-to-Video Upgrade

### 6.1 Mid-Call Video Toggle

```typescript
// Upgrade voice call to video
async function addVideoToCall(call: Call): Promise<void> {
  // 1. Get video stream
  const videoStream = await navigator.mediaDevices.getUserMedia({
    video: videoConstraints,
  });

  // 2. Add video track to peer connection
  const videoTrack = videoStream.getVideoTracks()[0];
  call.peerConnection.addTrack(videoTrack, call.localStream);

  // 3. Signal video capability to remote
  await signaling.sendVideoEnabled({
    callId: call.id,
    enabled: true,
  });

  // 4. Renegotiate (createOffer with new track)
  const offer = await call.peerConnection.createOffer();
  await call.peerConnection.setLocalDescription(offer);

  await signaling.sendCallOffer({
    callId: call.id,
    sdp: offer.sdp!,
    callType: 'video',
    timestamp: Date.now(),
    isRenegotiation: true,
  }, call.remotePubkey);
}
```

### 6.2 Video Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              VOICE → VIDEO UPGRADE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User A (voice call)              User B (voice call)            │
│       │                                  │                       │
│       │ clicks "Turn on camera"          │                       │
│       │                                  │                       │
│       │──── video-request ──────────────▶│                       │
│       │     "A wants to turn on video"   │                       │
│       │                                  │                       │
│       │                        Shows prompt:                     │
│       │                        "A wants video. Allow?"           │
│       │                                  │                       │
│       │◀─── video-accept ────────────────│ User accepts          │
│       │                                  │                       │
│       │  Both add video tracks           │                       │
│       │  Renegotiate SDP                 │                       │
│       │                                  │                       │
│       │══════ Video flowing ═════════════│                       │
│                                                                  │
│  Alternative: Auto-accept if both have video enabled in prefs    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 7: E2EE for Video

### 7.1 Video Frame Encryption

```typescript
// Encrypt video frames using Insertable Streams
// Same pattern as audio, but video has keyframes

function createVideoEncryptor(callKey: CryptoKey) {
  let frameCounter = 0;

  return new TransformStream({
    transform: async (frame: RTCEncodedVideoFrame, controller) => {
      // Don't encrypt frame metadata (needed for decoding)
      const metadata = frame.getMetadata();
      const isKeyFrame = metadata.frameType === 'key';

      // Generate IV from frame counter (prevents IV reuse)
      const iv = new Uint8Array(12);
      new DataView(iv.buffer).setBigUint64(0, BigInt(frameCounter++));

      // Encrypt frame data
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        callKey,
        frame.data
      );

      // Prepend IV + keyframe marker
      const output = new Uint8Array(1 + iv.length + encrypted.byteLength);
      output[0] = isKeyFrame ? 1 : 0;
      output.set(iv, 1);
      output.set(new Uint8Array(encrypted), 1 + iv.length);

      frame.data = output.buffer;
      controller.enqueue(frame);
    }
  });
}
```

### 7.2 Key Frame Handling

```
┌─────────────────────────────────────────────────────────────────┐
│              KEY FRAME CONSIDERATIONS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Video codecs use I-frames (keyframes) and P/B-frames:           │
│                                                                  │
│  I-frame: Complete image, can be decoded independently           │
│  P-frame: Only changes from previous frame                       │
│  B-frame: Changes from previous and next frames                  │
│                                                                  │
│  For E2EE:                                                       │
│  - Must handle packet loss gracefully                            │
│  - If keyframe is lost, request new one (PLI)                    │
│  - Encryption must preserve frame boundaries                     │
│                                                                  │
│  Keyframe interval: ~2 seconds (default)                         │
│  - More frequent = faster recovery, more bandwidth               │
│  - Less frequent = better compression, slower recovery           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 8: Platform-Specific

### 8.1 iOS Video

```swift
// Camera capture with WebRTC
class VideoCapturer: NSObject, RTCVideoCapturerDelegate {
    private let capturer: RTCCameraVideoCapturer
    private let source: RTCVideoSource

    func startCapture(position: AVCaptureDevice.Position) {
        guard let device = findCamera(position: position) else { return }

        let format = selectFormat(for: device)
        let fps = selectFPS(for: format)

        capturer.startCapture(with: device, format: format, fps: fps)
    }

    private func selectFormat(for device: AVCaptureDevice) -> AVCaptureDevice.Format {
        // Prefer 720p for quality/bandwidth balance
        let targetWidth: Int32 = 1280
        let targetHeight: Int32 = 720

        return device.formats
            .filter { format in
                let dimensions = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
                return dimensions.width <= targetWidth && dimensions.height <= targetHeight
            }
            .max { a, b in
                let aDim = CMVideoFormatDescriptionGetDimensions(a.formatDescription)
                let bDim = CMVideoFormatDescriptionGetDimensions(b.formatDescription)
                return aDim.width * aDim.height < bDim.width * bDim.height
            } ?? device.formats.first!
    }
}
```

### 8.2 Android Video

```kotlin
// Camera2 integration with WebRTC
class VideoCaptureController(
    private val context: Context,
    private val eglBase: EglBase
) {
    private var videoCapturer: CameraVideoCapturer? = null
    private var videoSource: VideoSource? = null

    fun startCapture(useFrontCamera: Boolean = true) {
        val capturer = createCameraCapturer(useFrontCamera)
        val surfaceTextureHelper = SurfaceTextureHelper.create(
            "CaptureThread",
            eglBase.eglBaseContext
        )

        videoSource = peerConnectionFactory.createVideoSource(capturer.isScreencast)
        capturer.initialize(
            surfaceTextureHelper,
            context,
            videoSource!!.capturerObserver
        )

        // Start at 720p 30fps
        capturer.startCapture(1280, 720, 30)
        videoCapturer = capturer
    }

    fun switchCamera() {
        (videoCapturer as? CameraVideoCapturer)?.switchCamera(null)
    }

    private fun createCameraCapturer(useFront: Boolean): CameraVideoCapturer {
        val camera2Enumerator = Camera2Enumerator(context)
        val deviceNames = camera2Enumerator.deviceNames

        val targetDevice = deviceNames.find { name ->
            val isFront = camera2Enumerator.isFrontFacing(name)
            if (useFront) isFront else !isFront
        } ?: deviceNames.first()

        return camera2Enumerator.createCapturer(targetDevice, null)
    }
}
```

---

## Implementation Tasks

### Phase 1: Video Basics
- [ ] Video constraints configuration
- [ ] Camera enumeration and selection
- [ ] Local video preview component
- [ ] Remote video display component

### Phase 2: Camera Controls
- [ ] Camera toggle (on/off)
- [ ] Camera switching (front/back)
- [ ] Video state signaling
- [ ] Placeholder for camera-off state

### Phase 3: Screen Sharing
- [ ] getDisplayMedia integration
- [ ] Screen share UI (start/stop)
- [ ] Track replacement logic
- [ ] Screen share state signaling

### Phase 4: Video UI
- [ ] Video call layout (remote + local pip)
- [ ] Screen share layout
- [ ] Video controls bar
- [ ] Mobile gesture controls

### Phase 5: Voice↔Video
- [ ] Upgrade voice to video
- [ ] Video request/accept flow
- [ ] Downgrade video to voice
- [ ] Bandwidth adaptation

### Phase 6: Platform Integration
- [ ] iOS RTCCameraVideoCapturer
- [ ] Android Camera2 integration
- [ ] Desktop screen capture
- [ ] Mobile screen share (broadcast extension)

---

## Success Criteria

- [ ] Video calls work with acceptable quality (720p on good network)
- [ ] Camera switching works on mobile
- [ ] Screen sharing works on desktop
- [ ] Video is E2EE (verified with test)
- [ ] Graceful degradation on poor networks
- [ ] All platforms have video calling

## Open Questions

1. Should we support virtual backgrounds? (CPU intensive)
2. Screen share audio on mobile possible?
3. Maximum video resolution to support? (1080p? 4K?)
4. Should camera-off show avatar or black screen?
