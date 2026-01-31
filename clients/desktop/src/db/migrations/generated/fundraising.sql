-- Fundraising module tables
-- Generated from protocol/schemas/modules/fundraising/v1.json
-- Version: 1.0.0

-- ── campaigns ──

CREATE TABLE IF NOT EXISTS "campaigns" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goal" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "raised" REAL DEFAULT 0,
    "donor_count" INTEGER DEFAULT 0,
    "starts_at" INTEGER,
    "ends_at" INTEGER,
    "status" TEXT DEFAULT 'draft' CHECK("status" IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    "visibility" TEXT DEFAULT 'group' CHECK("visibility" IN ('private', 'group', 'public')),
    "group_id" TEXT,
    "image" TEXT,
    "tiers" TEXT,
    "updates" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "table_id" TEXT,
    "slug" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_campaigns_group_id" ON "campaigns"("group_id");
CREATE INDEX IF NOT EXISTS "idx_campaigns_status" ON "campaigns"("status");
CREATE INDEX IF NOT EXISTS "idx_campaigns_created_at" ON "campaigns"("created_at");
CREATE INDEX IF NOT EXISTS "idx_campaigns_end_date" ON "campaigns"("end_date");


-- ── donations ──

CREATE TABLE IF NOT EXISTS "donations" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "donor_pubkey" TEXT,
    "donor_name" TEXT,
    "anonymous" INTEGER DEFAULT 0,
    "message" TEXT,
    "tier_id" TEXT,
    "payment_method" TEXT CHECK("payment_method" IN ('card', 'bank', 'crypto', 'cash', 'check', 'other')),
    "status" TEXT DEFAULT 'completed' CHECK("status" IN ('pending', 'completed', 'failed', 'refunded')),
    "donated_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_donations_campaign_id" ON "donations"("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_donations_group_id" ON "donations"("group_id");
CREATE INDEX IF NOT EXISTS "idx_donations_status" ON "donations"("status");
CREATE INDEX IF NOT EXISTS "idx_donations_donor_pubkey" ON "donations"("donor_pubkey");
CREATE INDEX IF NOT EXISTS "idx_donations_created_at" ON "donations"("created_at");


-- ── expenses ──

CREATE TABLE IF NOT EXISTS "expenses" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "receipt" TEXT,
    "vendor" TEXT,
    "date" INTEGER,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_expenses_campaign_id" ON "expenses"("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_expenses_category" ON "expenses"("category");
CREATE INDEX IF NOT EXISTS "idx_expenses_date" ON "expenses"("date");


