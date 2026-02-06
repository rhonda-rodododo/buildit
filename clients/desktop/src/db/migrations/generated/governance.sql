-- Governance module tables
-- Generated from protocol/schemas/modules/governance/v1.json
-- Version: 1.0.0

-- ── proposals ──

CREATE TABLE IF NOT EXISTS "proposals" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL CHECK("type" IN ('general', 'policy', 'budget', 'election', 'amendment', 'action', 'resolution')),
    "status" TEXT NOT NULL CHECK("status" IN ('draft', 'discussion', 'voting', 'passed', 'rejected', 'expired', 'withdrawn', 'implemented')),
    "voting_system" TEXT NOT NULL CHECK("voting_system" IN ('simple-majority', 'supermajority', 'ranked-choice', 'approval', 'quadratic', 'd-hondt', 'consensus', 'modified-consensus')),
    "options" TEXT NOT NULL,
    "quorum" TEXT,
    "threshold" TEXT,
    "discussion_period" TEXT,
    "voting_period" TEXT NOT NULL,
    "allow_abstain" INTEGER DEFAULT 1,
    "anonymous_voting" INTEGER DEFAULT 0,
    "allow_delegation" INTEGER DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER,
    "attachments" TEXT,
    "tags" TEXT,
    "quadratic_config" TEXT,
    "custom_fields" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_proposals_group_id" ON "proposals"("group_id");
CREATE INDEX IF NOT EXISTS "idx_proposals_type" ON "proposals"("type");
CREATE INDEX IF NOT EXISTS "idx_proposals_status" ON "proposals"("status");
CREATE INDEX IF NOT EXISTS "idx_proposals_voting_system" ON "proposals"("voting_system");
CREATE INDEX IF NOT EXISTS "idx_proposals_created_by" ON "proposals"("created_by");
CREATE INDEX IF NOT EXISTS "idx_proposals_created_at" ON "proposals"("created_at");
CREATE INDEX IF NOT EXISTS "idx_proposals_updated_at" ON "proposals"("updated_at");


-- ── votes ──

CREATE TABLE IF NOT EXISTS "votes" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "proposal_id" TEXT NOT NULL,
    "voter_id" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "weight" REAL DEFAULT 1,
    "delegated_from" TEXT,
    "comment" TEXT,
    "cast_at" INTEGER NOT NULL,
    "signature" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_votes_proposal_id" ON "votes"("proposal_id");
CREATE INDEX IF NOT EXISTS "idx_votes_voter_id" ON "votes"("voter_id");
CREATE INDEX IF NOT EXISTS "idx_votes_cast_at" ON "votes"("cast_at");
CREATE INDEX IF NOT EXISTS "idx_votes_proposal_id_voter_id" ON "votes"("proposal_id", "voter_id");


-- ── delegations ──

CREATE TABLE IF NOT EXISTS "delegations" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "delegator_id" TEXT NOT NULL,
    "delegate_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL CHECK("scope" IN ('all', 'category', 'proposal')),
    "category_tags" TEXT,
    "proposal_id" TEXT,
    "valid_from" INTEGER,
    "valid_until" INTEGER,
    "revoked" INTEGER DEFAULT 0,
    "created_at" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_delegations_delegator_id" ON "delegations"("delegator_id");
CREATE INDEX IF NOT EXISTS "idx_delegations_delegate_id" ON "delegations"("delegate_id");
CREATE INDEX IF NOT EXISTS "idx_delegations_scope" ON "delegations"("scope");
CREATE INDEX IF NOT EXISTS "idx_delegations_created_at" ON "delegations"("created_at");


