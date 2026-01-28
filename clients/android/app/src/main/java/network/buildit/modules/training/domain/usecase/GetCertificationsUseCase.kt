package network.buildit.modules.training.domain.usecase

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import network.buildit.core.crypto.CryptoManager
import network.buildit.modules.training.domain.model.*
import network.buildit.modules.training.domain.repository.TrainingRepository
import javax.inject.Inject

/**
 * Certification with associated course information.
 */
data class CertificationWithCourse(
    val certification: Certification,
    val course: Course?,
    val expiresInDays: Int?
)

/**
 * Use case for retrieving certifications.
 */
class GetCertificationsUseCase @Inject constructor(
    private val repository: TrainingRepository,
    private val cryptoManager: CryptoManager
) {
    /**
     * Gets all certifications for the current user.
     */
    operator fun invoke(): Flow<List<CertificationWithCourse>> {
        val pubkey = cryptoManager.getPublicKeyHex()
            ?: return flowOf(emptyList())

        return combine(
            repository.getCertifications(pubkey),
            repository.getCourses()
        ) { certifications, courses ->
            val courseMap = courses.associateBy { it.id }
            val now = System.currentTimeMillis() / 1000

            certifications.map { cert ->
                val expiresInDays = cert.expiresAt?.let { expiresAt ->
                    val secondsRemaining = expiresAt - now
                    if (secondsRemaining > 0) {
                        (secondsRemaining / 86400).toInt()
                    } else null
                }

                CertificationWithCourse(
                    certification = cert,
                    course = courseMap[cert.courseId],
                    expiresInDays = expiresInDays
                )
            }
        }
    }

    /**
     * Gets valid (non-expired, non-revoked) certifications.
     */
    fun validOnly(): Flow<List<CertificationWithCourse>> {
        return invoke().map { certs ->
            certs.filter { it.certification.isValid }
        }
    }

    /**
     * Gets certifications that are expiring soon.
     */
    fun expiringSoon(daysThreshold: Int = 30): Flow<List<CertificationWithCourse>> {
        return invoke().map { certs ->
            certs.filter { certWithCourse ->
                val expiresInDays = certWithCourse.expiresInDays
                expiresInDays != null && expiresInDays in 1..daysThreshold
            }
        }
    }

    /**
     * Gets certifications for a specific course.
     */
    fun forCourse(courseId: String): Flow<List<Certification>> {
        return repository.getCertificationsForCourse(courseId)
    }

    /**
     * Verifies a certification by its verification code.
     */
    suspend fun verify(verificationCode: String): CertificationVerification {
        val certification = repository.getCertificationByCode(verificationCode)
            ?: return CertificationVerification(
                valid = false,
                certification = null,
                course = null,
                holderName = null,
                expired = false,
                revoked = false,
                error = "Certification not found"
            )

        val course = repository.getCourse(certification.courseId)
            .let { flow ->
                var result: Course? = null
                flow.collect { result = it }
                result
            }

        return CertificationVerification(
            valid = certification.isValid,
            certification = certification,
            course = course,
            holderName = null, // Would need profile lookup
            expired = certification.isExpired,
            revoked = certification.isRevoked,
            error = when {
                certification.isRevoked -> "Certification has been revoked: ${certification.revokeReason}"
                certification.isExpired -> "Certification has expired"
                else -> null
            }
        )
    }

    /**
     * Gets certification count for a user.
     */
    suspend fun getCount(): Int {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return 0
        var count = 0
        repository.getCertifications(pubkey).collect { certifications ->
            count = certifications.count { it.isValid }
        }
        return count
    }
}
