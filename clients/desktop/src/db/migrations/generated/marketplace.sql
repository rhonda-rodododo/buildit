-- Marketplace module tables
-- Generated from protocol/schemas/modules/marketplace/v1.json
-- Version: 1.0.0

-- ── listings ──

CREATE TABLE IF NOT EXISTS "listings" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "type" TEXT NOT NULL CHECK("type" IN ('product', 'service', 'co-op', 'initiative', 'resource')),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL,
    "currency" TEXT,
    "images" TEXT,
    "location" TEXT,
    "availability" TEXT,
    "tags" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "expires_at" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active' CHECK("status" IN ('active', 'sold', 'expired', 'removed')),
    "group_id" TEXT,
    "coop_id" TEXT,
    "contact_method" TEXT DEFAULT 'dm' CHECK("contact_method" IN ('dm', 'public-reply'))
);

CREATE INDEX IF NOT EXISTS "idx_listings_group_id" ON "listings"("group_id");
CREATE INDEX IF NOT EXISTS "idx_listings_type" ON "listings"("type");
CREATE INDEX IF NOT EXISTS "idx_listings_status" ON "listings"("status");
CREATE INDEX IF NOT EXISTS "idx_listings_created_by" ON "listings"("created_by");
CREATE INDEX IF NOT EXISTS "idx_listings_created_at" ON "listings"("created_at");
CREATE INDEX IF NOT EXISTS "idx_listings_expires_at" ON "listings"("expires_at");


-- ── coop_profiles ──

CREATE TABLE IF NOT EXISTS "coop_profiles" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "member_count" INTEGER,
    "governance_model" TEXT CHECK("governance_model" IN ('consensus', 'democratic', 'sociocracy', 'holacracy', 'hybrid', 'other')),
    "industry" TEXT,
    "location" TEXT,
    "website" TEXT,
    "nostr_pubkey" TEXT NOT NULL,
    "verified_by" TEXT,
    "image" TEXT,
    "created_at" INTEGER,
    "updated_at" INTEGER,
    "group_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_coop_profiles_group_id" ON "coop_profiles"("group_id");
CREATE INDEX IF NOT EXISTS "idx_coop_profiles_nostr_pubkey" ON "coop_profiles"("nostr_pubkey");
CREATE INDEX IF NOT EXISTS "idx_coop_profiles_industry" ON "coop_profiles"("industry");
CREATE INDEX IF NOT EXISTS "idx_coop_profiles_governance_model" ON "coop_profiles"("governance_model");


-- ── reviews ──

CREATE TABLE IF NOT EXISTS "reviews" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "listing_id" TEXT NOT NULL,
    "reviewer_pubkey" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "created_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_reviews_listing_id" ON "reviews"("listing_id");
CREATE INDEX IF NOT EXISTS "idx_reviews_reviewer_pubkey" ON "reviews"("reviewer_pubkey");
CREATE INDEX IF NOT EXISTS "idx_reviews_rating" ON "reviews"("rating");
CREATE INDEX IF NOT EXISTS "idx_reviews_created_at" ON "reviews"("created_at");


-- ── skill_exchanges ──

CREATE TABLE IF NOT EXISTS "skill_exchanges" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "offered_skill" TEXT NOT NULL,
    "requested_skill" TEXT NOT NULL,
    "available_hours" REAL,
    "hourly_timebank" REAL,
    "location" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "status" TEXT DEFAULT 'active' CHECK("status" IN ('active', 'matched', 'completed', 'cancelled')),
    "group_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_skill_exchanges_group_id" ON "skill_exchanges"("group_id");
CREATE INDEX IF NOT EXISTS "idx_skill_exchanges_status" ON "skill_exchanges"("status");
CREATE INDEX IF NOT EXISTS "idx_skill_exchanges_created_by" ON "skill_exchanges"("created_by");
CREATE INDEX IF NOT EXISTS "idx_skill_exchanges_created_at" ON "skill_exchanges"("created_at");


-- ── resource_shares ──

CREATE TABLE IF NOT EXISTS "resource_shares" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "resource_type" TEXT NOT NULL CHECK("resource_type" IN ('tool', 'space', 'vehicle')),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "availability" TEXT,
    "location" TEXT,
    "deposit_required" INTEGER DEFAULT 0,
    "deposit_amount" REAL,
    "deposit_currency" TEXT,
    "images" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "status" TEXT DEFAULT 'available' CHECK("status" IN ('available', 'borrowed', 'unavailable')),
    "group_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_resource_shares_group_id" ON "resource_shares"("group_id");
CREATE INDEX IF NOT EXISTS "idx_resource_shares_resource_type" ON "resource_shares"("resource_type");
CREATE INDEX IF NOT EXISTS "idx_resource_shares_status" ON "resource_shares"("status");
CREATE INDEX IF NOT EXISTS "idx_resource_shares_created_by" ON "resource_shares"("created_by");


