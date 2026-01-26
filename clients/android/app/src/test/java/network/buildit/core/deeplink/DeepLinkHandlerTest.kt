package network.buildit.core.deeplink

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Unit tests for DeepLinkHandler.
 *
 * Uses Robolectric for Android Uri parsing.
 */
@RunWith(RobolectricTestRunner::class)
class DeepLinkHandlerTest {

    private lateinit var handler: DeepLinkHandler

    @Before
    fun setup() {
        handler = DeepLinkHandler()
    }

    // ========== buildit:// scheme tests ==========

    @Test
    fun `parse buildit chat URI returns Chat destination`() {
        val uri = Uri.parse("buildit://chat")
        val result = handler.parseUri(uri)

        assertEquals(DeepLinkDestination.Chat, result)
    }

    @Test
    fun `parse buildit settings URI returns Settings destination`() {
        val uri = Uri.parse("buildit://settings")
        val result = handler.parseUri(uri)

        assertEquals(DeepLinkDestination.Settings, result)
    }

    @Test
    fun `parse buildit sync URI returns DeviceSync destination`() {
        val uri = Uri.parse("buildit://sync")
        val result = handler.parseUri(uri)

        assertEquals(DeepLinkDestination.DeviceSync, result)
    }

    @Test
    fun `parse buildit group URI with ID returns Group destination`() {
        val uri = Uri.parse("buildit://group/abc123")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Group)
        assertEquals("abc123", (result as DeepLinkDestination.Group).groupId)
    }

    @Test
    fun `parse buildit group URI without ID returns Invalid`() {
        val uri = Uri.parse("buildit://group")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Invalid)
    }

    @Test
    fun `parse buildit profile with hex pubkey returns Profile destination`() {
        val hexPubkey = "a".repeat(64)
        val uri = Uri.parse("buildit://profile/$hexPubkey")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Profile)
        assertEquals(hexPubkey, (result as DeepLinkDestination.Profile).pubkey)
    }

    @Test
    fun `parse buildit dm with hex pubkey returns DirectMessage destination`() {
        val hexPubkey = "b".repeat(64)
        val uri = Uri.parse("buildit://dm/$hexPubkey")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.DirectMessage)
        assertEquals(hexPubkey, (result as DeepLinkDestination.DirectMessage).pubkey)
    }

    @Test
    fun `parse buildit event with hex event ID returns Event destination`() {
        val hexEventId = "c".repeat(64)
        val uri = Uri.parse("buildit://event/$hexEventId")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Event)
        assertEquals(hexEventId, (result as DeepLinkDestination.Event).eventId)
    }

    @Test
    fun `parse buildit calendar event returns CalendarEvent destination`() {
        val uri = Uri.parse("buildit://calendar/event123")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.CalendarEvent)
        assertEquals("event123", (result as DeepLinkDestination.CalendarEvent).eventId)
    }

    @Test
    fun `parse buildit document returns Document destination`() {
        val uri = Uri.parse("buildit://document/doc456")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Document)
        assertEquals("doc456", (result as DeepLinkDestination.Document).documentId)
    }

    @Test
    fun `parse buildit proposal returns Proposal destination`() {
        val uri = Uri.parse("buildit://proposal/prop789")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Proposal)
        assertEquals("prop789", (result as DeepLinkDestination.Proposal).proposalId)
    }

    @Test
    fun `parse buildit mutualaid returns MutualAidRequest destination`() {
        val uri = Uri.parse("buildit://mutualaid/req001")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.MutualAidRequest)
        assertEquals("req001", (result as DeepLinkDestination.MutualAidRequest).requestId)
    }

    @Test
    fun `parse buildit unknown path returns Invalid`() {
        val uri = Uri.parse("buildit://unknownpath")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Invalid)
    }

    // ========== nostr:// scheme tests ==========

    @Test
    fun `parse nostr npub URI returns Profile destination`() {
        val npub = "npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsutcwl"
        val uri = Uri.parse("nostr:$npub")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Profile)
    }

    @Test
    fun `parse nostr note URI returns Event destination`() {
        val note = "note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqhpvmwz"
        val uri = Uri.parse("nostr:$note")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Event)
    }

    @Test
    fun `parse nostr nsec URI returns Invalid for security`() {
        val nsec = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqwcuvxc"
        val uri = Uri.parse("nostr:$nsec")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Invalid)
    }

    // ========== App Links (https://buildit.network) tests ==========

    @Test
    fun `parse app link profile returns Profile destination`() {
        val hexPubkey = "d".repeat(64)
        val uri = Uri.parse("https://buildit.network/p/$hexPubkey")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Profile)
        assertEquals(hexPubkey, (result as DeepLinkDestination.Profile).pubkey)
    }

    @Test
    fun `parse app link event returns Event destination`() {
        val hexEventId = "e".repeat(64)
        val uri = Uri.parse("https://buildit.network/e/$hexEventId")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Event)
        assertEquals(hexEventId, (result as DeepLinkDestination.Event).eventId)
    }

    @Test
    fun `parse app link group returns Group destination`() {
        val uri = Uri.parse("https://buildit.network/g/group123")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Group)
        assertEquals("group123", (result as DeepLinkDestination.Group).groupId)
    }

    @Test
    fun `parse app link calendar returns CalendarEvent destination`() {
        val uri = Uri.parse("https://buildit.network/calendar/cal456")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.CalendarEvent)
        assertEquals("cal456", (result as DeepLinkDestination.CalendarEvent).eventId)
    }

    @Test
    fun `parse app link document returns Document destination`() {
        val uri = Uri.parse("https://buildit.network/doc/doc789")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Document)
        assertEquals("doc789", (result as DeepLinkDestination.Document).documentId)
    }

    @Test
    fun `parse app link with www prefix works`() {
        val uri = Uri.parse("https://www.buildit.network/chat")
        val result = handler.parseUri(uri)

        assertEquals(DeepLinkDestination.Chat, result)
    }

    @Test
    fun `parse app link root returns Chat destination`() {
        val uri = Uri.parse("https://buildit.network/")
        val result = handler.parseUri(uri)

        assertEquals(DeepLinkDestination.Chat, result)
    }

    @Test
    fun `parse http app link works`() {
        val uri = Uri.parse("http://buildit.network/settings")
        val result = handler.parseUri(uri)

        assertEquals(DeepLinkDestination.Settings, result)
    }

    @Test
    fun `parse unknown host returns Invalid`() {
        val uri = Uri.parse("https://unknown.com/path")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Invalid)
    }

    // ========== Edge cases ==========

    @Test
    fun `parse unknown scheme returns Invalid`() {
        val uri = Uri.parse("ftp://example.com")
        val result = handler.parseUri(uri)

        assertTrue(result is DeepLinkDestination.Invalid)
    }

    @Test
    fun `parseUriString handles malformed URI`() {
        val result = handler.parseUriString("not a valid uri :::")

        assertTrue(result is DeepLinkDestination.Invalid)
    }

    // ========== createUri tests ==========

    @Test
    fun `createUri for Chat returns correct buildit URI`() {
        val uri = handler.createUri(DeepLinkDestination.Chat)
        assertEquals("buildit://chat", uri)
    }

    @Test
    fun `createUri for Profile returns correct buildit URI`() {
        val destination = DeepLinkDestination.Profile("pubkey123")
        val uri = handler.createUri(destination)
        assertEquals("buildit://profile/pubkey123", uri)
    }

    @Test
    fun `createUri for Group returns correct buildit URI`() {
        val destination = DeepLinkDestination.Group("group456")
        val uri = handler.createUri(destination)
        assertEquals("buildit://group/group456", uri)
    }

    @Test
    fun `createUri for Invalid returns null`() {
        val destination = DeepLinkDestination.Invalid("uri", "reason")
        val uri = handler.createUri(destination)
        assertEquals(null, uri)
    }
}
