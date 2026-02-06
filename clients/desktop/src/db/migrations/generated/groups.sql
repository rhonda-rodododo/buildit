-- Groups module tables
-- Generated from protocol/schemas/modules/groups/v1.json
-- Version: 1.0.0

-- ── groups ──

CREATE TABLE IF NOT EXISTS "groups" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "picture" TEXT,
    "privacy_level" TEXT NOT NULL CHECK("privacy_level" IN ('public', 'private', 'secret')),
    "members" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "tags" TEXT,
    "website" TEXT,
    "location" TEXT,
    "enabled_modules" TEXT NOT NULL,
    "creation_event_id" TEXT NOT NULL,
    "metadata_event_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_groups_created_by" ON "groups"("created_by");
CREATE INDEX IF NOT EXISTS "idx_groups_privacy_level" ON "groups"("privacy_level");
CREATE INDEX IF NOT EXISTS "idx_groups_created_at" ON "groups"("created_at");


-- ── group_members ──

CREATE TABLE IF NOT EXISTS "group_members" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "pubkey" TEXT NOT NULL,
    "role" TEXT NOT NULL CHECK("role" IN ('owner', 'admin', 'moderator', 'member')),
    "joined_at" INTEGER NOT NULL,
    "invited_by" TEXT,
    "permissions" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_group_members_pubkey" ON "group_members"("pubkey");
CREATE INDEX IF NOT EXISTS "idx_group_members_role" ON "group_members"("role");


-- ── group_invitations ──

CREATE TABLE IF NOT EXISTS "group_invitations" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "invited_pubkey" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "message" TEXT,
    "created_at" INTEGER NOT NULL,
    "expires_at" INTEGER,
    "status" TEXT NOT NULL CHECK("status" IN ('pending', 'accepted', 'declined', 'expired'))
);

CREATE INDEX IF NOT EXISTS "idx_group_invitations_group_id" ON "group_invitations"("group_id");
CREATE INDEX IF NOT EXISTS "idx_group_invitations_invited_pubkey" ON "group_invitations"("invited_pubkey");
CREATE INDEX IF NOT EXISTS "idx_group_invitations_status" ON "group_invitations"("status");


-- ── group_threads ──

CREATE TABLE IF NOT EXISTS "group_threads" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "last_message_at" INTEGER NOT NULL,
    "message_count" INTEGER NOT NULL,
    "category" TEXT,
    "pinned" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_group_threads_group_id" ON "group_threads"("group_id");
CREATE INDEX IF NOT EXISTS "idx_group_threads_created_by" ON "group_threads"("created_by");
CREATE INDEX IF NOT EXISTS "idx_group_threads_last_message_at" ON "group_threads"("last_message_at");


-- ── group_messages ──

CREATE TABLE IF NOT EXISTS "group_messages" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "thread_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "reply_to" TEXT,
    "reactions" TEXT,
    "edited" INTEGER,
    "edited_at" INTEGER,
    "deleted" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_group_messages_thread_id" ON "group_messages"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_group_messages_group_id" ON "group_messages"("group_id");
CREATE INDEX IF NOT EXISTS "idx_group_messages_from" ON "group_messages"("from");
CREATE INDEX IF NOT EXISTS "idx_group_messages_timestamp" ON "group_messages"("timestamp");


