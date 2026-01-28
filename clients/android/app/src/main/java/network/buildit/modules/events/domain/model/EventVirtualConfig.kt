package network.buildit.modules.events.domain.model

import kotlinx.serialization.Serializable

/**
 * Configuration for virtual event features.
 */
@Serializable
data class EventVirtualConfig(
    val enabled: Boolean = false,
    val conferenceRoomId: String? = null,
    val autoStartMinutes: Int = 15,
    val waitingRoomEnabled: Boolean = true,
    val recordingEnabled: Boolean = false,
    val recordingConsentRequired: Boolean = true,
    val maxVirtualAttendees: Int? = null,
    val breakoutRoomsEnabled: Boolean = false,
    val breakoutConfig: BreakoutRoomConfig? = null,
    val recordingUrl: String? = null,
    val e2eeRequired: Boolean = false
)

/**
 * Configuration for breakout rooms in virtual events.
 */
@Serializable
data class BreakoutRoomConfig(
    val enabled: Boolean = false,
    val autoAssign: Boolean = false,
    val roomCount: Int? = null,
    val roomNames: List<String>? = null,
    val allowSelfSelect: Boolean = false,
    val durationMinutes: Int? = null
)

/**
 * Event attendance type.
 */
enum class EventAttendanceType(val value: String) {
    IN_PERSON("in_person"),
    VIRTUAL("virtual"),
    HYBRID("hybrid")
}

/**
 * Volunteer role in an event.
 */
@Serializable
data class EventVolunteerRole(
    val id: String,
    val name: String,
    val description: String? = null,
    val requiredTrainings: List<String> = emptyList(),
    val callingRoleRequired: VolunteerCallingRole? = null,
    val hotlineIds: List<String> = emptyList(),
    val maxVolunteers: Int? = null,
    val shifts: List<ShiftConfig> = emptyList()
)

/**
 * Volunteer calling role.
 */
enum class VolunteerCallingRole(val value: String) {
    HOTLINE_OPERATOR("hotline_operator"),
    DISPATCHER("dispatcher"),
    MEDIC("medic"),
    COORDINATOR("coordinator"),
    LEAD("lead")
}

/**
 * Shift configuration for volunteer scheduling.
 */
@Serializable
data class ShiftConfig(
    val hotlineId: String,
    val startTime: Long,
    val endTime: Long,
    val role: VolunteerCallingRole,
    val isRecurring: Boolean? = null,
    val recurringPattern: RecurringPattern? = null
)

/**
 * Pattern for recurring shifts.
 */
enum class RecurringPattern(val value: String) {
    DAILY("daily"),
    WEEKLY("weekly"),
    MONTHLY("monthly")
}

/**
 * Volunteer signup for an event.
 */
@Serializable
data class EventVolunteerSignup(
    val id: String,
    val eventId: String,
    val pubkey: String,
    val contactId: String,
    val roleId: String,
    val status: SignupStatus,
    val signedUpAt: Long,
    val confirmedAt: Long? = null,
    val confirmedBy: String? = null,
    val notes: String? = null
)

/**
 * Status of volunteer signup.
 */
enum class SignupStatus(val value: String) {
    PENDING("pending"),
    CONFIRMED("confirmed"),
    REJECTED("rejected"),
    CANCELLED("cancelled")
}
