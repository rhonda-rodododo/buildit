-- Documents module tables
-- Generated from protocol/schemas/modules/documents/v1.json
-- Version: 1.0.0

-- ── documents ──

CREATE TABLE IF NOT EXISTS "documents" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK("type" IN ('markdown', 'plain_text', 'rich_text')),
    "summary" TEXT,
    "visibility" TEXT DEFAULT 'group' CHECK("visibility" IN ('private', 'group', 'public')),
    "edit_permission" TEXT DEFAULT 'owner' CHECK("edit_permission" IN ('owner', 'editors', 'group', 'public')),
    "group_id" TEXT,
    "parent_id" TEXT,
    "tags" TEXT,
    "attachments" TEXT,
    "editors" TEXT,
    "version" INTEGER DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "updated_by" TEXT,
    "folder_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_documents_group_id" ON "documents"("group_id");
CREATE INDEX IF NOT EXISTS "idx_documents_type" ON "documents"("type");
CREATE INDEX IF NOT EXISTS "idx_documents_visibility" ON "documents"("visibility");
CREATE INDEX IF NOT EXISTS "idx_documents_created_by" ON "documents"("created_by");
CREATE INDEX IF NOT EXISTS "idx_documents_created_at" ON "documents"("created_at");
CREATE INDEX IF NOT EXISTS "idx_documents_updated_at" ON "documents"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_documents_group_id_updated_at" ON "documents"("group_id", "updated_at");


-- ── document_revisions ──

CREATE TABLE IF NOT EXISTS "document_revisions" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "change_note" TEXT,
    "edited_by" TEXT NOT NULL,
    "edited_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_document_revisions_document_id" ON "document_revisions"("document_id");
CREATE INDEX IF NOT EXISTS "idx_document_revisions_version" ON "document_revisions"("version");
CREATE INDEX IF NOT EXISTS "idx_document_revisions_created_at" ON "document_revisions"("created_at");


