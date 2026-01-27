package network.buildit.modules.calling.services

import android.util.Log
import androidx.compose.ui.graphics.Color
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import network.buildit.generated.schemas.CreditBalance
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.Calendar
import java.util.Date
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Credit alert thresholds
 */
object CreditThresholds {
    const val WARNING = 0.8    // 80% used - warning
    const val CRITICAL = 0.95  // 95% used - critical
}

/**
 * Credits manager configuration
 */
data class CreditsManagerConfig(
    val workerUrl: String,
    val pollingInterval: Long = 60000L // ms, default 1 minute
)

/**
 * Local credit balance for UI
 */
data class LocalCreditBalance(
    val groupId: String,
    val monthlyAllocation: Double,
    val used: Double,
    val remaining: Double,
    val percentUsed: Double,
    val resetDate: Date,
    val isLow: Boolean
)

/**
 * PSTN usage record
 */
@Serializable
data class PSTNUsageRecord(
    val callSid: String,
    val direction: String, // "inbound" or "outbound"
    val duration: Long, // seconds
    val creditsCost: Double,
    val timestamp: Long,
    val targetPhone: String? = null
)

/**
 * Usage summary
 */
data class UsageSummary(
    val totalCalls: Int,
    val totalMinutes: Int,
    val totalCost: Double,
    val inboundCalls: Int,
    val outboundCalls: Int,
    val averageCallDuration: Int, // seconds
    val peakHour: Int // 0-23
)

/**
 * Credit events
 */
sealed class CreditEvent {
    data class BalanceUpdated(val balance: LocalCreditBalance) : CreditEvent()
    data class CreditsLow(val balance: LocalCreditBalance) : CreditEvent()
    data class CreditsCritical(val balance: LocalCreditBalance) : CreditEvent()
    data class CreditsExhausted(val balance: LocalCreditBalance) : CreditEvent()
    data class UsageRecorded(val record: PSTNUsageRecord) : CreditEvent()
}

/**
 * PSTN Credits Manager
 *
 * Tracks credit balances and usage for PSTN calling.
 * Provides real-time balance updates and usage history.
 */
@Singleton
class PSTNCreditsManager @Inject constructor(
    private val httpClient: OkHttpClient
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    // Cached balances
    private val balances = ConcurrentHashMap<String, LocalCreditBalance>()

    // Usage history cache
    private val usageHistory = ConcurrentHashMap<String, MutableList<PSTNUsageRecord>>()

    // Polling job
    private var pollingJob: Job? = null

    // Configuration
    private var config: CreditsManagerConfig? = null

    // API base URL
    private val apiBase: String
        get() = config?.workerUrl ?: ""

    // State flows
    private val _balancesFlow = MutableStateFlow<Map<String, LocalCreditBalance>>(emptyMap())
    val balancesFlow: StateFlow<Map<String, LocalCreditBalance>> = _balancesFlow.asStateFlow()

    // Events
    private val _events = MutableSharedFlow<CreditEvent>()
    val events: SharedFlow<CreditEvent> = _events.asSharedFlow()

    companion object {
        private const val TAG = "PSTNCreditsManager"

        // Nostr event kind for PSTN credits (from protocol)
        const val KIND_PSTN_CREDITS = 24383

        /**
         * Format credits for display
         */
        fun formatCredits(credits: Double): String {
            val minutes = credits.toInt()
            return if (minutes >= 60) {
                val hours = minutes / 60
                val mins = minutes % 60
                if (mins > 0) "${hours}h ${mins}m" else "${hours}h"
            } else {
                "${minutes}m"
            }
        }

        /**
         * Format percentage for display
         */
        fun formatPercentage(percent: Double): String {
            return "${percent.toInt()}%"
        }

        /**
         * Get status color based on usage
         */
        fun getStatusColor(percentUsed: Double): Color {
            return when {
                percentUsed >= CreditThresholds.CRITICAL * 100 -> Color(0xFFF44336) // Red
                percentUsed >= CreditThresholds.WARNING * 100 -> Color(0xFFFF9800) // Orange/Yellow
                else -> Color(0xFF4CAF50) // Green
            }
        }

        /**
         * Calculate days until reset
         */
        fun getDaysUntilReset(resetDate: Date): Int {
            val now = Date()
            val diff = resetDate.time - now.time
            return (diff / (1000 * 60 * 60 * 24)).toInt().coerceAtLeast(0)
        }
    }

    /**
     * Initialize with configuration
     */
    fun initialize(config: CreditsManagerConfig) {
        this.config = config
        Log.d(TAG, "PSTNCreditsManager initialized with worker URL: ${config.workerUrl}")
    }

    /**
     * Handle credit event from Nostr signaling
     */
    fun handleSignalingEvent(kind: Int, content: String) {
        if (kind != KIND_PSTN_CREDITS) return

        scope.launch {
            try {
                handleCreditsEvent(content)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to handle credits event", e)
            }
        }
    }

    /**
     * Handle credits event from signaling
     */
    private suspend fun handleCreditsEvent(content: String) {
        val data = json.decodeFromString<CreditsEventData>(content)

        when (data.type) {
            "balance_update" -> {
                val balance = LocalCreditBalance(
                    groupId = data.groupId,
                    monthlyAllocation = data.monthlyAllocation ?: 0.0,
                    used = data.used ?: 0.0,
                    remaining = data.remaining ?: 0.0,
                    percentUsed = ((data.used ?: 0.0) / (data.monthlyAllocation ?: 1.0)) * 100,
                    resetDate = Date(data.resetDate ?: System.currentTimeMillis()),
                    isLow = (data.used ?: 0.0) / (data.monthlyAllocation ?: 1.0) >= CreditThresholds.WARNING
                )
                updateBalance(balance)
            }
            "usage" -> {
                val record = PSTNUsageRecord(
                    callSid = data.callSid ?: "",
                    direction = data.direction ?: "inbound",
                    duration = data.duration ?: 0,
                    creditsCost = data.creditsCost ?: 0.0,
                    timestamp = data.timestamp ?: System.currentTimeMillis(),
                    targetPhone = data.targetPhone
                )
                recordUsage(data.groupId, record)
            }
        }
    }

    /**
     * Fetch current balance from backend
     */
    suspend fun getBalance(groupId: String): LocalCreditBalance {
        // Check cache first
        balances[groupId]?.let { return it }

        // Fetch from backend
        val request = Request.Builder()
            .url("$apiBase/api/pstn/credits/$groupId")
            .get()
            .build()

        val response = httpClient.newCall(request).execute()

        if (!response.isSuccessful) {
            throw Exception("Failed to fetch credit balance")
        }

        val data = json.decodeFromString<CreditBalanceResponse>(response.body?.string() ?: "{}")

        val balance = LocalCreditBalance(
            groupId = groupId,
            monthlyAllocation = data.monthlyAllocation,
            used = data.used,
            remaining = data.remaining,
            percentUsed = (data.used / data.monthlyAllocation) * 100,
            resetDate = Date(data.resetDate),
            isLow = data.used / data.monthlyAllocation >= CreditThresholds.WARNING
        )

        updateBalance(balance)
        return balance
    }

    /**
     * Get usage history for a group
     */
    suspend fun getUsageHistory(groupId: String, days: Int = 30): List<PSTNUsageRecord> {
        // Check cache first
        usageHistory[groupId]?.let { cached ->
            if (cached.isNotEmpty()) {
                val cutoff = System.currentTimeMillis() - (days.toLong() * 24 * 60 * 60 * 1000)
                return cached.filter { it.timestamp >= cutoff }
            }
        }

        // Fetch from backend
        val request = Request.Builder()
            .url("$apiBase/api/pstn/credits/$groupId/usage?days=$days")
            .get()
            .build()

        val response = httpClient.newCall(request).execute()

        if (!response.isSuccessful) {
            throw Exception("Failed to fetch usage history")
        }

        val data = json.decodeFromString<UsageHistoryResponse>(response.body?.string() ?: "{}")

        // Cache the records
        usageHistory[groupId] = data.records.toMutableList()

        return data.records
    }

    /**
     * Get usage summary for a group
     */
    suspend fun getUsageSummary(groupId: String): UsageSummary {
        val records = getUsageHistory(groupId)

        if (records.isEmpty()) {
            return UsageSummary(
                totalCalls = 0,
                totalMinutes = 0,
                totalCost = 0.0,
                inboundCalls = 0,
                outboundCalls = 0,
                averageCallDuration = 0,
                peakHour = 0
            )
        }

        val totalCalls = records.size
        val totalMinutes = (records.sumOf { it.duration } / 60).toInt()
        val totalCost = records.sumOf { it.creditsCost }
        val inboundCalls = records.count { it.direction == "inbound" }
        val outboundCalls = records.count { it.direction == "outbound" }
        val averageCallDuration = (records.sumOf { it.duration } / totalCalls).toInt()

        // Calculate peak hour
        val hourCounts = IntArray(24)
        for (record in records) {
            val calendar = Calendar.getInstance().apply { timeInMillis = record.timestamp }
            val hour = calendar.get(Calendar.HOUR_OF_DAY)
            hourCounts[hour]++
        }
        val peakHour = hourCounts.indices.maxByOrNull { hourCounts[it] } ?: 0

        return UsageSummary(
            totalCalls = totalCalls,
            totalMinutes = totalMinutes,
            totalCost = totalCost,
            inboundCalls = inboundCalls,
            outboundCalls = outboundCalls,
            averageCallDuration = averageCallDuration,
            peakHour = peakHour
        )
    }

    /**
     * Check if group has sufficient credits for a call
     */
    suspend fun hasCredits(groupId: String, estimatedMinutes: Int = 1): Boolean {
        val balance = getBalance(groupId)
        return balance.remaining >= estimatedMinutes
    }

    /**
     * Get cached balance (synchronous)
     */
    fun getCachedBalance(groupId: String): LocalCreditBalance? = balances[groupId]

    /**
     * Get all cached balances
     */
    fun getAllCachedBalances(): List<LocalCreditBalance> = balances.values.toList()

    /**
     * Update balance and emit events if needed
     */
    private suspend fun updateBalance(balance: LocalCreditBalance) {
        val previousBalance = balances[balance.groupId]
        balances[balance.groupId] = balance

        _balancesFlow.value = balances.toMap()
        _events.emit(CreditEvent.BalanceUpdated(balance))

        // Check for threshold crossings
        val previousPercent = previousBalance?.percentUsed ?: 0.0

        when {
            balance.remaining <= 0 -> {
                _events.emit(CreditEvent.CreditsExhausted(balance))
            }
            balance.percentUsed >= CreditThresholds.CRITICAL * 100 &&
                    previousPercent < CreditThresholds.CRITICAL * 100 -> {
                _events.emit(CreditEvent.CreditsCritical(balance))
            }
            balance.percentUsed >= CreditThresholds.WARNING * 100 &&
                    previousPercent < CreditThresholds.WARNING * 100 -> {
                _events.emit(CreditEvent.CreditsLow(balance))
            }
        }
    }

    /**
     * Record a usage event
     */
    private suspend fun recordUsage(groupId: String, record: PSTNUsageRecord) {
        // Add to history
        val history = usageHistory.getOrPut(groupId) { mutableListOf() }
        history.add(record)

        // Emit event
        _events.emit(CreditEvent.UsageRecorded(record))

        // Update balance (deduct credits)
        balances[groupId]?.let { balance ->
            val updatedBalance = balance.copy(
                used = balance.used + record.creditsCost,
                remaining = balance.monthlyAllocation - balance.used - record.creditsCost,
                percentUsed = ((balance.used + record.creditsCost) / balance.monthlyAllocation) * 100,
                isLow = (balance.used + record.creditsCost) / balance.monthlyAllocation >= CreditThresholds.WARNING
            )
            updateBalance(updatedBalance)
        }
    }

    /**
     * Start polling for balance updates
     */
    fun startPolling(groupIds: List<String>) {
        stopPolling()

        val pollInterval = config?.pollingInterval ?: 60000L

        pollingJob = scope.launch {
            while (true) {
                for (groupId in groupIds) {
                    try {
                        getBalance(groupId)
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to poll balance for $groupId", e)
                    }
                }
                delay(pollInterval)
            }
        }

        // Fetch immediately
        scope.launch {
            for (groupId in groupIds) {
                try {
                    getBalance(groupId)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to fetch initial balance for $groupId", e)
                }
            }
        }
    }

    /**
     * Stop polling for balance updates
     */
    fun stopPolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    /**
     * Cleanup resources
     */
    fun destroy() {
        stopPolling()
        balances.clear()
        usageHistory.clear()
        _balancesFlow.value = emptyMap()
    }
}

// Response data classes

@Serializable
private data class CreditsEventData(
    val type: String,
    val groupId: String,
    val monthlyAllocation: Double? = null,
    val used: Double? = null,
    val remaining: Double? = null,
    val resetDate: Long? = null,
    val callSid: String? = null,
    val direction: String? = null,
    val duration: Long? = null,
    val creditsCost: Double? = null,
    val timestamp: Long? = null,
    val targetPhone: String? = null
)

@Serializable
private data class CreditBalanceResponse(
    val monthlyAllocation: Double,
    val used: Double,
    val remaining: Double,
    val resetDate: Long
)

@Serializable
private data class UsageHistoryResponse(
    val records: List<PSTNUsageRecord>
)
