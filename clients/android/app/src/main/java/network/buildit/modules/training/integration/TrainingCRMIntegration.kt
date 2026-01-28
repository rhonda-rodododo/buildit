package network.buildit.modules.training.integration

import android.util.Log
import kotlinx.coroutines.flow.first
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.repository.TrainingRepository
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Contact training information for CRM display.
 */
data class ContactTrainingInfo(
    val contactId: String,
    val pubkey: String,
    val enrolledCourses: Int,
    val completedCourses: Int,
    val certifications: List<Certification>,
    val certificationsExpiring: List<Certification>,
    val totalTimeSpentHours: Float,
    val lastActivity: Long?
)

/**
 * Training requirement for volunteer roles.
 */
data class TrainingRequirement(
    val courseId: String,
    val courseName: String,
    val required: Boolean,
    val currentlyMet: Boolean,
    val certificationExpired: Boolean = false,
    val certificationExpiresAt: Long? = null
)

/**
 * Integration between Training module and CRM module.
 * Links certifications to contacts and tracks training status.
 */
@Singleton
class TrainingCRMIntegration @Inject constructor(
    private val trainingRepository: TrainingRepository
    // In a real implementation, would inject CRMManager or DatabaseManager
) {
    companion object {
        private const val TAG = "TrainingCRMIntegration"
    }

    /**
     * Adds a certification to a CRM contact record.
     *
     * @param contactId The CRM contact ID
     * @param certification The certification to add
     */
    suspend fun addCertificationToContact(
        contactId: String,
        certification: Certification
    ) {
        Log.i(TAG, "Adding certification ${certification.id} to contact $contactId")

        // In a real implementation, this would:
        // 1. Get the CRM contact record
        // 2. Update custom fields with certification info
        // 3. Save the updated contact

        // Would use DatabaseManager or CRMManager to update contact
    }

    /**
     * Gets training status for a CRM contact.
     *
     * @param contactId The CRM contact ID
     * @param pubkey The contact's public key
     * @return Training information for the contact
     */
    suspend fun getContactTrainingStatus(
        contactId: String,
        pubkey: String
    ): ContactTrainingInfo {
        val status = trainingRepository.getUserTrainingStatus(pubkey)
        val certifications = trainingRepository.getCertifications(pubkey).first()

        val now = System.currentTimeMillis() / 1000
        val thirtyDays = 30 * 24 * 60 * 60L

        val validCerts = certifications.filter { it.isValid }
        val expiringSoon = validCerts.filter { cert ->
            cert.expiresAt != null &&
                    cert.expiresAt > now &&
                    cert.expiresAt < now + thirtyDays
        }

        return ContactTrainingInfo(
            contactId = contactId,
            pubkey = pubkey,
            enrolledCourses = status.coursesEnrolled,
            completedCourses = status.coursesCompleted,
            certifications = validCerts,
            certificationsExpiring = expiringSoon,
            totalTimeSpentHours = status.totalTimeSpentHours,
            lastActivity = status.lastActivity
        )
    }

    /**
     * Filters contacts by certification status.
     *
     * @param courseId The course ID
     * @param includeExpired Whether to include expired certifications
     * @return List of pubkeys with the certification
     */
    suspend fun filterContactsByCertification(
        courseId: String,
        includeExpired: Boolean = false
    ): List<String> {
        val certifications = trainingRepository.getCertificationsForCourse(courseId).first()
        val now = System.currentTimeMillis() / 1000

        return certifications
            .filter { cert ->
                !cert.isRevoked &&
                        (includeExpired || cert.expiresAt == null || cert.expiresAt > now)
            }
            .map { it.pubkey }
            .distinct()
    }

    /**
     * Checks training requirements for a contact.
     *
     * @param pubkey The contact's public key
     * @param requiredCourseIds List of required course IDs
     * @return Whether requirements are met and detailed status
     */
    suspend fun checkTrainingRequirements(
        pubkey: String,
        requiredCourseIds: List<String>
    ): TrainingRequirementsResult {
        val certifications = trainingRepository.getCertifications(pubkey).first()
        val now = System.currentTimeMillis() / 1000

        val requirements = mutableListOf<TrainingRequirement>()
        var allMet = true

        for (courseId in requiredCourseIds) {
            val course = trainingRepository.getCourse(courseId).first()
            val cert = certifications.find { it.courseId == courseId && !it.isRevoked }

            val expired = cert?.expiresAt?.let { it < now } ?: false
            val met = cert != null && !expired

            if (!met) {
                allMet = false
            }

            requirements.add(
                TrainingRequirement(
                    courseId = courseId,
                    courseName = course?.title ?: "Unknown Course",
                    required = true,
                    currentlyMet = met,
                    certificationExpired = expired,
                    certificationExpiresAt = cert?.expiresAt
                )
            )
        }

        return TrainingRequirementsResult(
            met = allMet,
            requirements = requirements
        )
    }

    /**
     * Gets contacts with certifications expiring within a threshold.
     *
     * @param daysThreshold Number of days to look ahead
     * @return List of contacts with expiring certifications
     */
    suspend fun getContactsWithExpiringCertifications(
        daysThreshold: Int = 30
    ): List<ExpiringCertificationInfo> {
        val courses = trainingRepository.getCourses().first()
        val courseMap = courses.associateBy { it.id }

        val now = System.currentTimeMillis() / 1000
        val threshold = daysThreshold * 24 * 60 * 60L

        val results = mutableListOf<ExpiringCertificationInfo>()

        // Would need to iterate through all certifications
        // In a real implementation, this would be a more efficient database query
        courses.forEach { course ->
            val certs = trainingRepository.getCertificationsForCourse(course.id).first()
            val expiring = certs.filter { cert ->
                cert.expiresAt != null &&
                        cert.expiresAt > now &&
                        cert.expiresAt < now + threshold &&
                        !cert.isRevoked
            }

            expiring.forEach { cert ->
                results.add(
                    ExpiringCertificationInfo(
                        pubkey = cert.pubkey,
                        certification = cert,
                        course = course,
                        daysRemaining = ((cert.expiresAt!! - now) / 86400).toInt()
                    )
                )
            }
        }

        return results.sortedBy { it.daysRemaining }
    }

    /**
     * Sends certification expiry reminders.
     *
     * @param pubkeys List of public keys to notify
     * @param courseId The course ID
     * @param message Reminder message
     */
    suspend fun sendCertificationReminders(
        pubkeys: List<String>,
        courseId: String,
        message: String
    ) {
        Log.i(TAG, "Sending certification reminders to ${pubkeys.size} contacts for course $courseId")

        // In a real implementation, this would:
        // 1. Send push notifications
        // 2. Send in-app messages
        // 3. Optionally send emails if configured
    }

    /**
     * Syncs certification data to CRM.
     * Called when certifications are earned or revoked.
     *
     * @param certification The certification to sync
     */
    suspend fun syncCertificationToCRM(certification: Certification) {
        val course = trainingRepository.getCourse(certification.courseId).first()

        Log.i(TAG, "Syncing certification ${certification.id} (${course?.title}) to CRM for ${certification.pubkey}")

        // In a real implementation, this would:
        // 1. Find the CRM contact by pubkey
        // 2. Update certification-related custom fields
        // 3. Create activity record for the certification

        // Fields to update:
        // - Last certification date
        // - Certification expiry date
        // - Course name
        // - Verification code
        // - Certification status
    }

    /**
     * Checks if CRM module is available.
     */
    fun isCRMModuleAvailable(): Boolean {
        // In a real implementation, would check if CRM module is enabled
        return true // Placeholder
    }
}

/**
 * Result of checking training requirements.
 */
data class TrainingRequirementsResult(
    val met: Boolean,
    val requirements: List<TrainingRequirement>
)

/**
 * Information about an expiring certification.
 */
data class ExpiringCertificationInfo(
    val pubkey: String,
    val certification: Certification,
    val course: Course,
    val daysRemaining: Int
)
