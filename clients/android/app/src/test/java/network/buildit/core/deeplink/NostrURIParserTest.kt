package network.buildit.core.deeplink

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for NostrURIParser.
 *
 * Tests parsing of Nostr URIs according to NIP-19 and NIP-21.
 */
class NostrURIParserTest {

    @Test
    fun `parse npub returns Pubkey entity`() {
        // Example npub from NIP-19 test vectors
        val npub = "npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsutcwl"
        val result = NostrURIParser.parse(npub)

        assertTrue(result is NostrURIParser.NostrEntity.Pubkey)
        val pubkey = result as NostrURIParser.NostrEntity.Pubkey
        // All zeros pubkey
        assertEquals("0000000000000000000000000000000000000000000000000000000000000000", pubkey.hex)
        assertTrue(pubkey.relayHints.isEmpty())
    }

    @Test
    fun `parse npub with nostr prefix`() {
        val uri = "nostr:npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsutcwl"
        val result = NostrURIParser.parse(uri)

        assertTrue(result is NostrURIParser.NostrEntity.Pubkey)
    }

    @Test
    fun `parse note returns EventId entity`() {
        val note = "note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqhpvmwz"
        val result = NostrURIParser.parse(note)

        assertTrue(result is NostrURIParser.NostrEntity.EventId)
        val eventId = result as NostrURIParser.NostrEntity.EventId
        assertEquals("0000000000000000000000000000000000000000000000000000000000000000", eventId.hex)
        assertTrue(eventId.relayHints.isEmpty())
    }

    @Test
    fun `parse nsec returns Invalid with security warning`() {
        // nsec should never be parsed from deep links for security
        val nsec = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqwcuvxc"
        val result = NostrURIParser.parse(nsec)

        assertTrue(result is NostrURIParser.NostrEntity.Invalid)
        val invalid = result as NostrURIParser.NostrEntity.Invalid
        assertTrue(invalid.reason.contains("Private keys", ignoreCase = true))
    }

    @Test
    fun `parse empty string returns Invalid`() {
        val result = NostrURIParser.parse("")
        assertTrue(result is NostrURIParser.NostrEntity.Invalid)
    }

    @Test
    fun `parse unknown prefix returns Invalid`() {
        val result = NostrURIParser.parse("unknown1abc")
        assertTrue(result is NostrURIParser.NostrEntity.Invalid)
    }

    @Test
    fun `isValidNostrURI returns true for valid npub`() {
        val npub = "npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsutcwl"
        assertTrue(NostrURIParser.isValidNostrURI(npub))
    }

    @Test
    fun `isValidNostrURI returns false for invalid input`() {
        assertTrue(!NostrURIParser.isValidNostrURI("not-a-nostr-uri"))
        assertTrue(!NostrURIParser.isValidNostrURI(""))
        assertTrue(!NostrURIParser.isValidNostrURI("nostr:"))
    }

    @Test
    fun `toDeepLinkDestination converts Pubkey to Profile`() {
        val pubkey = NostrURIParser.NostrEntity.Pubkey(
            hex = "abc123",
            relayHints = listOf("wss://relay.example.com")
        )

        val destination = NostrURIParser.toDeepLinkDestination(pubkey)

        assertTrue(destination is DeepLinkDestination.Profile)
        val profile = destination as DeepLinkDestination.Profile
        assertEquals("abc123", profile.pubkey)
        assertEquals(listOf("wss://relay.example.com"), profile.relayHints)
    }

    @Test
    fun `toDeepLinkDestination converts EventId to Event`() {
        val eventId = NostrURIParser.NostrEntity.EventId(
            hex = "def456",
            authorPubkey = "author123",
            kind = 1,
            relayHints = listOf("wss://relay.example.com")
        )

        val destination = NostrURIParser.toDeepLinkDestination(eventId)

        assertTrue(destination is DeepLinkDestination.Event)
        val event = destination as DeepLinkDestination.Event
        assertEquals("def456", event.eventId)
        assertEquals("author123", event.authorPubkey)
        assertEquals(1, event.kind)
        assertEquals(listOf("wss://relay.example.com"), event.relayHints)
    }

    @Test
    fun `toDeepLinkDestination converts Invalid to Invalid destination`() {
        val invalid = NostrURIParser.NostrEntity.Invalid("Test error")

        val destination = NostrURIParser.toDeepLinkDestination(invalid)

        assertTrue(destination is DeepLinkDestination.Invalid)
        val invalidDest = destination as DeepLinkDestination.Invalid
        assertEquals("Test error", invalidDest.reason)
    }

    @Test
    fun `parse handles uppercase NOSTR prefix`() {
        val uri = "NOSTR:npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsutcwl"
        val result = NostrURIParser.parse(uri)

        assertTrue(result is NostrURIParser.NostrEntity.Pubkey)
    }

    @Test
    fun `parse handles whitespace around URI`() {
        val uri = "  nostr:npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsutcwl  "
        val result = NostrURIParser.parse(uri)

        assertTrue(result is NostrURIParser.NostrEntity.Pubkey)
    }
}
