package network.buildit.modules.governance.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import network.buildit.modules.governance.data.local.QuadraticBallot
import network.buildit.modules.governance.data.local.QuadraticOptionResult
import network.buildit.modules.governance.data.local.QuadraticVotingConfig
import network.buildit.modules.governance.data.local.VoteOption
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Token allocation UI for quadratic voting.
 *
 * Each voter gets a token budget. The cost of N effective votes = N^2 tokens.
 * This encourages voters to spread tokens across multiple options.
 */
@Composable
fun QuadraticVotingPanel(
    options: List<VoteOption>,
    config: QuadraticVotingConfig,
    isSubmitting: Boolean = false,
    onSubmit: (QuadraticBallot) -> Unit
) {
    val allocations = remember {
        mutableStateMapOf<String, Int>().apply {
            options.forEach { this[it.id] = 0 }
        }
    }

    val totalUsed = allocations.values.sum()
    val remaining = config.tokenBudget - totalUsed
    val budgetPercentUsed = totalUsed.toFloat() / config.tokenBudget.toFloat()
    val hasAnyAllocation = totalUsed > 0

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Budget overview
        item {
            BudgetOverviewCard(
                totalUsed = totalUsed,
                budget = config.tokenBudget,
                remaining = remaining,
                percentUsed = budgetPercentUsed
            )
        }

        // How it works
        item {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "How Quadratic Voting Works",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "1 token = 1 vote, 4 tokens = 2 votes, 9 tokens = 3 votes, 16 tokens = 4 votes. " +
                                "Spread your tokens to maximize total influence.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Option allocation rows
        items(options.sortedBy { it.order }, key = { it.id }) { option ->
            OptionAllocationCard(
                option = option,
                tokens = allocations[option.id] ?: 0,
                maxPerOption = config.maxTokensPerOption ?: config.tokenBudget,
                remaining = remaining,
                onAllocationChange = { newValue ->
                    val otherAllocations = allocations
                        .filter { it.key != option.id }
                        .values.sum()

                    val maxPerOpt = config.maxTokensPerOption ?: config.tokenBudget
                    val maxAllowable = min(maxPerOpt, config.tokenBudget - otherAllocations)
                    allocations[option.id] = newValue.coerceIn(0, maxAllowable)
                }
            )
        }

        // Submit button
        item {
            Button(
                onClick = {
                    val nonZero = allocations
                        .filter { it.value > 0 }
                        .toMap()
                    onSubmit(QuadraticBallot(nonZero))
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = hasAnyAllocation && remaining >= 0 && !isSubmitting
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Submitting...")
                } else {
                    Icon(Icons.Default.HowToVote, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Submit Quadratic Ballot")
                }
            }
        }
    }
}

@Composable
private fun BudgetOverviewCard(
    totalUsed: Int,
    budget: Int,
    remaining: Int,
    percentUsed: Float
) {
    Card {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Token Budget",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "$totalUsed / $budget used",
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (remaining < 0)
                        MaterialTheme.colorScheme.error
                    else
                        MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            LinearProgressIndicator(
                progress = { percentUsed.coerceIn(0f, 1f) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp),
                color = if (remaining < 0)
                    MaterialTheme.colorScheme.error
                else
                    MaterialTheme.colorScheme.primary,
            )

            if (remaining > 0) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "$remaining tokens remaining",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else if (remaining < 0) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Over budget! Reduce allocations.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun OptionAllocationCard(
    option: VoteOption,
    tokens: Int,
    maxPerOption: Int,
    remaining: Int,
    onAllocationChange: (Int) -> Unit
) {
    val effectiveVotes = if (tokens > 0) sqrt(tokens.toDouble()) else 0.0

    Card {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = option.label,
                        style = MaterialTheme.typography.titleSmall
                    )
                    option.description?.let { desc ->
                        Text(
                            text = desc,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = String.format("%.2f votes", effectiveVotes),
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "$tokens tokens",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                IconButton(
                    onClick = { onAllocationChange(tokens - 1) },
                    enabled = tokens > 0
                ) {
                    Icon(Icons.Default.RemoveCircle, contentDescription = "Decrease")
                }

                OutlinedTextField(
                    value = tokens.toString(),
                    onValueChange = { text ->
                        val newValue = text.toIntOrNull() ?: 0
                        onAllocationChange(newValue)
                    },
                    modifier = Modifier.width(80.dp),
                    textStyle = MaterialTheme.typography.bodyMedium.copy(textAlign = TextAlign.Center),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )

                IconButton(
                    onClick = { onAllocationChange(tokens + 1) },
                    enabled = remaining > 0
                ) {
                    Icon(Icons.Default.AddCircle, contentDescription = "Increase")
                }

                Spacer(modifier = Modifier.weight(1f))

                // Quick preset buttons
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf(1, 4, 9, 16).forEach { preset ->
                        if (preset <= maxPerOption) {
                            AssistChip(
                                onClick = { onAllocationChange(preset) },
                                label = { Text("$preset", style = MaterialTheme.typography.labelSmall) },
                                modifier = Modifier.height(28.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Display component for quadratic voting results.
 */
@Composable
fun QuadraticResultsCard(
    options: List<VoteOption>,
    results: Map<String, QuadraticOptionResult>,
    winnerId: String?
) {
    val maxEffectiveVotes = results.values.maxOfOrNull { it.effectiveVotes } ?: 0.001

    Card {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Quadratic Voting Results",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "Weighted by square root of tokens allocated",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(16.dp))

            val sortedOptions = options
                .sortedByDescending { results[it.id]?.effectiveVotes ?: 0.0 }

            sortedOptions.forEachIndexed { index, option ->
                val result = results[option.id] ?: QuadraticOptionResult(0, 0.0, 0)
                val isWinner = option.id == winnerId
                val barPercent = (result.effectiveVotes / maxEffectiveVotes).toFloat()

                Column(modifier = Modifier.padding(vertical = 4.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (isWinner) {
                                Icon(
                                    Icons.Default.EmojiEvents,
                                    contentDescription = "Winner",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                            }
                            Text(
                                text = "${index + 1}. ${option.label}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (isWinner)
                                    androidx.compose.ui.text.font.FontWeight.Bold
                                else
                                    androidx.compose.ui.text.font.FontWeight.Normal,
                                color = if (isWinner)
                                    MaterialTheme.colorScheme.primary
                                else
                                    MaterialTheme.colorScheme.onSurface
                            )
                        }

                        Text(
                            text = String.format("%.2f votes", result.effectiveVotes),
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = if (isWinner)
                                androidx.compose.ui.text.font.FontWeight.Bold
                            else
                                androidx.compose.ui.text.font.FontWeight.Normal
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    LinearProgressIndicator(
                        progress = { barPercent },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp),
                        color = if (isWinner)
                            MaterialTheme.colorScheme.primary
                        else
                            MaterialTheme.colorScheme.secondary,
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "${result.totalTokens} tokens",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "${result.voterCount} voter${if (result.voterCount != 1) "s" else ""}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (index < sortedOptions.size - 1) {
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}
