-- Multi-device support and offline queue tables

-- ── Offline Queue ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offline_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    author_pubkey TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}', -- JSON
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    next_retry_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_offline_queue_type ON offline_queue(type);
CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);
CREATE INDEX IF NOT EXISTS idx_offline_queue_author_pubkey ON offline_queue(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_offline_queue_next_retry_at ON offline_queue(next_retry_at);

-- ── Cache Metadata ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cache_metadata (
    key TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    last_accessed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_metadata_type ON cache_metadata(type);
CREATE INDEX IF NOT EXISTS idx_cache_metadata_last_accessed_at ON cache_metadata(last_accessed_at);

-- ── Linked Devices ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS linked_devices (
    id TEXT PRIMARY KEY,
    identity_pubkey TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('primary', 'linked', 'bunker')),
    name TEXT NOT NULL,
    device_info TEXT NOT NULL DEFAULT '{}', -- JSON
    last_seen INTEGER NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_linked_devices_identity_pubkey ON linked_devices(identity_pubkey);
CREATE INDEX IF NOT EXISTS idx_linked_devices_type ON linked_devices(type);

-- ── Device Transfers ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_transfers (
    id TEXT PRIMARY KEY,
    identity_pubkey TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('outgoing', 'incoming')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'expired')),
    device_name TEXT NOT NULL,
    session_data TEXT, -- JSON (encrypted)
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    completed_at INTEGER,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_device_transfers_identity_pubkey ON device_transfers(identity_pubkey);
CREATE INDEX IF NOT EXISTS idx_device_transfers_status ON device_transfers(status);

-- ── Bunker Connections (NIP-46) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bunker_connections (
    id TEXT PRIMARY KEY,
    identity_pubkey TEXT NOT NULL,
    remote_pubkey TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied', 'revoked')),
    permissions TEXT NOT NULL DEFAULT '{}', -- JSON
    relays TEXT NOT NULL DEFAULT '[]', -- JSON array
    last_connected INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bunker_connections_identity_pubkey ON bunker_connections(identity_pubkey);
CREATE INDEX IF NOT EXISTS idx_bunker_connections_status ON bunker_connections(status);

-- ── Identity Backups ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS identity_backups (
    id TEXT PRIMARY KEY,
    identity_pubkey TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('recovery_phrase', 'encrypted_file', 'device_transfer')),
    encrypted_data TEXT,
    checksum TEXT NOT NULL,
    device_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_backups_identity_pubkey ON identity_backups(identity_pubkey);

-- ── Migration Metadata ──────────────────────────────────────────────────────
-- Track Dexie->SQLite migration status

CREATE TABLE IF NOT EXISTS _migration_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
