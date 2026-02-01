-- Publishing module tables
-- Generated from protocol/schemas/modules/publishing/v1.json
-- Version: 1.0.0

-- ── articles ──

CREATE TABLE IF NOT EXISTS "articles" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "subtitle" TEXT,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "cover_image" TEXT,
    "tags" TEXT,
    "categories" TEXT,
    "status" TEXT DEFAULT 'draft' CHECK("status" IN ('draft', 'published', 'archived')),
    "visibility" TEXT DEFAULT 'public' CHECK("visibility" IN ('private', 'group', 'public')),
    "group_id" TEXT,
    "published_at" INTEGER,
    "author_pubkey" TEXT NOT NULL,
    "author_name" TEXT,
    "coauthors" TEXT,
    "reading_time" INTEGER,
    "view_count" INTEGER DEFAULT 0,
    "canonical_url" TEXT,
    "seo" TEXT,
    "link_previews" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_articles_publication_id" ON "articles"("publication_id");
CREATE INDEX IF NOT EXISTS "idx_articles_group_id" ON "articles"("group_id");
CREATE INDEX IF NOT EXISTS "idx_articles_slug" ON "articles"("slug");
CREATE INDEX IF NOT EXISTS "idx_articles_status" ON "articles"("status");
CREATE INDEX IF NOT EXISTS "idx_articles_visibility" ON "articles"("visibility");
CREATE INDEX IF NOT EXISTS "idx_articles_author_pubkey" ON "articles"("author_pubkey");
CREATE INDEX IF NOT EXISTS "idx_articles_published_at" ON "articles"("published_at");
CREATE INDEX IF NOT EXISTS "idx_articles_created_at" ON "articles"("created_at");
CREATE INDEX IF NOT EXISTS "idx_articles_updated_at" ON "articles"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_articles_publication_id_status" ON "articles"("publication_id", "status");
CREATE INDEX IF NOT EXISTS "idx_articles_publication_id_published_at" ON "articles"("publication_id", "published_at");


-- ── article_comments ──

CREATE TABLE IF NOT EXISTS "article_comments" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "content" TEXT NOT NULL,
    "author_pubkey" TEXT NOT NULL,
    "author_name" TEXT,
    "link_previews" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_article_comments_article_id" ON "article_comments"("article_id");
CREATE INDEX IF NOT EXISTS "idx_article_comments_author_pubkey" ON "article_comments"("author_pubkey");
CREATE INDEX IF NOT EXISTS "idx_article_comments_parent_id" ON "article_comments"("parent_id");
CREATE INDEX IF NOT EXISTS "idx_article_comments_created_at" ON "article_comments"("created_at");


-- ── publications ──

CREATE TABLE IF NOT EXISTS "publications" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "cover_image" TEXT,
    "group_id" TEXT,
    "visibility" TEXT DEFAULT 'public' CHECK("visibility" IN ('private', 'group', 'public')),
    "editors" TEXT,
    "owner_pubkey" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_publications_group_id" ON "publications"("group_id");
CREATE INDEX IF NOT EXISTS "idx_publications_slug" ON "publications"("slug");
CREATE INDEX IF NOT EXISTS "idx_publications_owner_pubkey" ON "publications"("owner_pubkey");
CREATE INDEX IF NOT EXISTS "idx_publications_created_at" ON "publications"("created_at");


