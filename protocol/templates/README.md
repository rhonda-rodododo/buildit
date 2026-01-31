# BuildIt Protocol Templates

Cross-platform template definitions for the BuildIt organizing platform. These JSON template files serve as the **single source of truth** for all built-in templates across every client (web/desktop, iOS, Android).

## Directory Structure

```
protocol/templates/
├── _schema.json                          # Template meta-schema (validates all JSON files)
├── calling/
│   └── hotline-templates.json            # 10 hotline message templates with variable substitution
├── database/
│   └── built-in-templates.json           # 4 database templates (Contacts, Projects, Inventory, Events)
├── crm/
│   ├── single-table-templates.json       # 5 single-table CRM templates (Union, Fundraising, Legal, etc.)
│   └── multi-table-templates.json        # 8 multi-table CRM templates (NLG, Tenant, Nonprofit, etc.)
├── forms/
│   └── form-templates.json               # 2 form templates (Event Registration, Volunteer Signup)
├── documents/
│   └── document-templates.json           # 6 document templates (Meeting Notes, Proposal, Press Release, etc.)
├── training/
│   └── course-templates.json             # 4 training courses (App Basics, OpSec, Digital Security, Jail Support)
└── README.md                             # This file
```

## Schema

All template JSON files conform to `_schema.json`. The protocol-level schema definition used for codegen lives at:

```
protocol/schemas/modules/templates/v1.json
```

This schema defines typed interfaces for all template content structures and is used to generate platform-specific types via `bun run codegen`.

## Template Structure

Every template JSON file follows a common envelope:

```json
{
  "$schema": "../_schema.json",
  "module": "calling",
  "version": "1.0.0",
  "description": "Human-readable description of this collection",
  "templates": [
    {
      "id": "unique-kebab-case-id",
      "name": "Display Name",
      "description": "What this template provides",
      "category": "grouping-category",
      "icon": "IconName",
      "tags": ["searchable", "tags"],
      "content": { }
    }
  ]
}
```

The `content` object varies by module:

| Module | Content Structure |
|--------|------------------|
| **Calling** | `{ message, variables, shortcut }` |
| **Database** | `{ tables, relationships }` |
| **CRM (single)** | `{ fields, defaultViews }` |
| **CRM (multi)** | `{ tableCount, tables, tableDescriptions, integrations }` |
| **Forms** | `{ title, backingTable, settings }` |
| **Documents** | `{ html }` |
| **Training** | `{ difficulty, estimatedHours, modules: [{ lessons }] }` |

## Adding a New Template

1. **Choose the correct module directory** under `protocol/templates/`
2. **Add your template** to the appropriate JSON file's `templates` array
3. **Follow the schema** -- use `_schema.json` as reference for required fields
4. **Use kebab-case** for the template `id` (e.g., `my-new-template`)
5. **Include all required fields**: `id`, `name`, `description`, `content`
6. **Bump the collection version** if making breaking changes
7. **Run validation**: `bun run validate` from the repo root

### Example: Adding a New Calling Template

```json
{
  "id": "callback-request",
  "name": "Callback Request",
  "description": "Request caller's preferred callback time",
  "category": "General",
  "tags": ["callback", "scheduling"],
  "content": {
    "message": "Thank you, {{caller_name}}. What is the best time and number to reach you for a callback?",
    "variables": ["caller_name"],
    "shortcut": null
  }
}
```

### Example: Adding a New Database Template

```json
{
  "id": "bug-tracker",
  "name": "Bug Tracker",
  "description": "Track bugs and issues with priority and status",
  "category": "project",
  "icon": "Bug",
  "tags": ["bugs", "issues", "tracking"],
  "content": {
    "tables": [
      {
        "name": "Bugs",
        "description": "Bug reports",
        "fields": [
          { "name": "title", "label": "Title", "schema": { "type": "string", "required": true }, "widget": { "widget": "text" }, "order": 0 },
          { "name": "severity", "label": "Severity", "schema": { "type": "string" }, "widget": { "widget": "select", "options": [{ "value": "critical", "label": "Critical" }, { "value": "high", "label": "High" }] }, "order": 1 }
        ]
      }
    ],
    "relationships": []
  }
}
```

## How Clients Load Templates

Templates are loaded at build time or app initialization. The approach varies by platform:

### Web/Desktop (TypeScript)
Templates are imported as JSON modules and validated against the generated TypeScript types from `protocol/schemas/modules/templates/v1.json`.

### iOS (Swift)
Templates are bundled in the app and decoded using Codable structs generated from the schema via codegen.

### Android (Kotlin)
Templates are loaded from the assets directory and deserialized using data classes generated from the schema via codegen.

### Offline Distribution
Template bundles can propagate via BLE mesh networking, allowing groups to share template updates without internet connectivity.

## Variable Substitution (Calling Templates)

Calling templates support `{{variable_name}}` placeholders. Available context variables:

| Variable | Description |
|----------|-------------|
| `hotline_name` | Name of the hotline |
| `operator_name` | Current operator's display name |
| `caller_name` | Caller's name (if known) |
| `date` | Current date (auto-populated) |
| `time` | Current time (auto-populated) |

## Versioning

- Each template collection has a `version` field following semver
- Individual templates can optionally have their own `version`
- The protocol schema (`v1.json`) follows the standard schema versioning pattern
- Breaking changes to the template structure require a new schema version

## Related Files

| File | Purpose |
|------|---------|
| `protocol/schemas/modules/templates/v1.json` | JSON Schema for codegen |
| `protocol/templates/_schema.json` | Meta-schema for template validation |
| `protocol/schemas/modules/_registry.json` | Module registry (register templates module here) |
