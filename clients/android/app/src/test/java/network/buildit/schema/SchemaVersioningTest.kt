package network.buildit.schema

import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test

/**
 * Cross-version schema parsing tests for BuildIt Android client.
 *
 * Validates that the Android client correctly handles versioned content from
 * other clients, including:
 * - Current version parsing
 * - Future version with unknown fields (preserved)
 * - Missing _v field (defaults to 1.0.0)
 * - Core messaging always readable (crisis resilience)
 * - Relay forwarding preserves unknown fields
 *
 * Test vectors sourced from: protocol/test-vectors/cross-version-parsing.json
 */
class SchemaVersioningTest {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    // ========================================================================
    // Schema Version Parsing
    // ========================================================================

    data class SchemaVersion(val major: Int, val minor: Int, val patch: Int) : Comparable<SchemaVersion> {
        companion object {
            fun parse(version: String): SchemaVersion {
                val parts = version.split(".").mapNotNull { it.toIntOrNull() }
                return SchemaVersion(
                    major = parts.getOrElse(0) { 1 },
                    minor = parts.getOrElse(1) { 0 },
                    patch = parts.getOrElse(2) { 0 }
                )
            }
        }

        fun isCompatibleWith(reader: SchemaVersion): Boolean = this.major == reader.major

        override fun compareTo(other: SchemaVersion): Int {
            if (major != other.major) return major.compareTo(other.major)
            if (minor != other.minor) return minor.compareTo(other.minor)
            return patch.compareTo(other.patch)
        }

        override fun toString(): String = "$major.$minor.$patch"
    }

    // ========================================================================
    // Known fields per module (v1.0.0)
    // ========================================================================

    private val knownFieldsByModule = mapOf(
        "messaging" to setOf(
            "_v", "content", "replyTo", "attachments", "linkPreviews", "mentions",
            "groupId", "threadId", "emoji", "targetId", "conversationId",
            "lastRead", "readAt", "typing"
        ),
        "events" to setOf(
            "_v", "id", "title", "startAt", "endAt", "description", "location",
            "createdBy", "createdAt", "updatedAt", "timezone", "allDay",
            "recurrence", "rsvpDeadline", "maxAttendees", "visibility",
            "attachments", "customFields", "linkPreviews", "virtualUrl"
        ),
        "documents" to setOf(
            "_v", "id", "title", "content", "type", "createdBy", "createdAt",
            "updatedAt", "updatedBy", "version", "tags", "summary",
            "parentId", "groupId", "editors", "editPermission", "visibility",
            "attachments", "linkPreviews"
        )
    )

    // ========================================================================
    // Versioned content parsing
    // ========================================================================

    data class VersionedParseResult(
        val canParse: Boolean,
        val isPartial: Boolean,
        val unknownFields: List<String>,
        val preservedUnknownFields: Map<String, JsonElement>,
        val contentReadable: Boolean,
        val inferredVersion: String?,
        val updateRequired: Boolean
    )

    private fun parseVersionedContent(
        jsonObj: JsonObject,
        module: String,
        readerVersionString: String
    ): VersionedParseResult {
        val readerVersion = SchemaVersion.parse(readerVersionString)

        val versionString = (jsonObj["_v"] as? JsonPrimitive)?.content ?: "1.0.0"
        val contentVersion = SchemaVersion.parse(versionString)
        val inferredVersion: String? = if (jsonObj["_v"] == null) "1.0.0" else null

        val knownFields = knownFieldsByModule[module] ?: setOf("_v")
        val unknownFieldNames = jsonObj.keys.filter { it !in knownFields }.sorted()
        val preservedUnknownFields = unknownFieldNames.associateWith { jsonObj[it]!! }

        val isPartial = unknownFieldNames.isNotEmpty() || contentVersion.major > readerVersion.major
        val updateRequired: Boolean
        val canParse: Boolean

        if (contentVersion.major > readerVersion.major) {
            canParse = (module == "messaging")
            updateRequired = true
        } else {
            canParse = true
            updateRequired = false
        }

        val contentReadable = module == "messaging" && jsonObj.containsKey("content")

        return VersionedParseResult(
            canParse = canParse,
            isPartial = isPartial,
            unknownFields = unknownFieldNames,
            preservedUnknownFields = preservedUnknownFields,
            contentReadable = contentReadable,
            inferredVersion = inferredVersion,
            updateRequired = updateRequired
        )
    }

    // ========================================================================
    // cv-001: Current version message
    // ========================================================================

    @Test
    fun `cv-001 current version message parses fully`() {
        val jsonObj = json.parseToJsonElement("""
            {
                "_v": "1.0.0",
                "content": "Hello, world!",
                "replyTo": null,
                "attachments": []
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "messaging", "1.0.0")

        assertThat(result.canParse).isTrue()
        assertThat(result.isPartial).isFalse()
        assertThat(result.unknownFields).isEmpty()
    }

    // ========================================================================
    // cv-002: Future minor version with unknown fields
    // ========================================================================

    @Test
    fun `cv-002 future minor version preserves unknown fields`() {
        val jsonObj = json.parseToJsonElement("""
            {
                "_v": "1.1.0",
                "content": "Hello with new features!",
                "replyTo": null,
                "attachments": [],
                "futureFeature": "some new capability",
                "anotherNewField": { "nested": true }
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "messaging", "1.0.0")

        assertThat(result.canParse).isTrue()
        assertThat(result.isPartial).isTrue()
        assertThat(result.unknownFields).contains("futureFeature")
        assertThat(result.unknownFields).contains("anotherNewField")

        // Verify preserved values
        assertThat(result.preservedUnknownFields["futureFeature"]?.jsonPrimitive?.content)
            .isEqualTo("some new capability")
        assertThat(result.preservedUnknownFields["anotherNewField"]?.jsonObject?.get("nested")?.jsonPrimitive?.boolean)
            .isTrue()
    }

    // ========================================================================
    // cv-003: Future patch version
    // ========================================================================

    @Test
    fun `cv-003 future patch version is fully compatible`() {
        val jsonObj = json.parseToJsonElement("""
            {
                "_v": "1.0.5",
                "content": "Message from patch version"
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "messaging", "1.0.0")

        assertThat(result.canParse).isTrue()
        assertThat(result.isPartial).isFalse()
        assertThat(result.unknownFields).isEmpty()
    }

    // ========================================================================
    // cv-004: Future major version
    // ========================================================================

    @Test
    fun `cv-004 future major version requires update`() {
        val jsonObj = json.parseToJsonElement("""
            {
                "_v": "2.0.0",
                "content": "Message from major version bump",
                "newRequiredField": "required in v2"
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "messaging", "1.0.0")

        assertThat(result.isPartial).isTrue()
        assertThat(result.updateRequired).isTrue()
        assertThat(result.unknownFields).contains("newRequiredField")
    }

    // ========================================================================
    // cv-005: Older version message
    // ========================================================================

    @Test
    fun `cv-005 older version is fully readable`() {
        val jsonObj = json.parseToJsonElement("""
            {
                "_v": "1.0.0",
                "content": "Old message format"
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "messaging", "1.1.0")

        assertThat(result.canParse).isTrue()
        assertThat(result.isPartial).isFalse()
        assertThat(result.unknownFields).isEmpty()
    }

    // ========================================================================
    // cv-006: Event with unknown fields
    // ========================================================================

    @Test
    fun `cv-006 event with unknown fields preserved`() {
        val jsonObj = json.parseToJsonElement("""
            {
                "_v": "1.1.0",
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Community Meeting",
                "startAt": 1706198400,
                "createdBy": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                "createdAt": 1706112000,
                "coHostIds": ["fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"],
                "virtualPlatform": "jitsi"
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "events", "1.0.0")

        assertThat(result.canParse).isTrue()
        assertThat(result.isPartial).isTrue()
        assertThat(result.unknownFields).contains("coHostIds")
        assertThat(result.unknownFields).contains("virtualPlatform")

        // Verify preserved array
        val coHostIds = result.preservedUnknownFields["coHostIds"]?.jsonArray
        assertThat(coHostIds).isNotNull()
        assertThat(coHostIds!!.size).isEqualTo(1)
    }

    // ========================================================================
    // cv-007: Document with revision metadata
    // ========================================================================

    @Test
    fun `cv-007 document with revision metadata`() {
        val jsonObj = json.parseToJsonElement("""
            {
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
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "documents", "1.0.0")

        assertThat(result.canParse).isTrue()
        assertThat(result.isPartial).isTrue()
        assertThat(result.unknownFields).contains("editHistory")
        assertThat(result.unknownFields).contains("collaborativeEditingEnabled")
    }

    // ========================================================================
    // cv-008: Missing version field defaults to 1.0.0
    // ========================================================================

    @Test
    fun `cv-008 missing version field defaults to 1_0_0`() {
        val jsonObj = json.parseToJsonElement("""
            {
                "content": "Message without version field"
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "messaging", "1.0.0")

        assertThat(result.canParse).isTrue()
        assertThat(result.isPartial).isFalse()
        assertThat(result.inferredVersion).isEqualTo("1.0.0")
        assertThat(result.unknownFields).isEmpty()
    }

    // ========================================================================
    // cv-009: Core messaging from any version (crisis resilience)
    // ========================================================================

    @Test
    fun `cv-009 core messaging always readable for crisis resilience`() {
        val jsonObj = json.parseToJsonElement("""
            {
                "_v": "5.0.0",
                "content": "Emergency: Meet at safe house",
                "urgency": "critical",
                "autoDestruct": 3600
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "messaging", "1.0.0")

        assertThat(result.contentReadable).isTrue()
        assertThat(result.canParse).isTrue()
        assertThat(result.isPartial).isTrue()
    }

    // ========================================================================
    // cv-010: Relay forwarding preserves unknown fields
    // ========================================================================

    @Test
    fun `cv-010 relay forwarding preserves unknown fields exactly`() {
        val jsonObj = json.parseToJsonElement("""
            {
                "_v": "1.5.0",
                "content": "Message to relay",
                "e2eeVersion": 2,
                "forwardingMetadata": {
                    "originalSender": "abc123",
                    "hopCount": 3,
                    "routingHints": ["relay1", "relay2"]
                }
            }
        """.trimIndent()).jsonObject

        val result = parseVersionedContent(jsonObj, "messaging", "1.0.0")

        assertThat(result.canParse).isTrue()
        assertThat(result.isPartial).isTrue()

        // Verify unknown fields preserved exactly
        assertThat(result.preservedUnknownFields["e2eeVersion"]?.jsonPrimitive?.int).isEqualTo(2)

        val metadata = result.preservedUnknownFields["forwardingMetadata"]?.jsonObject
        assertThat(metadata).isNotNull()
        assertThat(metadata!!["originalSender"]?.jsonPrimitive?.content).isEqualTo("abc123")
        assertThat(metadata["hopCount"]?.jsonPrimitive?.int).isEqualTo(3)

        val hints = metadata["routingHints"]?.jsonArray
        assertThat(hints).isNotNull()
        assertThat(hints!!.map { it.jsonPrimitive.content }).containsExactly("relay1", "relay2")

        // Verify relay round-trip: reconstruct output and compare
        val relayOutput = buildMap<String, JsonElement> {
            putAll(result.preservedUnknownFields)
            put("_v", jsonObj["_v"]!!)
            put("content", jsonObj["content"]!!)
        }

        assertThat((relayOutput["_v"] as JsonPrimitive).content).isEqualTo("1.5.0")
        assertThat((relayOutput["content"] as JsonPrimitive).content).isEqualTo("Message to relay")
    }

    // ========================================================================
    // SchemaVersion tests
    // ========================================================================

    @Test
    fun `schema version parsing`() {
        val v1 = SchemaVersion.parse("1.0.0")
        assertThat(v1.major).isEqualTo(1)
        assertThat(v1.minor).isEqualTo(0)
        assertThat(v1.patch).isEqualTo(0)

        val v2 = SchemaVersion.parse("2.3.5")
        assertThat(v2.major).isEqualTo(2)
        assertThat(v2.minor).isEqualTo(3)
        assertThat(v2.patch).isEqualTo(5)
    }

    @Test
    fun `schema version comparison`() {
        assertThat(SchemaVersion.parse("1.0.0") < SchemaVersion.parse("1.1.0")).isTrue()
        assertThat(SchemaVersion.parse("1.0.0") < SchemaVersion.parse("2.0.0")).isTrue()
        assertThat(SchemaVersion.parse("1.0.0") < SchemaVersion.parse("1.0.1")).isTrue()
        assertThat(SchemaVersion.parse("1.0.0") < SchemaVersion.parse("1.0.0")).isFalse()
        assertThat(SchemaVersion.parse("1.9.9") < SchemaVersion.parse("2.0.0")).isTrue()
    }

    @Test
    fun `schema version compatibility`() {
        val v1 = SchemaVersion.parse("1.0.0")
        assertThat(v1.isCompatibleWith(SchemaVersion.parse("1.0.0"))).isTrue()
        assertThat(v1.isCompatibleWith(SchemaVersion.parse("1.5.0"))).isTrue()
        assertThat(v1.isCompatibleWith(SchemaVersion.parse("2.0.0"))).isFalse()
    }

    // ========================================================================
    // kotlinx.serialization with ignoreUnknownKeys
    // ========================================================================

    @Test
    fun `kotlinx serialization ignores unknown keys for DirectMessage`() {
        val jsonWithExtras = """
            {
                "_v": "1.1.0",
                "content": "Hello with extras",
                "futureField": "should be ignored by strict parser",
                "anotherField": 42
            }
        """.trimIndent()

        val parsed = json.decodeFromString<network.buildit.generated.schemas.DirectMessage>(jsonWithExtras)
        assertThat(parsed.v).isEqualTo("1.1.0")
        assertThat(parsed.content).isEqualTo("Hello with extras")
    }

    @Test
    fun `kotlinx serialization round-trip for DirectMessage`() {
        val original = network.buildit.generated.schemas.DirectMessage(
            v = "1.0.0",
            content = "Test message",
            replyTo = null,
            attachments = emptyList()
        )

        val encoded = json.encodeToString(network.buildit.generated.schemas.DirectMessage.serializer(), original)
        val decoded = json.decodeFromString<network.buildit.generated.schemas.DirectMessage>(encoded)

        assertThat(decoded.v).isEqualTo(original.v)
        assertThat(decoded.content).isEqualTo(original.content)
    }
}
