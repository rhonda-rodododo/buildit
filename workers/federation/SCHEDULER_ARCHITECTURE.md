# SchedulerBridge Architecture

## Overview

The SchedulerBridge is a Cloudflare Durable Object that enables server-side scheduling of Nostr events while maintaining BuildIt's zero-knowledge privacy model. The client pre-signs events before sending them to the scheduler, ensuring the server never has access to private keys.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client Application                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 1. Generate Event                                           │ │
│  │    - created_at = scheduled time                            │ │
│  │    - content, tags, etc.                                    │ │
│  │                                                             │ │
│  │ 2. Pre-Sign Event (client-side with private key)           │ │
│  │    - id = hash(event)                                       │ │
│  │    - sig = sign(id, privateKey)                             │ │
│  │                                                             │ │
│  │ 3. POST /api/schedule                                       │ │
│  │    {                                                        │ │
│  │      id: "schedule-id",                                     │ │
│  │      nostrEvent: { id, sig, ... },                          │ │
│  │      scheduledAt: timestamp,                                │ │
│  │      crossPostAP: true,                                     │ │
│  │      crossPostAT: false                                     │ │
│  │    }                                                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Federation Worker (index.ts)                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Route: /api/schedule/*                                      │ │
│  │   → Forward to SchedulerBridge Durable Object               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│             SchedulerBridge Durable Object (Primary)              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Storage (Durable Object State)                              │ │
│  │   - alarm: next scheduled post timestamp                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ POST /schedule                                              │ │
│  │   1. Validate request (pubkey, timestamp, signature)        │ │
│  │   2. Store in D1 (scheduled_posts table)                    │ │
│  │   3. Update alarm to earliest scheduled time                │ │
│  │   4. Return { status: "scheduled", id }                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ DELETE /schedule/:id                                        │ │
│  │   1. Mark as 'cancelled' in D1                              │ │
│  │   2. Update alarm if needed                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ GET /schedule/status?pubkey=...                             │ │
│  │   1. Query D1 for all scheduled posts by pubkey             │ │
│  │   2. Return list with status, timestamps, errors            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ alarm() — Triggered at scheduled time                       │ │
│  │   1. Fetch all pending posts with scheduled_at <= now       │ │
│  │   2. For each post:                                         │ │
│  │      a. Connect to BuildIt relay (WebSocket)                │ │
│  │      b. Send pre-signed event: ["EVENT", event]             │ │
│  │      c. Wait for relay OK response                          │ │
│  │      d. If cross-posting enabled:                           │ │
│  │         - Enqueue ap_publish to FEDERATION_QUEUE            │ │
│  │         - Enqueue at_publish to FEDERATION_QUEUE            │ │
│  │      e. Mark as 'published' in D1                           │ │
│  │   3. On failure:                                            │ │
│  │      - Retry with exponential backoff (1m, 5m, 15m)         │ │
│  │      - After 3 failures: mark as 'failed'                   │ │
│  │   4. Set next alarm for earliest pending post               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────┬────────────────────────────────────┬──────────────┘
               │                                    │
               ▼                                    ▼
┌──────────────────────────────┐   ┌────────────────────────────────┐
│      D1 Database (D1)        │   │   FEDERATION_QUEUE (Queue)     │
│  ┌─────────────────────────┐ │   │  ┌──────────────────────────┐ │
│  │ scheduled_posts         │ │   │  │ ap_publish message       │ │
│  │   - id                  │ │   │  │   type: 'ap_publish'     │ │
│  │   - nostr_pubkey        │ │   │  │   nostrEvent: {...}      │ │
│  │   - scheduled_at        │ │   │  │   username: 'alice'      │ │
│  │   - status              │ │   │  └──────────────────────────┘ │
│  │   - signed_event (JSON) │ │   │                                │
│  │   - cross_post_ap       │ │   │  ┌──────────────────────────┐ │
│  │   - cross_post_at       │ │   │  │ at_publish message       │ │
│  │   - retry_count         │ │   │  │   type: 'at_publish'     │ │
│  │   - error_message       │ │   │  │   nostrEvent: {...}      │ │
│  │   - published_at        │ │   │  │   nostrPubkey: '0x...'   │ │
│  └─────────────────────────┘ │   │  └──────────────────────────┘ │
└──────────────────────────────┘   └────────────────────────────────┘
               │                                    │
               │                                    ▼
               │                   ┌────────────────────────────────┐
               │                   │   Queue Consumer               │
               │                   │   (handleQueueMessage)         │
               │                   │                                │
               │                   │   → apPublish.ts               │
               │                   │   → atPublish.ts               │
               │                   └────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                       BuildIt Relay (WebSocket)                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Receives: ["EVENT", signedEvent]                            │ │
│  │ Returns:  ["OK", eventId, true, ""]                         │ │
│  │                                                             │ │
│  │ Event is now available to all subscribers                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                 FederationBridge Durable Object                   │
│  (Subscribes to federation-enabled pubkeys)                       │
│                                                                   │
│  Receives scheduled event → Already queued by SchedulerBridge    │
│  (Deduplication handled by federation queue)                      │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Scheduling Flow
```
Client → Federation Worker → SchedulerBridge → D1 Database
  │                                │
  │                                └→ Durable Object Alarm Set
  └→ Response: { status: "scheduled", id }
```

### 2. Publication Flow (at scheduled time)
```
Durable Object Alarm Fires
  │
  └→ SchedulerBridge.alarm()
       │
       ├→ Fetch pending posts from D1
       │
       ├→ For each post:
       │    │
       │    ├→ WebSocket → BuildIt Relay
       │    │    └→ ["EVENT", signedEvent]
       │    │    ←─ ["OK", eventId, true]
       │    │
       │    ├→ Queue.send(ap_publish) (if enabled)
       │    ├→ Queue.send(at_publish) (if enabled)
       │    │
       │    └→ D1: UPDATE status = 'published'
       │
       └→ Set next alarm for earliest pending post
```

### 3. Retry Flow (on failure)
```
Publish Failed
  │
  ├→ retry_count < 3?
  │    │
  │    ├─ YES → Reschedule with exponential backoff
  │    │         - Attempt 1: +1 minute
  │    │         - Attempt 2: +5 minutes
  │    │         - Attempt 3: +15 minutes
  │    │
  │    └─ NO  → Mark as 'failed' with error_message
```

## Database Schema

```sql
CREATE TABLE scheduled_posts (
  id TEXT PRIMARY KEY,                    -- Client-generated UUID
  nostr_pubkey TEXT NOT NULL,             -- Event author pubkey (64-char hex)
  scheduled_at INTEGER NOT NULL,          -- Unix timestamp (ms)
  status TEXT DEFAULT 'pending',          -- pending|published|failed|cancelled
  signed_event TEXT,                      -- Pre-signed Nostr event (JSON)
  cross_post_ap INTEGER DEFAULT 0,        -- Boolean: cross-post to ActivityPub
  cross_post_at INTEGER DEFAULT 0,        -- Boolean: cross-post to ATProto
  retry_count INTEGER DEFAULT 0,          -- Number of retry attempts
  error_message TEXT,                     -- Last error message
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT                       -- Timestamp when published
);

CREATE INDEX idx_sched_status_time
  ON scheduled_posts(status, scheduled_at);
```

## Alarm Mechanism

Cloudflare Durable Objects support a single alarm per DO instance:

1. **Setting Alarm**: `state.storage.setAlarm(timestamp)`
   - Scheduler sets alarm to the earliest pending post's `scheduled_at`
   - Alarm automatically persists across DO hibernation

2. **Alarm Fires**: `alarm()` method is called
   - Processes all posts due at that time
   - Sets next alarm for the next earliest pending post

3. **Updating Alarm**:
   - After scheduling a new post: recalculate earliest time
   - After cancelling a post: recalculate earliest time
   - After publishing: recalculate for remaining posts

4. **Sweep Mechanism** (backup):
   - Cron job (every 6 hours) calls `POST /sweep`
   - Processes any posts that should have been published
   - Handles edge case of missed alarms

## Security Considerations

### Zero-Knowledge Design
- **Client pre-signs events** — server never has private keys
- Server only stores and publishes pre-signed events at scheduled times
- Cannot modify event content or signature

### Validation
- Pubkey format validation (64-char hex)
- Event must have `id` and `sig` fields
- Scheduled time must be in the future
- Cross-post flags respect federation identity settings

### Rate Limiting (Recommended)
```typescript
// Future enhancement: limit scheduled posts per pubkey
const MAX_SCHEDULED_PER_PUBKEY = 100;
```

### CORS
- Scheduler endpoints use same CORS as main worker
- Consider restrictive CORS for production

## Error Handling

### Client Errors (4xx)
- 400 Invalid pubkey format
- 400 Missing required fields
- 400 scheduledAt in the past
- 400 Event not pre-signed
- 404 Schedule ID not found

### Server Errors (5xx)
- 500 D1 database error
- 500 Relay connection failure
- 500 Queue send failure

### Retry Logic
- Transient failures → Retry with exponential backoff
- Permanent failures → Mark as failed after 3 attempts
- Error messages stored in `error_message` field

## Testing

### Unit Tests
See `src/__tests__/scheduler.test.ts`:
- Input validation
- Pubkey format checks
- Timestamp validation
- Unsigned event rejection

### Integration Tests (Manual)
1. Schedule a post 2 minutes in the future
2. Verify status shows 'pending'
3. Wait for publication time
4. Verify status shows 'published'
5. Check relay for event
6. Verify cross-posts if enabled

### Testing Endpoints
```bash
# Schedule a post
curl -X POST https://buildit.network/api/schedule \
  -H "Content-Type: application/json" \
  -d @schedule-request.json

# Get status for a pubkey
curl "https://buildit.network/api/schedule/status?pubkey=0000..."

# Get single schedule
curl "https://buildit.network/api/schedule/schedule-id"

# Cancel a scheduled post
curl -X DELETE "https://buildit.network/api/schedule/schedule-id"
```

## Deployment

1. **Database Migration**:
   ```bash
   curl -X POST https://buildit.network/admin/init-db \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Deploy Worker**:
   ```bash
   cd workers/federation
   bun run deploy
   ```

3. **Verify Durable Object**:
   - SchedulerBridge DO auto-created on first request
   - Uses singleton pattern: `idFromName('primary')`

## Monitoring

### Metrics to Track
- Scheduled posts per day
- Publication success rate
- Average retry count
- Failed posts count
- Alarm firing accuracy

### Logs to Monitor
- `Schedule error:` — D1 write failures
- `Alarm processing error:` — Publication failures
- `Failed to publish post:` — Per-post failures
- `Relay publish failed:` — WebSocket errors

## Future Enhancements

1. **Recurring Posts**: Cron-like schedules
2. **Bulk Scheduling**: Multiple posts in one request
3. **Edit Scheduled**: Update content/time before publication
4. **Webhook Notifications**: Notify client on publish/fail
5. **Time Zone UI**: Client-side timezone hints
6. **Analytics Dashboard**: View scheduled posts metrics
7. **Rate Limiting**: Per-pubkey scheduling limits
8. **Priority Queues**: VIP users get priority publication
