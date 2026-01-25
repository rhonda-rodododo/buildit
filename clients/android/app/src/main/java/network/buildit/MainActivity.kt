package network.buildit

import android.Manifest
import android.os.Build
import android.os.Bundle
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
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
import network.buildit.features.chat.ChatScreen
import network.buildit.features.chat.ChatViewModel
import network.buildit.features.chat.ContactPickerScreen
import network.buildit.features.devicesync.DeviceSyncScreen
import network.buildit.features.groups.GroupsScreen
import network.buildit.features.settings.SettingsScreen
import network.buildit.ui.theme.BuildItTheme

/**
 * Main Activity for the BuildIt app.
 *
 * This activity hosts the main navigation structure using Jetpack Compose
 * with a bottom navigation bar for switching between main features.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            BuildItTheme {
                BuildItContent()
            }
        }
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
 */
@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun BuildItContent() {
    val navController = rememberNavController()

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
