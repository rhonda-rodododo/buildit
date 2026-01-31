-- Crm module tables
-- Generated from protocol/schemas/modules/crm/v1.json
-- Version: 1.0.0

-- ── contacts ──

CREATE TABLE IF NOT EXISTS "contacts" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "pubkey" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "organization" TEXT,
    "title" TEXT,
    "tags" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "custom_fields" TEXT,
    "group_id" TEXT,
    "status" TEXT DEFAULT 'active' CHECK("status" IN ('active', 'inactive', 'archived')),
    "last_contacted_at" INTEGER,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_contacts_group_id" ON "contacts"("group_id");
CREATE INDEX IF NOT EXISTS "idx_contacts_name" ON "contacts"("name");
CREATE INDEX IF NOT EXISTS "idx_contacts_email" ON "contacts"("email");
CREATE INDEX IF NOT EXISTS "idx_contacts_status" ON "contacts"("status");
CREATE INDEX IF NOT EXISTS "idx_contacts_created_at" ON "contacts"("created_at");
CREATE INDEX IF NOT EXISTS "idx_contacts_updated_at" ON "contacts"("updated_at");


-- ── interactions ──

CREATE TABLE IF NOT EXISTS "interactions" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "contact_id" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK("type" IN ('call', 'email', 'meeting', 'text', 'event', 'note', 'other')),
    "summary" TEXT,
    "notes" TEXT,
    "outcome" TEXT,
    "follow_up_date" INTEGER,
    "occurred_at" INTEGER NOT NULL,
    "logged_by" TEXT NOT NULL,
    "group_id" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_interactions_contact_id" ON "interactions"("contact_id");
CREATE INDEX IF NOT EXISTS "idx_interactions_group_id" ON "interactions"("group_id");
CREATE INDEX IF NOT EXISTS "idx_interactions_type" ON "interactions"("type");
CREATE INDEX IF NOT EXISTS "idx_interactions_date" ON "interactions"("date");
CREATE INDEX IF NOT EXISTS "idx_interactions_follow_up_date" ON "interactions"("follow_up_date");


-- ── crm_tasks ──

CREATE TABLE IF NOT EXISTS "crm_tasks" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "contact_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_at" INTEGER,
    "priority" TEXT DEFAULT 'medium' CHECK("priority" IN ('low', 'medium', 'high', 'urgent')),
    "status" TEXT DEFAULT 'pending' CHECK("status" IN ('pending', 'in_progress', 'completed', 'cancelled')),
    "assigned_to" TEXT,
    "completed_at" INTEGER,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "group_id" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_crm_tasks_contact_id" ON "crm_tasks"("contact_id");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_group_id" ON "crm_tasks"("group_id");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_status" ON "crm_tasks"("status");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_priority" ON "crm_tasks"("priority");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_due_date" ON "crm_tasks"("due_date");
CREATE INDEX IF NOT EXISTS "idx_crm_tasks_assigned_to" ON "crm_tasks"("assigned_to");


