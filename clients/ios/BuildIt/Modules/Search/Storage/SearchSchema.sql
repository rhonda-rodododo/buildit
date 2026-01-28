-- SearchSchema.sql
-- BuildIt - Decentralized Mesh Communication
--
-- FTS5 virtual tables for full-text search.
-- All data is stored encrypted at rest.

-- Main search documents table (FTS5 virtual table)
CREATE VIRTUAL TABLE IF NOT EXISTS search_documents USING fts5(
    id,
    module_type,
    entity_id,
    group_id,
    title,
    content,
    tags,
    excerpt,
    author_pubkey,
    facets_json,
    created_at,
    updated_at,
    indexed_at,
    tokenize = 'porter unicode61 remove_diacritics 1',
    content_rowid = 'rowid'
);

-- Auxiliary table for document metadata (non-searchable)
CREATE TABLE IF NOT EXISTS search_documents_meta (
    rowid INTEGER PRIMARY KEY,
    id TEXT UNIQUE NOT NULL,
    module_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    author_pubkey TEXT,
    facets_json TEXT,
    vector_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    indexed_at INTEGER NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_documents_meta_module_type ON search_documents_meta(module_type);
CREATE INDEX IF NOT EXISTS idx_documents_meta_group_id ON search_documents_meta(group_id);
CREATE INDEX IF NOT EXISTS idx_documents_meta_author ON search_documents_meta(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_documents_meta_created ON search_documents_meta(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_meta_updated ON search_documents_meta(updated_at);

-- Tags table
CREATE TABLE IF NOT EXISTS search_tags (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    color TEXT,
    parent_tag_id TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_group ON search_tags(group_id);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON search_tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_parent ON search_tags(parent_tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_group_slug ON search_tags(group_id, slug);

-- Entity-Tag associations
CREATE TABLE IF NOT EXISTS search_entity_tags (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON search_entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON search_entity_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_group ON search_entity_tags(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_tags_unique ON search_entity_tags(entity_type, entity_id, tag_id);

-- Saved searches
CREATE TABLE IF NOT EXISTS search_saved_searches (
    id TEXT PRIMARY KEY,
    user_pubkey TEXT NOT NULL,
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    scope_json TEXT NOT NULL,
    filters_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_used_at INTEGER,
    use_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON search_saved_searches(user_pubkey);

-- Recent searches (limited history per user)
CREATE TABLE IF NOT EXISTS search_recent_searches (
    id TEXT PRIMARY KEY,
    user_pubkey TEXT NOT NULL,
    query TEXT NOT NULL,
    scope_json TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    result_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recent_searches_user ON search_recent_searches(user_pubkey);
CREATE INDEX IF NOT EXISTS idx_recent_searches_timestamp ON search_recent_searches(timestamp);

-- TF-IDF term index for semantic search
CREATE TABLE IF NOT EXISTS search_term_index (
    term TEXT NOT NULL,
    document_count INTEGER DEFAULT 0,
    idf_score REAL,
    PRIMARY KEY (term)
);

-- Index statistics
CREATE TABLE IF NOT EXISTS search_index_stats (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Insert default stats
INSERT OR IGNORE INTO search_index_stats (key, value, updated_at) VALUES
    ('total_documents', '0', 0),
    ('unique_terms', '0', 0),
    ('last_full_reindex', NULL, 0),
    ('last_incremental_update', NULL, 0);

-- Trigger to update usage count when entity_tag is added
CREATE TRIGGER IF NOT EXISTS update_tag_usage_insert
AFTER INSERT ON search_entity_tags
BEGIN
    UPDATE search_tags SET usage_count = usage_count + 1, updated_at = NEW.created_at
    WHERE id = NEW.tag_id;
END;

-- Trigger to update usage count when entity_tag is deleted
CREATE TRIGGER IF NOT EXISTS update_tag_usage_delete
AFTER DELETE ON search_entity_tags
BEGIN
    UPDATE search_tags SET usage_count = MAX(0, usage_count - 1)
    WHERE id = OLD.tag_id;
END;
