-- Events module tables
-- Generated from protocol/schemas/modules/events/v1.json
-- Version: 1.0.0

-- ── events ──

CREATE TABLE IF NOT EXISTS "events" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_at" INTEGER NOT NULL,
    "end_at" INTEGER,
    "all_day" INTEGER DEFAULT 0,
    "timezone" TEXT,
    "location" TEXT,
    "virtual_url" TEXT,
    "rsvp_deadline" INTEGER,
    "max_attendees" INTEGER,
    "visibility" TEXT DEFAULT 'group' CHECK("visibility" IN ('group', 'public', 'private')),
    "recurrence" TEXT,
    "attachments" TEXT,
    "custom_fields" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "image_url" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_events_group_id" ON "events"("group_id");
CREATE INDEX IF NOT EXISTS "idx_events_start_at" ON "events"("start_at");
CREATE INDEX IF NOT EXISTS "idx_events_created_by" ON "events"("created_by");
CREATE INDEX IF NOT EXISTS "idx_events_visibility" ON "events"("visibility");
CREATE INDEX IF NOT EXISTS "idx_events_created_at" ON "events"("created_at");


-- ── rsvps ──

CREATE TABLE IF NOT EXISTS "rsvps" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "event_id" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "status" TEXT NOT NULL CHECK("status" IN ('going', 'maybe', 'not_going')),
    "guest_count" INTEGER DEFAULT 0,
    "note" TEXT,
    "responded_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_rsvps_event_id" ON "rsvps"("event_id");
CREATE INDEX IF NOT EXISTS "idx_rsvps_pubkey" ON "rsvps"("pubkey");
CREATE INDEX IF NOT EXISTS "idx_rsvps_status" ON "rsvps"("status");
CREATE INDEX IF NOT EXISTS "idx_rsvps_event_id_pubkey" ON "rsvps"("event_id", "pubkey");


