-- Core tables: identities, groups, members, messages, conversations, friends
-- Derived from clients/web/src/core/storage/db.ts CORE_SCHEMA

-- ── Identities ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS identities (
    public_key TEXT PRIMARY KEY,
    encrypted_private_key TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    web_authn_protected INTEGER NOT NULL DEFAULT 0,
    credential_id TEXT,
    key_version INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    npub TEXT,
    username TEXT,
    display_name TEXT,
    nip05 TEXT,
    nip05_verified INTEGER DEFAULT 0,
    created INTEGER NOT NULL,
    last_used INTEGER NOT NULL,
    security_settings TEXT,
    recovery_phrase_shown_at INTEGER,
    recovery_phrase_confirmed_at INTEGER,
    last_backup_at INTEGER,
    imported_without_backup INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_identities_name ON identities(name);
CREATE INDEX IF NOT EXISTS idx_identities_username ON identities(username);
CREATE INDEX IF NOT EXISTS idx_identities_nip05 ON identities(nip05);
CREATE INDEX IF NOT EXISTS idx_identities_created ON identities(created);
CREATE INDEX IF NOT EXISTS idx_identities_last_used ON identities(last_used);

-- ── Groups ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    admin_pubkeys TEXT NOT NULL DEFAULT '[]', -- JSON array
    created INTEGER NOT NULL,
    privacy TEXT NOT NULL DEFAULT 'private' CHECK(privacy IN ('public', 'private')),
    encrypted_group_key TEXT,
    enabled_modules TEXT NOT NULL DEFAULT '[]' -- JSON array
);

CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_groups_created ON groups(created);
CREATE INDEX IF NOT EXISTS idx_groups_privacy ON groups(privacy);

-- ── Group Members ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'moderator', 'member', 'read-only')),
    joined INTEGER NOT NULL,
    UNIQUE(group_id, pubkey)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_pubkey ON group_members(pubkey);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON group_members(role);

-- ── Group Invitations ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_invitations (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    inviter_pubkey TEXT NOT NULL,
    invitee_pubkey TEXT,
    code TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'moderator', 'member', 'read-only')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
    message TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    accepted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_group_invitations_group_id ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_inviter_pubkey ON group_invitations(inviter_pubkey);
CREATE INDEX IF NOT EXISTS idx_group_invitations_invitee_pubkey ON group_invitations(invitee_pubkey);
CREATE INDEX IF NOT EXISTS idx_group_invitations_code ON group_invitations(code);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON group_invitations(status);
CREATE INDEX IF NOT EXISTS idx_group_invitations_created_at ON group_invitations(created_at);

-- ── Messages ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    author_pubkey TEXT NOT NULL,
    recipient_pubkey TEXT,
    content TEXT NOT NULL,
    kind INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array of arrays
    parent_id TEXT,
    thread_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_author_pubkey ON messages(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_pubkey ON messages(recipient_pubkey);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

-- ── Nostr Events ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nostr_events (
    id TEXT PRIMARY KEY,
    kind INTEGER NOT NULL,
    pubkey TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    content TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array
    sig TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nostr_events_kind ON nostr_events(kind);
CREATE INDEX IF NOT EXISTS idx_nostr_events_pubkey ON nostr_events(pubkey);
CREATE INDEX IF NOT EXISTS idx_nostr_events_created_at ON nostr_events(created_at);

-- ── Module Instances ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS module_instances (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'disabled' CHECK(state IN ('disabled', 'enabled', 'loading', 'error')),
    config TEXT NOT NULL DEFAULT '{}', -- JSON object
    enabled_at INTEGER NOT NULL,
    enabled_by TEXT NOT NULL,
    last_error TEXT,
    updated_at INTEGER NOT NULL,
    UNIQUE(group_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_module_instances_group_id ON module_instances(group_id);
CREATE INDEX IF NOT EXISTS idx_module_instances_module_id ON module_instances(module_id);
CREATE INDEX IF NOT EXISTS idx_module_instances_state ON module_instances(state);

-- ── Username Settings ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS username_settings (
    pubkey TEXT PRIMARY KEY,
    allow_username_search INTEGER NOT NULL DEFAULT 1,
    allow_email_discovery INTEGER NOT NULL DEFAULT 0,
    visible_to TEXT NOT NULL DEFAULT 'public' CHECK(visible_to IN ('public', 'friends', 'groups', 'none')),
    show_in_directory INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
);

-- ── Friends ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    user_pubkey TEXT NOT NULL,
    friend_pubkey TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    trust_tier TEXT,
    verified_in_person INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    display_name TEXT,
    username TEXT,
    notes TEXT,
    tags TEXT DEFAULT '[]', -- JSON array
    added_at INTEGER NOT NULL,
    accepted_at INTEGER,
    UNIQUE(user_pubkey, friend_pubkey)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_pubkey ON friends(user_pubkey);
CREATE INDEX IF NOT EXISTS idx_friends_friend_pubkey ON friends(friend_pubkey);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
CREATE INDEX IF NOT EXISTS idx_friends_trust_tier ON friends(trust_tier);
CREATE INDEX IF NOT EXISTS idx_friends_is_favorite ON friends(is_favorite);

-- Junction table for multi-entry friend tags
CREATE TABLE IF NOT EXISTS friends_tags (
    friend_id TEXT NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (friend_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_friends_tags_tag ON friends_tags(tag);

-- ── Friend Requests ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    from_pubkey TEXT NOT NULL,
    to_pubkey TEXT NOT NULL,
    message TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    UNIQUE(from_pubkey, to_pubkey)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_from_pubkey ON friend_requests(from_pubkey);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_pubkey ON friend_requests(to_pubkey);

-- ── Friend Invite Links ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friend_invite_links (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    creator_pubkey TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    max_uses INTEGER,
    current_uses INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_friend_invite_links_code ON friend_invite_links(code);
CREATE INDEX IF NOT EXISTS idx_friend_invite_links_creator_pubkey ON friend_invite_links(creator_pubkey);

-- ── Conversations ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_message_at INTEGER,
    last_message_preview TEXT,
    group_id TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_muted INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    unread_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX IF NOT EXISTS idx_conversations_group_id ON conversations(group_id);

-- Junction table for conversation participants (multi-entry)
CREATE TABLE IF NOT EXISTS conversations_participants (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    participant TEXT NOT NULL,
    PRIMARY KEY (conversation_id, participant)
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants_participant ON conversations_participants(participant);

-- ── Conversation Members ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_members (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at INTEGER NOT NULL,
    last_read_at INTEGER,
    UNIQUE(conversation_id, pubkey)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_pubkey ON conversation_members(pubkey);

-- ── Conversation Messages ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    "from" TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    reply_to TEXT,
    is_edited INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_from ON conversation_messages("from");
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON conversation_messages(timestamp);

-- ── User Presence ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_presence (
    pubkey TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'offline',
    last_seen INTEGER NOT NULL
);

-- ── Chat Windows ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_windows (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    is_minimized INTEGER NOT NULL DEFAULT 0,
    z_index INTEGER NOT NULL DEFAULT 0
);

-- ── Group Entities ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_entities (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_entities_group_id ON group_entities(group_id);

-- ── Group Entity Messages ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_entity_messages (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    authorized_by TEXT NOT NULL,
    authorized_at INTEGER NOT NULL,
    conversation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_group_entity_messages_group_id ON group_entity_messages(group_id);

-- ── Coalitions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coalitions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- ── Channels ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    conversation_id TEXT,
    type TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channels_group_id ON channels(group_id);
