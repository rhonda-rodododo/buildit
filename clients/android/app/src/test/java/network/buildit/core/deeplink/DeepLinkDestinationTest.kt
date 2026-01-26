package network.buildit.core.deeplink

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for DeepLinkDestination.
 */
class DeepLinkDestinationTest {

    // ========== requiresAuthentication tests ==========

    @Test
    fun `Chat requires authentication`() {
        assertTrue(DeepLinkDestination.Chat.requiresAuthentication())
    }

    @Test
    fun `DirectMessage requires authentication`() {
        val destination = DeepLinkDestination.DirectMessage("pubkey123")
        assertTrue(destination.requiresAuthentication())
    }

    @Test
    fun `Group requires authentication`() {
        val destination = DeepLinkDestination.Group("groupId")
        assertTrue(destination.requiresAuthentication())
    }

    @Test
    fun `Settings requires authentication`() {
        assertTrue(DeepLinkDestination.Settings.requiresAuthentication())
    }

    @Test
    fun `DeviceSync requires authentication`() {
        assertTrue(DeepLinkDestination.DeviceSync.requiresAuthentication())
    }

    @Test
    fun `Document requires authentication`() {
        val destination = DeepLinkDestination.Document("docId")
        assertTrue(destination.requiresAuthentication())
    }

    @Test
    fun `Proposal requires authentication`() {
        val destination = DeepLinkDestination.Proposal("propId")
        assertTrue(destination.requiresAuthentication())
    }

    @Test
    fun `MutualAidRequest requires authentication`() {
        val destination = DeepLinkDestination.MutualAidRequest("requestId")
        assertTrue(destination.requiresAuthentication())
    }

    @Test
    fun `Profile does not require authentication`() {
        val destination = DeepLinkDestination.Profile("pubkey123")
        assertFalse(destination.requiresAuthentication())
    }

    @Test
    fun `Event does not require authentication`() {
        val destination = DeepLinkDestination.Event("eventId")
        assertFalse(destination.requiresAuthentication())
    }

    @Test
    fun `CalendarEvent does not require authentication`() {
        val destination = DeepLinkDestination.CalendarEvent("calEventId")
        assertFalse(destination.requiresAuthentication())
    }

    @Test
    fun `SocialPost does not require authentication`() {
        val destination = DeepLinkDestination.SocialPost("postId")
        assertFalse(destination.requiresAuthentication())
    }

    @Test
    fun `Invalid does not require authentication`() {
        val destination = DeepLinkDestination.Invalid("uri", "reason")
        assertFalse(destination.requiresAuthentication())
    }

    // ========== Data class property tests ==========

    @Test
    fun `DirectMessage stores pubkey and relay hints`() {
        val relays = listOf("wss://relay1.com", "wss://relay2.com")
        val destination = DeepLinkDestination.DirectMessage("pubkey123", relays)

        assertEquals("pubkey123", destination.pubkey)
        assertEquals(relays, destination.relayHints)
    }

    @Test
    fun `DirectMessage defaults to empty relay hints`() {
        val destination = DeepLinkDestination.DirectMessage("pubkey123")
        assertTrue(destination.relayHints.isEmpty())
    }

    @Test
    fun `Profile stores pubkey and relay hints`() {
        val relays = listOf("wss://relay.example.com")
        val destination = DeepLinkDestination.Profile("pubkey456", relays)

        assertEquals("pubkey456", destination.pubkey)
        assertEquals(relays, destination.relayHints)
    }

    @Test
    fun `Event stores all metadata`() {
        val relays = listOf("wss://relay.example.com")
        val destination = DeepLinkDestination.Event(
            eventId = "event789",
            authorPubkey = "author123",
            kind = 1,
            relayHints = relays
        )

        assertEquals("event789", destination.eventId)
        assertEquals("author123", destination.authorPubkey)
        assertEquals(1, destination.kind)
        assertEquals(relays, destination.relayHints)
    }

    @Test
    fun `Event allows null optional fields`() {
        val destination = DeepLinkDestination.Event("eventId")

        assertEquals("eventId", destination.eventId)
        assertEquals(null, destination.authorPubkey)
        assertEquals(null, destination.kind)
        assertTrue(destination.relayHints.isEmpty())
    }

    @Test
    fun `Invalid stores uri and reason`() {
        val destination = DeepLinkDestination.Invalid(
            uri = "buildit://invalid/path",
            reason = "Unknown path"
        )

        assertEquals("buildit://invalid/path", destination.uri)
        assertEquals("Unknown path", destination.reason)
    }

    // ========== Equality tests ==========

    @Test
    fun `same Chat instances are equal`() {
        assertEquals(DeepLinkDestination.Chat, DeepLinkDestination.Chat)
    }

    @Test
    fun `Profile with same pubkey are equal`() {
        val dest1 = DeepLinkDestination.Profile("pubkey123")
        val dest2 = DeepLinkDestination.Profile("pubkey123")
        assertEquals(dest1, dest2)
    }

    @Test
    fun `Profile with different pubkeys are not equal`() {
        val dest1 = DeepLinkDestination.Profile("pubkey1")
        val dest2 = DeepLinkDestination.Profile("pubkey2")
        assertTrue(dest1 != dest2)
    }

    @Test
    fun `Event with same data are equal`() {
        val dest1 = DeepLinkDestination.Event(
            eventId = "event123",
            authorPubkey = "author",
            kind = 1
        )
        val dest2 = DeepLinkDestination.Event(
            eventId = "event123",
            authorPubkey = "author",
            kind = 1
        )
        assertEquals(dest1, dest2)
    }
}
