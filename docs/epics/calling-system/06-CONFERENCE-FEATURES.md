# Epic 6: Conference Features

> Advanced meeting capabilities: breakouts, moderation, recording, and collaboration

## Overview

Build rich conferencing features on top of the SFU infrastructure. These features transform basic group calling into a full collaboration platform suitable for assemblies, trainings, and large organizational meetings.

## Dependencies

- **Epic 5**: Conference Infrastructure (SFU, room management)

## Unlocks

- Epic 7: Hotline Calling (queue management patterns)

---

## Feature Matrix

| Feature | Priority | Complexity | Privacy Impact |
|---------|----------|------------|----------------|
| Breakout Rooms | High | Medium | Low |
| Host/Moderator Controls | High | Low | Low |
| Waiting Room | High | Low | Low |
| Screen Sharing | High | Done (Epic 3) | Low |
| Reactions | Medium | Low | Low |
| Hand Raising | Medium | Low | Low |
| Polls/Voting | Medium | Medium | Medium* |
| Whiteboard | Medium | High | Low |
| Local Recording | Medium | Medium | Low |
| Live Transcription | Low | High | High** |
| Virtual Backgrounds | Low | Medium | Low |
| Server Recording | Low | Medium | High*** |

*Polls need careful design for anonymous voting
**Transcription processes audio content
***Server recording breaks E2EE guarantee

---

## Part 1: Breakout Rooms

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 BREAKOUT ROOM ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Room                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Participants: A, B, C, D, E, F, G, H, I, J             │    │
│  │  Host: A                                                 │    │
│  │  MLS Group Key: K_main                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Host creates 3 breakout rooms:                                  │
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │  Breakout 1   │  │  Breakout 2   │  │  Breakout 3   │        │
│  │  B, C, D      │  │  E, F, G      │  │  H, I, J      │        │
│  │  Key: K_br1   │  │  Key: K_br2   │  │  Key: K_br3   │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
│                                                                  │
│  Host A can "visit" any breakout (joins that room temporarily)   │
│                                                                  │
│  Implementation options:                                         │
│  A) Separate SFU rooms (cleaner isolation, more overhead)        │
│  B) Same SFU room with media routing rules (complex)             │
│                                                                  │
│  Recommendation: Option A - separate rooms with navigation       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Breakout Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://buildit.network/schemas/calling/v1/breakout-config.json",
  "title": "BreakoutConfig",
  "type": "object",
  "required": ["mainRoomId", "breakouts", "duration", "createdBy"],
  "properties": {
    "mainRoomId": {
      "type": "string",
      "format": "uuid"
    },
    "breakouts": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/BreakoutRoom"
      },
      "minItems": 2,
      "maxItems": 50
    },
    "duration": {
      "type": "integer",
      "description": "Duration in seconds (0 = unlimited)",
      "minimum": 0
    },
    "autoAssign": {
      "type": "boolean",
      "description": "Randomly assign unassigned participants"
    },
    "allowSelfSelect": {
      "type": "boolean",
      "description": "Participants can choose their room"
    },
    "createdBy": {
      "type": "string"
    },
    "createdAt": {
      "type": "integer"
    }
  },
  "$defs": {
    "BreakoutRoom": {
      "type": "object",
      "required": ["id", "name"],
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid"
        },
        "name": {
          "type": "string"
        },
        "participants": {
          "type": "array",
          "items": { "type": "string" }
        },
        "capacity": {
          "type": "integer",
          "minimum": 1
        }
      }
    }
  }
}
```

### 1.3 Breakout Manager

```typescript
class BreakoutManager {
  private mainRoom: ConferenceRoom;
  private breakouts: Map<string, ConferenceRoom> = new Map();
  private assignments: Map<string, string> = new Map();  // participant -> breakout

  async createBreakouts(config: BreakoutConfig): Promise<void> {
    // Validate host permissions
    if (!this.isHost()) {
      throw new Error('Only host can create breakouts');
    }

    // Create each breakout as a separate room
    for (const breakout of config.breakouts) {
      const room = await this.roomManager.createRoom({
        name: breakout.name,
        parentRoomId: this.mainRoom.id,
        maxParticipants: breakout.capacity ?? 20,
        settings: {
          ...this.mainRoom.settings,
          isBreakout: true,
        },
      });

      this.breakouts.set(breakout.id, room);

      // Pre-assign participants
      for (const pubkey of breakout.participants ?? []) {
        this.assignments.set(pubkey, breakout.id);
      }
    }

    // Auto-assign remaining participants if enabled
    if (config.autoAssign) {
      this.autoAssignParticipants();
    }

    // Broadcast breakout configuration to all participants
    await this.signaling.broadcastBreakoutConfig(config);

    // Start timer if duration set
    if (config.duration > 0) {
      this.startBreakoutTimer(config.duration);
    }
  }

  async moveToBreakout(breakoutId: string): Promise<void> {
    const breakout = this.breakouts.get(breakoutId);
    if (!breakout) throw new Error('Breakout not found');

    // Leave main room (but stay "linked")
    await this.mainRoom.disconnect({ keepLinked: true });

    // Join breakout room
    const token = await this.getBreakoutToken(breakoutId);
    await breakout.connect(token);

    // Get new MLS key for breakout
    await this.mlsManager.joinGroup(breakoutId);
  }

  async returnToMain(): Promise<void> {
    // Leave current breakout
    const currentBreakout = this.getCurrentBreakout();
    if (currentBreakout) {
      await currentBreakout.disconnect();
    }

    // Rejoin main room
    const token = await this.getMainRoomToken();
    await this.mainRoom.connect(token);

    // Restore main room MLS keys
    await this.mlsManager.rejoinGroup(this.mainRoom.id);
  }

  async endBreakouts(): Promise<void> {
    // Broadcast 60-second warning
    await this.signaling.broadcastBreakoutEnding(60);

    await this.delay(60_000);

    // Move everyone back to main
    await this.signaling.broadcastReturnToMain();

    // Close breakout rooms
    for (const [id, room] of this.breakouts) {
      await room.close();
    }
    this.breakouts.clear();
  }
}
```

### 1.4 Breakout UI

```typescript
// Host view: Create and manage breakouts
function BreakoutHostPanel({ participants, onCreateBreakouts }: BreakoutHostPanelProps) {
  const [numRooms, setNumRooms] = useState(3);
  const [assignments, setAssignments] = useState<Map<string, number>>(new Map());
  const [duration, setDuration] = useState(10);  // minutes

  const handleAutoAssign = () => {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const perRoom = Math.ceil(shuffled.length / numRooms);

    const newAssignments = new Map<string, number>();
    shuffled.forEach((p, i) => {
      newAssignments.set(p.pubkey, Math.floor(i / perRoom));
    });
    setAssignments(newAssignments);
  };

  return (
    <Panel title={t('breakout_rooms')}>
      <div className="space-y-4">
        <div>
          <Label>{t('number_of_rooms')}</Label>
          <Slider value={numRooms} onChange={setNumRooms} min={2} max={10} />
        </div>

        <div>
          <Label>{t('duration_minutes')}</Label>
          <Input type="number" value={duration} onChange={setDuration} />
        </div>

        <Button onClick={handleAutoAssign}>
          {t('auto_assign')}
        </Button>

        {/* Room assignment grid */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: numRooms }).map((_, i) => (
            <BreakoutRoomCard
              key={i}
              roomNumber={i + 1}
              participants={participants.filter(p => assignments.get(p.pubkey) === i)}
              onDrop={(pubkey) => setAssignments(prev => new Map(prev).set(pubkey, i))}
            />
          ))}
        </div>

        <Button
          variant="primary"
          onClick={() => onCreateBreakouts({ numRooms, assignments, duration })}
        >
          {t('open_breakouts')}
        </Button>
      </div>
    </Panel>
  );
}
```

---

## Part 2: Moderation Controls

### 2.1 Role System

```typescript
type ConferenceRole = 'host' | 'co-host' | 'moderator' | 'participant' | 'viewer';

interface RolePermissions {
  canSpeak: boolean;
  canVideo: boolean;
  canScreenShare: boolean;
  canChat: boolean;
  canMuteOthers: boolean;
  canRemoveParticipants: boolean;
  canManageBreakouts: boolean;
  canRecord: boolean;
  canEndMeeting: boolean;
  canPromoteOthers: boolean;
}

const rolePermissions: Record<ConferenceRole, RolePermissions> = {
  host: {
    canSpeak: true,
    canVideo: true,
    canScreenShare: true,
    canChat: true,
    canMuteOthers: true,
    canRemoveParticipants: true,
    canManageBreakouts: true,
    canRecord: true,
    canEndMeeting: true,
    canPromoteOthers: true,
  },
  'co-host': {
    canSpeak: true,
    canVideo: true,
    canScreenShare: true,
    canChat: true,
    canMuteOthers: true,
    canRemoveParticipants: true,
    canManageBreakouts: true,
    canRecord: false,
    canEndMeeting: false,
    canPromoteOthers: true,
  },
  moderator: {
    canSpeak: true,
    canVideo: true,
    canScreenShare: true,
    canChat: true,
    canMuteOthers: true,
    canRemoveParticipants: false,
    canManageBreakouts: false,
    canRecord: false,
    canEndMeeting: false,
    canPromoteOthers: false,
  },
  participant: {
    canSpeak: true,
    canVideo: true,
    canScreenShare: true,
    canChat: true,
    canMuteOthers: false,
    canRemoveParticipants: false,
    canManageBreakouts: false,
    canRecord: false,
    canEndMeeting: false,
    canPromoteOthers: false,
  },
  viewer: {
    canSpeak: false,
    canVideo: false,
    canScreenShare: false,
    canChat: true,
    canMuteOthers: false,
    canRemoveParticipants: false,
    canManageBreakouts: false,
    canRecord: false,
    canEndMeeting: false,
    canPromoteOthers: false,
  },
};
```

### 2.2 Mute Controls

```typescript
class ModerationManager {
  // Request participant to mute (soft mute)
  async requestMute(participantId: string): Promise<void> {
    await this.signaling.sendMuteRequest({
      roomId: this.roomId,
      targetParticipant: participantId,
      requestedBy: this.localParticipantId,
      type: 'request',
    });

    // UI shows: "Moderator requested you to mute"
    // Participant can comply or ignore
  }

  // Mute all participants except host/moderators
  async muteAll(): Promise<void> {
    await this.signaling.broadcastMuteAll({
      roomId: this.roomId,
      exceptRoles: ['host', 'co-host', 'moderator'],
    });
  }

  // Disable ability to unmute (webinar mode)
  async lockAudio(): Promise<void> {
    this.roomSettings.audioLocked = true;
    await this.signaling.broadcastSettingsChange({
      roomId: this.roomId,
      audioLocked: true,
    });

    // Participants see: "Audio has been locked by host"
    // Unmute button disabled
  }

  // Grant speaking rights to raised hand
  async allowToSpeak(participantId: string): Promise<void> {
    await this.signaling.sendSpeakingPermission({
      roomId: this.roomId,
      participantId,
      allowed: true,
    });
  }
}
```

### 2.3 Participant Management

```typescript
// Remove participant from meeting
async function removeParticipant(participantId: string, reason?: string): Promise<void> {
  // Send removal signal via SFU
  await room.removeParticipant(participantId);

  // Log action (for audit)
  await logModerationAction({
    action: 'remove',
    target: participantId,
    by: localParticipantId,
    reason,
    timestamp: Date.now(),
  });

  // Removed participant sees: "You have been removed from the meeting"
  // Optional: Add to block list for this room
}

// Waiting room approval
async function admitFromWaitingRoom(participantId: string): Promise<void> {
  await room.admitParticipant(participantId);
}

async function denyFromWaitingRoom(participantId: string): Promise<void> {
  await room.denyParticipant(participantId);
  // Participant sees: "The host did not admit you to the meeting"
}
```

---

## Part 3: Hand Raising & Reactions

### 3.1 Hand Raise System

```typescript
interface HandRaiseState {
  participantId: string;
  raisedAt: number;
  position: number;  // Queue position
}

class HandRaiseManager {
  private queue: HandRaiseState[] = [];

  async raiseHand(): Promise<void> {
    const state: HandRaiseState = {
      participantId: this.localParticipantId,
      raisedAt: Date.now(),
      position: this.queue.length + 1,
    };

    await this.signaling.sendHandRaise({
      roomId: this.roomId,
      ...state,
    });

    this.queue.push(state);
  }

  async lowerHand(participantId?: string): Promise<void> {
    const target = participantId ?? this.localParticipantId;

    await this.signaling.sendHandLower({
      roomId: this.roomId,
      participantId: target,
    });

    this.queue = this.queue.filter(h => h.participantId !== target);
    this.updatePositions();
  }

  async lowerAllHands(): Promise<void> {
    await this.signaling.broadcastLowerAllHands({
      roomId: this.roomId,
    });

    this.queue = [];
  }

  // Get sorted queue for display
  getQueue(): HandRaiseState[] {
    return [...this.queue].sort((a, b) => a.raisedAt - b.raisedAt);
  }
}
```

### 3.2 Reactions

```typescript
type Reaction = '👍' | '👎' | '❤️' | '😂' | '😮' | '🎉' | '✋' | '👏';

interface ReactionEvent {
  participantId: string;
  reaction: Reaction;
  timestamp: number;
}

class ReactionManager {
  private reactionBuffer: ReactionEvent[] = [];
  private readonly bufferDuration = 5000;  // Show for 5 seconds

  async sendReaction(reaction: Reaction): Promise<void> {
    const event: ReactionEvent = {
      participantId: this.localParticipantId,
      reaction,
      timestamp: Date.now(),
    };

    // Broadcast to room (unreliable delivery OK)
    await this.signaling.sendReaction({
      roomId: this.roomId,
      ...event,
    });
  }

  handleIncomingReaction(event: ReactionEvent): void {
    this.reactionBuffer.push(event);

    // Clean up old reactions
    const cutoff = Date.now() - this.bufferDuration;
    this.reactionBuffer = this.reactionBuffer.filter(r => r.timestamp > cutoff);

    this.emit('reactions-updated', this.reactionBuffer);
  }

  // Get aggregated reaction counts
  getReactionCounts(): Record<Reaction, number> {
    const counts: Partial<Record<Reaction, number>> = {};

    for (const event of this.reactionBuffer) {
      counts[event.reaction] = (counts[event.reaction] ?? 0) + 1;
    }

    return counts as Record<Reaction, number>;
  }
}
```

### 3.3 Reactions UI

```typescript
function ReactionsOverlay({ reactions }: { reactions: ReactionEvent[] }) {
  return (
    <div className="absolute bottom-20 right-4 pointer-events-none">
      <AnimatePresence>
        {reactions.map((r, i) => (
          <motion.div
            key={`${r.participantId}-${r.timestamp}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-4xl"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {r.reaction}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ReactionPicker({ onSelect }: { onSelect: (r: Reaction) => void }) {
  const reactions: Reaction[] = ['👍', '👎', '❤️', '😂', '😮', '🎉', '👏'];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="flex gap-1">
          {reactions.map(r => (
            <Button
              key={r}
              variant="ghost"
              size="sm"
              className="text-2xl"
              onClick={() => onSelect(r)}
            >
              {r}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## Part 4: Polls & Voting

### 4.1 Poll System (Privacy-Preserving)

```typescript
interface Poll {
  id: string;
  roomId: string;
  question: string;
  options: PollOption[];
  settings: PollSettings;
  createdBy: string;
  createdAt: number;
  closedAt?: number;
}

interface PollOption {
  id: string;
  text: string;
  votes: number;  // Aggregated count (not individual votes)
}

interface PollSettings {
  anonymous: boolean;      // Don't reveal who voted what
  multiSelect: boolean;    // Allow multiple choices
  showLiveResults: boolean;
  showVoterCount: boolean;
}

interface PollVote {
  pollId: string;
  optionIds: string[];
  // If anonymous, no voter identity stored
  // If not anonymous, include participantId
}
```

### 4.2 Anonymous Voting Implementation

```typescript
class PollManager {
  // Create poll (host/moderator only)
  async createPoll(poll: Omit<Poll, 'id' | 'createdAt'>): Promise<Poll> {
    const created: Poll = {
      ...poll,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    await this.signaling.broadcastPollCreated({
      roomId: this.roomId,
      poll: created,
    });

    return created;
  }

  // Submit vote
  async vote(pollId: string, optionIds: string[]): Promise<void> {
    const poll = this.polls.get(pollId);
    if (!poll) throw new Error('Poll not found');

    if (poll.settings.anonymous) {
      // Anonymous vote: use blind signature or simple aggregation
      // Server/SFU only sees that a vote was cast, not by whom
      await this.submitAnonymousVote(pollId, optionIds);
    } else {
      // Non-anonymous: include identity
      await this.signaling.sendPollVote({
        pollId,
        optionIds,
        participantId: this.localParticipantId,
      });
    }
  }

  private async submitAnonymousVote(pollId: string, optionIds: string[]): Promise<void> {
    // Option 1: Simple aggregation (Cloudflare Worker)
    // - Worker receives vote without identity
    // - Tracks "has voted" by hashed session token
    // - Only stores aggregate counts

    // Option 2: Cryptographic (more complex)
    // - Blind signatures
    // - Homomorphic tallying

    // For MVP, use Option 1:
    const voteToken = await this.generateAnonymousVoteToken(pollId);

    await fetch(`${this.pollServiceUrl}/vote`, {
      method: 'POST',
      body: JSON.stringify({
        pollId,
        optionIds,
        token: voteToken,  // Proves eligibility without revealing identity
      }),
    });
  }

  // Generate token that proves participant is in room without revealing who
  private async generateAnonymousVoteToken(pollId: string): Promise<string> {
    // HMAC(roomId + pollId, participantPrivateKey)
    // Server can verify participant was eligible without knowing who
    const data = new TextEncoder().encode(this.roomId + pollId);
    const signature = await crypto.subtle.sign(
      'HMAC',
      this.participantKey,
      data
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }
}
```

---

## Part 5: Local Recording

### 5.1 Client-Side Recording

```typescript
// Record conference locally (no server involvement = preserves E2EE)

class LocalRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mixedStream: MediaStream | null = null;

  async startRecording(options: RecordingOptions): Promise<void> {
    // Create canvas for video compositing
    const canvas = document.createElement('canvas');
    canvas.width = options.width ?? 1920;
    canvas.height = options.height ?? 1080;
    const ctx = canvas.getContext('2d')!;

    // Get all video streams
    const videoTracks = this.getParticipantVideoTracks();

    // Create audio mix
    const audioCtx = new AudioContext();
    const audioDestination = audioCtx.createMediaStreamDestination();

    for (const participant of this.participants) {
      if (participant.audioTrack) {
        const source = audioCtx.createMediaStreamSource(
          new MediaStream([participant.audioTrack])
        );
        source.connect(audioDestination);
      }
    }

    // Compose video frame by frame
    const compositeVideo = () => {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const layout = this.calculateLayout(videoTracks.length, canvas.width, canvas.height);

      videoTracks.forEach((track, i) => {
        const video = this.getVideoElement(track);
        const rect = layout[i];
        ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height);
      });

      requestAnimationFrame(compositeVideo);
    };
    compositeVideo();

    // Create combined stream
    const canvasStream = canvas.captureStream(30);
    this.mixedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);

    // Start recording
    this.mediaRecorder = new MediaRecorder(this.mixedStream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 5_000_000,
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000);  // Chunk every second
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        throw new Error('Not recording');
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.recordedChunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  async saveRecording(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

### 5.2 Recording Consent

```typescript
// Notify all participants when recording starts

class RecordingConsentManager {
  async requestRecordingConsent(): Promise<boolean> {
    // Broadcast recording intent
    await this.signaling.broadcastRecordingRequest({
      roomId: this.roomId,
      requestedBy: this.localParticipantId,
    });

    // Show consent dialog to all participants
    // Wait for responses (with timeout)
    const responses = await this.collectConsentResponses(30_000);

    // Check if all consented
    const allConsented = responses.every(r => r.consented);

    if (!allConsented) {
      // Inform requester
      this.emit('recording-denied', {
        deniedBy: responses.filter(r => !r.consented).map(r => r.participantId),
      });
      return false;
    }

    return true;
  }

  // UI shows clear recording indicator
  showRecordingIndicator(): void {
    // Red dot + "Recording" text visible to all
    // Cannot be hidden or dismissed while recording
  }
}
```

---

## Part 6: Waiting Room

### 6.1 Waiting Room Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 WAITING ROOM FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Participant requests to join                                 │
│     └─▶ Gets temporary connection to waiting area                │
│     └─▶ Can see: room name, host name, # waiting                 │
│     └─▶ Cannot: hear/see meeting, send messages                  │
│                                                                  │
│  2. Host sees waiting list                                       │
│     └─▶ Participant name + join time                             │
│     └─▶ [Admit] [Deny] [Admit All] buttons                       │
│                                                                  │
│  3. Host admits participant                                      │
│     └─▶ Participant joins MLS group (gets keys)                  │
│     └─▶ Moves to main room                                       │
│     └─▶ Sees/hears meeting                                       │
│                                                                  │
│  4. Host denies participant                                      │
│     └─▶ Participant sees "Not admitted" message                  │
│     └─▶ Connection closed                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Waiting Room Implementation

```typescript
interface WaitingParticipant {
  id: string;
  displayName: string;
  avatar?: string;
  joinedWaitingAt: number;
}

class WaitingRoomManager {
  private waiting: Map<string, WaitingParticipant> = new Map();

  // Called when someone tries to join a room with waiting room enabled
  async handleJoinRequest(participant: WaitingParticipant): Promise<void> {
    this.waiting.set(participant.id, participant);

    // Notify hosts
    await this.signaling.notifyHosts({
      type: 'waiting-room-join',
      participant,
    });

    this.emit('waiting-updated', Array.from(this.waiting.values()));
  }

  async admitParticipant(participantId: string): Promise<void> {
    const participant = this.waiting.get(participantId);
    if (!participant) return;

    // Generate join token
    const token = await this.generateParticipantToken(participantId);

    // Add to MLS group
    await this.mlsManager.addMember(participantId);

    // Send admit signal with token and MLS welcome
    await this.signaling.sendAdmit({
      participantId,
      token,
      mlsWelcome: await this.mlsManager.getWelcome(participantId),
    });

    this.waiting.delete(participantId);
    this.emit('waiting-updated', Array.from(this.waiting.values()));
  }

  async denyParticipant(participantId: string): Promise<void> {
    await this.signaling.sendDeny({
      participantId,
      reason: 'not-admitted',
    });

    this.waiting.delete(participantId);
    this.emit('waiting-updated', Array.from(this.waiting.values()));
  }

  async admitAll(): Promise<void> {
    for (const participantId of this.waiting.keys()) {
      await this.admitParticipant(participantId);
    }
  }
}
```

---

## Part 7: Chat Integration

### 7.1 In-Meeting Chat

```typescript
// Conference chat uses existing NIP-17 infrastructure

interface ConferenceChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  replyTo?: string;
  scope: 'everyone' | 'hosts' | 'participant';
  targetParticipant?: string;  // For private messages
}

class ConferenceChatManager {
  private messages: ConferenceChatMessage[] = [];

  async sendMessage(content: string, scope: 'everyone' | 'hosts' = 'everyone'): Promise<void> {
    const message: ConferenceChatMessage = {
      id: crypto.randomUUID(),
      roomId: this.roomId,
      senderId: this.localParticipantId,
      senderName: this.localDisplayName,
      content,
      timestamp: Date.now(),
      scope,
    };

    // Encrypt with room MLS key and broadcast
    const encrypted = await this.encryptMessage(message);
    await this.signaling.broadcastChat(encrypted);

    this.messages.push(message);
    this.emit('message', message);
  }

  async sendPrivateMessage(content: string, targetId: string): Promise<void> {
    const message: ConferenceChatMessage = {
      id: crypto.randomUUID(),
      roomId: this.roomId,
      senderId: this.localParticipantId,
      senderName: this.localDisplayName,
      content,
      timestamp: Date.now(),
      scope: 'participant',
      targetParticipant: targetId,
    };

    // Encrypt to specific participant using NIP-44
    const encrypted = await nip44.encrypt(
      this.localPrivkey,
      targetId,
      JSON.stringify(message)
    );

    await this.signaling.sendDirectMessage(encrypted, targetId);
  }
}
```

---

## Implementation Tasks

### Phase 1: Moderation
- [ ] Role system implementation
- [ ] Mute/unmute controls
- [ ] Remove participant
- [ ] Waiting room

### Phase 2: Engagement
- [ ] Hand raising
- [ ] Reactions
- [ ] In-meeting chat
- [ ] Private messages

### Phase 3: Breakouts
- [ ] Breakout creation UI
- [ ] Room assignment (drag-drop)
- [ ] Room navigation
- [ ] Timer and auto-return

### Phase 4: Polls
- [ ] Poll creation UI
- [ ] Voting interface
- [ ] Anonymous voting backend
- [ ] Results display

### Phase 5: Recording
- [ ] Local recording implementation
- [ ] Consent flow
- [ ] Recording indicator
- [ ] Export formats

---

## Success Criteria

- [ ] Breakout rooms work with smooth transitions
- [ ] Moderation controls respect privacy
- [ ] Polls support anonymous voting
- [ ] Local recording produces quality video
- [ ] Hand raise queue is fair and visible
- [ ] All features work with E2EE enabled

## Open Questions

1. Should breakouts have their own chat history?
2. How to handle someone joining during breakouts?
3. Should polls be persistent after meeting?
4. Recording format: WebM vs MP4?
5. Maximum breakout rooms per meeting?
