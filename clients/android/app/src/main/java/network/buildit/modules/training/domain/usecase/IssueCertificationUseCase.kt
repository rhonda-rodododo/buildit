package network.buildit.modules.training.domain.usecase

import kotlinx.coroutines.flow.first
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.generated.schemas.training.ProgressStatus
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.repository.TrainingRepository
import java.security.SecureRandom
import java.util.UUID
import javax.inject.Inject

/**
 * Use case for issuing certifications upon course completion.
 */
class IssueCertificationUseCase @Inject constructor(
    private val repository: TrainingRepository,
    private val cryptoManager: CryptoManager
) {
    private val secureRandom = SecureRandom()

    /**
     * Issues a certification for a completed course.
     */
    suspend operator fun invoke(courseId: String): ModuleResult<Certification> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val now = System.currentTimeMillis() / 1000

            // Get the course
            val course = repository.getCourse(courseId).first()
                ?: throw IllegalArgumentException("Course not found")

            if (!course.certificationEnabled) {
                throw IllegalStateException("Certifications are not enabled for this course")
            }

            // Check if user already has a valid certification
            val existingCerts = repository.getCertifications(pubkey).first()
            val existingValid = existingCerts.find { it.courseId == courseId && it.isValid }
            if (existingValid != null) {
                throw IllegalStateException("User already has a valid certification for this course")
            }

            // Verify course completion
            val progress = repository.getCourseProgress(courseId, pubkey).first()
                ?: throw IllegalStateException("No course progress found")

            if (progress.completedAt == null) {
                throw IllegalStateException("Course has not been completed")
            }

            // Verify all required lessons were completed with passing scores
            val allLessons = repository.getLessonsForCourse(courseId).first()
            val allProgress = repository.getLessonProgressForCourse(courseId, pubkey).first()
            val progressMap = allProgress.associateBy { it.lessonId }

            val requiredLessons = allLessons.filter { it.requiredForCertification }
            for (lesson in requiredLessons) {
                val lessonProgress = progressMap[lesson.id]
                    ?: throw IllegalStateException("Required lesson '${lesson.title}' has not been started")

                if (lessonProgress.status != ProgressStatus.Completed) {
                    throw IllegalStateException("Required lesson '${lesson.title}' has not been completed")
                }

                if (lesson.passingScore != null) {
                    val score = lessonProgress.score ?: 0
                    if (score < lesson.passingScore) {
                        throw IllegalStateException(
                            "Required lesson '${lesson.title}' score ($score) is below passing score (${lesson.passingScore})"
                        )
                    }
                }
            }

            // Generate verification code
            val verificationCode = generateVerificationCode()

            // Calculate expiry date if applicable
            val expiresAt = course.certificationExpiryDays?.let { days ->
                now + (days * 86400L)
            }

            // Create certification
            val certification = Certification(
                id = UUID.randomUUID().toString(),
                courseId = courseId,
                pubkey = pubkey,
                earnedAt = now,
                expiresAt = expiresAt,
                verificationCode = verificationCode,
                metadata = mapOf(
                    "courseTitle" to course.title,
                    "courseCategory" to course.category.value,
                    "courseDifficulty" to course.difficulty.value,
                    "completionTime" to (now - progress.startedAt).toString()
                ),
                revokedAt = null,
                revokedBy = null,
                revokeReason = null
            )

            repository.issueCertification(certification)

            certification
        }.toModuleResult()
    }

    /**
     * Revokes a certification.
     */
    suspend fun revoke(
        certificationId: String,
        reason: String
    ): ModuleResult<Unit> {
        return runCatching {
            val revokedBy = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            repository.revokeCertification(certificationId, revokedBy, reason)
        }.toModuleResult()
    }

    /**
     * Re-issues a certification (for expired ones).
     */
    suspend fun reissue(certificationId: String): ModuleResult<Certification> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val existingCert = repository.getCertification(certificationId).first()
                ?: throw IllegalArgumentException("Certification not found")

            if (existingCert.pubkey != pubkey) {
                throw IllegalStateException("Cannot re-issue certification for another user")
            }

            if (!existingCert.isExpired) {
                throw IllegalStateException("Certification has not expired")
            }

            if (existingCert.isRevoked) {
                throw IllegalStateException("Cannot re-issue a revoked certification")
            }

            // Issue a new certification
            invoke(existingCert.courseId)
        }.fold(
            onSuccess = { it },
            onFailure = { ModuleResult.Error(it.message ?: "Failed to re-issue certification") }
        )
    }

    /**
     * Generates a unique verification code.
     */
    private fun generateVerificationCode(): String {
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        val code = StringBuilder()

        // Format: XXXX-XXXX-XXXX (12 characters in 3 groups)
        repeat(3) { group ->
            if (group > 0) code.append("-")
            repeat(4) {
                code.append(chars[secureRandom.nextInt(chars.length)])
            }
        }

        return code.toString()
    }
}
