-- CustomFields module tables
-- Generated from protocol/schemas/modules/custom-fields/v1.json
-- Version: 1.0.0

-- ── custom_fields ──

CREATE TABLE IF NOT EXISTS "custom_fields" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" INTEGER DEFAULT 0,
    "description" TEXT,
    "default_value" TEXT,
    "options" TEXT,
    "validation" TEXT,
    "order" INTEGER,
    "group_id" TEXT,
    "module_id" TEXT,
    "created_at" INTEGER,
    "updated_at" INTEGER,
    "entity_type" TEXT NOT NULL,
    "created_by" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_custom_fields_group_id" ON "custom_fields"("group_id");
CREATE INDEX IF NOT EXISTS "idx_custom_fields_entity_type" ON "custom_fields"("entity_type");
CREATE INDEX IF NOT EXISTS "idx_custom_fields_name" ON "custom_fields"("name");
CREATE INDEX IF NOT EXISTS "idx_custom_fields_label" ON "custom_fields"("label");
CREATE INDEX IF NOT EXISTS "idx_custom_fields_created_at" ON "custom_fields"("created_at");
CREATE INDEX IF NOT EXISTS "idx_custom_fields_created_by" ON "custom_fields"("created_by");


-- ── custom_field_values ──

CREATE TABLE IF NOT EXISTS "custom_field_values" (
    "_v" TEXT NOT NULL DEFAULT '1.0.0',
    "field_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" INTEGER,
    "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_custom_field_values_field_id" ON "custom_field_values"("field_id");
CREATE INDEX IF NOT EXISTS "idx_custom_field_values_entity_id" ON "custom_field_values"("entity_id");


