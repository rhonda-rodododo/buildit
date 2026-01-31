-- Search module tables
-- Generated from protocol/schemas/modules/search/v1.json
-- Version: 1.0.0

-- ── search_documents ──

CREATE TABLE IF NOT EXISTS "search_documents" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "module_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT,
    "excerpt" TEXT,
    "author_pubkey" TEXT,
    "facets" TEXT,
    "vector" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "indexed_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_search_documents_module_type" ON "search_documents"("module_type");
CREATE INDEX IF NOT EXISTS "idx_search_documents_entity_id" ON "search_documents"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_search_documents_group_id" ON "search_documents"("group_id");
CREATE INDEX IF NOT EXISTS "idx_search_documents_author_pubkey" ON "search_documents"("author_pubkey");
CREATE INDEX IF NOT EXISTS "idx_search_documents_created_at" ON "search_documents"("created_at");
CREATE INDEX IF NOT EXISTS "idx_search_documents_updated_at" ON "search_documents"("updated_at");

CREATE TABLE IF NOT EXISTS "search_documents_tags" (
    "id" TEXT NOT NULL REFERENCES "search_documents"("id") ON DELETE CASCADE,
    "tag" TEXT NOT NULL,
    PRIMARY KEY ("id", "tag")
);

CREATE INDEX IF NOT EXISTS "idx_search_documents_tags_tag" ON "search_documents_tags"("tag");


-- ── tags ──

CREATE TABLE IF NOT EXISTS "tags" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "parent_tag_id" TEXT,
    "usage_count" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tags_slug" ON "tags"("slug");
CREATE INDEX IF NOT EXISTS "idx_tags_group_id" ON "tags"("group_id");
CREATE INDEX IF NOT EXISTS "idx_tags_usage_count" ON "tags"("usage_count");


-- ── entity_tags ──

CREATE TABLE IF NOT EXISTS "entity_tags" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_entity_tags_tag_id" ON "entity_tags"("tag_id");
CREATE INDEX IF NOT EXISTS "idx_entity_tags_entity_id" ON "entity_tags"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_entity_tags_entity_type" ON "entity_tags"("entity_type");
CREATE INDEX IF NOT EXISTS "idx_entity_tags_entity_id_tag_id" ON "entity_tags"("entity_id", "tag_id");


-- ── saved_searches ──

CREATE TABLE IF NOT EXISTS "saved_searches" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "user_pubkey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "filters" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "last_used_at" INTEGER,
    "use_count" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_saved_searches_group_id" ON "saved_searches"("group_id");
CREATE INDEX IF NOT EXISTS "idx_saved_searches_created_at" ON "saved_searches"("created_at");
CREATE INDEX IF NOT EXISTS "idx_saved_searches_use_count" ON "saved_searches"("use_count");


-- ── recent_searches ──

CREATE TABLE IF NOT EXISTS "recent_searches" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "user_pubkey" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "result_count" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_recent_searches_searched_at" ON "recent_searches"("searched_at");


