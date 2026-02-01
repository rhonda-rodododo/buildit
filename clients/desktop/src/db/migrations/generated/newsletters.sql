-- Newsletters module tables
-- Generated from protocol/schemas/modules/newsletters/v1.json
-- Version: 1.0.0

-- ── newsletters ──

CREATE TABLE IF NOT EXISTS "newsletters" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "group_id" TEXT,
    "from_name" TEXT,
    "reply_to" TEXT,
    "logo" TEXT,
    "subscriber_count" INTEGER DEFAULT 0,
    "visibility" TEXT DEFAULT 'group' CHECK("visibility" IN ('private', 'group', 'public')),
    "double_opt_in" INTEGER DEFAULT 1,
    "owner_pubkey" TEXT NOT NULL,
    "editors" TEXT,
    "created_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_newsletters_group_id" ON "newsletters"("group_id");
CREATE INDEX IF NOT EXISTS "idx_newsletters_owner_pubkey" ON "newsletters"("owner_pubkey");
CREATE INDEX IF NOT EXISTS "idx_newsletters_created_at" ON "newsletters"("created_at");
CREATE INDEX IF NOT EXISTS "idx_newsletters_group_id_created_at" ON "newsletters"("group_id", "created_at");


-- ── newsletter_campaigns ──

CREATE TABLE IF NOT EXISTS "newsletter_campaigns" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "newsletter_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "content" TEXT NOT NULL,
    "content_type" TEXT DEFAULT 'markdown' CHECK("content_type" IN ('html', 'markdown')),
    "status" TEXT DEFAULT 'draft' CHECK("status" IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    "scheduled_at" INTEGER,
    "sent_at" INTEGER,
    "recipient_count" INTEGER,
    "open_count" INTEGER DEFAULT 0,
    "click_count" INTEGER DEFAULT 0,
    "segments" TEXT,
    "link_previews" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_newsletter_campaigns_newsletter_id" ON "newsletter_campaigns"("newsletter_id");
CREATE INDEX IF NOT EXISTS "idx_newsletter_campaigns_group_id" ON "newsletter_campaigns"("group_id");
CREATE INDEX IF NOT EXISTS "idx_newsletter_campaigns_status" ON "newsletter_campaigns"("status");
CREATE INDEX IF NOT EXISTS "idx_newsletter_campaigns_scheduled_at" ON "newsletter_campaigns"("scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_newsletter_campaigns_sent_at" ON "newsletter_campaigns"("sent_at");
CREATE INDEX IF NOT EXISTS "idx_newsletter_campaigns_newsletter_id_status" ON "newsletter_campaigns"("newsletter_id", "status");
CREATE INDEX IF NOT EXISTS "idx_newsletter_campaigns_newsletter_id_created_at" ON "newsletter_campaigns"("newsletter_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_newsletter_campaigns_status_scheduled_at" ON "newsletter_campaigns"("status", "scheduled_at");


-- ── newsletter_subscribers ──

CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "newsletter_id" TEXT NOT NULL,
    "pubkey" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending' CHECK("status" IN ('pending', 'active', 'unsubscribed', 'bounced', 'complained')),
    "segments" TEXT,
    "custom_fields" TEXT,
    "source" TEXT,
    "subscribed_at" INTEGER NOT NULL,
    "confirmed_at" INTEGER,
    "unsubscribed_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_newsletter_subscribers_newsletter_id" ON "newsletter_subscribers"("newsletter_id");
CREATE INDEX IF NOT EXISTS "idx_newsletter_subscribers_subscriber_pubkey" ON "newsletter_subscribers"("subscriber_pubkey");
CREATE INDEX IF NOT EXISTS "idx_newsletter_subscribers_status" ON "newsletter_subscribers"("status");
CREATE INDEX IF NOT EXISTS "idx_newsletter_subscribers_newsletter_id_status" ON "newsletter_subscribers"("newsletter_id", "status");
CREATE INDEX IF NOT EXISTS "idx_newsletter_subscribers_newsletter_id_subscriber_pubkey" ON "newsletter_subscribers"("newsletter_id", "subscriber_pubkey");


