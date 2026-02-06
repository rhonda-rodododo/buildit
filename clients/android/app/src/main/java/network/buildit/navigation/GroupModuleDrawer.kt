package network.buildit.navigation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Group module navigation drawer/panel.
 *
 * Displays all enabled modules for a group with icons and labels.
 * Allows navigating to module-specific screens within the group context.
 * Respects per-group module enablement from ModuleRegistry.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupModuleDrawer(
    groupId: String,
    groupName: String,
    enabledModuleIds: Set<String>,
    selectedModuleId: String?,
    onModuleSelected: (moduleId: String, route: String) -> Unit,
    onManageModules: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val enabledModules = moduleNavItems.filter { it.moduleId in enabledModuleIds }
    val disabledModules = moduleNavItems.filter { it.moduleId !in enabledModuleIds }

    ModalDrawerSheet(modifier = modifier) {
        // Group header
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = groupName,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${enabledModules.size} module${if (enabledModules.size != 1) "s" else ""} enabled",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        HorizontalDivider()

        LazyColumn(
            modifier = Modifier.weight(1f)
        ) {
            // Enabled modules
            items(enabledModules) { module ->
                NavigationDrawerItem(
                    label = { Text(module.label) },
                    selected = module.moduleId == selectedModuleId,
                    onClick = {
                        onModuleSelected(module.moduleId, module.route(groupId))
                    },
                    icon = {
                        Icon(module.icon, contentDescription = module.label)
                    },
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
            }

            // Separator if there are disabled modules
            if (disabledModules.isNotEmpty()) {
                item {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    Text(
                        text = "Available Modules",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 28.dp, vertical = 4.dp)
                    )
                }

                // Disabled modules (greyed out)
                items(disabledModules.take(5)) { module ->
                    NavigationDrawerItem(
                        label = {
                            Text(
                                module.label,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                        },
                        selected = false,
                        onClick = { /* Show enable module dialog */ },
                        icon = {
                            Icon(
                                module.icon,
                                contentDescription = module.label,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                        },
                        badge = {
                            Text(
                                text = "Off",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                        },
                        modifier = Modifier.padding(horizontal = 12.dp)
                    )
                }
            }
        }

        // Manage modules button at bottom
        if (onManageModules != null) {
            HorizontalDivider()
            NavigationDrawerItem(
                label = { Text("Manage Modules") },
                selected = false,
                onClick = onManageModules,
                icon = {
                    Icon(Icons.Default.Settings, contentDescription = "Manage Modules")
                },
                modifier = Modifier.padding(12.dp)
            )
        }
    }
}

/**
 * Compact horizontal module selector shown at the top of a group screen.
 *
 * Alternative to the full drawer for smaller screens or inline navigation.
 */
@Composable
fun GroupModuleTabBar(
    groupId: String,
    enabledModuleIds: Set<String>,
    selectedModuleId: String?,
    onModuleSelected: (moduleId: String, route: String) -> Unit,
    modifier: Modifier = Modifier
) {
    val enabledModules = moduleNavItems.filter { it.moduleId in enabledModuleIds }

    if (enabledModules.isEmpty()) return

    ScrollableTabRow(
        selectedTabIndex = enabledModules.indexOfFirst { it.moduleId == selectedModuleId }
            .coerceAtLeast(0),
        modifier = modifier,
        edgePadding = 16.dp,
        divider = {}
    ) {
        enabledModules.forEach { module ->
            Tab(
                selected = module.moduleId == selectedModuleId,
                onClick = {
                    onModuleSelected(module.moduleId, module.route(groupId))
                },
                text = { Text(module.label) },
                icon = {
                    Icon(
                        module.icon,
                        contentDescription = module.label,
                        modifier = Modifier.size(18.dp)
                    )
                }
            )
        }
    }
}

/**
 * Module enable/disable management screen for a group.
 *
 * Allows group admins to toggle which modules are active for their group.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModuleManagementScreen(
    groupId: String,
    enabledModuleIds: Set<String>,
    onToggleModule: (moduleId: String, enabled: Boolean) -> Unit,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Manage Modules") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            item {
                Text(
                    text = "Choose which modules are available for this group. " +
                        "Disabled modules hide their navigation and features but preserve data.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }

            items(moduleNavItems) { module ->
                val isEnabled = module.moduleId in enabledModuleIds

                ListItem(
                    headlineContent = {
                        Text(
                            text = module.label,
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    supportingContent = {
                        Text(
                            text = module.description,
                            style = MaterialTheme.typography.bodySmall
                        )
                    },
                    leadingContent = {
                        Icon(
                            module.icon,
                            contentDescription = null,
                            tint = if (isEnabled) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                    },
                    trailingContent = {
                        Switch(
                            checked = isEnabled,
                            onCheckedChange = { enabled ->
                                onToggleModule(module.moduleId, enabled)
                            }
                        )
                    },
                    modifier = Modifier.clickable {
                        onToggleModule(module.moduleId, !isEnabled)
                    }
                )
            }
        }
    }
}
