# SchedulerBridge Database Migration Guide

## Migration Overview

The SchedulerBridge requires a new table in the federation D1 database: `scheduled_posts`.

## Migration SQL

This SQL is already included in `src/db.ts` and will be executed when you run the database initialization endpoint.

```sql
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  nostr_pubkey TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'published', 'failed', 'cancelled')),
  signed_event TEXT,
  cross_post_ap INTEGER DEFAULT 0,
  cross_post_at INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sched_status_time
  ON scheduled_posts(status, scheduled_at);
```

## Running the Migration

### Development Environment

```bash
# Start the dev server
cd workers/federation
bun run dev

# In another terminal, initialize the database
curl -X POST http://localhost:8787/admin/init-db
```

### Production Environment

```bash
# Deploy the worker first
cd workers/federation
bun run deploy

# Initialize the database
curl -X POST https://buildit.network/admin/init-db \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

The response should be:
```json
{"status":"initialized"}
```

## Verification

After running the migration, verify the table exists:

```bash
# Using wrangler D1 shell
wrangler d1 execute buildit-federation --command "SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_posts';"

# Expected output:
# name
# scheduled_posts
```

Check the schema:

```bash
wrangler d1 execute buildit-federation --command "PRAGMA table_info(scheduled_posts);"

# Expected output:
# cid | name           | type    | notnull | dflt_value        | pk
# 0   | id             | TEXT    | 0       |                   | 1
# 1   | nostr_pubkey   | TEXT    | 1       |                   | 0
# 2   | scheduled_at   | INTEGER | 1       |                   | 0
# 3   | status         | TEXT    | 0       | 'pending'         | 0
# 4   | signed_event   | TEXT    | 0       |                   | 0
# 5   | cross_post_ap  | INTEGER | 0       | 0                 | 0
# 6   | cross_post_at  | INTEGER | 0       | 0                 | 0
# 7   | retry_count    | INTEGER | 0       | 0                 | 0
# 8   | error_message  | TEXT    | 0       |                   | 0
# 9   | created_at     | TEXT    | 0       | (datetime('now')) | 0
# 10  | published_at   | TEXT    | 0       |                   | 0
```

## Rollback

If you need to rollback the migration (remove the table):

```bash
wrangler d1 execute buildit-federation --command "DROP TABLE IF EXISTS scheduled_posts;"
```

**Warning**: This will delete all scheduled posts. Only do this in development or if you're certain you want to remove all scheduling data.

## Durable Object Migration

The SchedulerBridge Durable Object requires a migration in `wrangler.toml`:

```toml
[[migrations]]
tag = "v2"
new_classes = ["SchedulerBridge"]
```

This tells Cloudflare to create the new Durable Object class. This migration happens automatically when you deploy the worker.

### Verifying Durable Object

After deployment, the SchedulerBridge DO will be created on first request. You can verify it by scheduling a test post:

```bash
# Schedule a test post
curl -X POST https://buildit.network/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-schedule-1",
    "nostrEvent": {
      "id": "test-event-id",
      "pubkey": "0000000000000000000000000000000000000000000000000000000000000000",
      "created_at": 1234567890,
      "kind": 1,
      "tags": [],
      "content": "Test post",
      "sig": "test-signature"
    },
    "scheduledAt": '$(($(date +%s) * 1000 + 120000))',
    "crossPostAP": false,
    "crossPostAT": false
  }'
```

Expected response:
```json
{"status":"scheduled","id":"test-schedule-1"}
```

Then cancel it:
```bash
curl -X DELETE https://buildit.network/api/schedule/test-schedule-1
```

Expected response:
```json
{"status":"cancelled","id":"test-schedule-1"}
```

## Migration Checklist

- [ ] Update `src/db.ts` with `scheduled_posts` table schema (already done)
- [ ] Update `wrangler.toml` with SchedulerBridge DO migration (already done)
- [ ] Deploy worker to production: `bun run deploy`
- [ ] Run database initialization: `curl -X POST .../admin/init-db`
- [ ] Verify table exists: `wrangler d1 execute ... --command "SELECT ..."`
- [ ] Test scheduling endpoint: `curl -X POST .../api/schedule`
- [ ] Monitor logs for errors: `wrangler tail`
- [ ] Update client applications to use new scheduler API

## Troubleshooting

### "Table already exists" error
This is safe to ignore. The schema uses `CREATE TABLE IF NOT EXISTS`, so it won't recreate the table if it already exists.

### "Unknown Durable Object class" error
Make sure you've deployed the worker with the updated `wrangler.toml` that includes the SchedulerBridge migration.

### Alarm not firing
1. Check that the scheduled time is in the future
2. Verify the DO alarm is set: check logs for "Alarm processing error"
3. Manually trigger sweep: `curl -X POST https://internal/sweep` (admin route)

### Cross-posting not working
1. Verify the user has federation enabled: `GET /api/status/:pubkey`
2. Check federation queue: `wrangler tail` for queue messages
3. Verify AP/AT credentials are configured correctly

## Support

For issues with the scheduler migration:
1. Check worker logs: `wrangler tail buildit-federation`
2. Inspect D1 database: `wrangler d1 execute buildit-federation --command "SELECT * FROM scheduled_posts LIMIT 10;"`
3. Review scheduler documentation: `src/scheduler/README.md`
