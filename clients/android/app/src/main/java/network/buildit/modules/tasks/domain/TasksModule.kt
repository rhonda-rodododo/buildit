package network.buildit.modules.tasks.domain

import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import javax.inject.Inject

/**
 * BuildIt module definition for Tasks.
 *
 * Implements the BuildItModule interface for task management functionality.
 */
class TasksBuildItModule @Inject constructor(
    private val tasksUseCase: TasksUseCase
) : BuildItModule {
    override val identifier: String = "tasks"
    override val version: String = "1.0.0"
    override val displayName: String = "Tasks"
    override val description: String = "Task management with assignments, due dates, and priorities"
    override val dependencies: List<String> = emptyList()

    override suspend fun initialize() {
        // No special initialization needed
    }

    override suspend fun shutdown() {
        // No cleanup needed
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            TasksUseCase.KIND_TASK -> {
                // Handle incoming task from Nostr
                true
            }
            NostrClient.KIND_DELETE -> {
                val taskIds = event.tags.filter { it.firstOrNull() == "e" }
                    .mapNotNull { it.getOrNull(1) }
                taskIds.forEach { tasksUseCase.deleteTask(it) }
                taskIds.isNotEmpty()
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> = emptyList()

    override fun getHandledEventKinds(): List<Int> = listOf(
        TasksUseCase.KIND_TASK,
        NostrClient.KIND_DELETE
    )
}
