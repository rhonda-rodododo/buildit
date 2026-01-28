package network.buildit.modules.search.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import network.buildit.modules.search.models.FacetCounts
import network.buildit.modules.search.models.FacetDefinition
import network.buildit.modules.search.models.FacetFilters
import network.buildit.modules.search.models.FacetType

/**
 * Facet filter chips for search filtering.
 *
 * Displays:
 * - Module type chips with counts
 * - Tag chips
 * - Custom facets from providers
 * - Clear all button
 */
@Composable
fun FacetChips(
    facetCounts: FacetCounts?,
    filters: FacetFilters,
    facetDefinitions: List<FacetDefinition>,
    onModuleTypeClick: (String) -> Unit,
    onTagClick: (String) -> Unit,
    onClearFilters: () -> Unit,
    modifier: Modifier = Modifier
) {
    val hasActiveFilters = filters.moduleTypes.isNotEmpty() ||
            filters.tags.isNotEmpty() ||
            filters.groupIds.isNotEmpty() ||
            filters.authors.isNotEmpty()

    Column(modifier = modifier.fillMaxWidth()) {
        // Header with filter icon and clear button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.FilterList,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp)
            )

            Spacer(modifier = Modifier.width(8.dp))

            Text(
                text = "Filters",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.weight(1f))

            if (hasActiveFilters) {
                TextButton(onClick = onClearFilters) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Clear all")
                }
            }
        }

        // Module type chips
        facetCounts?.moduleType?.takeIf { it.isNotEmpty() }?.let { moduleCounts ->
            Text(
                text = "Type",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                moduleCounts.forEach { (moduleType, count) ->
                    val isSelected = moduleType in filters.moduleTypes

                    CountFilterChip(
                        label = formatModuleType(moduleType),
                        count = count,
                        selected = isSelected,
                        onClick = { onModuleTypeClick(moduleType) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }

        // Tag chips
        facetCounts?.tags?.takeIf { it.isNotEmpty() }?.let { tagCounts ->
            Text(
                text = "Tags",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                tagCounts.entries.take(10).forEach { (tag, count) ->
                    val isSelected = tag in filters.tags

                    TagFilterChip(
                        tag = tag,
                        count = count,
                        selected = isSelected,
                        onClick = { onTagClick(tag) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

/**
 * Filter chip with count badge.
 */
@Composable
fun CountFilterChip(
    label: String,
    count: Int,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val containerColor by animateColorAsState(
        targetValue = if (selected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
        label = "containerColor"
    )

    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label)
                Spacer(modifier = Modifier.width(4.dp))
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = if (selected) {
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    }
                ) {
                    Text(
                        text = count.toString(),
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
        },
        leadingIcon = if (selected) {
            {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
            }
        } else null,
        modifier = modifier,
        colors = FilterChipDefaults.filterChipColors(
            containerColor = containerColor,
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
        )
    )
}

/**
 * Tag filter chip.
 */
@Composable
fun TagFilterChip(
    tag: String,
    count: Int,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("#$tag")
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = count.toString(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }
        },
        leadingIcon = {
            if (selected) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
            } else {
                Icon(
                    imageVector = Icons.Default.Tag,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        modifier = modifier,
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    )
}

/**
 * Active filters summary bar.
 */
@Composable
fun ActiveFiltersBar(
    filters: FacetFilters,
    onRemoveModuleType: (String) -> Unit,
    onRemoveTag: (String) -> Unit,
    onClearAll: () -> Unit,
    modifier: Modifier = Modifier
) {
    val hasFilters = filters.moduleTypes.isNotEmpty() ||
            filters.tags.isNotEmpty() ||
            filters.groupIds.isNotEmpty() ||
            filters.authors.isNotEmpty()

    if (!hasFilters) return

    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Module type filters
        filters.moduleTypes.forEach { moduleType ->
            RemovableChip(
                label = formatModuleType(moduleType),
                onRemove = { onRemoveModuleType(moduleType) }
            )
        }

        // Tag filters
        filters.tags.forEach { tag ->
            RemovableChip(
                label = "#$tag",
                onRemove = { onRemoveTag(tag) }
            )
        }

        // Clear all button
        if (filters.moduleTypes.size + filters.tags.size > 1) {
            TextButton(
                onClick = onClearAll
            ) {
                Text(
                    text = "Clear all",
                    style = MaterialTheme.typography.labelMedium
                )
            }
        }
    }
}

/**
 * Removable filter chip.
 */
@Composable
fun RemovableChip(
    label: String,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.primaryContainer,
        modifier = modifier
    ) {
        Row(
            modifier = Modifier.padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            IconButton(
                onClick = onRemove,
                modifier = Modifier.size(24.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Remove filter",
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}

/**
 * Scope selector for search.
 */
@Composable
fun ScopeSelector(
    currentScope: network.buildit.modules.search.models.SearchScope,
    onScopeChange: (network.buildit.modules.search.models.SearchScope) -> Unit,
    groupName: String? = null,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        ScopeChip(
            label = "All",
            selected = currentScope is network.buildit.modules.search.models.SearchScope.Global,
            onClick = { onScopeChange(network.buildit.modules.search.models.SearchScope.Global) }
        )

        groupName?.let { name ->
            ScopeChip(
                label = name,
                selected = currentScope is network.buildit.modules.search.models.SearchScope.Group,
                onClick = {
                    // Would need group ID here
                }
            )
        }
    }
}

/**
 * Scope selection chip.
 */
@Composable
fun ScopeChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        leadingIcon = if (selected) {
            {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
            }
        } else null,
        modifier = modifier
    )
}

// ============== Helper Functions ==============

private fun formatModuleType(moduleType: String): String {
    return when (moduleType.lowercase()) {
        "mutualaid" -> "Mutual Aid"
        "wiki" -> "Wiki"
        else -> moduleType.replaceFirstChar { it.uppercase() }
    }
}
