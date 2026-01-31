-- Module tables: events, rsvps, proposals, wiki, database, mutual aid, etc.
-- These correspond to protocol/schemas/modules/* with x-storage annotations

-- ── Events ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    start_at INTEGER NOT NULL,
    end_at INTEGER,
    all_day INTEGER DEFAULT 0,
    timezone TEXT,
    location TEXT, -- JSON object
    virtual_url TEXT,
    rsvp_deadline INTEGER,
    max_attendees INTEGER,
    visibility TEXT DEFAULT 'group' CHECK(visibility IN ('group', 'public', 'private')),
    recurrence TEXT, -- JSON object
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    image_url TEXT,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- ── RSVPs ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('going', 'maybe', 'not_going')),
    guest_count INTEGER DEFAULT 0,
    note TEXT,
    responded_at INTEGER NOT NULL,
    _v TEXT NOT NULL DEFAULT '1.0.0',
    UNIQUE(event_id, pubkey)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_pubkey ON rsvps(pubkey);
CREATE INDEX IF NOT EXISTS idx_rsvps_status ON rsvps(status);

-- ── Proposals (Governance) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    voting_system TEXT NOT NULL DEFAULT 'simple',
    options TEXT DEFAULT '[]', -- JSON array
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    starts_at INTEGER,
    ends_at INTEGER,
    quorum_threshold REAL,
    pass_threshold REAL,
    allow_abstain INTEGER DEFAULT 1,
    require_reason INTEGER DEFAULT 0,
    is_anonymous INTEGER DEFAULT 0,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_proposals_group_id ON proposals(group_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_by ON proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at);

-- ── Votes (Governance) ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id TEXT NOT NULL,
    voter_pubkey TEXT NOT NULL,
    choice TEXT NOT NULL, -- JSON value
    reason TEXT,
    voted_at INTEGER NOT NULL,
    _v TEXT NOT NULL DEFAULT '1.0.0',
    UNIQUE(proposal_id, voter_pubkey)
);

CREATE INDEX IF NOT EXISTS idx_votes_proposal_id ON votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_pubkey ON votes(voter_pubkey);

-- ── Wiki Pages ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wiki_pages (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    slug TEXT,
    parent_id TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    updated_by TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_group_id ON wiki_pages(group_id);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_slug ON wiki_pages(slug);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_parent_id ON wiki_pages(parent_id);

-- ── Mutual Aid Requests ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mutual_aid_requests (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    fulfilled_at INTEGER,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_mutual_aid_requests_group_id ON mutual_aid_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_mutual_aid_requests_type ON mutual_aid_requests(type);
CREATE INDEX IF NOT EXISTS idx_mutual_aid_requests_status ON mutual_aid_requests(status);

-- ── Database Tables (Airtable-like) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS database_tables (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    fields TEXT NOT NULL DEFAULT '[]', -- JSON array of field definitions
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_database_tables_group_id ON database_tables(group_id);

-- ── Database Records ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS database_records (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES database_tables(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}', -- JSON object matching table fields
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_database_records_table_id ON database_records(table_id);
CREATE INDEX IF NOT EXISTS idx_database_records_group_id ON database_records(group_id);

-- ── Database Views ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS database_views (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES database_tables(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'table',
    config TEXT NOT NULL DEFAULT '{}', -- JSON object
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_database_views_table_id ON database_views(table_id);

-- ── Custom Fields ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_fields (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    module_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}', -- JSON object
    required INTEGER DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_group_id ON custom_fields(group_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_module_id ON custom_fields(module_id);

-- ── Search Index ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_index (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    group_id TEXT,
    title TEXT,
    content TEXT,
    excerpt TEXT,
    facets TEXT, -- JSON
    vector TEXT, -- JSON
    tags TEXT, -- JSON array
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_index_entity_type ON search_index(entity_type);
CREATE INDEX IF NOT EXISTS idx_search_index_group_id ON search_index(group_id);

-- ── Tags ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_id TEXT,
    color TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_group_id ON tags(group_id);

-- ── Entity Tags (junction) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entity_tags (
    id TEXT PRIMARY KEY,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_tags_tag_id ON entity_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);

-- ── Saved Searches ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    filters TEXT, -- JSON
    name TEXT,
    pubkey TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- ── Recent Searches ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recent_searches (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    searched_at INTEGER NOT NULL
);

-- ── Search Index Metadata ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_index_meta (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    last_indexed_at INTEGER NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0
);

-- ── Documents ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT NOT NULL DEFAULT 'document',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    updated_by TEXT,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_documents_group_id ON documents(group_id);

-- ── Files ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    mime_type TEXT,
    size INTEGER,
    folder_id TEXT,
    encrypted_url TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_files_group_id ON files(group_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);

-- ── Posts (Social/Microblogging) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    author_pubkey TEXT NOT NULL,
    content TEXT NOT NULL,
    reply_to TEXT,
    repost_of TEXT,
    created_at INTEGER NOT NULL,
    _v TEXT NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX IF NOT EXISTS idx_posts_group_id ON posts(group_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_pubkey ON posts(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
