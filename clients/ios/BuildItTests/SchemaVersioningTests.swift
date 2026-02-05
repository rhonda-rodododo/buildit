// SchemaVersioningTests.swift
// BuildIt - Decentralized Mesh Communication
//
// Tests for cross-version schema parsing. Validates that BuildIt iOS client
// correctly handles versioned content from other clients, including:
// - Current version parsing
// - Future version with unknown fields (preserved)
// - Missing _v field (defaults to 1.0.0)
// - Core messaging always readable (crisis resilience)
// - Relay forwarding preserves unknown fields
//
// Test vectors sourced from: protocol/test-vectors/cross-version-parsing.json

import XCTest
@testable import BuildIt

// MARK: - Schema Versioning Support Types

/// Semantic version for schema comparison
struct SchemaVersion: Comparable, Equatable, CustomStringConvertible {
    let major: Int
    let minor: Int
    let patch: Int

    init(_ string: String) {
        let parts = string.split(separator: ".").compactMap { Int($0) }
        self.major = parts.count > 0 ? parts[0] : 1
        self.minor = parts.count > 1 ? parts[1] : 0
        self.patch = parts.count > 2 ? parts[2] : 0
    }

    var description: String { "\(major).\(minor).\(patch)" }

    static func < (lhs: SchemaVersion, rhs: SchemaVersion) -> Bool {
        if lhs.major != rhs.major { return lhs.major < rhs.major }
        if lhs.minor != rhs.minor { return lhs.minor < rhs.minor }
        return lhs.patch < rhs.patch
    }

    /// Same major version means compatible (minor/patch add optional fields)
    func isCompatible(with reader: SchemaVersion) -> Bool {
        return self.major == reader.major
    }
}

/// Result of parsing versioned content
struct VersionedParseResult {
    let canParse: Bool
    let isPartial: Bool
    let unknownFields: [String]
    let preservedUnknownFields: [String: Any]
    let contentReadable: Bool
    let inferredVersion: String?
    let updateRequired: Bool
}

/// Parses versioned content and determines compatibility.
/// This is the core logic that each platform must implement.
func parseVersionedContent(
    json: [String: Any],
    module: String,
    readerVersionString: String
) -> VersionedParseResult {
    let readerVersion = SchemaVersion(readerVersionString)

    // Default _v to "1.0.0" if missing
    let versionString = json["_v"] as? String ?? "1.0.0"
    let contentVersion = SchemaVersion(versionString)
    let inferredVersion: String? = (json["_v"] == nil) ? "1.0.0" : nil

    // Determine known fields per module
    let knownFields = knownFieldsForModule(module)

    // Find unknown fields
    let unknownFieldNames = json.keys.filter { !knownFields.contains($0) }
    var preservedUnknownFields: [String: Any] = [:]
    for key in unknownFieldNames {
        if let value = json[key] {
            preservedUnknownFields[key] = value
        }
    }

    // Determine parsing capability
    let sameMajor = contentVersion.major == readerVersion.major
    let isPartial = !unknownFieldNames.isEmpty || contentVersion.major > readerVersion.major
    let canParse: Bool
    let updateRequired: Bool

    if contentVersion.major > readerVersion.major {
        // Major version bump: cannot fully parse, update required
        // But for core messaging, content field is always readable
        canParse = (module == "messaging") ? true : false
        updateRequired = true
    } else {
        canParse = true
        updateRequired = false
    }

    // Core messaging content field is always readable
    let contentReadable = (module == "messaging" && json["content"] != nil)

    return VersionedParseResult(
        canParse: canParse,
        isPartial: isPartial,
        unknownFields: unknownFieldNames.sorted(),
        preservedUnknownFields: preservedUnknownFields,
        contentReadable: contentReadable,
        inferredVersion: inferredVersion,
        updateRequired: updateRequired
    )
}

/// Returns the set of known field names for a given module at v1.0.0
private func knownFieldsForModule(_ module: String) -> Set<String> {
    switch module {
    case "messaging":
        return ["_v", "content", "replyTo", "attachments", "linkPreviews", "mentions",
                "groupId", "threadId", "emoji", "targetId", "conversationId",
                "lastRead", "readAt", "typing"]
    case "events":
        return ["_v", "id", "title", "startAt", "endAt", "description", "location",
                "createdBy", "createdAt", "updatedAt", "timezone", "allDay",
                "recurrence", "rsvpDeadline", "maxAttendees", "visibility",
                "attachments", "customFields", "linkPreviews", "virtualUrl"]
    case "documents":
        return ["_v", "id", "title", "content", "type", "createdBy", "createdAt",
                "updatedAt", "updatedBy", "version", "tags", "summary",
                "parentId", "groupId", "editors", "editPermission", "visibility",
                "attachments", "linkPreviews"]
    default:
        return ["_v"]
    }
}

// MARK: - Test Cases

final class SchemaVersioningTests: XCTestCase {

    // MARK: cv-001: Current version message

    func testCurrentVersionMessageParsesFullly() throws {
        let json: [String: Any] = [
            "_v": "1.0.0",
            "content": "Hello, world!",
            "replyTo": NSNull(),
            "attachments": [] as [Any]
        ]

        let result = parseVersionedContent(json: json, module: "messaging", readerVersionString: "1.0.0")

        XCTAssertTrue(result.canParse, "cv-001: Current version should be fully parseable")
        XCTAssertFalse(result.isPartial, "cv-001: No unknown fields means not partial")
        XCTAssertTrue(result.unknownFields.isEmpty, "cv-001: Should have no unknown fields")
    }

    // MARK: cv-002: Future minor version with unknown fields

    func testFutureMinorVersionPreservesUnknownFields() throws {
        let json: [String: Any] = [
            "_v": "1.1.0",
            "content": "Hello with new features!",
            "replyTo": NSNull(),
            "attachments": [] as [Any],
            "futureFeature": "some new capability",
            "anotherNewField": ["nested": true] as [String: Any]
        ]

        let result = parseVersionedContent(json: json, module: "messaging", readerVersionString: "1.0.0")

        XCTAssertTrue(result.canParse, "cv-002: Same major version should be parseable")
        XCTAssertTrue(result.isPartial, "cv-002: Unknown fields means partial parse")
        XCTAssertTrue(result.unknownFields.contains("futureFeature"),
                      "cv-002: futureFeature should be in unknown fields")
        XCTAssertTrue(result.unknownFields.contains("anotherNewField"),
                      "cv-002: anotherNewField should be in unknown fields")

        // Verify preserved values
        XCTAssertEqual(result.preservedUnknownFields["futureFeature"] as? String,
                      "some new capability",
                      "cv-002: futureFeature value should be preserved")
        let nestedField = result.preservedUnknownFields["anotherNewField"] as? [String: Any]
        XCTAssertNotNil(nestedField, "cv-002: anotherNewField should be preserved as dict")
        XCTAssertEqual(nestedField?["nested"] as? Bool, true,
                      "cv-002: Nested field value should be preserved")
    }

    // MARK: cv-003: Future patch version

    func testFuturePatchVersionIsFullyCompatible() throws {
        let json: [String: Any] = [
            "_v": "1.0.5",
            "content": "Message from patch version"
        ]

        let result = parseVersionedContent(json: json, module: "messaging", readerVersionString: "1.0.0")

        XCTAssertTrue(result.canParse, "cv-003: Patch version should be fully parseable")
        XCTAssertFalse(result.isPartial, "cv-003: Patch version should not be partial")
        XCTAssertTrue(result.unknownFields.isEmpty, "cv-003: No unknown fields expected")
    }

    // MARK: cv-004: Future major version

    func testFutureMajorVersionRequiresUpdate() throws {
        let json: [String: Any] = [
            "_v": "2.0.0",
            "content": "Message from major version bump",
            "newRequiredField": "required in v2"
        ]

        let result = parseVersionedContent(json: json, module: "messaging", readerVersionString: "1.0.0")

        // For messaging module, canParse is true because core content is always readable
        XCTAssertTrue(result.isPartial, "cv-004: Major version bump is partial")
        XCTAssertTrue(result.updateRequired, "cv-004: Major version bump requires update")
        XCTAssertTrue(result.unknownFields.contains("newRequiredField"),
                      "cv-004: newRequiredField should be unknown")
    }

    // MARK: cv-005: Older version message

    func testOlderVersionIsFullyReadable() throws {
        let json: [String: Any] = [
            "_v": "1.0.0",
            "content": "Old message format"
        ]

        let result = parseVersionedContent(json: json, module: "messaging", readerVersionString: "1.1.0")

        XCTAssertTrue(result.canParse, "cv-005: Older version should always be parseable")
        XCTAssertFalse(result.isPartial, "cv-005: Older version should not be partial")
        XCTAssertTrue(result.unknownFields.isEmpty, "cv-005: No unknown fields expected")
    }

    // MARK: cv-006: Event with unknown fields

    func testEventWithUnknownFieldsPreserved() throws {
        let json: [String: Any] = [
            "_v": "1.1.0",
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Community Meeting",
            "startAt": 1706198400,
            "createdBy": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "createdAt": 1706112000,
            "coHostIds": ["fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"],
            "virtualPlatform": "jitsi"
        ]

        let result = parseVersionedContent(json: json, module: "events", readerVersionString: "1.0.0")

        XCTAssertTrue(result.canParse, "cv-006: Same major version event should parse")
        XCTAssertTrue(result.isPartial, "cv-006: Unknown fields means partial")
        XCTAssertTrue(result.unknownFields.contains("coHostIds"),
                      "cv-006: coHostIds should be unknown")
        XCTAssertTrue(result.unknownFields.contains("virtualPlatform"),
                      "cv-006: virtualPlatform should be unknown")

        // Verify preserved array
        let coHostIds = result.preservedUnknownFields["coHostIds"] as? [String]
        XCTAssertNotNil(coHostIds, "cv-006: coHostIds should be preserved as array")
        XCTAssertEqual(coHostIds?.count, 1, "cv-006: coHostIds should have 1 element")
    }

    // MARK: cv-007: Document with revision metadata

    func testDocumentWithRevisionMetadata() throws {
        let json: [String: Any] = [
            "_v": "1.2.0",
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Team Guidelines",
            "content": "# Guidelines\n\nOur team follows...",
            "type": "markdown",
            "createdBy": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "createdAt": 1706112000,
            "editHistory": [
                ["version": 1, "editedAt": 1706112000, "editedBy": "abc123"],
                ["version": 2, "editedAt": 1706200000, "editedBy": "def456"]
            ] as [[String: Any]],
            "collaborativeEditingEnabled": true
        ]

        let result = parseVersionedContent(json: json, module: "documents", readerVersionString: "1.0.0")

        XCTAssertTrue(result.canParse, "cv-007: Same major version document should parse")
        XCTAssertTrue(result.isPartial, "cv-007: Unknown fields means partial")
        XCTAssertTrue(result.unknownFields.contains("editHistory"),
                      "cv-007: editHistory should be unknown")
        XCTAssertTrue(result.unknownFields.contains("collaborativeEditingEnabled"),
                      "cv-007: collaborativeEditingEnabled should be unknown")
    }

    // MARK: cv-008: Missing version field defaults to 1.0.0

    func testMissingVersionFieldDefaultsTo100() throws {
        let json: [String: Any] = [
            "content": "Message without version field"
        ]

        let result = parseVersionedContent(json: json, module: "messaging", readerVersionString: "1.0.0")

        XCTAssertTrue(result.canParse, "cv-008: Missing version should default to 1.0.0 and parse")
        XCTAssertFalse(result.isPartial, "cv-008: Should not be partial")
        XCTAssertEqual(result.inferredVersion, "1.0.0",
                      "cv-008: Inferred version should be 1.0.0")
        XCTAssertTrue(result.unknownFields.isEmpty, "cv-008: No unknown fields")
    }

    // MARK: cv-009: Core messaging from any version (crisis resilience)

    func testCoreMessagingAlwaysReadable() throws {
        let json: [String: Any] = [
            "_v": "5.0.0",
            "content": "Emergency: Meet at safe house",
            "urgency": "critical",
            "autoDestruct": 3600
        ]

        let result = parseVersionedContent(json: json, module: "messaging", readerVersionString: "1.0.0")

        XCTAssertTrue(result.contentReadable,
                      "cv-009: Core messaging content MUST always be readable (crisis resilience)")
        XCTAssertTrue(result.canParse,
                      "cv-009: Messaging canParse should be true even for major version gap")
        XCTAssertTrue(result.isPartial, "cv-009: Far future version is partial")
    }

    // MARK: cv-010: Relay forwarding preserves unknown fields

    func testRelayForwardingPreservesUnknownFields() throws {
        let json: [String: Any] = [
            "_v": "1.5.0",
            "content": "Message to relay",
            "e2eeVersion": 2,
            "forwardingMetadata": [
                "originalSender": "abc123",
                "hopCount": 3,
                "routingHints": ["relay1", "relay2"]
            ] as [String: Any]
        ]

        let result = parseVersionedContent(json: json, module: "messaging", readerVersionString: "1.0.0")

        XCTAssertTrue(result.canParse, "cv-010: Same major version should parse")
        XCTAssertTrue(result.isPartial, "cv-010: Has unknown fields")

        // Verify unknown fields are preserved exactly
        XCTAssertEqual(result.preservedUnknownFields["e2eeVersion"] as? Int, 2,
                      "cv-010: e2eeVersion must be preserved exactly")

        let metadata = result.preservedUnknownFields["forwardingMetadata"] as? [String: Any]
        XCTAssertNotNil(metadata, "cv-010: forwardingMetadata must be preserved")
        XCTAssertEqual(metadata?["originalSender"] as? String, "abc123",
                      "cv-010: Nested fields must be preserved exactly")
        XCTAssertEqual(metadata?["hopCount"] as? Int, 3,
                      "cv-010: Nested numeric fields must be preserved exactly")

        let hints = metadata?["routingHints"] as? [String]
        XCTAssertEqual(hints, ["relay1", "relay2"],
                      "cv-010: Nested arrays must be preserved exactly")

        // Verify relay output would be identical (round-trip)
        var relayOutput = result.preservedUnknownFields
        relayOutput["_v"] = json["_v"]
        relayOutput["content"] = json["content"]

        XCTAssertEqual(relayOutput["_v"] as? String, "1.5.0",
                      "cv-010: Relay output _v must match input")
        XCTAssertEqual(relayOutput["content"] as? String, "Message to relay",
                      "cv-010: Relay output content must match input")
    }

    // MARK: - SchemaVersion Tests

    func testSchemaVersionParsing() throws {
        let v1 = SchemaVersion("1.0.0")
        XCTAssertEqual(v1.major, 1)
        XCTAssertEqual(v1.minor, 0)
        XCTAssertEqual(v1.patch, 0)

        let v2 = SchemaVersion("2.3.5")
        XCTAssertEqual(v2.major, 2)
        XCTAssertEqual(v2.minor, 3)
        XCTAssertEqual(v2.patch, 5)
    }

    func testSchemaVersionComparison() throws {
        XCTAssertTrue(SchemaVersion("1.0.0") < SchemaVersion("1.1.0"))
        XCTAssertTrue(SchemaVersion("1.0.0") < SchemaVersion("2.0.0"))
        XCTAssertTrue(SchemaVersion("1.0.0") < SchemaVersion("1.0.1"))
        XCTAssertFalse(SchemaVersion("1.0.0") < SchemaVersion("1.0.0"))
        XCTAssertTrue(SchemaVersion("1.9.9") < SchemaVersion("2.0.0"))
    }

    func testSchemaVersionCompatibility() throws {
        let v1 = SchemaVersion("1.0.0")
        XCTAssertTrue(v1.isCompatible(with: SchemaVersion("1.0.0")))
        XCTAssertTrue(v1.isCompatible(with: SchemaVersion("1.5.0")))
        XCTAssertFalse(v1.isCompatible(with: SchemaVersion("2.0.0")))
    }

    // MARK: - Codable Round-Trip Tests

    func testDirectMessageCodableRoundTrip() throws {
        let jsonString = """
        {
            "_v": "1.0.0",
            "content": "Hello, world!",
            "replyTo": null,
            "attachments": []
        }
        """
        let data = jsonString.data(using: .utf8)!
        let decoder = JSONDecoder()

        let message = try decoder.decode(DirectMessage.self, from: data)
        XCTAssertEqual(message.v, "1.0.0")
        XCTAssertEqual(message.content, "Hello, world!")
        XCTAssertNil(message.replyTo)

        // Re-encode
        let encoder = JSONEncoder()
        let reEncoded = try encoder.encode(message)
        let reDecoded = try decoder.decode(DirectMessage.self, from: reEncoded)
        XCTAssertEqual(reDecoded.v, message.v)
        XCTAssertEqual(reDecoded.content, message.content)
    }

    func testDirectMessageWithOptionalVersionField() throws {
        // The _v field is required in the schema, but we should handle
        // the default gracefully when parsing raw JSON
        let jsonString = """
        {
            "_v": "1.0.0",
            "content": "Test message"
        }
        """
        let data = jsonString.data(using: .utf8)!
        let decoder = JSONDecoder()
        let message = try decoder.decode(DirectMessage.self, from: data)
        XCTAssertEqual(message.v, "1.0.0")
        XCTAssertEqual(message.content, "Test message")
    }

    // MARK: - Schema Constants

    func testMessagingSchemaVersionConstants() throws {
        XCTAssertEqual(MessagingSchema.version, "1.0.0",
                      "Messaging module should be at version 1.0.0")
        XCTAssertEqual(MessagingSchema.minReaderVersion, "1.0.0",
                      "Messaging min reader version should be 1.0.0")
    }

    func testEventsSchemaVersionConstants() throws {
        XCTAssertEqual(EventsSchema.version, "1.0.0",
                      "Events module should be at version 1.0.0")
        XCTAssertEqual(EventsSchema.minReaderVersion, "1.0.0",
                      "Events min reader version should be 1.0.0")
    }

    func testDocumentsSchemaVersionConstants() throws {
        XCTAssertEqual(DocumentsSchema.version, "1.0.0",
                      "Documents module should be at version 1.0.0")
        XCTAssertEqual(DocumentsSchema.minReaderVersion, "1.0.0",
                      "Documents min reader version should be 1.0.0")
    }
}
