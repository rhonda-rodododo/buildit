-- Database module tables
-- Generated from protocol/schemas/modules/database/v1.json
-- Version: 1.0.0

-- ── database_tables ──

CREATE TABLE IF NOT EXISTS "database_tables" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "columns" TEXT NOT NULL,
    "group_id" TEXT,
    "visibility" TEXT DEFAULT 'group' CHECK("visibility" IN ('private', 'group', 'public')),
    "edit_permission" TEXT DEFAULT 'group' CHECK("edit_permission" IN ('owner', 'editors', 'group')),
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "form_layout" TEXT,
    "detail_config" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_database_tables_group_id" ON "database_tables"("group_id");
CREATE INDEX IF NOT EXISTS "idx_database_tables_name" ON "database_tables"("name");
CREATE INDEX IF NOT EXISTS "idx_database_tables_created_by" ON "database_tables"("created_by");
CREATE INDEX IF NOT EXISTS "idx_database_tables_created_at" ON "database_tables"("created_at");


-- ── database_rows ──

CREATE TABLE IF NOT EXISTS "database_rows" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "table_id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "updated_by" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_database_rows_table_id" ON "database_rows"("table_id");
CREATE INDEX IF NOT EXISTS "idx_database_rows_group_id" ON "database_rows"("group_id");
CREATE INDEX IF NOT EXISTS "idx_database_rows_created_at" ON "database_rows"("created_at");
CREATE INDEX IF NOT EXISTS "idx_database_rows_created_by" ON "database_rows"("created_by");
CREATE INDEX IF NOT EXISTS "idx_database_rows_updated_at" ON "database_rows"("updated_at");


-- ── database_views ──

CREATE TABLE IF NOT EXISTS "database_views" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "table_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'table' CHECK("type" IN ('table', 'grid', 'kanban', 'calendar', 'gallery', 'list')),
    "filters" TEXT,
    "sorts" TEXT,
    "hidden_columns" TEXT,
    "group_by" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_database_views_table_id" ON "database_views"("table_id");
CREATE INDEX IF NOT EXISTS "idx_database_views_group_id" ON "database_views"("group_id");
CREATE INDEX IF NOT EXISTS "idx_database_views_type" ON "database_views"("type");
CREATE INDEX IF NOT EXISTS "idx_database_views_created_at" ON "database_views"("created_at");


