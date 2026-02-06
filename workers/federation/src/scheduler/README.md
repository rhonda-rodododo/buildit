# SchedulerBridge — Server-Side Post Scheduling

The SchedulerBridge is a Cloudflare Durable Object that handles server-side scheduling of pre-signed Nostr events. This enables users to schedule posts for future publication while maintaining BuildIt's zero-knowledge architecture (the server never has access to private keys).

## Architecture

- **Zero-Knowledge**: Client pre-signs the Nostr event before sending it to the scheduler
- **Precise Timing**: Uses Durable Object `setAlarm()` for accurate wake-up at scheduled times
- **Persistent Storage**: Scheduled posts stored in D1 database
- **Cross-Platform**: Automatically enqueues cross-posts to ActivityPub/ATProto via existing federation queue
- **Retry Logic**: Exponential backoff retry (max 3 attempts: 1min, 5min, 15min delays)

## API Endpoints

### POST /api/schedule

Schedule a new post. Client must pre-sign the Nostr event.

**Request Body:**
```json
{
  "id": "unique-schedule-id",
  "nostrEvent": {
    "id": "event-id",
    "pubkey": "user-pubkey",
    "created_at": 1234567890,
    "kind": 1,
    "tags": [],
    "content": "Scheduled post content",
    "sig": "pre-computed-signature"
  },
  "scheduledAt": 1234567890000,
  "crossPostAP": true,
  "crossPostAT": false
}
```

**Response:**
```json
{
  "status": "scheduled",
  "id": "unique-schedule-id"
}
```

### DELETE /api/schedule/:id

Cancel a scheduled post (only works if status is 'pending').

**Response:**
```json
{
  "status": "cancelled",
  "id": "unique-schedule-id"
}
```

### GET /api/schedule/status?pubkey=...

Get all scheduled posts for a pubkey.

**Response:**
```json
{
  "posts": [
    {
      "id": "schedule-id",
      "scheduled_at": 1234567890000,
      "status": "pending",
      "retry_count": 0,
      "error_message": null,
      "created_at": "2025-01-01T00:00:00Z",
      "published_at": null
    }
  ]
}
```

### GET /api/schedule/:id

Get a single scheduled post status.

**Response:**
```json
{
  "id": "schedule-id",
  "nostr_pubkey": "user-pubkey",
  "scheduled_at": 1234567890000,
  "status": "pending",
  "cross_post_ap": 1,
  "cross_post_at": 0,
  "retry_count": 0,
  "error_message": null,
  "created_at": "2025-01-01T00:00:00Z",
  "published_at": null
}
```

## Database Schema

```sql
CREATE TABLE scheduled_posts (
  id TEXT PRIMARY KEY,
  nostr_pubkey TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  signed_event TEXT,
  cross_post_ap INTEGER DEFAULT 0,
  cross_post_at INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);
```

## Status Values

- **pending**: Scheduled, waiting for publication time
- **published**: Successfully published to relay and cross-posted (if enabled)
- **failed**: Failed after max retries
- **cancelled**: User cancelled before publication

## Workflow

1. **Client Pre-Signs Event**
   - Client generates the Nostr event with `created_at` set to the scheduled time
   - Client signs the event with their private key
   - Client sends the signed event + scheduledAt timestamp to POST /api/schedule

2. **Server Stores Event**
   - SchedulerBridge stores the signed event in D1
   - Sets Durable Object alarm for the scheduled time

3. **Alarm Fires at Scheduled Time**
   - SchedulerBridge wakes up via `alarm()` handler
   - Fetches all pending posts due now
   - For each post:
     - Opens WebSocket to BuildIt relay
     - Sends pre-signed event as `["EVENT", event]`
     - Waits for relay OK response
     - If cross-posting enabled: enqueues AP/AT publish messages to FEDERATION_QUEUE
     - Marks post as published in D1

4. **Retry on Failure**
   - If relay publish fails: retry with exponential backoff (1min, 5min, 15min)
   - After 3 failed attempts: mark as failed with error message
   - User can view errors via GET /api/schedule/:id

5. **Missed Alarms**
   - Cron job (every 6 hours) calls `/sweep` endpoint
   - Sweeps for any pending posts that should have been published
   - Processes them immediately

## Security Considerations

- **Zero-Knowledge**: Server never sees private keys (client pre-signs)
- **Pubkey Validation**: All requests validate pubkey format (64-char hex)
- **Event Verification**: Basic validation that event has `id` and `sig` fields
- **CORS**: Scheduler endpoints inherit CORS from main worker config
- **Rate Limiting**: Consider adding rate limits on POST /api/schedule (e.g., max 100 scheduled posts per pubkey)

## Client Integration Example

```typescript
import { getEventHash, getSignature } from 'nostr-tools';

async function schedulePost(content: string, scheduledAt: number, keys: { publicKey: string; privateKey: string }) {
  // Create event with scheduled timestamp
  const event = {
    pubkey: keys.publicKey,
    created_at: Math.floor(scheduledAt / 1000),
    kind: 1,
    tags: [],
    content,
  };

  // Pre-sign the event
  const signedEvent = {
    ...event,
    id: getEventHash(event),
    sig: getSignature(event, keys.privateKey),
  };

  // Send to scheduler
  const response = await fetch('https://buildit.network/api/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      nostrEvent: signedEvent,
      scheduledAt,
      crossPostAP: true,
      crossPostAT: false,
    }),
  });

  return response.json();
}
```

## Future Enhancements

- **Recurring Posts**: Support for cron-like schedules
- **Bulk Scheduling**: Schedule multiple posts in one request
- **Edit Scheduled Post**: Allow updating content/time before publication
- **Webhook Notifications**: Notify client when post is published
- **Time Zone Support**: Client-side UI hints for timezone conversion
