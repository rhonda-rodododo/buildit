-- Contacts module tables
-- Generated from protocol/schemas/modules/contacts/v1.json
-- Version: 1.0.0

-- ── contacts ──

CREATE TABLE IF NOT EXISTS "contacts" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "pubkey" TEXT PRIMARY KEY,
    "relay" TEXT,
    "petname" TEXT,
    "display_name" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "nip05" TEXT,
    "lud16" TEXT,
    "relationship" TEXT NOT NULL CHECK("relationship" IN ('following', 'follower', 'friend', 'blocked')),
    "followed_at" INTEGER,
    "muted_at" INTEGER,
    "blocked_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_contacts_relationship" ON "contacts"("relationship");
CREATE INDEX IF NOT EXISTS "idx_contacts_display_name" ON "contacts"("display_name");


-- ── contact_notes ──

CREATE TABLE IF NOT EXISTS "contact_notes" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "contact_pubkey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL CHECK("category" IN ('general', 'meeting', 'follow_up', 'concern', 'positive', 'task')),
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_contact_notes_contact_pubkey" ON "contact_notes"("contact_pubkey");
CREATE INDEX IF NOT EXISTS "idx_contact_notes_category" ON "contact_notes"("category");
CREATE INDEX IF NOT EXISTS "idx_contact_notes_created_at" ON "contact_notes"("created_at");


-- ── contact_tags ──

CREATE TABLE IF NOT EXISTS "contact_tags" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "contact_pubkey" TEXT NOT NULL,
    "tag" TEXT NOT NULL CHECK("tag" IN ('volunteer', 'member', 'leader', 'media_contact', 'ally', 'potential', 'inactive', 'union_rep', 'steward', 'donor'))
);

CREATE INDEX IF NOT EXISTS "idx_contact_tags_contact_pubkey" ON "contact_tags"("contact_pubkey");
CREATE INDEX IF NOT EXISTS "idx_contact_tags_tag" ON "contact_tags"("tag");


