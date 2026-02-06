-- Microblogging module tables
-- Generated from protocol/schemas/modules/microblogging/v1.json
-- Version: 1.0.0

-- ── posts ──

CREATE TABLE IF NOT EXISTS "posts" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL CHECK("content_type" IN ('text', 'image', 'video', 'poll', 'event-share', 'document-share')),
    "visibility" TEXT NOT NULL,
    "media" TEXT,
    "link_previews" TEXT,
    "location" TEXT,
    "reaction_count" INTEGER DEFAULT 0,
    "comment_count" INTEGER DEFAULT 0,
    "repost_count" INTEGER DEFAULT 0,
    "bookmark_count" INTEGER DEFAULT 0,
    "mentions" TEXT,
    "hashtags" TEXT,
    "links" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "nostr_event_id" TEXT,
    "relay_urls" TEXT,
    "is_repost" INTEGER,
    "reposted_post_id" TEXT,
    "is_quote" INTEGER,
    "quoted_post_id" TEXT,
    "quoted_content" TEXT,
    "content_warning" TEXT,
    "is_sensitive" INTEGER,
    "is_pinned" INTEGER,
    "pinned_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_posts_author_id" ON "posts"("author_id");
CREATE INDEX IF NOT EXISTS "idx_posts_content_type" ON "posts"("content_type");
CREATE INDEX IF NOT EXISTS "idx_posts_created_at" ON "posts"("created_at");
CREATE INDEX IF NOT EXISTS "idx_posts_nostr_event_id" ON "posts"("nostr_event_id");


-- ── comments ──

CREATE TABLE IF NOT EXISTS "comments" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "post_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_comment_id" TEXT,
    "depth" INTEGER NOT NULL,
    "reaction_count" INTEGER DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "nostr_event_id" TEXT,
    "is_reported" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_comments_post_id" ON "comments"("post_id");
CREATE INDEX IF NOT EXISTS "idx_comments_author_id" ON "comments"("author_id");
CREATE INDEX IF NOT EXISTS "idx_comments_parent_comment_id" ON "comments"("parent_comment_id");
CREATE INDEX IF NOT EXISTS "idx_comments_created_at" ON "comments"("created_at");


-- ── reactions ──

CREATE TABLE IF NOT EXISTS "reactions" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK("type" IN ('heart', 'fist', 'fire', 'eyes', 'laugh', 'thumbs_up')),
    "created_at" INTEGER NOT NULL,
    "nostr_event_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_reactions_post_id" ON "reactions"("post_id");
CREATE INDEX IF NOT EXISTS "idx_reactions_user_id" ON "reactions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_reactions_post_id_user_id" ON "reactions"("post_id", "user_id");


-- ── reposts ──

CREATE TABLE IF NOT EXISTS "reposts" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_quote" INTEGER NOT NULL,
    "quote_content" TEXT,
    "created_at" INTEGER NOT NULL,
    "nostr_event_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_reposts_post_id" ON "reposts"("post_id");
CREATE INDEX IF NOT EXISTS "idx_reposts_user_id" ON "reposts"("user_id");


-- ── bookmarks ──

CREATE TABLE IF NOT EXISTS "bookmarks" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "collection_id" TEXT,
    "tags" TEXT,
    "notes" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_bookmarks_post_id" ON "bookmarks"("post_id");
CREATE INDEX IF NOT EXISTS "idx_bookmarks_user_id" ON "bookmarks"("user_id");
CREATE INDEX IF NOT EXISTS "idx_bookmarks_collection_id" ON "bookmarks"("collection_id");


