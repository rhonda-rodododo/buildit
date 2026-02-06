-- Tasks module tables
-- Generated from protocol/schemas/modules/tasks/v1.json
-- Version: 1.0.0

-- ── tasks ──

CREATE TABLE IF NOT EXISTS "tasks" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT CHECK("status" IN ('todo', 'in_progress', 'done', 'cancelled')),
    "priority" TEXT CHECK("priority" IN ('low', 'medium', 'high', 'urgent')),
    "assignee_pubkey" TEXT,
    "created_by" TEXT NOT NULL,
    "due_date" INTEGER,
    "completed_at" INTEGER,
    "tags" TEXT,
    "checklist" TEXT,
    "parent_task_id" TEXT,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_tasks_group_id" ON "tasks"("group_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_assignee_pubkey" ON "tasks"("assignee_pubkey");
CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks"("status");
CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks"("due_date");
CREATE INDEX IF NOT EXISTS "idx_tasks_created_by" ON "tasks"("created_by");


