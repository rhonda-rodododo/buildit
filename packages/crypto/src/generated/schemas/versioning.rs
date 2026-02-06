//! Schema versioning support for cross-version content parsing.
//!
//! This module provides:
//! - Semantic version parsing and comparison
//! - Versioned content parsing with unknown field preservation
//! - Cross-version compatibility checking
//!
//! All BuildIt clients must implement equivalent logic to ensure
//! interoperability across schema versions.

use crate::error::CryptoError;
use serde_json::Value;
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::fmt;

/// Default schema version when `_v` field is absent
pub const DEFAULT_VERSION: &str = "1.0.0";

/// Semantic version for schema comparison
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SchemaVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl SchemaVersion {
    /// Parse a version string like "1.2.3" with strict validation.
    ///
    /// Requires exactly 3 dot-separated numeric components (MAJOR.MINOR.PATCH).
    /// Rejects empty strings, non-numeric parts, and wrong number of segments.
    pub fn parse(version: &str) -> Result<Self, CryptoError> {
        let parts: Vec<&str> = version.split('.').collect();

        if parts.len() != 3 {
            return Err(CryptoError::InvalidVersion);
        }

        let major = parts[0].parse::<u32>().map_err(|_| CryptoError::InvalidVersion)?;
        let minor = parts[1].parse::<u32>().map_err(|_| CryptoError::InvalidVersion)?;
        let patch = parts[2].parse::<u32>().map_err(|_| CryptoError::InvalidVersion)?;

        Ok(SchemaVersion { major, minor, patch })
    }

    /// Parse a version string, defaulting to "1.0.0" if the input is empty or absent.
    ///
    /// Use this for the `_v` field in schema content where a missing version
    /// should default to "1.0.0" per the versioning spec.
    pub fn parse_or_default(version: &str) -> Result<Self, CryptoError> {
        if version.is_empty() {
            return Ok(SchemaVersion { major: 1, minor: 0, patch: 0 });
        }
        Self::parse(version)
    }

    /// Check if this version is compatible with a reader version.
    /// Same major version = compatible (minor/patch add optional fields).
    pub fn is_compatible_with(&self, reader: &SchemaVersion) -> bool {
        self.major == reader.major
    }
}

impl fmt::Display for SchemaVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

impl Ord for SchemaVersion {
    fn cmp(&self, other: &Self) -> Ordering {
        self.major
            .cmp(&other.major)
            .then(self.minor.cmp(&other.minor))
            .then(self.patch.cmp(&other.patch))
    }
}

impl PartialOrd for SchemaVersion {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Result of parsing versioned content
#[derive(Debug, Clone)]
pub struct VersionedParseResult {
    /// Whether the content can be meaningfully parsed
    pub can_parse: bool,
    /// Whether the parse is partial (unknown fields present or major version gap)
    pub is_partial: bool,
    /// Names of fields not recognized by the reader
    pub unknown_fields: Vec<String>,
    /// Preserved unknown field values for relay forwarding
    pub preserved_unknown_fields: HashMap<String, Value>,
    /// Whether the core content field is readable (critical for messaging)
    pub content_readable: bool,
    /// Version inferred when `_v` is missing (always "1.0.0")
    pub inferred_version: Option<String>,
    /// Whether a client update is required (major version gap)
    pub update_required: bool,
}

/// Returns the set of known field names for a given module at v1.0.0
fn known_fields_for_module(module: &str) -> HashSet<&'static str> {
    match module {
        "messaging" => [
            "_v", "content", "replyTo", "attachments", "linkPreviews", "mentions",
            "groupId", "threadId", "emoji", "targetId", "conversationId",
            "lastRead", "readAt", "typing",
        ]
        .iter()
        .copied()
        .collect(),

        "events" => [
            "_v", "id", "title", "startAt", "endAt", "description", "location",
            "createdBy", "createdAt", "updatedAt", "timezone", "allDay",
            "recurrence", "rsvpDeadline", "maxAttendees", "visibility",
            "attachments", "customFields", "linkPreviews", "virtualUrl",
        ]
        .iter()
        .copied()
        .collect(),

        "documents" => [
            "_v", "id", "title", "content", "type", "createdBy", "createdAt",
            "updatedAt", "updatedBy", "version", "tags", "summary",
            "parentId", "groupId", "editors", "editPermission", "visibility",
            "attachments", "linkPreviews",
        ]
        .iter()
        .copied()
        .collect(),

        _ => ["_v"].iter().copied().collect(),
    }
}

/// Parse versioned JSON content and determine compatibility.
///
/// This function implements the core versioning logic that all BuildIt
/// clients must follow:
///
/// 1. Missing `_v` defaults to "1.0.0"
/// 2. Same major version = compatible, unknown fields preserved
/// 3. Major version gap = update required (but messaging content always readable)
/// 4. Unknown fields must be preserved exactly for relay forwarding
pub fn parse_versioned_content(
    json: &Value,
    module: &str,
    reader_version_str: &str,
) -> VersionedParseResult {
    let reader_version = match SchemaVersion::parse(reader_version_str) {
        Ok(v) => v,
        Err(_) => {
            return VersionedParseResult {
                can_parse: false,
                is_partial: false,
                unknown_fields: vec![],
                preserved_unknown_fields: HashMap::new(),
                content_readable: false,
                inferred_version: None,
                update_required: false,
            }
        }
    };

    let obj = match json.as_object() {
        Some(o) => o,
        None => {
            return VersionedParseResult {
                can_parse: false,
                is_partial: false,
                unknown_fields: vec![],
                preserved_unknown_fields: HashMap::new(),
                content_readable: false,
                inferred_version: None,
                update_required: false,
            }
        }
    };

    // Default _v to "1.0.0" if missing
    let version_string = obj
        .get("_v")
        .and_then(|v| v.as_str())
        .unwrap_or(DEFAULT_VERSION);
    let content_version = match SchemaVersion::parse(version_string) {
        Ok(v) => v,
        Err(_) => {
            return VersionedParseResult {
                can_parse: false,
                is_partial: false,
                unknown_fields: vec![],
                preserved_unknown_fields: HashMap::new(),
                content_readable: false,
                inferred_version: None,
                update_required: false,
            }
        }
    };
    let inferred_version = if obj.get("_v").is_none() {
        Some(DEFAULT_VERSION.to_string())
    } else {
        None
    };

    // Find unknown fields
    let known_fields = known_fields_for_module(module);
    let mut unknown_fields: Vec<String> = obj
        .keys()
        .filter(|k| !known_fields.contains(k.as_str()))
        .cloned()
        .collect();
    unknown_fields.sort();

    let preserved_unknown_fields: HashMap<String, Value> = unknown_fields
        .iter()
        .filter_map(|k| obj.get(k).map(|v| (k.clone(), v.clone())))
        .collect();

    // Determine compatibility
    let is_partial =
        !unknown_fields.is_empty() || content_version.major > reader_version.major;

    let (can_parse, update_required) = if content_version.major > reader_version.major {
        // Major version gap: messaging content always readable, others may not be
        let can = module == "messaging";
        (can, true)
    } else {
        (true, false)
    };

    // Core messaging: content field is always readable
    let content_readable = module == "messaging" && obj.contains_key("content");

    VersionedParseResult {
        can_parse,
        is_partial,
        unknown_fields,
        preserved_unknown_fields,
        content_readable,
        inferred_version,
        update_required,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ================================================================
    // SchemaVersion tests
    // ================================================================

    #[test]
    fn test_schema_version_parsing() {
        let v = SchemaVersion::parse("1.0.0").unwrap();
        assert_eq!(v.major, 1);
        assert_eq!(v.minor, 0);
        assert_eq!(v.patch, 0);

        let v = SchemaVersion::parse("2.3.5").unwrap();
        assert_eq!(v.major, 2);
        assert_eq!(v.minor, 3);
        assert_eq!(v.patch, 5);
    }

    #[test]
    fn test_schema_version_comparison() {
        assert!(SchemaVersion::parse("1.0.0").unwrap() < SchemaVersion::parse("1.1.0").unwrap());
        assert!(SchemaVersion::parse("1.0.0").unwrap() < SchemaVersion::parse("2.0.0").unwrap());
        assert!(SchemaVersion::parse("1.0.0").unwrap() < SchemaVersion::parse("1.0.1").unwrap());
        assert!(!(SchemaVersion::parse("1.0.0").unwrap() < SchemaVersion::parse("1.0.0").unwrap()));
        assert!(SchemaVersion::parse("1.9.9").unwrap() < SchemaVersion::parse("2.0.0").unwrap());
    }

    #[test]
    fn test_schema_version_compatibility() {
        let v1 = SchemaVersion::parse("1.0.0").unwrap();
        assert!(v1.is_compatible_with(&SchemaVersion::parse("1.0.0").unwrap()));
        assert!(v1.is_compatible_with(&SchemaVersion::parse("1.5.0").unwrap()));
        assert!(!v1.is_compatible_with(&SchemaVersion::parse("2.0.0").unwrap()));
    }

    #[test]
    fn test_schema_version_display() {
        assert_eq!(SchemaVersion::parse("1.2.3").unwrap().to_string(), "1.2.3");
    }

    #[test]
    fn test_schema_version_rejects_malformed() {
        // Empty string
        assert!(SchemaVersion::parse("").is_err());
        // Non-numeric
        assert!(SchemaVersion::parse("abc").is_err());
        assert!(SchemaVersion::parse("1.2.abc").is_err());
        // Wrong number of segments
        assert!(SchemaVersion::parse("1").is_err());
        assert!(SchemaVersion::parse("1.2").is_err());
        assert!(SchemaVersion::parse("1.2.3.4").is_err());
        assert!(SchemaVersion::parse("1.2.3.4.5").is_err());
        // Negative numbers
        assert!(SchemaVersion::parse("-1.0.0").is_err());
        // Spaces
        assert!(SchemaVersion::parse("1. 2.3").is_err());

        // parse_or_default handles empty string gracefully
        let v = SchemaVersion::parse_or_default("").unwrap();
        assert_eq!(v.major, 1);
        assert_eq!(v.minor, 0);
        assert_eq!(v.patch, 0);

        // parse_or_default still validates non-empty strings
        assert!(SchemaVersion::parse_or_default("abc").is_err());
        assert!(SchemaVersion::parse_or_default("1.2").is_err());
    }

    // ================================================================
    // cv-001: Current version message
    // ================================================================

    #[test]
    fn test_cv001_current_version_message() {
        let input = json!({
            "_v": "1.0.0",
            "content": "Hello, world!",
            "replyTo": null,
            "attachments": []
        });

        let result = parse_versioned_content(&input, "messaging", "1.0.0");

        assert!(result.can_parse, "cv-001: Current version should be fully parseable");
        assert!(!result.is_partial, "cv-001: No unknown fields means not partial");
        assert!(
            result.unknown_fields.is_empty(),
            "cv-001: Should have no unknown fields"
        );
    }

    // ================================================================
    // cv-002: Future minor version with unknown fields
    // ================================================================

    #[test]
    fn test_cv002_future_minor_version_preserves_unknown_fields() {
        let input = json!({
            "_v": "1.1.0",
            "content": "Hello with new features!",
            "replyTo": null,
            "attachments": [],
            "futureFeature": "some new capability",
            "anotherNewField": { "nested": true }
        });

        let result = parse_versioned_content(&input, "messaging", "1.0.0");

        assert!(result.can_parse, "cv-002: Same major version should be parseable");
        assert!(result.is_partial, "cv-002: Unknown fields means partial parse");
        assert!(
            result.unknown_fields.contains(&"futureFeature".to_string()),
            "cv-002: futureFeature should be in unknown fields"
        );
        assert!(
            result.unknown_fields.contains(&"anotherNewField".to_string()),
            "cv-002: anotherNewField should be in unknown fields"
        );

        // Verify preserved values
        assert_eq!(
            result.preserved_unknown_fields["futureFeature"],
            json!("some new capability"),
            "cv-002: futureFeature value should be preserved"
        );
        assert_eq!(
            result.preserved_unknown_fields["anotherNewField"],
            json!({"nested": true}),
            "cv-002: anotherNewField value should be preserved with nested structure"
        );
    }

    // ================================================================
    // cv-003: Future patch version
    // ================================================================

    #[test]
    fn test_cv003_future_patch_version_fully_compatible() {
        let input = json!({
            "_v": "1.0.5",
            "content": "Message from patch version"
        });

        let result = parse_versioned_content(&input, "messaging", "1.0.0");

        assert!(
            result.can_parse,
            "cv-003: Patch version should be fully parseable"
        );
        assert!(!result.is_partial, "cv-003: Patch version should not be partial");
        assert!(
            result.unknown_fields.is_empty(),
            "cv-003: No unknown fields expected"
        );
    }

    // ================================================================
    // cv-004: Future major version
    // ================================================================

    #[test]
    fn test_cv004_future_major_version_requires_update() {
        let input = json!({
            "_v": "2.0.0",
            "content": "Message from major version bump",
            "newRequiredField": "required in v2"
        });

        let result = parse_versioned_content(&input, "messaging", "1.0.0");

        assert!(result.is_partial, "cv-004: Major version bump is partial");
        assert!(
            result.update_required,
            "cv-004: Major version bump requires update"
        );
        assert!(
            result.unknown_fields.contains(&"newRequiredField".to_string()),
            "cv-004: newRequiredField should be unknown"
        );
        // Messaging canParse is true because core content is always readable
        assert!(
            result.can_parse,
            "cv-004: Messaging canParse should be true even for major version gap"
        );
    }

    // ================================================================
    // cv-005: Older version message
    // ================================================================

    #[test]
    fn test_cv005_older_version_fully_readable() {
        let input = json!({
            "_v": "1.0.0",
            "content": "Old message format"
        });

        let result = parse_versioned_content(&input, "messaging", "1.1.0");

        assert!(
            result.can_parse,
            "cv-005: Older version should always be parseable"
        );
        assert!(!result.is_partial, "cv-005: Older version should not be partial");
        assert!(
            result.unknown_fields.is_empty(),
            "cv-005: No unknown fields expected"
        );
    }

    // ================================================================
    // cv-006: Event with unknown fields
    // ================================================================

    #[test]
    fn test_cv006_event_with_unknown_fields_preserved() {
        let input = json!({
            "_v": "1.1.0",
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Community Meeting",
            "startAt": 1706198400,
            "createdBy": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "createdAt": 1706112000,
            "coHostIds": ["fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"],
            "virtualPlatform": "jitsi"
        });

        let result = parse_versioned_content(&input, "events", "1.0.0");

        assert!(result.can_parse, "cv-006: Same major version event should parse");
        assert!(result.is_partial, "cv-006: Unknown fields means partial");
        assert!(
            result.unknown_fields.contains(&"coHostIds".to_string()),
            "cv-006: coHostIds should be unknown"
        );
        assert!(
            result.unknown_fields.contains(&"virtualPlatform".to_string()),
            "cv-006: virtualPlatform should be unknown"
        );

        // Verify preserved array
        let co_host_ids = result.preserved_unknown_fields["coHostIds"]
            .as_array()
            .expect("cv-006: coHostIds should be preserved as array");
        assert_eq!(co_host_ids.len(), 1, "cv-006: coHostIds should have 1 element");
    }

    // ================================================================
    // cv-007: Document with revision metadata
    // ================================================================

    #[test]
    fn test_cv007_document_with_revision_metadata() {
        let input = json!({
            "_v": "1.2.0",
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Team Guidelines",
            "content": "# Guidelines\n\nOur team follows...",
            "type": "markdown",
            "createdBy": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "createdAt": 1706112000,
            "editHistory": [
                { "version": 1, "editedAt": 1706112000, "editedBy": "abc123" },
                { "version": 2, "editedAt": 1706200000, "editedBy": "def456" }
            ],
            "collaborativeEditingEnabled": true
        });

        let result = parse_versioned_content(&input, "documents", "1.0.0");

        assert!(
            result.can_parse,
            "cv-007: Same major version document should parse"
        );
        assert!(result.is_partial, "cv-007: Unknown fields means partial");
        assert!(
            result.unknown_fields.contains(&"editHistory".to_string()),
            "cv-007: editHistory should be unknown"
        );
        assert!(
            result
                .unknown_fields
                .contains(&"collaborativeEditingEnabled".to_string()),
            "cv-007: collaborativeEditingEnabled should be unknown"
        );
    }

    // ================================================================
    // cv-008: Missing version field defaults to 1.0.0
    // ================================================================

    #[test]
    fn test_cv008_missing_version_defaults_to_100() {
        let input = json!({
            "content": "Message without version field"
        });

        let result = parse_versioned_content(&input, "messaging", "1.0.0");

        assert!(
            result.can_parse,
            "cv-008: Missing version should default to 1.0.0 and parse"
        );
        assert!(!result.is_partial, "cv-008: Should not be partial");
        assert_eq!(
            result.inferred_version,
            Some("1.0.0".to_string()),
            "cv-008: Inferred version should be 1.0.0"
        );
        assert!(
            result.unknown_fields.is_empty(),
            "cv-008: No unknown fields"
        );
    }

    // ================================================================
    // cv-009: Core messaging from any version (crisis resilience)
    // ================================================================

    #[test]
    fn test_cv009_core_messaging_always_readable() {
        let input = json!({
            "_v": "5.0.0",
            "content": "Emergency: Meet at safe house",
            "urgency": "critical",
            "autoDestruct": 3600
        });

        let result = parse_versioned_content(&input, "messaging", "1.0.0");

        assert!(
            result.content_readable,
            "cv-009: Core messaging content MUST always be readable (crisis resilience)"
        );
        assert!(
            result.can_parse,
            "cv-009: Messaging canParse should be true even for major version gap"
        );
        assert!(result.is_partial, "cv-009: Far future version is partial");
    }

    // ================================================================
    // cv-010: Relay forwarding preserves unknown fields
    // ================================================================

    #[test]
    fn test_cv010_relay_forwarding_preserves_unknown_fields() {
        let input = json!({
            "_v": "1.5.0",
            "content": "Message to relay",
            "e2eeVersion": 2,
            "forwardingMetadata": {
                "originalSender": "abc123",
                "hopCount": 3,
                "routingHints": ["relay1", "relay2"]
            }
        });

        let result = parse_versioned_content(&input, "messaging", "1.0.0");

        assert!(result.can_parse, "cv-010: Same major version should parse");
        assert!(result.is_partial, "cv-010: Has unknown fields");

        // Verify unknown fields are preserved exactly
        assert_eq!(
            result.preserved_unknown_fields["e2eeVersion"],
            json!(2),
            "cv-010: e2eeVersion must be preserved exactly"
        );

        let metadata = result.preserved_unknown_fields["forwardingMetadata"]
            .as_object()
            .expect("cv-010: forwardingMetadata must be preserved as object");
        assert_eq!(
            metadata["originalSender"],
            json!("abc123"),
            "cv-010: Nested fields must be preserved exactly"
        );
        assert_eq!(
            metadata["hopCount"],
            json!(3),
            "cv-010: Nested numeric fields must be preserved exactly"
        );
        assert_eq!(
            metadata["routingHints"],
            json!(["relay1", "relay2"]),
            "cv-010: Nested arrays must be preserved exactly"
        );

        // Verify relay round-trip: reconstruct and compare
        let mut relay_output = serde_json::Map::new();
        for (k, v) in &result.preserved_unknown_fields {
            relay_output.insert(k.clone(), v.clone());
        }
        relay_output.insert(
            "_v".to_string(),
            input.as_object().unwrap()["_v"].clone(),
        );
        relay_output.insert(
            "content".to_string(),
            input.as_object().unwrap()["content"].clone(),
        );

        assert_eq!(
            relay_output["_v"],
            json!("1.5.0"),
            "cv-010: Relay output _v must match input"
        );
        assert_eq!(
            relay_output["content"],
            json!("Message to relay"),
            "cv-010: Relay output content must match input"
        );
    }

    // ================================================================
    // serde round-trip tests with generated types
    // ================================================================

    #[test]
    fn test_direct_message_serde_round_trip() {
        use super::super::messaging::DirectMessage;

        let json_str = r#"{
            "_v": "1.0.0",
            "content": "Hello, world!",
            "replyTo": null,
            "attachments": []
        }"#;

        let msg: DirectMessage = serde_json::from_str(json_str).expect("Should deserialize");
        assert_eq!(msg.v, "1.0.0");
        assert_eq!(msg.content, "Hello, world!");
        assert!(msg.reply_to.is_none());

        // Re-encode
        let re_encoded = serde_json::to_string(&msg).expect("Should serialize");
        let re_decoded: DirectMessage =
            serde_json::from_str(&re_encoded).expect("Should re-deserialize");
        assert_eq!(re_decoded.v, msg.v);
        assert_eq!(re_decoded.content, msg.content);
    }

    #[test]
    fn test_event_serde_round_trip() {
        use super::super::events::Event;

        let json_str = r#"{
            "_v": "1.0.0",
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Community Meeting",
            "startAt": 1706198400,
            "createdBy": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "createdAt": 1706112000
        }"#;

        let event: Event = serde_json::from_str(json_str).expect("Should deserialize");
        assert_eq!(event.v, "1.0.0");
        assert_eq!(event.title, "Community Meeting");

        let re_encoded = serde_json::to_string(&event).expect("Should serialize");
        let re_decoded: Event =
            serde_json::from_str(&re_encoded).expect("Should re-deserialize");
        assert_eq!(re_decoded.v, event.v);
        assert_eq!(re_decoded.title, event.title);
    }

    #[test]
    fn test_document_serde_round_trip() {
        use super::super::documents::Document;

        let json_str = r#"{
            "_v": "1.0.0",
            "id": "doc-001",
            "title": "Test Document",
            "content": "Some content",
            "type": "markdown",
            "createdBy": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "createdAt": 1706112000
        }"#;

        let doc: Document = serde_json::from_str(json_str).expect("Should deserialize");
        assert_eq!(doc.v, "1.0.0");
        assert_eq!(doc.title, "Test Document");

        let re_encoded = serde_json::to_string(&doc).expect("Should serialize");
        let re_decoded: Document =
            serde_json::from_str(&re_encoded).expect("Should re-deserialize");
        assert_eq!(re_decoded.v, doc.v);
        assert_eq!(re_decoded.title, doc.title);
    }

    // ================================================================
    // Version constant tests
    // ================================================================

    #[test]
    fn test_messaging_version_constants() {
        use super::super::messaging::{MESSAGING_MIN_READER_VERSION, MESSAGING_VERSION};
        assert_eq!(MESSAGING_VERSION, "1.0.0");
        assert_eq!(MESSAGING_MIN_READER_VERSION, "1.0.0");
    }

    #[test]
    fn test_events_version_constants() {
        use super::super::events::{EVENTS_MIN_READER_VERSION, EVENTS_VERSION};
        assert_eq!(EVENTS_VERSION, "1.0.0");
        assert_eq!(EVENTS_MIN_READER_VERSION, "1.0.0");
    }

    #[test]
    fn test_documents_version_constants() {
        use super::super::documents::{DOCUMENTS_MIN_READER_VERSION, DOCUMENTS_VERSION};
        assert_eq!(DOCUMENTS_VERSION, "1.0.0");
        assert_eq!(DOCUMENTS_MIN_READER_VERSION, "1.0.0");
    }
}
