package network.buildit.core.deeplink

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for DeepLinkRouter.
 */
class DeepLinkRouterTest {

    private lateinit var handler: DeepLinkHandler
    private lateinit var router: DeepLinkRouter

    @Before
    fun setup() {
        handler = DeepLinkHandler()
        router = DeepLinkRouter(handler)
    }

    // ========== Pending deep link management ==========

    @Test
    fun `setPendingDeepLink stores destination`() {
        val destination = DeepLinkDestination.Profile("pubkey123")

        router.setPendingDeepLink(destination)

        assertEquals(destination, router.pendingDeepLink.value)
    }

    @Test
    fun `clearPendingDeepLink removes stored destination`() {
        router.setPendingDeepLink(DeepLinkDestination.Chat)

        router.clearPendingDeepLink()

        assertNull(router.pendingDeepLink.value)
    }

    @Test
    fun `consumePendingDeepLink returns and clears destination`() {
        val destination = DeepLinkDestination.Group("group456")
        router.setPendingDeepLink(destination)

        val consumed = router.consumePendingDeepLink()

        assertEquals(destination, consumed)
        assertNull(router.pendingDeepLink.value)
    }

    @Test
    fun `consumePendingDeepLink returns null when no pending link`() {
        val consumed = router.consumePendingDeepLink()

        assertNull(consumed)
    }

    // ========== Route building ==========

    @Test
    fun `buildRoute for Chat returns chat route`() {
        val route = router.buildRoute(DeepLinkDestination.Chat)
        assertEquals("chat", route)
    }

    @Test
    fun `buildRoute for Settings returns settings route`() {
        val route = router.buildRoute(DeepLinkDestination.Settings)
        assertEquals("settings", route)
    }

    @Test
    fun `buildRoute for DeviceSync returns device_sync route`() {
        val route = router.buildRoute(DeepLinkDestination.DeviceSync)
        assertEquals("device_sync", route)
    }

    @Test
    fun `buildRoute for Profile returns profile route with pubkey`() {
        val destination = DeepLinkDestination.Profile("abc123")
        val route = router.buildRoute(destination)
        assertEquals("profile/abc123", route)
    }

    @Test
    fun `buildRoute for DirectMessage returns dm route with pubkey`() {
        val destination = DeepLinkDestination.DirectMessage("def456")
        val route = router.buildRoute(destination)
        assertEquals("dm/def456", route)
    }

    @Test
    fun `buildRoute for Group returns group_chat route with ID`() {
        val destination = DeepLinkDestination.Group("mygroup")
        val route = router.buildRoute(destination)
        assertEquals("group_chat/mygroup", route)
    }

    @Test
    fun `buildRoute for Event returns event route with ID`() {
        val destination = DeepLinkDestination.Event("event123")
        val route = router.buildRoute(destination)
        assertEquals("event/event123", route)
    }

    @Test
    fun `buildRoute for Event with author and kind includes query params`() {
        val destination = DeepLinkDestination.Event(
            eventId = "event123",
            authorPubkey = "author456",
            kind = 1
        )
        val route = router.buildRoute(destination)
        assertTrue(route?.contains("event/event123") == true)
        assertTrue(route?.contains("author=author456") == true)
        assertTrue(route?.contains("kind=1") == true)
    }

    @Test
    fun `buildRoute for Event with relays includes relays param`() {
        val destination = DeepLinkDestination.Event(
            eventId = "event123",
            relayHints = listOf("wss://relay1.com", "wss://relay2.com")
        )
        val route = router.buildRoute(destination)
        assertTrue(route?.contains("relays=wss://relay1.com,wss://relay2.com") == true)
    }

    @Test
    fun `buildRoute for CalendarEvent returns calendar_event route`() {
        val destination = DeepLinkDestination.CalendarEvent("cal789")
        val route = router.buildRoute(destination)
        assertEquals("calendar_event/cal789", route)
    }

    @Test
    fun `buildRoute for Document returns document route`() {
        val destination = DeepLinkDestination.Document("doc001")
        val route = router.buildRoute(destination)
        assertEquals("document/doc001", route)
    }

    @Test
    fun `buildRoute for Proposal returns proposal route`() {
        val destination = DeepLinkDestination.Proposal("prop002")
        val route = router.buildRoute(destination)
        assertEquals("proposal/prop002", route)
    }

    @Test
    fun `buildRoute for MutualAidRequest returns mutual_aid route`() {
        val destination = DeepLinkDestination.MutualAidRequest("aid003")
        val route = router.buildRoute(destination)
        assertEquals("mutual_aid/aid003", route)
    }

    @Test
    fun `buildRoute for SocialPost returns social_post route`() {
        val destination = DeepLinkDestination.SocialPost("post004")
        val route = router.buildRoute(destination)
        assertEquals("social_post/post004", route)
    }

    @Test
    fun `buildRoute for Invalid returns null`() {
        val destination = DeepLinkDestination.Invalid("uri", "reason")
        val route = router.buildRoute(destination)
        assertNull(route)
    }

    // ========== Parent route determination ==========

    @Test
    fun `getParentRoute for DirectMessage returns chat`() {
        val destination = DeepLinkDestination.DirectMessage("pubkey")
        assertEquals("chat", router.getParentRoute(destination))
    }

    @Test
    fun `getParentRoute for Profile returns chat`() {
        val destination = DeepLinkDestination.Profile("pubkey")
        assertEquals("chat", router.getParentRoute(destination))
    }

    @Test
    fun `getParentRoute for Group returns groups`() {
        val destination = DeepLinkDestination.Group("groupId")
        assertEquals("groups", router.getParentRoute(destination))
    }

    @Test
    fun `getParentRoute for Document returns groups`() {
        val destination = DeepLinkDestination.Document("docId")
        assertEquals("groups", router.getParentRoute(destination))
    }

    @Test
    fun `getParentRoute for Settings returns settings`() {
        assertEquals("settings", router.getParentRoute(DeepLinkDestination.Settings))
    }

    @Test
    fun `getParentRoute for DeviceSync returns settings`() {
        assertEquals("settings", router.getParentRoute(DeepLinkDestination.DeviceSync))
    }

    // ========== Bottom nav visibility ==========

    @Test
    fun `shouldShowBottomNav returns true for main destinations`() {
        assertTrue(router.shouldShowBottomNav(DeepLinkDestination.Chat))
        assertTrue(router.shouldShowBottomNav(DeepLinkDestination.Settings))
        assertTrue(router.shouldShowBottomNav(DeepLinkDestination.DeviceSync))
    }

    @Test
    fun `shouldShowBottomNav returns false for detail destinations`() {
        assertTrue(!router.shouldShowBottomNav(DeepLinkDestination.Profile("pubkey")))
        assertTrue(!router.shouldShowBottomNav(DeepLinkDestination.DirectMessage("pubkey")))
        assertTrue(!router.shouldShowBottomNav(DeepLinkDestination.Event("eventId")))
        assertTrue(!router.shouldShowBottomNav(DeepLinkDestination.Group("groupId")))
        assertTrue(!router.shouldShowBottomNav(DeepLinkDestination.Document("docId")))
        assertTrue(!router.shouldShowBottomNav(DeepLinkDestination.Invalid("uri", "reason")))
    }
}
