package network.buildit.core.deeplink

import android.util.Log
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Routes deep link destinations to the appropriate navigation targets.
 *
 * This class handles:
 * - Converting DeepLinkDestination to navigation routes
 * - Managing pending deep links (for cold start or auth-required scenarios)
 * - Providing navigation options for proper back stack handling
 */
@Singleton
class DeepLinkRouter @Inject constructor(
    private val deepLinkHandler: DeepLinkHandler
) {

    companion object {
        private const val TAG = "DeepLinkRouter"

        // Navigation routes (should match routes in MainActivity)
        const val ROUTE_CHAT = "chat"
        const val ROUTE_GROUPS = "groups"
        const val ROUTE_GROUP_CHAT = "group_chat"
        const val ROUTE_DEVICE_SYNC = "device_sync"
        const val ROUTE_SETTINGS = "settings"
        const val ROUTE_CONTACT_PICKER = "contact_picker"

        // Additional routes for deep link targets
        const val ROUTE_PROFILE = "profile"
        const val ROUTE_EVENT = "event"
        const val ROUTE_DM = "dm"
        const val ROUTE_CALENDAR_EVENT = "calendar_event"
        const val ROUTE_DOCUMENT = "document"
        const val ROUTE_PROPOSAL = "proposal"
        const val ROUTE_MUTUAL_AID = "mutual_aid"
        const val ROUTE_SOCIAL_POST = "social_post"

        // Module routes (Epic 81)
        const val ROUTE_TASKS = "tasks"
        const val ROUTE_FILES = "files"
        const val ROUTE_POLLS = "polls"
        const val ROUTE_WIKI = "wiki"
        const val ROUTE_WIKI_PAGE = "wiki_page"
        const val ROUTE_WIKI_EDITOR = "wiki_editor"
        const val ROUTE_MESSAGE_SEARCH = "messages/search"
        const val ROUTE_MESSAGE_THREAD = "messages/thread"
    }

    /**
     * Pending deep link that should be navigated to once the app is ready.
     * This is used for cold start scenarios or when authentication is required.
     */
    private val _pendingDeepLink = MutableStateFlow<DeepLinkDestination?>(null)
    val pendingDeepLink: StateFlow<DeepLinkDestination?> = _pendingDeepLink.asStateFlow()

    /**
     * Stores a deep link to be processed later.
     * Used when the app needs to complete initialization or authentication first.
     *
     * @param destination The destination to store
     */
    fun setPendingDeepLink(destination: DeepLinkDestination) {
        Log.d(TAG, "Setting pending deep link: $destination")
        _pendingDeepLink.value = destination
    }

    /**
     * Clears the pending deep link.
     * Called after the deep link has been successfully navigated.
     */
    fun clearPendingDeepLink() {
        Log.d(TAG, "Clearing pending deep link")
        _pendingDeepLink.value = null
    }

    /**
     * Consumes and returns the pending deep link, clearing it in the process.
     *
     * @return The pending destination, or null if none
     */
    fun consumePendingDeepLink(): DeepLinkDestination? {
        val pending = _pendingDeepLink.value
        _pendingDeepLink.value = null
        return pending
    }

    /**
     * Navigates to a deep link destination using the provided NavController.
     *
     * @param navController The NavController to use for navigation
     * @param destination The destination to navigate to
     * @param clearBackStack Whether to clear the back stack before navigating
     * @return True if navigation was successful, false otherwise
     */
    fun navigate(
        navController: NavController,
        destination: DeepLinkDestination,
        clearBackStack: Boolean = false
    ): Boolean {
        Log.d(TAG, "Navigating to deep link destination: $destination")

        if (destination is DeepLinkDestination.Invalid) {
            Log.w(TAG, "Cannot navigate to invalid destination: ${destination.reason}")
            return false
        }

        return try {
            val route = buildRoute(destination)
            if (route == null) {
                Log.w(TAG, "Could not build route for destination: $destination")
                return false
            }

            val navOptions = buildNavOptions(destination, clearBackStack, navController)
            navController.navigate(route, navOptions)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Navigation failed", e)
            false
        }
    }

    /**
     * Builds the navigation route for a destination.
     *
     * @param destination The destination to build a route for
     * @return The route string, or null if the destination is not routable
     */
    fun buildRoute(destination: DeepLinkDestination): String? = when (destination) {
        is DeepLinkDestination.Chat -> ROUTE_CHAT

        is DeepLinkDestination.DirectMessage -> buildRouteWithArg(ROUTE_DM, destination.pubkey)

        is DeepLinkDestination.Profile -> buildRouteWithArg(ROUTE_PROFILE, destination.pubkey)

        is DeepLinkDestination.Event -> buildEventRoute(destination)

        is DeepLinkDestination.Group -> buildRouteWithArg(ROUTE_GROUP_CHAT, destination.groupId)

        is DeepLinkDestination.CalendarEvent -> buildRouteWithArg(ROUTE_CALENDAR_EVENT, destination.eventId)

        is DeepLinkDestination.Settings -> ROUTE_SETTINGS

        is DeepLinkDestination.DeviceSync -> ROUTE_DEVICE_SYNC

        is DeepLinkDestination.Document -> buildRouteWithArg(ROUTE_DOCUMENT, destination.documentId)

        is DeepLinkDestination.Proposal -> buildRouteWithArg(ROUTE_PROPOSAL, destination.proposalId)

        is DeepLinkDestination.MutualAidRequest -> buildRouteWithArg(ROUTE_MUTUAL_AID, destination.requestId)

        is DeepLinkDestination.SocialPost -> buildRouteWithArg(ROUTE_SOCIAL_POST, destination.postId)

        is DeepLinkDestination.Invalid -> null
    }

    /**
     * Builds a route with a single argument.
     */
    private fun buildRouteWithArg(route: String, arg: String): String {
        return "$route/${encodeRouteArg(arg)}"
    }

    /**
     * Builds a route for an Event destination with optional parameters.
     */
    private fun buildEventRoute(destination: DeepLinkDestination.Event): String {
        val base = "$ROUTE_EVENT/${encodeRouteArg(destination.eventId)}"
        val params = buildList {
            destination.authorPubkey?.let { add("author=$it") }
            destination.kind?.let { add("kind=$it") }
            if (destination.relayHints.isNotEmpty()) {
                add("relays=${destination.relayHints.joinToString(",")}")
            }
        }
        return if (params.isEmpty()) base else "$base?${params.joinToString("&")}"
    }

    /**
     * URL-encodes a route argument to handle special characters.
     */
    private fun encodeRouteArg(arg: String): String {
        return android.net.Uri.encode(arg)
    }

    /**
     * Builds navigation options for a destination.
     *
     * @param destination The destination being navigated to
     * @param clearBackStack Whether to clear the entire back stack
     * @param navController The NavController (used to get the graph for back stack clearing)
     * @return NavOptions configured for the navigation
     */
    private fun buildNavOptions(
        destination: DeepLinkDestination,
        clearBackStack: Boolean,
        navController: NavController
    ): NavOptions {
        return NavOptions.Builder().apply {
            // For deep links, we generally want single top behavior
            setLaunchSingleTop(true)

            // Handle back stack based on destination type
            when {
                clearBackStack -> {
                    // Clear entire back stack and start fresh
                    val startDestId = navController.graph.startDestinationId
                    setPopUpTo(startDestId, inclusive = true)
                }

                destination.isMainDestination() -> {
                    // For main destinations, pop to start and save state
                    val startDestId = navController.graph.startDestinationId
                    setPopUpTo(startDestId, inclusive = false, saveState = true)
                    setRestoreState(true)
                }

                else -> {
                    // For detail destinations, allow normal back stack behavior
                    // No popUpTo - just add to the existing stack
                }
            }
        }.build()
    }

    /**
     * Checks if a destination is a main/root destination.
     */
    private fun DeepLinkDestination.isMainDestination(): Boolean = when (this) {
        is DeepLinkDestination.Chat,
        is DeepLinkDestination.Settings,
        is DeepLinkDestination.DeviceSync -> true
        else -> false
    }

    /**
     * Gets the parent route for a destination (for proper back stack handling).
     */
    fun getParentRoute(destination: DeepLinkDestination): String = when (destination) {
        is DeepLinkDestination.DirectMessage,
        is DeepLinkDestination.Profile,
        is DeepLinkDestination.Chat -> ROUTE_CHAT

        is DeepLinkDestination.Group -> ROUTE_GROUPS

        is DeepLinkDestination.Event,
        is DeepLinkDestination.SocialPost -> ROUTE_CHAT // Social content typically accessed from chat

        is DeepLinkDestination.CalendarEvent -> ROUTE_CHAT // Events module

        is DeepLinkDestination.Document,
        is DeepLinkDestination.Proposal,
        is DeepLinkDestination.MutualAidRequest -> ROUTE_GROUPS // Community features

        is DeepLinkDestination.Settings,
        is DeepLinkDestination.DeviceSync -> ROUTE_SETTINGS

        is DeepLinkDestination.Invalid -> ROUTE_CHAT
    }

    /**
     * Determines if a destination should show the bottom navigation bar.
     */
    fun shouldShowBottomNav(destination: DeepLinkDestination): Boolean = when (destination) {
        is DeepLinkDestination.Chat,
        is DeepLinkDestination.Settings,
        is DeepLinkDestination.DeviceSync -> true

        is DeepLinkDestination.DirectMessage,
        is DeepLinkDestination.Profile,
        is DeepLinkDestination.Event,
        is DeepLinkDestination.Group,
        is DeepLinkDestination.CalendarEvent,
        is DeepLinkDestination.Document,
        is DeepLinkDestination.Proposal,
        is DeepLinkDestination.MutualAidRequest,
        is DeepLinkDestination.SocialPost,
        is DeepLinkDestination.Invalid -> false
    }

    /**
     * Result of attempting to navigate to a deep link.
     */
    sealed class NavigationResult {
        /**
         * Navigation was successful.
         */
        data object Success : NavigationResult()

        /**
         * Navigation requires authentication first.
         * The deep link has been saved as pending.
         */
        data class RequiresAuth(val destination: DeepLinkDestination) : NavigationResult()

        /**
         * Navigation failed due to an invalid destination.
         */
        data class InvalidDestination(val reason: String) : NavigationResult()

        /**
         * Navigation failed due to a route that doesn't exist.
         */
        data class RouteNotFound(val route: String) : NavigationResult()

        /**
         * Navigation failed due to an unexpected error.
         */
        data class Error(val exception: Exception) : NavigationResult()
    }

    /**
     * Attempts to navigate to a deep link destination, handling auth requirements.
     *
     * @param navController The NavController to use for navigation
     * @param destination The destination to navigate to
     * @param isAuthenticated Whether the user is currently authenticated
     * @param clearBackStack Whether to clear the back stack before navigating
     * @return The result of the navigation attempt
     */
    fun navigateWithAuth(
        navController: NavController,
        destination: DeepLinkDestination,
        isAuthenticated: Boolean,
        clearBackStack: Boolean = false
    ): NavigationResult {
        if (destination is DeepLinkDestination.Invalid) {
            return NavigationResult.InvalidDestination(destination.reason)
        }

        // Check if authentication is required
        if (destination.requiresAuthentication() && !isAuthenticated) {
            setPendingDeepLink(destination)
            return NavigationResult.RequiresAuth(destination)
        }

        // Attempt navigation
        return try {
            val success = navigate(navController, destination, clearBackStack)
            if (success) {
                NavigationResult.Success
            } else {
                val route = buildRoute(destination)
                NavigationResult.RouteNotFound(route ?: "unknown")
            }
        } catch (e: Exception) {
            NavigationResult.Error(e)
        }
    }
}
