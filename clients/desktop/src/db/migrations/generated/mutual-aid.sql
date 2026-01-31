-- MutualAid module tables
-- Generated from protocol/schemas/modules/mutual-aid/v1.json
-- Version: 1.0.0

-- ── mutual_aid_requests ──

CREATE TABLE IF NOT EXISTS "mutual_aid_requests" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL CHECK("status" IN ('open', 'in-progress', 'partially-fulfilled', 'fulfilled', 'closed', 'expired', 'cancelled')),
    "urgency" TEXT CHECK("urgency" IN ('low', 'medium', 'high', 'critical')),
    "requester_id" TEXT NOT NULL,
    "anonymous_request" INTEGER DEFAULT 0,
    "location" TEXT,
    "needed_by" INTEGER,
    "recurring_need" TEXT,
    "fulfillments" TEXT,
    "quantity_needed" REAL,
    "quantity_fulfilled" REAL DEFAULT 0,
    "unit" TEXT,
    "tags" TEXT,
    "custom_fields" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "closed_at" INTEGER,
    "image_url" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_mutual_aid_requests_group_id" ON "mutual_aid_requests"("group_id");
CREATE INDEX IF NOT EXISTS "idx_mutual_aid_requests_category" ON "mutual_aid_requests"("category");
CREATE INDEX IF NOT EXISTS "idx_mutual_aid_requests_status" ON "mutual_aid_requests"("status");
CREATE INDEX IF NOT EXISTS "idx_mutual_aid_requests_urgency" ON "mutual_aid_requests"("urgency");
CREATE INDEX IF NOT EXISTS "idx_mutual_aid_requests_requester_id" ON "mutual_aid_requests"("requester_id");
CREATE INDEX IF NOT EXISTS "idx_mutual_aid_requests_created_at" ON "mutual_aid_requests"("created_at");


-- ── mutual_aid_offers ──

CREATE TABLE IF NOT EXISTS "mutual_aid_offers" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active' CHECK("status" IN ('active', 'claimed', 'expired', 'withdrawn')),
    "offerer_id" TEXT NOT NULL,
    "location" TEXT,
    "available_from" INTEGER,
    "available_until" INTEGER,
    "recurring_availability" TEXT,
    "quantity" REAL,
    "unit" TEXT,
    "claimed_by" TEXT,
    "tags" TEXT,
    "custom_fields" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "image_url" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_mutual_aid_offers_group_id" ON "mutual_aid_offers"("group_id");
CREATE INDEX IF NOT EXISTS "idx_mutual_aid_offers_category" ON "mutual_aid_offers"("category");
CREATE INDEX IF NOT EXISTS "idx_mutual_aid_offers_status" ON "mutual_aid_offers"("status");
CREATE INDEX IF NOT EXISTS "idx_mutual_aid_offers_offerer_id" ON "mutual_aid_offers"("offerer_id");
CREATE INDEX IF NOT EXISTS "idx_mutual_aid_offers_created_at" ON "mutual_aid_offers"("created_at");


-- ── ride_shares ──

CREATE TABLE IF NOT EXISTS "ride_shares" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK("type" IN ('offer', 'request')),
    "driver_id" TEXT,
    "requester_id" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departure_time" INTEGER NOT NULL,
    "flexibility" INTEGER,
    "available_seats" INTEGER,
    "recurring" TEXT,
    "preferences" TEXT,
    "passengers" TEXT,
    "status" TEXT NOT NULL CHECK("status" IN ('active', 'full', 'departed', 'completed', 'cancelled')),
    "notes" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_ride_shares_group_id" ON "ride_shares"("group_id");
CREATE INDEX IF NOT EXISTS "idx_ride_shares_type" ON "ride_shares"("type");
CREATE INDEX IF NOT EXISTS "idx_ride_shares_status" ON "ride_shares"("status");
CREATE INDEX IF NOT EXISTS "idx_ride_shares_departure_time" ON "ride_shares"("departure_time");
CREATE INDEX IF NOT EXISTS "idx_ride_shares_created_at" ON "ride_shares"("created_at");


-- ── resource_directory ──

CREATE TABLE IF NOT EXISTS "resource_directory" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "contact" TEXT,
    "location" TEXT,
    "hours" TEXT,
    "eligibility" TEXT,
    "languages" TEXT,
    "verified" INTEGER DEFAULT 0,
    "verified_by" TEXT,
    "verified_at" INTEGER,
    "tags" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_resource_directory_group_id" ON "resource_directory"("group_id");
CREATE INDEX IF NOT EXISTS "idx_resource_directory_category" ON "resource_directory"("category");
CREATE INDEX IF NOT EXISTS "idx_resource_directory_verified" ON "resource_directory"("verified");
CREATE INDEX IF NOT EXISTS "idx_resource_directory_created_by" ON "resource_directory"("created_by");
CREATE INDEX IF NOT EXISTS "idx_resource_directory_created_at" ON "resource_directory"("created_at");


