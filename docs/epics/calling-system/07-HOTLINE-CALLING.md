# Epic 7: Hotline Module Enhancement

> Real voice/video calling for jail support, dispatch, and crisis hotlines

## Overview

Transform the existing Hotline module from a call metadata/logging system into a full-featured calling platform. Operators can receive and make calls, dispatch can coordinate with volunteers in the field, and all communications remain E2EE.

**IMPORTANT**: This epic provides **fully functional hotlines using BuildIt-to-BuildIt calls only**. PSTN integration (Epic 8) comes later but is **critical for accessibility** - many callers (especially those in custody) won't have smartphone/data access. The BuildIt-native hotline ships first, enabling E2EE calling immediately, with phone network support following.

## Dependencies

- **Epic 2**: 1:1 Voice Calls (core calling)
- **Epic 5**: Conference Infrastructure (for multi-operator scenarios)
- **Epic 6**: Conference Features (queue management patterns)

## Unlocks

- Epic 8: PSTN Gateway (critical for accessibility - reaches callers without smartphones/data)
- Epic 9: Messaging Hotline & Blasts (text-based intake)

---

## Current State Analysis

The existing Hotline module (see exploration results) handles:
- ✅ Hotline configuration (types, hours, description)
- ✅ Call metadata logging (start time, duration, notes)
- ✅ Operator shift management
- ✅ Dispatch tracking (volunteer assignments)
- ✅ Call status (active, on-hold, completed, escalated)
- ✅ Priority levels and categorization
- ✅ CRM integration (linking to contact records)

**Missing** (what this epic adds):
- ❌ Actual voice/video communication
- ❌ Call queuing
- ❌ Real-time operator coordination
- ❌ Automatic call distribution (ACD)
- ❌ Call recording (with consent)
- ❌ PSTN bridge (covered in Epic 8)

---

## Part 1: Architecture

### 1.1 Hotline Call Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 HOTLINE CALL FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INTERNAL CALLER (BuildIt user)                                  │
│                                                                  │
│  ┌─────────────┐     ┌─────────────────┐     ┌───────────────┐  │
│  │   Caller    │────▶│  Hotline Queue  │────▶│   Operator    │  │
│  │  (BuildIt)  │     │                 │     │  (on shift)   │  │
│  └─────────────┘     │  - Wait music   │     └───────┬───────┘  │
│                      │  - Position     │             │          │
│                      │  - Est. wait    │             │          │
│                      └─────────────────┘             │          │
│                                                      ▼          │
│                                           ┌───────────────────┐ │
│                                           │  Call Connected   │ │
│                                           │  - E2EE audio     │ │
│                                           │  - Notes capture  │ │
│                                           │  - Dispatch       │ │
│                                           └───────────────────┘ │
│                                                                  │
│  EXTERNAL CALLER (PSTN - Epic 8)                                 │
│                                                                  │
│  ┌─────────────┐     ┌─────────────────┐     ┌───────────────┐  │
│  │ Phone Call  │────▶│  PSTN Gateway   │────▶│ Hotline Queue │  │
│  │ (555-1234)  │     │  (Twilio/Plivo) │     │               │  │
│  └─────────────┘     └─────────────────┘     └───────────────┘  │
│                                                                  │
│  Note: PSTN calls can't be E2EE (phone network limitation)       │
│        but BuildIt-to-BuildIt calls remain encrypted             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Model Extensions

```typescript
// Extend existing HotlineCall with real call data

interface HotlineCall {
  // Existing fields (from current implementation)
  id: string;
  hotlineId: string;
  groupId: string;
  callerName: string;
  callerPhone?: string;
  callerPubkey?: string;
  takenBy?: string;
  callTime: Date;
  endTime?: Date;
  status: HotlineCallStatus;
  summary?: string;
  priority: Priority;
  category?: string;
  followUpNeeded: boolean;
  followUpNotes?: string;
  linkedRecordId?: string;
  linkedRecordTable?: string;

  // NEW: Real calling fields
  callType: 'internal' | 'pstn';
  callSessionId?: string;        // WebRTC session ID
  queuedAt?: Date;               // When entered queue
  queuePosition?: number;        // Position in queue
  waitDuration?: number;         // Time in queue (seconds)
  isEncrypted: boolean;          // E2EE status
  recordingConsent?: boolean;    // Did caller consent to recording?
  recordingId?: string;          // Local recording reference
  transferredFrom?: string;      // Previous operator (if transferred)
  transferredTo?: string;        // Next operator (if transferring)
}

// Queue state
interface HotlineQueue {
  hotlineId: string;
  calls: QueuedCall[];
  estimatedWaitTime: number;     // Average wait in seconds
  operatorsAvailable: number;
}

interface QueuedCall {
  callId: string;
  callerName: string;
  callerPubkey?: string;
  priority: Priority;
  queuedAt: Date;
  position: number;
}
```

### 1.3 Schema Updates

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://buildit.network/schemas/modules/hotlines/v2/hotline-call.json",
  "title": "HotlineCall",
  "description": "Extended hotline call with real-time calling support",
  "type": "object",
  "required": ["id", "hotlineId", "groupId", "callType", "status", "callTime"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "hotlineId": { "type": "string" },
    "groupId": { "type": "string" },

    "callType": {
      "type": "string",
      "enum": ["internal", "pstn"],
      "description": "Internal BuildIt call or external phone"
    },

    "caller": {
      "type": "object",
      "properties": {
        "pubkey": { "type": "string" },
        "phone": { "type": "string" },
        "name": { "type": "string" }
      }
    },

    "operator": {
      "type": "object",
      "properties": {
        "pubkey": { "type": "string" },
        "name": { "type": "string" }
      }
    },

    "callSession": {
      "type": "object",
      "properties": {
        "sessionId": { "type": "string" },
        "isEncrypted": { "type": "boolean" },
        "codec": { "type": "string" }
      }
    },

    "queue": {
      "type": "object",
      "properties": {
        "enteredAt": { "type": "integer" },
        "exitedAt": { "type": "integer" },
        "position": { "type": "integer" },
        "waitDuration": { "type": "integer" }
      }
    },

    "status": {
      "type": "string",
      "enum": ["queued", "ringing", "active", "on-hold", "completed", "escalated", "transferred", "abandoned"]
    },

    "priority": {
      "type": "string",
      "enum": ["low", "medium", "high", "urgent"]
    },

    "notes": { "type": "string" },
    "summary": { "type": "string" },
    "category": { "type": "string" },

    "recording": {
      "type": "object",
      "properties": {
        "consent": { "type": "boolean" },
        "localRecordingId": { "type": "string" }
      }
    },

    "transfer": {
      "type": "object",
      "properties": {
        "from": { "type": "string" },
        "to": { "type": "string" },
        "reason": { "type": "string" },
        "timestamp": { "type": "integer" }
      }
    },

    "dispatch": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/Dispatch"
      }
    },

    "timestamps": {
      "type": "object",
      "properties": {
        "created": { "type": "integer" },
        "answered": { "type": "integer" },
        "ended": { "type": "integer" }
      }
    }
  }
}
```

---

## Part 2: Call Queue System

### 2.1 Queue Manager

```typescript
class HotlineQueueManager {
  private queues: Map<string, HotlineQueue> = new Map();
  private activeOperators: Map<string, OperatorState> = new Map();

  async enqueueCall(hotlineId: string, call: IncomingCall): Promise<QueuedCall> {
    let queue = this.queues.get(hotlineId);
    if (!queue) {
      queue = { hotlineId, calls: [], estimatedWaitTime: 0, operatorsAvailable: 0 };
      this.queues.set(hotlineId, queue);
    }

    const queuedCall: QueuedCall = {
      callId: call.id,
      callerName: call.callerName,
      callerPubkey: call.callerPubkey,
      priority: call.priority ?? 'medium',
      queuedAt: new Date(),
      position: queue.calls.length + 1,
    };

    // Insert based on priority
    this.insertByPriority(queue, queuedCall);

    // Update queue positions
    this.updatePositions(queue);

    // Update estimated wait time
    queue.estimatedWaitTime = this.calculateEstimatedWait(queue);

    // Notify caller of queue status
    await this.notifyCallerQueueStatus(queuedCall, queue);

    // Trigger ACD
    await this.attemptDistribution(hotlineId);

    return queuedCall;
  }

  private insertByPriority(queue: HotlineQueue, call: QueuedCall): void {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const insertIndex = queue.calls.findIndex(
      c => priorityOrder[c.priority] > priorityOrder[call.priority]
    );

    if (insertIndex === -1) {
      queue.calls.push(call);
    } else {
      queue.calls.splice(insertIndex, 0, call);
    }
  }

  async attemptDistribution(hotlineId: string): Promise<void> {
    const queue = this.queues.get(hotlineId);
    if (!queue || queue.calls.length === 0) return;

    // Find available operator
    const availableOperator = this.findAvailableOperator(hotlineId);
    if (!availableOperator) return;

    // Get next call in queue
    const nextCall = queue.calls[0];

    // Assign call to operator
    await this.assignCallToOperator(nextCall, availableOperator);
  }

  private findAvailableOperator(hotlineId: string): OperatorState | null {
    for (const [pubkey, state] of this.activeOperators) {
      if (
        state.hotlineId === hotlineId &&
        state.status === 'available' &&
        state.isOnShift
      ) {
        return state;
      }
    }
    return null;
  }

  private async assignCallToOperator(call: QueuedCall, operator: OperatorState): Promise<void> {
    // Update operator status
    operator.status = 'ringing';
    operator.currentCallId = call.callId;

    // Ring operator
    await this.signaling.sendOperatorRing({
      callId: call.callId,
      operatorPubkey: operator.pubkey,
      caller: {
        name: call.callerName,
        pubkey: call.callerPubkey,
      },
      priority: call.priority,
    });

    // Start ring timeout
    this.startRingTimeout(call.callId, operator.pubkey, 30_000);
  }

  async handleOperatorAnswer(callId: string, operatorPubkey: string): Promise<void> {
    const call = this.findQueuedCall(callId);
    if (!call) return;

    // Remove from queue
    this.removeFromQueue(call.hotlineId, callId);

    // Update operator status
    const operator = this.activeOperators.get(operatorPubkey);
    if (operator) {
      operator.status = 'on-call';
    }

    // Connect caller and operator via WebRTC
    await this.connectCall(call, operatorPubkey);

    // Update call record
    await this.hotlineManager.updateCall(callId, {
      status: 'active',
      takenBy: operatorPubkey,
      connectedAt: Date.now(),
      queue: {
        waitDuration: Math.floor((Date.now() - call.queuedAt.getTime()) / 1000),
      },
    });
  }
}
```

### 2.2 Queue UI (Operator Dashboard)

```typescript
function OperatorDashboard({ hotlineId }: { hotlineId: string }) {
  const { queue, stats, currentCall } = useHotlineOperator(hotlineId);
  const { status, setStatus } = useOperatorStatus();

  return (
    <div className="grid grid-cols-12 gap-4 h-screen">
      {/* Left: Queue & Stats */}
      <div className="col-span-3 space-y-4">
        <OperatorStatusCard
          status={status}
          onStatusChange={setStatus}
        />

        <QueueCard queue={queue} />

        <StatsCard stats={stats} />
      </div>

      {/* Center: Active Call */}
      <div className="col-span-6">
        {currentCall ? (
          <ActiveCallPanel call={currentCall} />
        ) : (
          <WaitingForCall status={status} />
        )}
      </div>

      {/* Right: Call Notes & Actions */}
      <div className="col-span-3 space-y-4">
        {currentCall && (
          <>
            <CallNotesPanel callId={currentCall.id} />
            <DispatchPanel callId={currentCall.id} />
            <QuickActionsPanel
              onHold={() => holdCall(currentCall.id)}
              onTransfer={() => openTransferDialog()}
              onEscalate={() => escalateCall(currentCall.id)}
              onEnd={() => endCall(currentCall.id)}
            />
          </>
        )}
      </div>
    </div>
  );
}

function QueueCard({ queue }: { queue: HotlineQueue }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('queue')}</CardTitle>
        <Badge variant={queue.calls.length > 5 ? 'destructive' : 'default'}>
          {queue.calls.length} {t('waiting')}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {queue.calls.map((call, i) => (
            <div
              key={call.callId}
              className="flex items-center justify-between p-2 rounded bg-muted"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">#{i + 1}</span>
                <span>{call.callerName || t('anonymous')}</span>
                <PriorityBadge priority={call.priority} />
              </div>
              <span className="text-sm text-muted-foreground">
                {formatDuration(Date.now() - call.queuedAt.getTime())}
              </span>
            </div>
          ))}

          {queue.calls.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              {t('no_calls_waiting')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 2.3 Caller Queue Experience

```typescript
function CallerQueueView({ queueStatus }: { queueStatus: QueueStatus }) {
  const { position, estimatedWait, hotlineName } = queueStatus;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Phone className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <CardTitle>{t('calling_hotline', { name: hotlineName })}</CardTitle>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          <div>
            <p className="text-3xl font-bold">{position}</p>
            <p className="text-muted-foreground">{t('position_in_queue')}</p>
          </div>

          <div>
            <p className="text-xl">{formatMinutes(estimatedWait)}</p>
            <p className="text-muted-foreground">{t('estimated_wait')}</p>
          </div>

          {/* Hold music visualization */}
          <AudioVisualizer />

          <p className="text-sm text-muted-foreground">
            {t('queue_message')}
          </p>
        </CardContent>

        <CardFooter>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => leaveQueue()}
          >
            {t('leave_queue')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
```

---

## Part 3: Operator Features

### 3.1 Call Controls

```typescript
class HotlineCallController {
  // Put caller on hold
  async holdCall(callId: string): Promise<void> {
    await this.signaling.sendHold({ callId });

    // Play hold music to caller
    await this.playHoldMusic(callId);

    await this.hotlineManager.updateCall(callId, {
      status: 'on-hold',
    });
  }

  // Resume call from hold
  async resumeCall(callId: string): Promise<void> {
    await this.signaling.sendResume({ callId });
    await this.stopHoldMusic(callId);

    await this.hotlineManager.updateCall(callId, {
      status: 'active',
    });
  }

  // Transfer call to another operator
  async transferCall(callId: string, targetOperatorPubkey: string): Promise<void> {
    // Notify target operator
    await this.signaling.sendTransferRequest({
      callId,
      fromOperator: this.localPubkey,
      toOperator: targetOperatorPubkey,
    });

    // Wait for acceptance
    const accepted = await this.waitForTransferAccept(callId, targetOperatorPubkey, 30_000);

    if (accepted) {
      // Perform WebRTC track handoff
      await this.handoffCall(callId, targetOperatorPubkey);

      await this.hotlineManager.updateCall(callId, {
        status: 'transferred',
        transfer: {
          from: this.localPubkey,
          to: targetOperatorPubkey,
          timestamp: Date.now(),
        },
      });
    } else {
      // Transfer rejected, keep call
      this.emit('transfer-rejected', { callId, targetOperatorPubkey });
    }
  }

  // Escalate to supervisor/host
  async escalateCall(callId: string, reason: string): Promise<void> {
    // Find available supervisor
    const supervisor = await this.findAvailableSupervisor();

    if (supervisor) {
      // Add supervisor to call (3-way)
      await this.addToCall(callId, supervisor.pubkey);
    } else {
      // Queue for supervisor callback
      await this.queueForSupervisor(callId, reason);
    }

    await this.hotlineManager.updateCall(callId, {
      status: 'escalated',
    });
  }

  // End call with summary
  async endCall(callId: string, summary: string): Promise<void> {
    await this.signaling.sendHangup({ callId });

    await this.hotlineManager.updateCall(callId, {
      status: 'completed',
      summary,
      endTime: new Date(),
    });

    // Return operator to available
    this.setOperatorStatus('available');
  }
}
```

### 3.2 Call Notes (Real-Time)

```typescript
function CallNotesPanel({ callId }: { callId: string }) {
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string>();
  const [priority, setPriority] = useState<Priority>('medium');

  // Auto-save notes every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (notes) {
        saveNotes(callId, notes);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [callId, notes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('call_notes')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t('category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="arrest">{t('arrest_support')}</SelectItem>
              <SelectItem value="legal">{t('legal_question')}</SelectItem>
              <SelectItem value="medical">{t('medical_need')}</SelectItem>
              <SelectItem value="safety">{t('safety_concern')}</SelectItem>
              <SelectItem value="other">{t('other')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{t('low_priority')}</SelectItem>
              <SelectItem value="medium">{t('medium_priority')}</SelectItem>
              <SelectItem value="high">{t('high_priority')}</SelectItem>
              <SelectItem value="urgent">{t('urgent_priority')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notes_placeholder')}
          rows={8}
        />

        <div className="flex items-center gap-2">
          <Checkbox id="followUp" />
          <Label htmlFor="followUp">{t('needs_follow_up')}</Label>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3.3 Dispatch Integration

```typescript
function DispatchPanel({ callId }: { callId: string }) {
  const { dispatches, availableVolunteers } = useDispatch(callId);

  const handleDispatch = async (volunteerPubkey: string) => {
    await dispatchVolunteer({
      callId,
      volunteerPubkey,
      timestamp: Date.now(),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dispatch')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active dispatches */}
        {dispatches.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">{t('dispatched')}</h4>
            {dispatches.map(d => (
              <div key={d.id} className="flex items-center justify-between p-2 rounded bg-muted">
                <span>{d.volunteerName}</span>
                <DispatchStatusBadge status={d.status} />
              </div>
            ))}
          </div>
        )}

        {/* Available volunteers */}
        <div>
          <h4 className="text-sm font-medium mb-2">{t('available_volunteers')}</h4>
          {availableVolunteers.map(v => (
            <div key={v.pubkey} className="flex items-center justify-between p-2">
              <div>
                <span>{v.name}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  {v.location}
                </span>
              </div>
              <Button size="sm" onClick={() => handleDispatch(v.pubkey)}>
                {t('dispatch')}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Part 4: Multi-Operator Coordination

### 4.1 Operator Status System

```typescript
type OperatorStatus =
  | 'available'    // Ready to take calls
  | 'on-call'      // Currently on a call
  | 'wrap-up'      // Post-call work (auto-available after timeout)
  | 'break'        // Temporary break
  | 'offline';     // End of shift

interface OperatorState {
  pubkey: string;
  hotlineId: string;
  status: OperatorStatus;
  isOnShift: boolean;
  shiftStart: Date;
  shiftEnd?: Date;
  currentCallId?: string;
  callCount: number;
  avgHandleTime: number;  // seconds
}

class OperatorStatusManager {
  async setStatus(status: OperatorStatus): Promise<void> {
    const currentState = this.operators.get(this.localPubkey);
    if (!currentState) return;

    currentState.status = status;

    // Broadcast status change
    await this.signaling.broadcastOperatorStatus({
      pubkey: this.localPubkey,
      status,
      hotlineId: currentState.hotlineId,
    });

    // If becoming available, check queue
    if (status === 'available') {
      await this.queueManager.attemptDistribution(currentState.hotlineId);
    }

    // Auto-return from wrap-up
    if (status === 'wrap-up') {
      setTimeout(() => {
        this.setStatus('available');
      }, 60_000);  // 60 second wrap-up time
    }
  }

  // Get operator availability for queue
  getAvailableOperators(hotlineId: string): OperatorState[] {
    return Array.from(this.operators.values()).filter(
      op => op.hotlineId === hotlineId &&
           op.status === 'available' &&
           op.isOnShift
    );
  }
}
```

### 4.2 Supervisor Dashboard

```typescript
function SupervisorDashboard({ hotlineId }: { hotlineId: string }) {
  const { operators, queue, stats, activeCalls } = useHotlineSupervisor(hotlineId);

  return (
    <div className="space-y-6">
      {/* Overview metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label={t('calls_waiting')}
          value={queue.calls.length}
          trend={queue.calls.length > 5 ? 'bad' : 'good'}
        />
        <MetricCard
          label={t('operators_available')}
          value={operators.filter(o => o.status === 'available').length}
        />
        <MetricCard
          label={t('avg_wait_time')}
          value={formatDuration(stats.avgWaitTime)}
        />
        <MetricCard
          label={t('calls_today')}
          value={stats.callsToday}
        />
      </div>

      {/* Operator status grid */}
      <Card>
        <CardHeader>
          <CardTitle>{t('operators')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {operators.map(op => (
              <OperatorStatusCard
                key={op.pubkey}
                operator={op}
                onListenIn={() => listenToCall(op.currentCallId)}
                onWhisper={() => whisperToOperator(op.pubkey)}
                onBarge={() => bargeIntoCall(op.currentCallId)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Queue management */}
      <Card>
        <CardHeader>
          <CardTitle>{t('queue_management')}</CardTitle>
        </CardHeader>
        <CardContent>
          <QueueListWithActions
            queue={queue}
            operators={operators}
            onAssign={(callId, operatorPubkey) => manualAssign(callId, operatorPubkey)}
            onPrioritize={(callId, priority) => changePriority(callId, priority)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4.3 Supervisor Call Monitoring

```typescript
class SupervisorMonitoring {
  // Silent listen to an active call
  async listenIn(callId: string): Promise<void> {
    // Join call receive-only
    const call = await this.getCall(callId);
    await this.webrtc.joinReceiveOnly(call.sessionId);

    // Neither operator nor caller know supervisor is listening
    // (use case: quality assurance, training)
  }

  // Whisper to operator (caller can't hear)
  async whisper(operatorPubkey: string, message: string): Promise<void> {
    // Create side channel to operator
    await this.signaling.sendWhisper({
      targetPubkey: operatorPubkey,
      message,
      type: 'text',
    });

    // For audio whisper, need separate audio channel
  }

  // Barge into call (everyone hears)
  async barge(callId: string): Promise<void> {
    // Join call as third party
    const call = await this.getCall(callId);
    await this.webrtc.joinCall(call.sessionId);

    // Announce presence
    await this.signaling.sendBargeNotification({
      callId,
      supervisorPubkey: this.localPubkey,
    });
  }
}
```

---

## Part 5: Integration with Existing Module

### 5.1 HotlinesManager Extensions

```typescript
// Extend existing HotlinesManager with calling functionality

class HotlinesManager {
  // ... existing methods ...

  // NEW: Start hotline call queue
  async startHotlineService(hotlineId: string): Promise<void> {
    const hotline = await this.getHotlineById(hotlineId);
    if (!hotline) throw new Error('Hotline not found');

    // Initialize queue
    await this.queueManager.initializeQueue(hotlineId);

    // Start accepting calls
    this.signaling.subscribeToHotlineCalls(hotlineId, this.handleIncomingCall);

    // Broadcast hotline is active
    await this.signaling.broadcastHotlineStatus({
      hotlineId,
      status: 'active',
      operatorsOnline: this.getActiveOperators(hotlineId).length,
    });
  }

  // NEW: Call the hotline
  async callHotline(hotlineId: string): Promise<HotlineCall> {
    const call = await this.startCall(hotlineId, {
      callerPubkey: this.localPubkey,
      callerName: this.getDisplayName(),
      priority: 'medium',
    });

    // Enter queue
    await this.queueManager.enqueueCall(hotlineId, call);

    return call;
  }

  // NEW: Operator takes next call from queue
  async takeNextCall(hotlineId: string): Promise<HotlineCall | null> {
    const nextCall = await this.queueManager.getNextCall(hotlineId);
    if (!nextCall) return null;

    await this.queueManager.assignCallToOperator(nextCall.callId, this.localPubkey);
    return this.getCallById(nextCall.callId);
  }
}
```

### 5.2 Store Extensions

```typescript
// Extend hotlinesStore with real-time calling state

interface HotlineCallingState {
  // Queue state
  queues: Record<string, HotlineQueue>;

  // Operator state
  operatorStatus: OperatorStatus;
  currentCall: HotlineCall | null;

  // Caller state (when calling a hotline)
  queuePosition: number | null;
  estimatedWait: number | null;

  // Real-time metrics
  liveStats: HotlineStats;
}

const useHotlineCallingStore = create<HotlineCallingState>((set, get) => ({
  queues: {},
  operatorStatus: 'offline',
  currentCall: null,
  queuePosition: null,
  estimatedWait: null,
  liveStats: defaultStats,

  // Actions
  setOperatorStatus: (status) => set({ operatorStatus: status }),
  setCurrentCall: (call) => set({ currentCall: call }),
  updateQueuePosition: (position, wait) =>
    set({ queuePosition: position, estimatedWait: wait }),

  // Subscribe to real-time updates
  subscribeToHotline: (hotlineId) => {
    return signaling.subscribe(`hotline:${hotlineId}`, (event) => {
      switch (event.type) {
        case 'queue-update':
          set((state) => ({
            queues: { ...state.queues, [hotlineId]: event.queue },
          }));
          break;
        case 'stats-update':
          set({ liveStats: event.stats });
          break;
      }
    });
  },
}));
```

---

## Part 6: Mobile Integration

### 6.1 iOS CallKit for Hotline

```swift
// Report incoming hotline call to system

class HotlineCallKitManager {
    func reportIncomingHotlineCall(call: HotlineCall) async throws {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(
            type: .generic,
            value: call.hotlineId
        )
        update.localizedCallerName = call.hotlineName
        update.hasVideo = false
        update.supportsDTMF = true  // May need for PSTN calls
        update.supportsHolding = true

        try await provider.reportNewIncomingCall(
            with: UUID(uuidString: call.id)!,
            update: update
        )
    }

    // Operator-specific: handle call assignment
    func handleCallAssignment(call: HotlineCall) {
        // Show fullscreen incoming call UI
        // with caller info and accept/decline
    }
}
```

### 6.2 Android Service

```kotlin
class HotlineCallService : ConnectionService() {
    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest
    ): Connection {
        val callId = request.extras.getString(EXTRA_CALL_ID)!!
        val hotlineId = request.extras.getString(EXTRA_HOTLINE_ID)!!
        val callerName = request.extras.getString(EXTRA_CALLER_NAME)

        return HotlineConnection(callId, hotlineId).apply {
            setCallerDisplayName(callerName, TelecomManager.PRESENTATION_ALLOWED)
            setRinging()
        }
    }
}
```

---

## Part 7: Desktop Call Center Experience

The Tauri desktop app (using the web UI) provides a full-featured call center experience for distributed operators.

### 7.1 Why Desktop for Operators?

```
┌─────────────────────────────────────────────────────────────────┐
│                 DISTRIBUTED CALL CENTER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Traditional call center:          BuildIt distributed model:    │
│  ┌─────────────────────┐           ┌─────────────────────────┐  │
│  │   Physical Office   │           │   Anywhere with laptop   │  │
│  │   - Expensive       │           │   - Home, cafe, protest  │  │
│  │   - Single location │           │   - Multiple cities      │  │
│  │   - Surveillance    │           │   - Privacy-respecting   │  │
│  └─────────────────────┘           └─────────────────────────┘  │
│                                                                  │
│  Benefits of desktop app for operators:                          │
│  ✓ Larger screen for dashboard + notes + dispatch               │
│  ✓ Better audio (USB headset support)                           │
│  ✓ Multi-monitor support (call on one, notes on another)        │
│  ✓ Keyboard shortcuts for fast operation                        │
│  ✓ System tray for background operation                         │
│  ✓ Native notifications even when minimized                     │
│  ✓ Works offline/BLE for local coordination                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Desktop Operator Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  BuildIt Hotline - Jail Support                    [_][□][X]    │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌───────────────────────────────┐ ┌───────────┐│
│ │ My Status   │ │        ACTIVE CALL            │ │ Queue (3) ││
│ │ ○ Available │ │  ┌───────────────────────┐    │ │           ││
│ │ ○ On Break  │ │  │    Caller: Maria G.   │    │ │ #1 Urgent ││
│ │ ● On Call   │ │  │    Duration: 04:23    │    │ │ #2 High   ││
│ │             │ │  │    🔒 E2EE Active     │    │ │ #3 Medium ││
│ │ Shift: 6h   │ │  └───────────────────────┘    │ │           ││
│ │ Calls: 12   │ │                               │ │ Avg wait: ││
│ └─────────────┘ │  [🔇 Mute] [⏸ Hold] [📞 Xfer] │ │ 2m 34s    ││
│                 │                               │ └───────────┘│
│ ┌─────────────┐ │  ┌───────────────────────┐    │ ┌───────────┐│
│ │ Quick       │ │  │ CALL NOTES            │    │ │ Dispatch  ││
│ │ Actions     │ │  │                       │    │ │           ││
│ │             │ │  │ Category: [Arrest  ▼] │    │ │ Active:   ││
│ │ [Escalate]  │ │  │ Priority: [High    ▼] │    │ │ • Sam (2m)││
│ │ [3-Way]     │ │  │                       │    │ │ • Jo (5m) ││
│ │ [End Call]  │ │  │ Booking #: 2024-1234  │    │ │           ││
│ │             │ │  │ Location: County Jail │    │ │ Available:││
│ │ Shortcuts:  │ │  │                       │    │ │ • Alex    ││
│ │ M = Mute    │ │  │ Notes:                │    │ │ • Chris   ││
│ │ H = Hold    │ │  │ Arrestee needs lawyer │    │ │           ││
│ │ E = End     │ │  │ for arraignment tmrw. │    │ │ [Dispatch]││
│ └─────────────┘ │  │ Family notified.      │    │ └───────────┘│
│                 │  └───────────────────────┘    │              │
│                 └───────────────────────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│ [Team Chat]  Supervisor: "Heads up - busy night expected"       │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Keyboard Shortcuts

```typescript
// Desktop-optimized keyboard shortcuts for operators

const operatorShortcuts = {
  // Call control
  'M': 'toggleMute',
  'H': 'toggleHold',
  'E': 'endCall',
  'T': 'openTransferDialog',
  'D': 'openDispatchDialog',
  'Escape': 'cancelDialog',

  // Status
  'F1': 'setStatusAvailable',
  'F2': 'setStatusBreak',
  'F3': 'setStatusWrapUp',

  // Navigation
  'Tab': 'focusNextSection',
  'Shift+Tab': 'focusPreviousSection',
  'Ctrl+N': 'focusNotes',
  'Ctrl+Q': 'focusQueue',

  // Quick notes
  'Ctrl+1': 'insertTemplate1',  // "Arrestee info taken"
  'Ctrl+2': 'insertTemplate2',  // "Transferred to legal"
  'Ctrl+3': 'insertTemplate3',  // "Follow-up scheduled"
};
```

### 7.4 System Tray & Notifications

```typescript
// Tauri system tray for background operation

import { TrayIcon } from '@tauri-apps/api/tray';

class HotlineTrayManager {
  private tray: TrayIcon;

  async initialize() {
    this.tray = await TrayIcon.new({
      icon: 'icons/hotline-idle.png',
      tooltip: 'BuildIt Hotline - Available',
      menu: await this.buildMenu(),
    });

    // Update icon based on status
    this.onStatusChange((status) => {
      const icons = {
        available: 'hotline-available.png',
        'on-call': 'hotline-oncall.png',
        break: 'hotline-break.png',
        offline: 'hotline-offline.png',
      };
      this.tray.setIcon(`icons/${icons[status]}`);
    });

    // Flash on incoming call
    this.onIncomingCall(() => {
      this.tray.setIcon('icons/hotline-ringing.png');
      // Also use Tauri notification
      sendNotification({
        title: 'Incoming Hotline Call',
        body: 'Click to answer',
        sound: 'default',
      });
    });
  }
}
```

### 7.5 Multi-Hotline Support

Operators can monitor multiple hotlines simultaneously:

```typescript
interface MultiHotlineOperator {
  // Operator can be on-shift for multiple hotlines
  activeShifts: {
    hotlineId: string;
    hotlineName: string;
    priority: number;  // Which hotline to prioritize
  }[];

  // Unified queue view across all hotlines
  unifiedQueue: QueuedCall[];

  // Per-hotline stats
  statsPerHotline: Map<string, HotlineStats>;
}

// UI allows filtering or unified view
function MultiHotlineQueue({ shifts }: { shifts: HotlineShift[] }) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  return (
    <div>
      <ToggleGroup value={viewMode} onValueChange={setViewMode}>
        <ToggleGroupItem value="unified">{t('all_hotlines')}</ToggleGroupItem>
        <ToggleGroupItem value="split">{t('by_hotline')}</ToggleGroupItem>
      </ToggleGroup>

      {viewMode === 'unified' ? (
        <UnifiedQueueView hotlineIds={shifts.map(s => s.hotlineId)} />
      ) : (
        <SplitQueueView shifts={shifts} />
      )}
    </div>
  );
}
```

### 7.6 Offline & BLE Mode

Desktop operators can work in degraded network conditions:

```typescript
// When internet is unavailable, use BLE mesh for local coordination

class OfflineHotlineMode {
  async enableBLEMode() {
    // Can still:
    // - Receive calls from nearby BuildIt users via BLE
    // - Coordinate with other operators on same BLE mesh
    // - Log calls locally (sync when online)

    // Cannot:
    // - Receive calls from remote users
    // - Access centralized queue
    // - PSTN calls (obviously)

    this.showOfflineBanner({
      message: t('offline_mode_active'),
      capabilities: ['local_calls', 'local_dispatch', 'offline_logging'],
    });
  }
}
```

---

## Implementation Tasks

### Phase 1: Queue System
- [ ] Queue manager implementation
- [ ] Automatic call distribution (ACD)
- [ ] Queue position tracking
- [ ] Wait time estimation

### Phase 2: Operator Experience
- [ ] Operator dashboard
- [ ] Call controls (hold, transfer, escalate)
- [ ] Real-time notes
- [ ] Status management

### Phase 3: Caller Experience
- [ ] Call hotline flow
- [ ] Queue UI
- [ ] Position updates
- [ ] Hold music

### Phase 4: Supervisor Features
- [ ] Supervisor dashboard
- [ ] Listen/whisper/barge
- [ ] Manual queue management
- [ ] Real-time metrics

### Phase 5: Integration
- [ ] Extend HotlinesManager
- [ ] Update database schema
- [ ] Mobile CallKit/ConnectionService
- [ ] Dispatch integration

---

## Success Criteria

- [ ] Callers can call hotline and wait in queue
- [ ] Operators receive calls automatically (ACD)
- [ ] Call transfer works between operators
- [ ] Supervisors can monitor calls
- [ ] All E2EE for internal calls
- [ ] Existing hotline features still work

## Open Questions

1. Queue announcement frequency (every 30s? on position change?)
2. Maximum queue length before turning away?
3. Call recording consent flow?
4. Integration with existing dispatch module?
5. Fallback when no operators available?
