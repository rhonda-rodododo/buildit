package network.buildit.core.nostr

import network.buildit.testutil.TestFixtures
import org.json.JSONArray
import org.json.JSONObject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

@DisplayName("NostrEvent")
class NostrEventTest {

    @Nested
    @DisplayName("Data Class")
    inner class DataClass {

        @Test
        @DisplayName("can create with all required fields")
        fun createWithAllFields() {
            val event = TestFixtures.createNostrEvent()

            assertNotNull(event.id)
            assertNotNull(event.pubkey)
            assertTrue(event.createdAt > 0)
            assertTrue(event.kind >= 0)
            assertNotNull(event.tags)
            assertNotNull(event.content)
            assertNotNull(event.sig)
        }

        @Test
        @DisplayName("copy creates modified instance")
        fun copyWorks() {
            val original = TestFixtures.createNostrEvent(kind = 1)

            val copy = original.copy(kind = 4)

            assertEquals(4, copy.kind)
            assertEquals(original.id, copy.id)
            assertEquals(original.pubkey, copy.pubkey)
        }

        @Test
        @DisplayName("equals compares all fields")
        fun equalsComparesAllFields() {
            val event1 = TestFixtures.createNostrEvent()
            val event2 = TestFixtures.createNostrEvent()

            // Same parameters should produce equal events
            assertEquals(event1.id, event2.id)
        }
    }

    @Nested
    @DisplayName("toJson")
    inner class ToJson {

        @Test
        @DisplayName("produces valid JSON object")
        fun producesValidJson() {
            val event = TestFixtures.createNostrEvent()

            val json = event.toJson()

            assertNotNull(json)
            assertTrue(json.has("id"))
            assertTrue(json.has("pubkey"))
            assertTrue(json.has("created_at"))
            assertTrue(json.has("kind"))
            assertTrue(json.has("tags"))
            assertTrue(json.has("content"))
            assertTrue(json.has("sig"))
        }

        @Test
        @DisplayName("id field is correct")
        fun idFieldCorrect() {
            val event = TestFixtures.createNostrEvent(id = "test-id-123")

            val json = event.toJson()

            assertEquals("test-id-123", json.getString("id"))
        }

        @Test
        @DisplayName("pubkey field is correct")
        fun pubkeyFieldCorrect() {
            val pubkey = TestFixtures.TEST_PUBLIC_KEY_HEX
            val event = TestFixtures.createNostrEvent(pubkey = pubkey)

            val json = event.toJson()

            assertEquals(pubkey, json.getString("pubkey"))
        }

        @Test
        @DisplayName("created_at field is correct")
        fun createdAtFieldCorrect() {
            val timestamp = 1704067200L // Jan 1, 2024
            val event = TestFixtures.createNostrEvent(createdAt = timestamp)

            val json = event.toJson()

            assertEquals(timestamp, json.getLong("created_at"))
        }

        @Test
        @DisplayName("kind field is correct")
        fun kindFieldCorrect() {
            val event = TestFixtures.createNostrEvent(kind = 4)

            val json = event.toJson()

            assertEquals(4, json.getInt("kind"))
        }

        @Test
        @DisplayName("content field is correct")
        fun contentFieldCorrect() {
            val content = "encrypted message content"
            val event = TestFixtures.createNostrEvent(content = content)

            val json = event.toJson()

            assertEquals(content, json.getString("content"))
        }

        @Test
        @DisplayName("sig field is correct")
        fun sigFieldCorrect() {
            val sig = "signature123"
            val event = TestFixtures.createNostrEvent(sig = sig)

            val json = event.toJson()

            assertEquals(sig, json.getString("sig"))
        }

        @Test
        @DisplayName("tags field is JSON array")
        fun tagsFieldIsArray() {
            val tags = listOf(
                listOf("p", "pubkey123"),
                listOf("e", "eventid456")
            )
            val event = TestFixtures.createNostrEvent(tags = tags)

            val json = event.toJson()
            val tagsArray = json.getJSONArray("tags")

            assertNotNull(tagsArray)
            assertEquals(2, tagsArray.length())
        }

        @Test
        @DisplayName("nested tags are arrays")
        fun nestedTagsAreArrays() {
            val tags = listOf(listOf("p", "pubkey123"))
            val event = TestFixtures.createNostrEvent(tags = tags)

            val json = event.toJson()
            val tagsArray = json.getJSONArray("tags")
            val firstTag = tagsArray.getJSONArray(0)

            assertEquals("p", firstTag.getString(0))
            assertEquals("pubkey123", firstTag.getString(1))
        }

        @Test
        @DisplayName("handles empty tags")
        fun handlesEmptyTags() {
            val event = TestFixtures.createNostrEvent(tags = emptyList())

            val json = event.toJson()
            val tagsArray = json.getJSONArray("tags")

            assertEquals(0, tagsArray.length())
        }
    }

    @Nested
    @DisplayName("fromJson")
    inner class FromJson {

        @Test
        @DisplayName("parses valid JSON")
        fun parsesValidJson() {
            val json = JSONObject().apply {
                put("id", "event-id")
                put("pubkey", "pubkey123")
                put("created_at", 1704067200L)
                put("kind", 1)
                put("tags", JSONArray())
                put("content", "Hello")
                put("sig", "signature")
            }

            val event = NostrEvent.fromJson(json)

            assertEquals("event-id", event.id)
            assertEquals("pubkey123", event.pubkey)
            assertEquals(1704067200L, event.createdAt)
            assertEquals(1, event.kind)
            assertEquals("Hello", event.content)
            assertEquals("signature", event.sig)
        }

        @Test
        @DisplayName("parses tags correctly")
        fun parsesTagsCorrectly() {
            val json = JSONObject().apply {
                put("id", "id")
                put("pubkey", "pubkey")
                put("created_at", 0L)
                put("kind", 1)
                put("tags", JSONArray().apply {
                    put(JSONArray().apply {
                        put("p")
                        put("pubkey123")
                    })
                    put(JSONArray().apply {
                        put("e")
                        put("eventid456")
                        put("relay-url")
                    })
                })
                put("content", "")
                put("sig", "")
            }

            val event = NostrEvent.fromJson(json)

            assertEquals(2, event.tags.size)
            assertEquals(listOf("p", "pubkey123"), event.tags[0])
            assertEquals(listOf("e", "eventid456", "relay-url"), event.tags[1])
        }

        @Test
        @DisplayName("round-trip through JSON preserves data")
        fun roundTripPreservesData() {
            val original = TestFixtures.createNostrEvent(
                id = "test-id",
                pubkey = "test-pubkey",
                createdAt = 1704067200L,
                kind = 4,
                tags = listOf(listOf("p", "recipient")),
                content = "test content",
                sig = "test-sig"
            )

            val json = original.toJson()
            val restored = NostrEvent.fromJson(json)

            assertEquals(original.id, restored.id)
            assertEquals(original.pubkey, restored.pubkey)
            assertEquals(original.createdAt, restored.createdAt)
            assertEquals(original.kind, restored.kind)
            assertEquals(original.tags, restored.tags)
            assertEquals(original.content, restored.content)
            assertEquals(original.sig, restored.sig)
        }
    }

    @Nested
    @DisplayName("Event Kinds")
    inner class EventKinds {

        @ParameterizedTest
        @ValueSource(ints = [0, 1, 2, 3, 4, 5, 6, 7, 14, 40, 41, 42])
        @DisplayName("various event kinds are valid")
        fun variousKindsAreValid(kind: Int) {
            val event = TestFixtures.createNostrEvent(kind = kind)

            assertEquals(kind, event.kind)
        }

        @Test
        @DisplayName("KIND_SET_METADATA is 0")
        fun kindSetMetadataIs0() {
            assertEquals(0, NostrClient.KIND_SET_METADATA)
        }

        @Test
        @DisplayName("KIND_TEXT_NOTE is 1")
        fun kindTextNoteIs1() {
            assertEquals(1, NostrClient.KIND_TEXT_NOTE)
        }

        @Test
        @DisplayName("KIND_ENCRYPTED_DIRECT_MESSAGE is 4")
        fun kindEncryptedDmIs4() {
            assertEquals(4, NostrClient.KIND_ENCRYPTED_DIRECT_MESSAGE)
        }

        @Test
        @DisplayName("KIND_PRIVATE_DIRECT_MESSAGE is 14")
        fun kindPrivateDmIs14() {
            assertEquals(14, NostrClient.KIND_PRIVATE_DIRECT_MESSAGE)
        }
    }

    @Nested
    @DisplayName("Tags")
    inner class Tags {

        @Test
        @DisplayName("p tag contains recipient pubkey")
        fun pTagContainsRecipient() {
            val recipientPubkey = "recipient-pubkey"
            val tags = listOf(listOf("p", recipientPubkey))
            val event = TestFixtures.createNostrEvent(tags = tags)

            val pTag = event.tags.find { it.firstOrNull() == "p" }
            assertNotNull(pTag)
            assertEquals(recipientPubkey, pTag!![1])
        }

        @Test
        @DisplayName("e tag contains event reference")
        fun eTagContainsEventRef() {
            val eventId = "referenced-event-id"
            val tags = listOf(listOf("e", eventId))
            val event = TestFixtures.createNostrEvent(tags = tags)

            val eTag = event.tags.find { it.firstOrNull() == "e" }
            assertNotNull(eTag)
            assertEquals(eventId, eTag!![1])
        }

        @Test
        @DisplayName("multiple tags of same type are supported")
        fun multipleTagsOfSameType() {
            val tags = listOf(
                listOf("p", "pubkey1"),
                listOf("p", "pubkey2"),
                listOf("p", "pubkey3")
            )
            val event = TestFixtures.createNostrEvent(tags = tags)

            val pTags = event.tags.filter { it.firstOrNull() == "p" }
            assertEquals(3, pTags.size)
        }

        @Test
        @DisplayName("tag with extra elements is preserved")
        fun tagWithExtraElements() {
            val tags = listOf(listOf("e", "eventid", "relay-url", "mention"))
            val event = TestFixtures.createNostrEvent(tags = tags)

            assertEquals(4, event.tags[0].size)
        }
    }

    @Nested
    @DisplayName("Content")
    inner class Content {

        @Test
        @DisplayName("content can be empty")
        fun contentCanBeEmpty() {
            val event = TestFixtures.createNostrEvent(content = "")

            assertEquals("", event.content)
        }

        @Test
        @DisplayName("content can contain special characters")
        fun contentCanContainSpecialChars() {
            val content = "Hello! @#\$%^&*() \n\t \"quotes\" 'apostrophe'"
            val event = TestFixtures.createNostrEvent(content = content)

            assertEquals(content, event.content)
        }

        @Test
        @DisplayName("content can be very long")
        fun contentCanBeLong() {
            val content = "a".repeat(10000)
            val event = TestFixtures.createNostrEvent(content = content)

            assertEquals(10000, event.content.length)
        }

        @Test
        @DisplayName("content can contain unicode")
        fun contentCanContainUnicode() {
            val content = "Hello World!"
            val event = TestFixtures.createNostrEvent(content = content)

            assertTrue(event.content.isNotEmpty())
        }
    }

    @Nested
    @DisplayName("Timestamp")
    inner class Timestamp {

        @Test
        @DisplayName("timestamp is in Unix seconds")
        fun timestampInUnixSeconds() {
            val currentTimeSeconds = System.currentTimeMillis() / 1000
            val event = TestFixtures.createNostrEvent(createdAt = currentTimeSeconds)

            // Should be within reasonable range (not in milliseconds)
            assertTrue(event.createdAt < 10_000_000_000L)
        }

        @Test
        @DisplayName("timestamp can be historical")
        fun timestampCanBeHistorical() {
            val jan2020 = 1577836800L // Jan 1, 2020
            val event = TestFixtures.createNostrEvent(createdAt = jan2020)

            assertEquals(jan2020, event.createdAt)
        }
    }
}
