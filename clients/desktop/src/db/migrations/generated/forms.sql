-- Forms module tables
-- Generated from protocol/schemas/modules/forms/v1.json
-- Version: 1.0.0

-- ── forms ──

CREATE TABLE IF NOT EXISTS "forms" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fields" TEXT NOT NULL,
    "group_id" TEXT,
    "visibility" TEXT DEFAULT 'group' CHECK("visibility" IN ('private', 'group', 'public')),
    "anonymous" INTEGER DEFAULT 0,
    "allow_multiple" INTEGER DEFAULT 0,
    "opens_at" INTEGER,
    "closes_at" INTEGER,
    "max_responses" INTEGER,
    "confirmation_message" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "status" TEXT CHECK("status" IN ('draft', 'open', 'closed', 'archived')),
    "updated_at" INTEGER,
    "table_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_forms_group_id" ON "forms"("group_id");
CREATE INDEX IF NOT EXISTS "idx_forms_status" ON "forms"("status");
CREATE INDEX IF NOT EXISTS "idx_forms_created_at" ON "forms"("created_at");


-- ── form_responses ──

CREATE TABLE IF NOT EXISTS "form_responses" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "form_id" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "respondent" TEXT,
    "submitted_at" INTEGER NOT NULL,
    "group_id" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_form_responses_form_id" ON "form_responses"("form_id");
CREATE INDEX IF NOT EXISTS "idx_form_responses_group_id" ON "form_responses"("group_id");
CREATE INDEX IF NOT EXISTS "idx_form_responses_respondent_pubkey" ON "form_responses"("respondent_pubkey");
CREATE INDEX IF NOT EXISTS "idx_form_responses_submitted_at" ON "form_responses"("submitted_at");


