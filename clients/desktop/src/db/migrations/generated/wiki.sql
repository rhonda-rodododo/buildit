-- Wiki module tables
-- Generated from protocol/schemas/modules/wiki/v1.json
-- Version: 1.0.0

-- ── wiki_pages ──

CREATE TABLE IF NOT EXISTS "wiki_pages" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "version" INTEGER NOT NULL,
    "parent_id" TEXT,
    "category_id" TEXT,
    "status" TEXT NOT NULL CHECK("status" IN ('draft', 'review', 'published', 'archived', 'deleted')),
    "visibility" TEXT CHECK("visibility" IN ('public', 'group', 'private', 'role-restricted')),
    "permissions" TEXT,
    "tags" TEXT,
    "aliases" TEXT,
    "created_by" TEXT NOT NULL,
    "last_edited_by" TEXT,
    "contributors" TEXT,
    "locked_by" TEXT,
    "locked_at" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "published_at" INTEGER,
    "archived_at" INTEGER,
    "deleted_at" INTEGER,
    "metadata" TEXT,
    "indexability" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_wiki_pages_group_id" ON "wiki_pages"("group_id");
CREATE INDEX IF NOT EXISTS "idx_wiki_pages_slug" ON "wiki_pages"("slug");
CREATE INDEX IF NOT EXISTS "idx_wiki_pages_title" ON "wiki_pages"("title");
CREATE INDEX IF NOT EXISTS "idx_wiki_pages_category_id" ON "wiki_pages"("category_id");
CREATE INDEX IF NOT EXISTS "idx_wiki_pages_status" ON "wiki_pages"("status");
CREATE INDEX IF NOT EXISTS "idx_wiki_pages_visibility" ON "wiki_pages"("visibility");
CREATE INDEX IF NOT EXISTS "idx_wiki_pages_updated_at" ON "wiki_pages"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_wiki_pages_created_by" ON "wiki_pages"("created_by");
CREATE INDEX IF NOT EXISTS "idx_wiki_pages_last_edited_by" ON "wiki_pages"("last_edited_by");


-- ── wiki_page_revisions ──

CREATE TABLE IF NOT EXISTS "wiki_page_revisions" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "page_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "diff" TEXT,
    "edited_by" TEXT NOT NULL,
    "edit_type" TEXT DEFAULT 'edit' CHECK("edit_type" IN ('create', 'edit', 'revert', 'merge', 'move')),
    "reverted_from" INTEGER,
    "created_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_wiki_page_revisions_page_id" ON "wiki_page_revisions"("page_id");
CREATE INDEX IF NOT EXISTS "idx_wiki_page_revisions_version" ON "wiki_page_revisions"("version");
CREATE INDEX IF NOT EXISTS "idx_wiki_page_revisions_edited_by" ON "wiki_page_revisions"("edited_by");
CREATE INDEX IF NOT EXISTS "idx_wiki_page_revisions_created_at" ON "wiki_page_revisions"("created_at");


-- ── wiki_categories ──

CREATE TABLE IF NOT EXISTS "wiki_categories" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "order" INTEGER,
    "page_count" INTEGER,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_wiki_categories_group_id" ON "wiki_categories"("group_id");
CREATE INDEX IF NOT EXISTS "idx_wiki_categories_slug" ON "wiki_categories"("slug");
CREATE INDEX IF NOT EXISTS "idx_wiki_categories_name" ON "wiki_categories"("name");
CREATE INDEX IF NOT EXISTS "idx_wiki_categories_parent_id" ON "wiki_categories"("parent_id");
CREATE INDEX IF NOT EXISTS "idx_wiki_categories_order" ON "wiki_categories"("order");


