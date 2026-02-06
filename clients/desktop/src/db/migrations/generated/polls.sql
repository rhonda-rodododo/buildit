-- Polls module tables
-- Generated from protocol/schemas/modules/polls/v1.json
-- Version: 1.0.0

-- ── polls ──

CREATE TABLE IF NOT EXISTS "polls" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "post_id" TEXT,
    "author_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "poll_type" TEXT NOT NULL CHECK("poll_type" IN ('single', 'multiple', 'ranked_choice')),
    "status" TEXT CHECK("status" IN ('draft', 'active', 'closed', 'cancelled')),
    "ends_at" INTEGER NOT NULL,
    "is_ended" INTEGER,
    "total_votes" INTEGER NOT NULL,
    "voter_count" INTEGER,
    "hide_results_until_ended" INTEGER,
    "allow_anonymous_votes" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "nostr_event_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_polls_post_id" ON "polls"("post_id");
CREATE INDEX IF NOT EXISTS "idx_polls_author_id" ON "polls"("author_id");
CREATE INDEX IF NOT EXISTS "idx_polls_status" ON "polls"("status");
CREATE INDEX IF NOT EXISTS "idx_polls_ends_at" ON "polls"("ends_at");
CREATE INDEX IF NOT EXISTS "idx_polls_created_at" ON "polls"("created_at");


-- ── poll_votes ──

CREATE TABLE IF NOT EXISTS "poll_votes" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "poll_id" TEXT NOT NULL,
    "option_ids" TEXT NOT NULL,
    "voter_id" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "nostr_event_id" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_poll_votes_poll_id" ON "poll_votes"("poll_id");
CREATE INDEX IF NOT EXISTS "idx_poll_votes_voter_id" ON "poll_votes"("voter_id");
CREATE INDEX IF NOT EXISTS "idx_poll_votes_poll_id_voter_id" ON "poll_votes"("poll_id", "voter_id");


