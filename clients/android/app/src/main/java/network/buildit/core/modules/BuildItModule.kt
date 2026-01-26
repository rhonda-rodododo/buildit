package network.buildit.core.modules

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.coroutines.flow.Flow
import network.buildit.core.nostr.NostrEvent

/**
 * Interface that all BuildIt modules must implement.
 *
 * Modules are self-contained features that can be enabled/disabled per group.
 * Each module defines its own:
 * - Data models and storage
 * - Business logic (use cases)
 * - UI screens and navigation
 * - Event handling for Nostr events
 *
 * Examples: Events, Messaging, Tasks, Files, Polls
 */
interface BuildItModule {
    /**
     * Unique identifier for this module (e.g., "events", "messaging").
     */
    val identifier: String

    /**
     * Current version of this module (e.g., "1.0.0").
     */
    val version: String

    /**
     * List of module identifiers this module depends on.
     * Dependencies must be enabled for this module to function.
     */
    val dependencies: List<String>
        get() = emptyList()

    /**
     * Human-readable name for this module.
     */
    val displayName: String

    /**
     * Brief description of what this module provides.
     */
    val description: String

    /**
     * Called when the module is first initialized.
     * Use this to set up any required resources, subscriptions, etc.
     */
    suspend fun initialize()

    /**
     * Called to clean up module resources.
     */
    suspend fun shutdown() {
        // Default no-op
    }

    /**
     * Handles incoming Nostr events that this module is interested in.
     *
     * @param event The Nostr event to process
     * @return True if the event was handled by this module
     */
    suspend fun handleEvent(event: NostrEvent): Boolean

    /**
     * Returns the navigation routes this module provides.
     * These routes will be integrated into the app's navigation graph.
     */
    fun getNavigationRoutes(): List<ModuleRoute>

    /**
     * Returns the Nostr event kinds this module handles.
     * Used to set up subscriptions efficiently.
     */
    fun getHandledEventKinds(): List<Int> = emptyList()
}

/**
 * Represents a navigation route provided by a module.
 */
data class ModuleRoute(
    /**
     * The route path (e.g., "events", "events/{eventId}").
     */
    val route: String,

    /**
     * Human-readable title for this route.
     */
    val title: String,

    /**
     * Icon to display in navigation (if applicable).
     */
    val icon: ImageVector? = null,

    /**
     * Whether this route should appear in main navigation.
     */
    val showInNavigation: Boolean = true,

    /**
     * Composable content for this route.
     * Receives navigation controller and any route parameters.
     */
    val content: @Composable (routeArgs: Map<String, String>) -> Unit
)

/**
 * Configuration for a module within a specific group.
 */
data class ModuleConfiguration(
    /**
     * The module identifier.
     */
    val moduleId: String,

    /**
     * Whether the module is enabled for this group.
     */
    val enabled: Boolean = true,

    /**
     * Module-specific settings (JSON object).
     */
    val settings: Map<String, Any> = emptyMap(),

    /**
     * When this configuration was last updated.
     */
    val updatedAt: Long = System.currentTimeMillis()
)

/**
 * Result of a module operation.
 */
sealed class ModuleResult<out T> {
    data class Success<T>(val data: T) : ModuleResult<T>()
    data class Error(val message: String, val cause: Throwable? = null) : ModuleResult<Nothing>()
    data object NotEnabled : ModuleResult<Nothing>()
}

/**
 * Extension to convert Result to ModuleResult.
 */
fun <T> Result<T>.toModuleResult(): ModuleResult<T> =
    fold(
        onSuccess = { ModuleResult.Success(it) },
        onFailure = { ModuleResult.Error(it.message ?: "Unknown error", it) }
    )
