package network.buildit.modules.events.integration

import network.buildit.core.redacted
import android.util.Log
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flow
import network.buildit.modules.calling.service.OperatorStatusManager
import network.buildit.modules.calling.service.SFUConferenceManager
import network.buildit.modules.events.data.EventsRepository
import network.buildit.modules.events.domain.model.EventVolunteerRole
import network.buildit.modules.events.domain.model.EventVolunteerSignup
import network.buildit.modules.events.domain.model.RecurringPattern
import network.buildit.modules.events.domain.model.ShiftConfig
import network.buildit.modules.events.domain.model.SignupStatus
import network.buildit.modules.events.domain.model.VolunteerCallingRole
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Integration for volunteer signup with calling requirements.
 *
 * Provides functionality for:
 * - Checking volunteer requirements (training, calling access)
 * - Granting/revoking hotline access on signup confirmation
 * - Managing operator pools for shifts
 * - Processing signup confirmations with automatic access grants
 */
@Singleton
class VolunteerCallingIntegration @Inject constructor(
    private val conferenceManager: SFUConferenceManager,
    private val eventsRepository: EventsRepository,
    private val operatorStatusManager: OperatorStatusManager
) {
    companion object {
        private const val TAG = "VolunteerCallingInteg"
    }

    // Operator pool by hotline ID
    private val operatorPools = ConcurrentHashMap<String, MutableList<OperatorPoolEntry>>()

    // Hotline access grants by pubkey
    private val accessGrants = ConcurrentHashMap<String, MutableList<HotlineAccessGrant>>()

    // State flows for observation
    private val _operatorPoolUpdates = MutableStateFlow<Map<String, List<OperatorPoolEntry>>>(emptyMap())
    val operatorPoolUpdates: StateFlow<Map<String, List<OperatorPoolEntry>>> = _operatorPoolUpdates.asStateFlow()

    /**
     * Check if volunteer meets requirements for a role.
     *
     * @param contactId The contact's ID.
     * @param pubkey The volunteer's pubkey.
     * @param role The volunteer role requirements.
     * @return Requirements check result.
     */
    suspend fun checkRequirements(
        contactId: String,
        pubkey: String,
        role: EventVolunteerRole
    ): VolunteerRequirementsResult {
        Log.d(TAG, "Checking requirements for ${pubkey.redacted()}, role: ${role.name}")

        val missingTrainings = mutableListOf<TrainingRequirementStatus>()
        var allMet = true

        // Check required trainings
        for (trainingId in role.requiredTrainings) {
            // In production, this would query the training repository
            val trainingStatus = checkTrainingCompletion(pubkey, trainingId)
            if (!trainingStatus.met) {
                allMet = false
            }
            missingTrainings.add(trainingStatus)
        }

        // Check if calling role is required and accessible
        var missingCallingAccess = false
        val callingRoleRequired = role.callingRoleRequired
        if (callingRoleRequired != null) {
            val hasAccess = role.hotlineIds.all { hotlineId ->
                hasHotlineAccess(pubkey, hotlineId, callingRoleRequired)
            }
            if (!hasAccess) {
                missingCallingAccess = true
                allMet = false
            }
        }

        val unmetTrainings = missingTrainings.filter { !it.met }
        val message = when {
            !allMet && unmetTrainings.isNotEmpty() && missingCallingAccess ->
                "Missing required trainings and hotline access for this role"
            !allMet && unmetTrainings.isNotEmpty() ->
                "Missing required trainings: ${unmetTrainings.joinToString { it.courseName }}"
            !allMet && missingCallingAccess ->
                "Missing hotline access for ${callingRoleRequired?.value ?: "required"} role"
            else -> null
        }

        return VolunteerRequirementsResult(
            met = allMet,
            missingTrainings = missingTrainings,
            missingCallingAccess = missingCallingAccess,
            callingRoleRequired = callingRoleRequired,
            message = message
        )
    }

    /**
     * Grant hotline access to a volunteer.
     *
     * @param contactId The contact's ID.
     * @param pubkey The volunteer's pubkey.
     * @param hotlineIds List of hotline IDs to grant access to.
     * @param role The calling role to grant.
     * @param grantedBy Pubkey of the person granting access.
     */
    suspend fun grantHotlineAccess(
        contactId: String,
        pubkey: String,
        hotlineIds: List<String>,
        role: VolunteerCallingRole,
        grantedBy: String
    ) {
        val now = System.currentTimeMillis()

        val grants = accessGrants.getOrPut(pubkey) { mutableListOf() }

        for (hotlineId in hotlineIds) {
            // Remove any existing grant for this hotline
            grants.removeAll { it.hotlineId == hotlineId }

            // Add new grant
            val grant = HotlineAccessGrant(
                pubkey = pubkey,
                contactId = contactId,
                hotlineId = hotlineId,
                role = role,
                grantedAt = now,
                grantedBy = grantedBy,
                active = true
            )
            grants.add(grant)

            Log.i(TAG, "Granted ${role.value} access to hotline $hotlineId for ${pubkey.redacted()}")
        }
    }

    /**
     * Revoke hotline access from a volunteer.
     *
     * @param pubkey The volunteer's pubkey.
     * @param hotlineId The hotline ID to revoke access from.
     * @param reason Optional reason for revocation.
     */
    suspend fun revokeHotlineAccess(
        pubkey: String,
        hotlineId: String,
        reason: String? = null
    ) {
        val grants = accessGrants[pubkey] ?: return

        val revoked = grants.filter { it.hotlineId == hotlineId && it.active }
        revoked.forEach { grant ->
            val index = grants.indexOf(grant)
            if (index >= 0) {
                grants[index] = grant.copy(
                    active = false,
                    revokedAt = System.currentTimeMillis(),
                    revokedReason = reason
                )
            }
        }

        // Remove from operator pool if present
        operatorPools[hotlineId]?.removeAll { it.pubkey == pubkey }
        updateOperatorPoolState()

        Log.i(TAG, "Revoked access to hotline $hotlineId for ${pubkey.redacted()}: $reason")
    }

    /**
     * Add volunteer to operator pool for shifts.
     *
     * @param contactId The contact's ID.
     * @param pubkey The volunteer's pubkey.
     * @param hotlineId The hotline ID.
     * @param shifts List of shift configurations.
     */
    suspend fun addToOperatorPool(
        contactId: String,
        pubkey: String,
        hotlineId: String,
        shifts: List<ShiftConfig>
    ) {
        val pool = operatorPools.getOrPut(hotlineId) { mutableListOf() }

        // Check for existing entry
        val existing = pool.find { it.pubkey == pubkey }
        if (existing != null) {
            // Update shifts
            val updated = existing.copy(
                shifts = existing.shifts + shifts
            )
            pool.remove(existing)
            pool.add(updated)
            Log.i(TAG, "Updated operator ${pubkey.redacted()} in pool for hotline $hotlineId with ${shifts.size} new shifts")
        } else {
            // Get the role from the most recent access grant
            val grant = accessGrants[pubkey]?.find { it.hotlineId == hotlineId && it.active }
            val role = grant?.role ?: VolunteerCallingRole.HOTLINE_OPERATOR

            val entry = OperatorPoolEntry(
                pubkey = pubkey,
                contactId = contactId,
                hotlineId = hotlineId,
                role = role,
                shifts = shifts,
                addedAt = System.currentTimeMillis(),
                addedBy = grant?.grantedBy ?: "system",
                status = OperatorStatus.ACTIVE
            )
            pool.add(entry)
            Log.i(TAG, "Added operator ${pubkey.redacted()} to pool for hotline $hotlineId")
        }

        updateOperatorPoolState()
    }

    /**
     * Remove volunteer from operator pool.
     *
     * @param pubkey The volunteer's pubkey.
     * @param hotlineId The hotline ID.
     * @param shiftIds Optional specific shift IDs to remove. If null, removes from all shifts.
     */
    suspend fun removeFromOperatorPool(
        pubkey: String,
        hotlineId: String,
        shiftIds: List<String>? = null
    ) {
        val pool = operatorPools[hotlineId] ?: return
        val entry = pool.find { it.pubkey == pubkey } ?: return

        if (shiftIds == null) {
            // Remove entirely
            pool.remove(entry)
            Log.i(TAG, "Removed operator ${pubkey.redacted()} from pool for hotline $hotlineId")
        } else {
            // Remove specific shifts
            val remainingShifts = entry.shifts.filter { shift ->
                // Keep shifts whose ID (generated from hotlineId + startTime) is not in shiftIds
                val shiftId = "${shift.hotlineId}-${shift.startTime}"
                shiftId !in shiftIds
            }

            if (remainingShifts.isEmpty()) {
                pool.remove(entry)
                Log.i(TAG, "Removed operator ${pubkey.redacted()} from pool for hotline $hotlineId (no remaining shifts)")
            } else {
                pool.remove(entry)
                pool.add(entry.copy(shifts = remainingShifts))
                Log.i(TAG, "Removed ${shiftIds.size} shifts for operator ${pubkey.redacted()} from hotline $hotlineId")
            }
        }

        updateOperatorPoolState()
    }

    /**
     * Get all operators for a hotline.
     *
     * @param hotlineId The hotline ID.
     * @return List of operator pool entries.
     */
    fun getHotlineOperators(hotlineId: String): List<OperatorPoolEntry> {
        return operatorPools[hotlineId]?.toList() ?: emptyList()
    }

    /**
     * Get operators available for a specific time slot.
     *
     * @param hotlineId The hotline ID.
     * @param time Unix timestamp in milliseconds.
     * @return List of operators available at that time.
     */
    fun getAvailableOperators(hotlineId: String, time: Long): List<OperatorPoolEntry> {
        val pool = operatorPools[hotlineId] ?: return emptyList()

        return pool.filter { entry ->
            entry.status == OperatorStatus.ACTIVE &&
                    entry.shifts.any { shift ->
                        time >= shift.startTime && time <= shift.endTime
                    }
        }
    }

    /**
     * Process signup confirmation and grant necessary access.
     *
     * @param signup The volunteer signup.
     * @param role The event volunteer role.
     * @param confirmedBy Pubkey of the person confirming.
     * @return Result of the confirmation process.
     */
    suspend fun processSignupConfirmation(
        signup: EventVolunteerSignup,
        role: EventVolunteerRole,
        confirmedBy: String
    ): SignupConfirmationResult {
        Log.i(TAG, "Processing signup confirmation for ${signup.pubkey}, role: ${role.name}")

        // Check requirements first
        val requirements = checkRequirements(signup.contactId, signup.pubkey, role)
        if (!requirements.met) {
            Log.w(TAG, "Signup requirements not met: ${requirements.message}")
            return SignupConfirmationResult(
                accessGranted = false,
                message = requirements.message ?: "Requirements not met"
            )
        }

        // Grant hotline access if role requires it
        val callingRole = role.callingRoleRequired
        if (callingRole != null && role.hotlineIds.isNotEmpty()) {
            grantHotlineAccess(
                contactId = signup.contactId,
                pubkey = signup.pubkey,
                hotlineIds = role.hotlineIds,
                role = callingRole,
                grantedBy = confirmedBy
            )

            // Add to operator pool with configured shifts
            if (role.shifts.isNotEmpty()) {
                for (hotlineId in role.hotlineIds) {
                    val shiftsForHotline = role.shifts.filter { it.hotlineId == hotlineId }
                    if (shiftsForHotline.isNotEmpty()) {
                        addToOperatorPool(
                            contactId = signup.contactId,
                            pubkey = signup.pubkey,
                            hotlineId = hotlineId,
                            shifts = shiftsForHotline
                        )
                    }
                }
            }
        }

        return SignupConfirmationResult(
            accessGranted = callingRole != null,
            message = if (callingRole != null) {
                "Access granted for ${callingRole.value} role on ${role.hotlineIds.size} hotline(s)"
            } else {
                "Signup confirmed"
            }
        )
    }

    /**
     * Observe operator pool for a hotline.
     *
     * @param hotlineId The hotline ID.
     * @return Flow of operator pool entries.
     */
    fun observeHotlineOperators(hotlineId: String): Flow<List<OperatorPoolEntry>> {
        return flow {
            emit(operatorPools[hotlineId]?.toList() ?: emptyList())
        }
    }

    /**
     * Check if a volunteer has hotline access.
     *
     * @param pubkey The volunteer's pubkey.
     * @param hotlineId The hotline ID.
     * @param requiredRole Optional required role level.
     * @return True if access is granted.
     */
    fun hasHotlineAccess(
        pubkey: String,
        hotlineId: String,
        requiredRole: VolunteerCallingRole? = null
    ): Boolean {
        val grants = accessGrants[pubkey] ?: return false
        val grant = grants.find { it.hotlineId == hotlineId && it.active }
        if (grant == null) return false

        // If no specific role required, any active grant is sufficient
        if (requiredRole == null) return true

        // Check if the granted role meets the requirement
        return grant.role.ordinal <= requiredRole.ordinal // Lower ordinal = higher privilege
    }

    /**
     * Get all access grants for a volunteer.
     *
     * @param pubkey The volunteer's pubkey.
     * @return List of active access grants.
     */
    fun getAccessGrants(pubkey: String): List<HotlineAccessGrant> {
        return accessGrants[pubkey]?.filter { it.active } ?: emptyList()
    }

    /**
     * Update operator status.
     *
     * @param pubkey The operator's pubkey.
     * @param hotlineId The hotline ID.
     * @param status The new status.
     */
    suspend fun updateOperatorStatus(
        pubkey: String,
        hotlineId: String,
        status: OperatorStatus
    ) {
        val pool = operatorPools[hotlineId] ?: return
        val entry = pool.find { it.pubkey == pubkey } ?: return

        pool.remove(entry)
        pool.add(entry.copy(status = status))
        updateOperatorPoolState()

        Log.i(TAG, "Updated operator ${pubkey.redacted()} status to ${status.value} for hotline $hotlineId")
    }

    private suspend fun checkTrainingCompletion(
        pubkey: String,
        trainingId: String
    ): TrainingRequirementStatus {
        // In production, this would query the training repository
        // For now, return a placeholder
        return TrainingRequirementStatus(
            courseId = trainingId,
            courseName = "Training $trainingId",
            required = true,
            met = true, // Assume met for now
            certificationExpired = null,
            expiresAt = null
        )
    }

    private fun updateOperatorPoolState() {
        _operatorPoolUpdates.value = operatorPools.mapValues { it.value.toList() }
    }
}

/**
 * Result of volunteer requirements check.
 */
data class VolunteerRequirementsResult(
    val met: Boolean,
    val missingTrainings: List<TrainingRequirementStatus>,
    val missingCallingAccess: Boolean,
    val callingRoleRequired: VolunteerCallingRole?,
    val message: String?
)

/**
 * Training requirement status.
 */
data class TrainingRequirementStatus(
    val courseId: String,
    val courseName: String,
    val required: Boolean,
    val met: Boolean,
    val certificationExpired: Boolean?,
    val expiresAt: Long?
)

/**
 * Operator pool entry.
 */
data class OperatorPoolEntry(
    val pubkey: String,
    val contactId: String,
    val hotlineId: String,
    val role: VolunteerCallingRole,
    val shifts: List<ShiftConfig>,
    val addedAt: Long,
    val addedBy: String,
    val status: OperatorStatus
)

/**
 * Operator status.
 */
enum class OperatorStatus(val value: String) {
    ACTIVE("active"),
    INACTIVE("inactive"),
    SUSPENDED("suspended")
}

/**
 * Hotline access grant record.
 */
data class HotlineAccessGrant(
    val pubkey: String,
    val contactId: String,
    val hotlineId: String,
    val role: VolunteerCallingRole,
    val grantedAt: Long,
    val grantedBy: String,
    val active: Boolean,
    val revokedAt: Long? = null,
    val revokedReason: String? = null
)

/**
 * Result of signup confirmation.
 */
data class SignupConfirmationResult(
    val accessGranted: Boolean,
    val message: String
)
