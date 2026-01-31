-- Files module tables
-- Generated from protocol/schemas/modules/files/v1.json
-- Version: 1.0.0

-- ── file_metadata ──

CREATE TABLE IF NOT EXISTS "file_metadata" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hash" TEXT,
    "description" TEXT,
    "folder_id" TEXT,
    "group_id" TEXT,
    "visibility" TEXT DEFAULT 'group' CHECK("visibility" IN ('private', 'group', 'public')),
    "encrypted" INTEGER DEFAULT 1,
    "encryption_key_id" TEXT,
    "thumbnail" TEXT,
    "dimensions" TEXT,
    "duration" REAL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_file_metadata_group_id" ON "file_metadata"("group_id");
CREATE INDEX IF NOT EXISTS "idx_file_metadata_folder_id" ON "file_metadata"("folder_id");
CREATE INDEX IF NOT EXISTS "idx_file_metadata_mime_type" ON "file_metadata"("mime_type");
CREATE INDEX IF NOT EXISTS "idx_file_metadata_created_at" ON "file_metadata"("created_at");
CREATE INDEX IF NOT EXISTS "idx_file_metadata_updated_at" ON "file_metadata"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_file_metadata_group_id_updated_at" ON "file_metadata"("group_id", "updated_at");
CREATE INDEX IF NOT EXISTS "idx_file_metadata_group_id_folder_id" ON "file_metadata"("group_id", "folder_id");


-- ── folders ──

CREATE TABLE IF NOT EXISTS "folders" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "group_id" TEXT,
    "color" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_folders_group_id" ON "folders"("group_id");
CREATE INDEX IF NOT EXISTS "idx_folders_parent_id" ON "folders"("parent_id");
CREATE INDEX IF NOT EXISTS "idx_folders_name" ON "folders"("name");
CREATE INDEX IF NOT EXISTS "idx_folders_group_id_parent_id" ON "folders"("group_id", "parent_id");


-- ── file_shares ──

CREATE TABLE IF NOT EXISTS "file_shares" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "file_id" TEXT NOT NULL,
    "shared_with" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'view' CHECK("permission" IN ('view', 'download', 'edit')),
    "expires_at" INTEGER,
    "shared_by" TEXT NOT NULL,
    "shared_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_file_shares_file_id" ON "file_shares"("file_id");
CREATE INDEX IF NOT EXISTS "idx_file_shares_group_id" ON "file_shares"("group_id");
CREATE INDEX IF NOT EXISTS "idx_file_shares_recipient_pubkey" ON "file_shares"("recipient_pubkey");
CREATE INDEX IF NOT EXISTS "idx_file_shares_expires_at" ON "file_shares"("expires_at");


