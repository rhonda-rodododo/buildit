-- SocialPublishing module tables
-- Generated from protocol/schemas/modules/social-publishing/v1.json
-- Version: 1.0.0

-- ── scheduled_content ──

CREATE TABLE IF NOT EXISTS "scheduled_content" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "source_module" TEXT NOT NULL,
    "source_content_id" TEXT NOT NULL,
    "scheduled_at" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending' CHECK("status" IN ('pending', 'publishing', 'published', 'failed', 'cancelled')),
    "recurrence" TEXT,
    "cross_post_config" TEXT,
    "signed_event" TEXT,
    "published_at" INTEGER,
    "error_message" TEXT,
    "retry_count" INTEGER DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_scheduled_content_source_module" ON "scheduled_content"("source_module");
CREATE INDEX IF NOT EXISTS "idx_scheduled_content_scheduled_at" ON "scheduled_content"("scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_scheduled_content_status" ON "scheduled_content"("status");
CREATE INDEX IF NOT EXISTS "idx_scheduled_content_created_by" ON "scheduled_content"("created_by");
CREATE INDEX IF NOT EXISTS "idx_scheduled_content_created_at" ON "scheduled_content"("created_at");


-- ── share_links ──

CREATE TABLE IF NOT EXISTS "share_links" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "source_module" TEXT NOT NULL,
    "source_content_id" TEXT NOT NULL,
    "target_url" TEXT,
    "expires_at" INTEGER,
    "password_hash" TEXT,
    "track_clicks" INTEGER DEFAULT 1,
    "click_count" INTEGER DEFAULT 0,
    "seo_overrides" TEXT,
    "is_active" INTEGER DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_share_links_slug" ON "share_links"("slug");
CREATE INDEX IF NOT EXISTS "idx_share_links_source_module" ON "share_links"("source_module");
CREATE INDEX IF NOT EXISTS "idx_share_links_source_content_id" ON "share_links"("source_content_id");
CREATE INDEX IF NOT EXISTS "idx_share_links_created_by" ON "share_links"("created_by");
CREATE INDEX IF NOT EXISTS "idx_share_links_is_active" ON "share_links"("is_active");


-- ── social_accounts ──

CREATE TABLE IF NOT EXISTS "social_accounts" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "platform" TEXT NOT NULL CHECK("platform" IN ('activitypub', 'atproto')),
    "handle" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "pubkey" TEXT NOT NULL,
    "is_active" INTEGER DEFAULT 1,
    "last_sync_at" INTEGER,
    "created_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_social_accounts_platform" ON "social_accounts"("platform");
CREATE INDEX IF NOT EXISTS "idx_social_accounts_pubkey" ON "social_accounts"("pubkey");
CREATE INDEX IF NOT EXISTS "idx_social_accounts_is_active" ON "social_accounts"("is_active");


-- ── content_calendar_entries ──

CREATE TABLE IF NOT EXISTS "content_calendar_entries" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "source_module" TEXT NOT NULL,
    "source_content_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduled_at" INTEGER NOT NULL,
    "status" TEXT NOT NULL CHECK("status" IN ('pending', 'publishing', 'published', 'failed', 'cancelled')),
    "platforms" TEXT,
    "content_type" TEXT CHECK("content_type" IN ('article', 'post', 'event', 'newsletter', 'listing'))
);

CREATE INDEX IF NOT EXISTS "idx_content_calendar_entries_source_module" ON "content_calendar_entries"("source_module");
CREATE INDEX IF NOT EXISTS "idx_content_calendar_entries_scheduled_at" ON "content_calendar_entries"("scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_content_calendar_entries_status" ON "content_calendar_entries"("status");


-- ── outreach_analytics ──

CREATE TABLE IF NOT EXISTS "outreach_analytics" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "share_link_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "referrer" TEXT,
    "platform" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_outreach_analytics_share_link_id" ON "outreach_analytics"("share_link_id");
CREATE INDEX IF NOT EXISTS "idx_outreach_analytics_timestamp" ON "outreach_analytics"("timestamp");


