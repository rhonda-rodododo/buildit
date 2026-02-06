-- Training module tables
-- Generated from protocol/schemas/modules/training/v1.json
-- Version: 1.0.0

-- ── courses ──

CREATE TABLE IF NOT EXISTS "courses" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "group_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "category" TEXT NOT NULL CHECK("category" IN ('app-basics', 'opsec', 'digital-security', 'legal', 'medic', 'self-defense', 'organizing', 'communication', 'civil-defense', 'custom')),
    "difficulty" TEXT NOT NULL CHECK("difficulty" IN ('beginner', 'intermediate', 'advanced')),
    "estimated_hours" REAL NOT NULL,
    "prerequisites" TEXT,
    "status" TEXT NOT NULL CHECK("status" IN ('draft', 'published', 'archived')),
    "certification_enabled" INTEGER DEFAULT 0,
    "certification_expiry_days" INTEGER,
    "is_public" INTEGER DEFAULT 0,
    "is_default" INTEGER DEFAULT 0,
    "created" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_courses_group_id" ON "courses"("group_id");
CREATE INDEX IF NOT EXISTS "idx_courses_category" ON "courses"("category");
CREATE INDEX IF NOT EXISTS "idx_courses_difficulty" ON "courses"("difficulty");
CREATE INDEX IF NOT EXISTS "idx_courses_status" ON "courses"("status");
CREATE INDEX IF NOT EXISTS "idx_courses_created_by" ON "courses"("created_by");
CREATE INDEX IF NOT EXISTS "idx_courses_created" ON "courses"("created");


-- ── training_modules ──

CREATE TABLE IF NOT EXISTS "training_modules" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_training_modules_course_id" ON "training_modules"("course_id");
CREATE INDEX IF NOT EXISTS "idx_training_modules_order" ON "training_modules"("order");


-- ── lessons ──

CREATE TABLE IF NOT EXISTS "lessons" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "module_id" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK("type" IN ('video', 'document', 'quiz', 'assignment', 'live-session', 'interactive')),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "required_for_certification" INTEGER DEFAULT 0,
    "passing_score" INTEGER,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "video_url" TEXT,
    "transcript_url" TEXT,
    "captions_url" TEXT,
    "duration" INTEGER,
    "markdown" TEXT,
    "pdf_url" TEXT,
    "questions" TEXT,
    "allow_retakes" INTEGER,
    "max_attempts" INTEGER,
    "shuffle_questions" INTEGER,
    "shuffle_options" INTEGER,
    "show_correct_after" INTEGER,
    "time_limit_minutes" INTEGER,
    "instructions" TEXT,
    "allowed_file_types" TEXT,
    "max_file_size_m_b" INTEGER,
    "rubric" TEXT,
    "scheduled_at" INTEGER,
    "instructor_pubkey" TEXT,
    "conference_room_id" TEXT,
    "recording_url" TEXT,
    "max_participants" INTEGER,
    "requires_r_s_v_p" INTEGER,
    "exercise_type" TEXT CHECK("exercise_type" IN ('threat-model', 'security-audit', 'scenario', 'simulation', 'custom')),
    "config_json" TEXT,
    "external_url" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_lessons_module_id" ON "lessons"("module_id");
CREATE INDEX IF NOT EXISTS "idx_lessons_type" ON "lessons"("type");
CREATE INDEX IF NOT EXISTS "idx_lessons_order" ON "lessons"("order");


-- ── course_progress ──

CREATE TABLE IF NOT EXISTS "course_progress" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "percent_complete" REAL NOT NULL,
    "lessons_completed" INTEGER NOT NULL,
    "total_lessons" INTEGER NOT NULL,
    "current_module_id" TEXT,
    "current_lesson_id" TEXT,
    "started_at" INTEGER NOT NULL,
    "last_activity_at" INTEGER NOT NULL,
    "completed_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_course_progress_course_id" ON "course_progress"("course_id");
CREATE INDEX IF NOT EXISTS "idx_course_progress_pubkey" ON "course_progress"("pubkey");
CREATE INDEX IF NOT EXISTS "idx_course_progress_course_id_pubkey" ON "course_progress"("course_id", "pubkey");


-- ── certifications ──

CREATE TABLE IF NOT EXISTS "certifications" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "earned_at" INTEGER NOT NULL,
    "expires_at" INTEGER,
    "verification_code" TEXT NOT NULL,
    "metadata" TEXT,
    "revoked_at" INTEGER,
    "revoked_by" TEXT,
    "revoke_reason" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_certifications_course_id" ON "certifications"("course_id");
CREATE INDEX IF NOT EXISTS "idx_certifications_pubkey" ON "certifications"("pubkey");
CREATE INDEX IF NOT EXISTS "idx_certifications_verification_code" ON "certifications"("verification_code");


