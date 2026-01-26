package network.buildit

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavController
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.NavType
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import androidx.hilt.navigation.compose.hiltViewModel
import dagger.hilt.android.AndroidEntryPoint
import network.buildit.core.deeplink.DeepLinkDestination
import network.buildit.core.deeplink.DeepLinkHandler
import network.buildit.core.deeplink.DeepLinkRouter
import network.buildit.features.chat.ChatScreen
import network.buildit.features.chat.ChatViewModel
import network.buildit.features.chat.ContactPickerScreen
import network.buildit.features.devicesync.DeviceSyncScreen
import network.buildit.features.groups.GroupsScreen
import network.buildit.features.settings.SettingsScreen
import network.buildit.ui.theme.BuildItTheme
import javax.inject.Inject

/**
 * Main Activity for the BuildIt app.
 *
 * This activity hosts the main navigation structure using Jetpack Compose
 * with a bottom navigation bar for switching between main features.
 *
 * Handles deep links from:
 * - buildit:// custom scheme
 * - nostr:// Nostr protocol URIs (NIP-21)
 * - https://buildit.network App Links
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    @Inject
    lateinit var deepLinkHandler: DeepLinkHandler

    @Inject
    lateinit var deepLinkRouter: DeepLinkRouter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Handle deep link from cold start
        handleDeepLinkIntent(intent, isColdStart = true)

        setContent {
            BuildItTheme {
                BuildItContent(
                    deepLinkRouter = deepLinkRouter,
                    deepLinkHandler = deepLinkHandler
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Handle deep link when app is already running (warm start)
        handleDeepLinkIntent(intent, isColdStart = false)
    }

    /**
     * Processes a deep link intent and stores the destination for navigation.
     *
     * @param intent The incoming intent
     * @param isColdStart Whether this is from onCreate (cold start) vs onNewIntent (warm start)
     */
    private fun handleDeepLinkIntent(intent: Intent?, isColdStart: Boolean) {
        if (intent == null || intent.action != Intent.ACTION_VIEW) {
            return
        }

        val uri = intent.data ?: return
        Log.d(TAG, "Received deep link: $uri (coldStart=$isColdStart)")

        // Validate the deep link source for security
        if (!validateDeepLinkIntent(intent)) {
            Log.w(TAG, "Deep link failed validation: $uri")
            return
        }

        val destination = deepLinkHandler.parseUri(uri)
        Log.d(TAG, "Parsed deep link destination: $destination")

        when (destination) {
            is DeepLinkDestination.Invalid -> {
                Log.w(TAG, "Invalid deep link: ${destination.reason}")
                // Could show a toast or snackbar here
            }
            else -> {
                // Store as pending - will be consumed by BuildItContent
                deepLinkRouter.setPendingDeepLink(destination)
            }
        }
    }

    /**
     * Validates a deep link intent for security.
     *
     * Checks:
     * - Intent flags for suspicious behavior
     * - URI scheme matches expected schemes
     * - Basic sanity checks on URI structure
     */
    private fun validateDeepLinkIntent(intent: Intent): Boolean {
        val uri = intent.data ?: return false

        // Check for valid schemes
        val scheme = uri.scheme?.lowercase()
        if (scheme !in listOf("buildit", "nostr", "https", "http")) {
            Log.w(TAG, "Unexpected scheme: $scheme")
            return false
        }

        // For App Links, verify the host
        if (scheme == "https" || scheme == "http") {
            val host = uri.host?.lowercase()
            if (host != "buildit.network" && host != "www.buildit.network") {
                Log.w(TAG, "Unexpected host: $host")
                return false
            }
        }

        // Check for overly long URIs (potential attack vector)
        if (uri.toString().length > 2048) {
            Log.w(TAG, "URI too long: ${uri.toString().length} characters")
            return false
        }

        return true
    }
}

/**
 * Navigation destinations for the bottom navigation bar.
 */
sealed class Screen(
    val route: String,
    val titleRes: Int,
    val icon: ImageVector
) {
    data object Chat : Screen(
        route = "chat",
        titleRes = R.string.nav_chat,
        icon = Icons.Default.Chat
    )

    data object Groups : Screen(
        route = "groups",
        titleRes = R.string.nav_groups,
        icon = Icons.Default.Group
    )

    data object DeviceSync : Screen(
        route = "device_sync",
        titleRes = R.string.nav_device_sync,
        icon = Icons.Default.Sync
    )

    data object Settings : Screen(
        route = "settings",
        titleRes = R.string.nav_settings,
        icon = Icons.Default.Settings
    )

    // Non-bottom-nav screens
    data object ContactPicker : Screen(
        route = "contact_picker",
        titleRes = R.string.contact_picker_title,
        icon = Icons.Default.Chat  // Not shown in nav
    )

    data object GroupChat : Screen(
        route = "group_chat/{groupId}",
        titleRes = R.string.nav_groups,
        icon = Icons.Default.Group  // Not shown in nav
    ) {
        fun createRoute(groupId: String) = "group_chat/$groupId"
    }

    companion object {
        val bottomNavItems = listOf(Chat, Groups, DeviceSync, Settings)
    }
}

/**
 * Main composable function that sets up the app structure.
 *
 * @param deepLinkRouter Router for handling deep link navigation
 * @param deepLinkHandler Handler for parsing deep links
 */
@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun BuildItContent(
    deepLinkRouter: DeepLinkRouter? = null,
    deepLinkHandler: DeepLinkHandler? = null
) {
    val navController = rememberNavController()

    // Handle pending deep links
    HandleDeepLinks(
        navController = navController,
        deepLinkRouter = deepLinkRouter
    )

    // Request necessary permissions
    val permissions = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            add(Manifest.permission.BLUETOOTH_SCAN)
            add(Manifest.permission.BLUETOOTH_ADVERTISE)
            add(Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            add(Manifest.permission.BLUETOOTH)
            add(Manifest.permission.BLUETOOTH_ADMIN)
            add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    val permissionsState = rememberMultiplePermissionsState(permissions)

    var hasRequestedPermissions by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (!hasRequestedPermissions) {
            permissionsState.launchMultiplePermissionRequest()
            hasRequestedPermissions = true
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination

                Screen.bottomNavItems.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = null) },
                        label = { Text(stringResource(screen.titleRes)) },
                        selected = currentDestination?.hierarchy?.any {
                            it.route == screen.route
                        } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Chat.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Chat.route) {
                ChatScreen(
                    onNavigateToContactPicker = {
                        navController.navigate(Screen.ContactPicker.route)
                    }
                )
            }
            composable(Screen.Groups.route) {
                GroupsScreen(
                    onNavigateToGroupChat = { groupId ->
                        navController.navigate(Screen.GroupChat.createRoute(groupId))
                    }
                )
            }
            composable(
                route = Screen.GroupChat.route,
                arguments = listOf(navArgument("groupId") { type = NavType.StringType })
            ) { backStackEntry ->
                val groupId = backStackEntry.arguments?.getString("groupId") ?: return@composable
                // Use ChatScreen with a group-opened ViewModel
                val chatViewModel: ChatViewModel = hiltViewModel()
                LaunchedEffect(groupId) {
                    chatViewModel.openGroupConversation(groupId)
                }
                ChatScreen(
                    viewModel = chatViewModel,
                    onNavigateToContactPicker = {
                        navController.navigate(Screen.ContactPicker.route)
                    }
                )
            }
            composable(Screen.DeviceSync.route) {
                DeviceSyncScreen()
            }
            composable(Screen.Settings.route) {
                SettingsScreen()
            }
            composable(Screen.ContactPicker.route) {
                ContactPickerScreen(
                    onContactSelected = { pubkey ->
                        navController.popBackStack()
                        // TODO: Start conversation with selected pubkey
                    },
                    onBack = {
                        navController.popBackStack()
                    }
                )
            }
        }
    }
}

/**
 * Composable that handles pending deep links from DeepLinkRouter.
 *
 * Observes the pending deep link state and navigates when a new deep link arrives.
 * Handles both cold start (pending link set before composition) and warm start
 * (pending link set while app is running) scenarios.
 *
 * @param navController The NavController to use for navigation
 * @param deepLinkRouter The router containing pending deep links
 */
@Composable
private fun HandleDeepLinks(
    navController: NavController,
    deepLinkRouter: DeepLinkRouter?
) {
    if (deepLinkRouter == null) return

    val pendingDeepLink by deepLinkRouter.pendingDeepLink.collectAsState()

    LaunchedEffect(pendingDeepLink) {
        val destination = pendingDeepLink ?: return@LaunchedEffect

        Log.d("HandleDeepLinks", "Processing pending deep link: $destination")

        // For now, assume user is authenticated
        // TODO: Add actual authentication check when auth system is implemented
        val isAuthenticated = true

        when (val result = deepLinkRouter.navigateWithAuth(
            navController = navController,
            destination = destination,
            isAuthenticated = isAuthenticated,
            clearBackStack = false
        )) {
            is DeepLinkRouter.NavigationResult.Success -> {
                Log.d("HandleDeepLinks", "Deep link navigation successful")
                deepLinkRouter.clearPendingDeepLink()
            }

            is DeepLinkRouter.NavigationResult.RequiresAuth -> {
                Log.d("HandleDeepLinks", "Deep link requires authentication")
                // Navigate to login/onboarding screen
                // The deep link will remain pending and be processed after auth
            }

            is DeepLinkRouter.NavigationResult.InvalidDestination -> {
                Log.w("HandleDeepLinks", "Invalid deep link destination: ${result.reason}")
                deepLinkRouter.clearPendingDeepLink()
            }

            is DeepLinkRouter.NavigationResult.RouteNotFound -> {
                Log.w("HandleDeepLinks", "Route not found: ${result.route}")
                // Navigate to a fallback (e.g., home screen)
                navigateToFallback(navController, destination, deepLinkRouter)
                deepLinkRouter.clearPendingDeepLink()
            }

            is DeepLinkRouter.NavigationResult.Error -> {
                Log.e("HandleDeepLinks", "Navigation error", result.exception)
                deepLinkRouter.clearPendingDeepLink()
            }
        }
    }
}

/**
 * Navigates to a fallback destination when the primary route is not available.
 *
 * This handles cases where deep links point to features that haven't been
 * implemented yet or routes that don't exist in the current navigation graph.
 */
private fun navigateToFallback(
    navController: NavController,
    destination: DeepLinkDestination,
    deepLinkRouter: DeepLinkRouter
) {
    val parentRoute = deepLinkRouter.getParentRoute(destination)

    try {
        navController.navigate(parentRoute) {
            popUpTo(navController.graph.startDestinationId) {
                saveState = true
            }
            launchSingleTop = true
            restoreState = true
        }
    } catch (e: Exception) {
        Log.e("HandleDeepLinks", "Failed to navigate to fallback: $parentRoute", e)
        // Last resort: navigate to start destination
        navController.navigate(Screen.Chat.route) {
            popUpTo(navController.graph.startDestinationId) {
                inclusive = true
            }
        }
    }
}
