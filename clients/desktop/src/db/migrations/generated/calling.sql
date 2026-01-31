-- Calling module tables
-- Generated from protocol/schemas/modules/calling/v1.json
-- Version: 1.0.0

-- ── call_history ──

CREATE TABLE IF NOT EXISTS "call_history" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "call_id" TEXT NOT NULL,
    "remote_pubkey" TEXT NOT NULL,
    "remote_name" TEXT,
    "direction" TEXT NOT NULL CHECK("direction" IN ('outgoing', 'incoming')),
    "call_type" TEXT CHECK("call_type" IN ('voice', 'video', 'group')),
    "started_at" INTEGER NOT NULL,
    "connected_at" INTEGER,
    "ended_at" INTEGER,
    "duration" INTEGER,
    "end_reason" TEXT CHECK("end_reason" IN ('completed', 'rejected', 'busy', 'no_answer', 'network_failure', 'cancelled', 'timeout')),
    "was_encrypted" INTEGER,
    "group_id" TEXT,
    "room_id" TEXT,
    "participant_count" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_call_history_call_id" ON "call_history"("call_id");
CREATE INDEX IF NOT EXISTS "idx_call_history_remote_pubkey" ON "call_history"("remote_pubkey");
CREATE INDEX IF NOT EXISTS "idx_call_history_direction" ON "call_history"("direction");
CREATE INDEX IF NOT EXISTS "idx_call_history_call_type" ON "call_history"("call_type");
CREATE INDEX IF NOT EXISTS "idx_call_history_started_at" ON "call_history"("started_at");
CREATE INDEX IF NOT EXISTS "idx_call_history_group_id" ON "call_history"("group_id");


-- ── call_settings ──

CREATE TABLE IF NOT EXISTS "call_settings" (
    "_v" TEXT DEFAULT '1.0.0',
    "default_call_type" TEXT DEFAULT 'voice' CHECK("default_call_type" IN ('voice', 'video')),
    "auto_answer" INTEGER DEFAULT 0,
    "do_not_disturb" INTEGER DEFAULT 0,
    "allow_unknown_callers" INTEGER DEFAULT 1,
    "relay_only_mode" INTEGER DEFAULT 0,
    "preferred_audio_input" TEXT,
    "preferred_audio_output" TEXT,
    "preferred_video_input" TEXT,
    "echo_cancellation" INTEGER DEFAULT 1,
    "noise_suppression" INTEGER DEFAULT 1,
    "auto_gain_control" INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "idx_call_settings_updated_at" ON "call_settings"("updated_at");


-- ── broadcasts ──

CREATE TABLE IF NOT EXISTS "broadcasts" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "broadcast_id" TEXT PRIMARY KEY,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "target_type" TEXT NOT NULL CHECK("target_type" IN ('group', 'contact_list', 'public_channel', 'emergency')),
    "target_ids" TEXT,
    "priority" TEXT DEFAULT 'normal' CHECK("priority" IN ('normal', 'high', 'emergency')),
    "created_by" TEXT NOT NULL,
    "scheduled_at" INTEGER,
    "sent_at" INTEGER,
    "status" TEXT CHECK("status" IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    "analytics" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_broadcasts_created_by" ON "broadcasts"("created_by");
CREATE INDEX IF NOT EXISTS "idx_broadcasts_status" ON "broadcasts"("status");
CREATE INDEX IF NOT EXISTS "idx_broadcasts_scheduled_at" ON "broadcasts"("scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_broadcasts_sent_at" ON "broadcasts"("sent_at");


-- ── conference_rooms ──

CREATE TABLE IF NOT EXISTS "conference_rooms" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "room_id" TEXT PRIMARY KEY,
    "group_id" TEXT,
    "name" TEXT NOT NULL,
    "sfu_endpoint" TEXT,
    "max_participants" INTEGER DEFAULT 100,
    "created_by" TEXT NOT NULL,
    "settings" TEXT,
    "created_at" INTEGER,
    "expires_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_conference_rooms_group_id" ON "conference_rooms"("group_id");
CREATE INDEX IF NOT EXISTS "idx_conference_rooms_created_by" ON "conference_rooms"("created_by");
CREATE INDEX IF NOT EXISTS "idx_conference_rooms_created_at" ON "conference_rooms"("created_at");
CREATE INDEX IF NOT EXISTS "idx_conference_rooms_expires_at" ON "conference_rooms"("expires_at");


