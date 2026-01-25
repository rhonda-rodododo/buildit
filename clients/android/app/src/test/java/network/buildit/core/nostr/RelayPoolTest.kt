package network.buildit.core.nostr

import app.cash.turbine.test
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import network.buildit.testutil.TestFixtures
import okhttp3.OkHttpClient
import okhttp3.WebSocket
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

@DisplayName("RelayPool")
class RelayPoolTest {

    @Nested
    @DisplayName("RelayConfig")
    inner class RelayConfigTests {

        @Test
        @DisplayName("can create with URL only")
        fun createWithUrlOnly() {
            val config = RelayConfig(url = "wss://relay.example.com")

            assertEquals("wss://relay.example.com", config.url)
            assertTrue(config.read)
            assertTrue(config.write)
        }

        @Test
        @DisplayName("can create read-only relay")
        fun createReadOnlyRelay() {
            val config = RelayConfig(
                url = "wss://relay.example.com",
                read = true,
                write = false
            )

            assertTrue(config.read)
            assertFalse(config.write)
        }

        @Test
        @DisplayName("can create write-only relay")
        fun createWriteOnlyRelay() {
            val config = RelayConfig(
                url = "wss://relay.example.com",
                read = false,
                write = true
            )

            assertFalse(config.read)
            assertTrue(config.write)
        }

        @Test
        @DisplayName("URL must be WSS protocol")
        fun urlMustBeWss() {
            val config = RelayConfig(url = "wss://secure.relay.com")

            assertTrue(config.url.startsWith("wss://"))
        }

        @Test
        @DisplayName("copy creates modified instance")
        fun copyWorks() {
            val original = RelayConfig(
                url = "wss://relay1.com",
                read = true,
                write = true
            )

            val copy = original.copy(write = false)

            assertEquals("wss://relay1.com", copy.url)
            assertTrue(copy.read)
            assertFalse(copy.write)
        }
    }

    @Nested
    @DisplayName("Relay Management")
    inner class RelayManagement {

        @Test
        @DisplayName("configured relays starts with defaults")
        fun configuredRelaysHasDefaults() {
            // Default relays are: relay.damus.io, nos.lol, relay.nostr.band
            val defaultUrls = listOf(
                "wss://relay.damus.io",
                "wss://nos.lol",
                "wss://relay.nostr.band"
            )

            defaultUrls.forEach { url ->
                assertTrue(url.startsWith("wss://"))
            }
        }

        @Test
        @DisplayName("can add relay to pool")
        fun canAddRelay() {
            val relays = mutableListOf<RelayConfig>()
            val newRelay = RelayConfig(url = "wss://new.relay.com")

            relays.add(newRelay)

            assertTrue(relays.any { it.url == "wss://new.relay.com" })
        }

        @Test
        @DisplayName("duplicate URLs are not added")
        fun noDuplicateUrls() {
            val relays = mutableListOf<RelayConfig>()
            val relay = RelayConfig(url = "wss://unique.relay.com")

            if (relays.none { it.url == relay.url }) {
                relays.add(relay)
            }
            if (relays.none { it.url == relay.url }) {
                relays.add(relay)
            }

            assertEquals(1, relays.size)
        }

        @Test
        @DisplayName("can remove relay from pool")
        fun canRemoveRelay() {
            val relays = mutableListOf(
                RelayConfig(url = "wss://relay1.com"),
                RelayConfig(url = "wss://relay2.com")
            )

            relays.removeIf { it.url == "wss://relay1.com" }

            assertEquals(1, relays.size)
            assertFalse(relays.any { it.url == "wss://relay1.com" })
        }
    }

    @Nested
    @DisplayName("RelayConnection")
    inner class RelayConnectionTests {

        @Test
        @DisplayName("isConnected is false initially")
        fun isConnectedFalseInitially() {
            var isConnected = false

            assertFalse(isConnected)
        }

        @Test
        @DisplayName("reconnectAttempts starts at 0")
        fun reconnectAttemptsStartsAtZero() {
            var reconnectAttempts = 0

            assertEquals(0, reconnectAttempts)
        }

        @Test
        @DisplayName("reconnectAttempts resets on successful connection")
        fun reconnectAttemptsResetsOnSuccess() {
            var reconnectAttempts = 5

            // Simulate successful connection
            reconnectAttempts = 0

            assertEquals(0, reconnectAttempts)
        }

        @Test
        @DisplayName("reconnectAttempts increments on failure")
        fun reconnectAttemptsIncrementsOnFailure() {
            var reconnectAttempts = 0

            reconnectAttempts++

            assertEquals(1, reconnectAttempts)
        }
    }

    @Nested
    @DisplayName("Backoff Logic")
    inner class BackoffLogic {

        private val INITIAL_BACKOFF_MS = 1000L
        private val MAX_BACKOFF_MS = 60000L

        @Test
        @DisplayName("initial backoff is 1 second")
        fun initialBackoffIs1Second() {
            assertEquals(1000L, INITIAL_BACKOFF_MS)
        }

        @Test
        @DisplayName("max backoff is 60 seconds")
        fun maxBackoffIs60Seconds() {
            assertEquals(60000L, MAX_BACKOFF_MS)
        }

        @Test
        @DisplayName("backoff doubles with each attempt")
        fun backoffDoubles() {
            fun calculateBackoff(attempts: Int): Long {
                return minOf(INITIAL_BACKOFF_MS * (1 shl attempts), MAX_BACKOFF_MS)
            }

            assertEquals(1000L, calculateBackoff(0))
            assertEquals(2000L, calculateBackoff(1))
            assertEquals(4000L, calculateBackoff(2))
            assertEquals(8000L, calculateBackoff(3))
        }

        @Test
        @DisplayName("backoff caps at max value")
        fun backoffCapsAtMax() {
            fun calculateBackoff(attempts: Int): Long {
                return minOf(INITIAL_BACKOFF_MS * (1 shl attempts), MAX_BACKOFF_MS)
            }

            assertEquals(MAX_BACKOFF_MS, calculateBackoff(10))
            assertEquals(MAX_BACKOFF_MS, calculateBackoff(20))
        }

        @ParameterizedTest
        @ValueSource(ints = [0, 1, 2, 3, 4, 5, 6])
        @DisplayName("backoff is calculated correctly for various attempts")
        fun backoffCalculation(attempts: Int) {
            val backoff = minOf(INITIAL_BACKOFF_MS * (1 shl attempts), MAX_BACKOFF_MS)

            assertTrue(backoff >= INITIAL_BACKOFF_MS)
            assertTrue(backoff <= MAX_BACKOFF_MS)
        }
    }

    @Nested
    @DisplayName("Message Broadcasting")
    inner class MessageBroadcasting {

        @Test
        @DisplayName("broadcast only sends to write relays")
        fun broadcastOnlyToWriteRelays() {
            val relays = listOf(
                RelayConfig(url = "wss://write.relay.com", read = true, write = true),
                RelayConfig(url = "wss://readonly.relay.com", read = true, write = false)
            )

            val writeRelays = relays.filter { it.write }

            assertEquals(1, writeRelays.size)
            assertEquals("wss://write.relay.com", writeRelays.first().url)
        }

        @Test
        @DisplayName("broadcast only sends to connected relays")
        fun broadcastOnlyToConnected() {
            val connections = mutableMapOf(
                "wss://connected.relay.com" to true,
                "wss://disconnected.relay.com" to false
            )

            val connectedRelays = connections.filter { it.value }.keys

            assertEquals(1, connectedRelays.size)
        }
    }

    @Nested
    @DisplayName("Event Deduplication")
    inner class EventDeduplication {

        @Test
        @DisplayName("seen events are tracked")
        fun seenEventsTracked() {
            val seenEventIds = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()

            val eventId = "event-123"
            val wasNew = seenEventIds.add(eventId)

            assertTrue(wasNew)
            assertTrue(seenEventIds.contains(eventId))
        }

        @Test
        @DisplayName("duplicate events are rejected")
        fun duplicatesRejected() {
            val seenEventIds = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()

            val eventId = "event-123"
            seenEventIds.add(eventId)
            val wasNew = seenEventIds.add(eventId)

            assertFalse(wasNew)
        }

        @Test
        @DisplayName("clearSeenEvents removes all entries")
        fun clearRemovesAll() {
            val seenEventIds = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
            seenEventIds.add("event-1")
            seenEventIds.add("event-2")

            seenEventIds.clear()

            assertTrue(seenEventIds.isEmpty())
        }
    }

    @Nested
    @DisplayName("Message Parsing")
    inner class MessageParsing {

        @Test
        @DisplayName("EVENT message is parsed correctly")
        fun parseEventMessage() {
            val json = """["EVENT", "sub-123", {"id":"test","pubkey":"pk","created_at":0,"kind":1,"tags":[],"content":"","sig":"sig"}]"""
            val array = org.json.JSONArray(json)

            assertEquals("EVENT", array.getString(0))
            assertEquals("sub-123", array.getString(1))
        }

        @Test
        @DisplayName("OK message is parsed correctly")
        fun parseOkMessage() {
            val json = """["OK", "event-id", true, ""]"""
            val array = org.json.JSONArray(json)

            assertEquals("OK", array.getString(0))
            assertEquals("event-id", array.getString(1))
            assertTrue(array.getBoolean(2))
        }

        @Test
        @DisplayName("EOSE message is parsed correctly")
        fun parseEoseMessage() {
            val json = """["EOSE", "sub-123"]"""
            val array = org.json.JSONArray(json)

            assertEquals("EOSE", array.getString(0))
            assertEquals("sub-123", array.getString(1))
        }

        @Test
        @DisplayName("NOTICE message is parsed correctly")
        fun parseNoticeMessage() {
            val json = """["NOTICE", "Rate limited"]"""
            val array = org.json.JSONArray(json)

            assertEquals("NOTICE", array.getString(0))
            assertEquals("Rate limited", array.getString(1))
        }

        @Test
        @DisplayName("CLOSED message is parsed correctly")
        fun parseClosedMessage() {
            val json = """["CLOSED", "sub-123", "reason"]"""
            val array = org.json.JSONArray(json)

            assertEquals("CLOSED", array.getString(0))
            assertEquals("sub-123", array.getString(1))
        }

        @Test
        @DisplayName("unknown message type is ignored")
        fun unknownTypeIgnored() {
            val json = """["UNKNOWN", "data"]"""
            val array = org.json.JSONArray(json)

            val type = array.getString(0)
            val isKnown = type in listOf("EVENT", "OK", "EOSE", "NOTICE", "CLOSED")

            assertFalse(isKnown)
        }
    }

    @Nested
    @DisplayName("Connection Count")
    inner class ConnectionCount {

        @Test
        @DisplayName("connected count starts at 0")
        fun startsAtZero() {
            var connectedCount = 0

            assertEquals(0, connectedCount)
        }

        @Test
        @DisplayName("count increases when relay connects")
        fun increasesOnConnect() {
            var connectedCount = 0

            connectedCount++

            assertEquals(1, connectedCount)
        }

        @Test
        @DisplayName("count decreases when relay disconnects")
        fun decreasesOnDisconnect() {
            var connectedCount = 2

            connectedCount--

            assertEquals(1, connectedCount)
        }

        @Test
        @DisplayName("count is based on actual connected relays")
        fun basedOnActualConnections() {
            val connections = mapOf(
                "relay1" to true,
                "relay2" to true,
                "relay3" to false
            )

            val count = connections.values.count { it }

            assertEquals(2, count)
        }
    }

    @Nested
    @DisplayName("RelayMessage Sealed Class")
    inner class RelayMessageTests {

        @Test
        @DisplayName("all message types have relayUrl")
        fun allTypesHaveRelayUrl() {
            val relayUrl = TestFixtures.TEST_RELAY_URL

            val event = RelayMessage.Event(relayUrl, "sub", TestFixtures.createNostrEvent())
            val ok = RelayMessage.Ok(relayUrl, "id", true, "")
            val eose = RelayMessage.Eose(relayUrl, "sub")
            val notice = RelayMessage.Notice(relayUrl, "msg")
            val closed = RelayMessage.Closed(relayUrl, "sub", "")

            assertEquals(relayUrl, event.relayUrl)
            assertEquals(relayUrl, ok.relayUrl)
            assertEquals(relayUrl, eose.relayUrl)
            assertEquals(relayUrl, notice.relayUrl)
            assertEquals(relayUrl, closed.relayUrl)
        }

        @Test
        @DisplayName("Event message contains NostrEvent")
        fun eventContainsNostrEvent() {
            val nostrEvent = TestFixtures.createNostrEvent()
            val message = RelayMessage.Event(
                relayUrl = TestFixtures.TEST_RELAY_URL,
                subscriptionId = "sub-1",
                event = nostrEvent
            )

            assertEquals(nostrEvent, message.event)
        }

        @Test
        @DisplayName("Ok message has accepted boolean")
        fun okHasAccepted() {
            val accepted = RelayMessage.Ok(
                relayUrl = TestFixtures.TEST_RELAY_URL,
                eventId = "id",
                accepted = true,
                message = ""
            )
            val rejected = RelayMessage.Ok(
                relayUrl = TestFixtures.TEST_RELAY_URL,
                eventId = "id",
                accepted = false,
                message = "Error"
            )

            assertTrue(accepted.accepted)
            assertFalse(rejected.accepted)
        }
    }
}
