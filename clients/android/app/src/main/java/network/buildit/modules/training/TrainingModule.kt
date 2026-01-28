package network.buildit.modules.training

import android.util.Log
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.School
import kotlinx.serialization.json.Json
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import network.buildit.modules.training.domain.repository.TrainingRepository
import network.buildit.modules.training.domain.usecase.*
import network.buildit.modules.training.integration.*
import network.buildit.modules.training.presentation.ui.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Training module for BuildIt.
 *
 * Provides comprehensive training and certification functionality:
 * - Course management with modules and lessons
 * - Multiple lesson types (video, document, quiz, assignment, live session, interactive)
 * - Progress tracking across lessons and courses
 * - Quiz system with scoring and retakes
 * - Assignment submission and review
 * - Certification issuance upon course completion
 * - Live training sessions via calling integration
 * - CRM integration for contact training status
 * - Events integration for session scheduling
 */
@Singleton
class TrainingModuleImpl @Inject constructor(
    private val repository: TrainingRepository,
    private val nostrClient: NostrClient,
    private val callingIntegration: TrainingCallingIntegration,
    private val crmIntegration: TrainingCRMIntegration,
    private val eventsIntegration: TrainingEventsIntegration
) : BuildItModule {

    override val identifier: String = "training"
    override val version: String = "1.0.0"
    override val displayName: String = "Training"
    override val description: String = "Training courses with certifications for skill development"
    override val dependencies: List<String> = listOf("calling", "events") // Optional dependencies

    private var subscriptionId: String? = null
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun initialize() {
        Log.i(TAG, "Initializing Training module")

        // Subscribe to training-related Nostr events
        subscriptionId = nostrClient.subscribe(
            NostrFilter(
                kinds = getHandledEventKinds(),
                since = System.currentTimeMillis() / 1000 - 86400 * 30 // Last 30 days
            )
        )

        Log.i(TAG, "Training module initialized")
    }

    override suspend fun shutdown() {
        Log.i(TAG, "Shutting down Training module")
        subscriptionId?.let { nostrClient.unsubscribe(it) }
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            KIND_COURSE -> {
                handleCourseEvent(event)
                true
            }
            KIND_MODULE -> {
                handleModuleEvent(event)
                true
            }
            KIND_LESSON -> {
                handleLessonEvent(event)
                true
            }
            KIND_PROGRESS -> {
                handleProgressEvent(event)
                true
            }
            KIND_CERTIFICATION -> {
                handleCertificationEvent(event)
                true
            }
            NostrClient.KIND_DELETE -> {
                handleDeleteEvent(event)
                true
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "training",
                title = "Training",
                icon = Icons.Default.School,
                showInNavigation = true,
                content = { args ->
                    CourseListScreen(
                        onCourseClick = { courseId ->
                            // Navigate to course detail
                        },
                        onCertificationsClick = {
                            // Navigate to certifications
                        }
                    )
                }
            ),
            ModuleRoute(
                route = "training/course/{courseId}",
                title = "Course",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val courseId = args["courseId"] ?: return@ModuleRoute
                    CourseDetailScreen(
                        courseId = courseId,
                        onNavigateBack = { },
                        onLessonClick = { lessonId ->
                            // Navigate to lesson player
                        }
                    )
                }
            ),
            ModuleRoute(
                route = "training/lesson/{lessonId}",
                title = "Lesson",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val lessonId = args["lessonId"] ?: return@ModuleRoute
                    LessonPlayerScreen(
                        lessonId = lessonId,
                        onNavigateBack = { },
                        onLessonComplete = { }
                    )
                }
            ),
            ModuleRoute(
                route = "training/certifications",
                title = "Certifications",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    // CertificationsScreen()
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            KIND_COURSE,
            KIND_MODULE,
            KIND_LESSON,
            KIND_PROGRESS,
            KIND_CERTIFICATION,
            NostrClient.KIND_DELETE
        )
    }

    // ============================================================================
    // Event Handlers
    // ============================================================================

    private suspend fun handleCourseEvent(event: NostrEvent) {
        try {
            Log.d(TAG, "Received course event: ${event.id}")
            // Parse and save course from Nostr event
            // In a real implementation, would deserialize from event.content
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle course event", e)
        }
    }

    private suspend fun handleModuleEvent(event: NostrEvent) {
        try {
            Log.d(TAG, "Received module event: ${event.id}")
            // Parse and save module from Nostr event
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle module event", e)
        }
    }

    private suspend fun handleLessonEvent(event: NostrEvent) {
        try {
            Log.d(TAG, "Received lesson event: ${event.id}")
            // Parse and save lesson from Nostr event
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle lesson event", e)
        }
    }

    private suspend fun handleProgressEvent(event: NostrEvent) {
        try {
            Log.d(TAG, "Received progress event: ${event.id}")
            // Parse and save progress from Nostr event
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle progress event", e)
        }
    }

    private suspend fun handleCertificationEvent(event: NostrEvent) {
        try {
            Log.d(TAG, "Received certification event: ${event.id}")
            // Parse and save certification from Nostr event
            // Also sync to CRM
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle certification event", e)
        }
    }

    private suspend fun handleDeleteEvent(event: NostrEvent) {
        try {
            val deletedIds = event.tags
                .filter { it.firstOrNull() == "e" }
                .mapNotNull { it.getOrNull(1) }

            Log.d(TAG, "Received delete event for: $deletedIds")
            // Handle deletions based on referenced event types
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle delete event", e)
        }
    }

    companion object {
        private const val TAG = "TrainingModule"

        // Nostr event kinds for training (31950-31999 reserved range)
        const val KIND_COURSE = 31950
        const val KIND_MODULE = 31951
        const val KIND_LESSON = 31952
        const val KIND_PROGRESS = 31953
        const val KIND_CERTIFICATION = 31954
    }
}
