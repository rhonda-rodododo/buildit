package network.buildit.modules.federation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Public
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrEvent
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Federation module — manages AP and AT Protocol bridge settings.
 * Federation is handled server-side by the federation worker;
 * this module provides the settings UI and status display.
 */
@Singleton
class FederationModule @Inject constructor() : BuildItModule {
    override val identifier = "federation"
    override val version = "1.0.0"
    override val dependencies = emptyList<String>()
    override val displayName = "Federation"
    override val description = "Bridge public posts to Mastodon and Bluesky"

    override suspend fun initialize() {
        // Load cached federation status
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        // Federation is worker-side — no local event handling
        return false
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "federation-settings",
                title = "Federation",
                icon = Icons.Default.Public,
            ) { FederationSettingsScreen() }
        )
    }

    override fun getHandledEventKinds(): List<Int> = emptyList()
}
