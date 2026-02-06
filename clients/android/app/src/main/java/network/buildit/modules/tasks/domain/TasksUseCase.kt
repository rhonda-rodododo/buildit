package network.buildit.modules.tasks.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.modules.tasks.data.TaskRepository
import network.buildit.modules.tasks.data.local.TaskEntity
import network.buildit.modules.tasks.data.local.TaskPriority
import network.buildit.modules.tasks.data.local.TaskStatus
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for tasks module operations.
 *
 * Handles:
 * - Creating, updating, and deleting tasks
 * - Task assignment
 * - Status transitions
 * - Nostr event publishing for sync
 */
@Singleton
class TasksUseCase @Inject constructor(
    private val repository: TaskRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    /**
     * Creates a new task.
     */
    suspend fun createTask(
        groupId: String,
        title: String,
        description: String? = null,
        assigneePubkey: String? = null,
        dueDate: Long? = null,
        priority: TaskPriority = TaskPriority.Medium,
        parentTaskId: String? = null
    ): ModuleResult<TaskEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val task = TaskEntity(
                id = UUID.randomUUID().toString(),
                groupId = groupId,
                title = title,
                description = description,
                status = TaskStatus.Todo,
                priority = priority,
                assigneePubkey = assigneePubkey,
                createdBy = pubkey,
                dueDate = dueDate,
                completedAt = null,
                checklistJson = null,
                parentTaskId = parentTaskId
            )

            repository.saveTask(task)
            publishTaskToNostr(task)
            task
        }.toModuleResult()
    }

    /**
     * Updates an existing task.
     */
    suspend fun updateTask(task: TaskEntity): ModuleResult<TaskEntity> {
        return runCatching {
            val updated = task.copy(updatedAt = System.currentTimeMillis() / 1000)
            repository.updateTask(updated)
            publishTaskToNostr(updated)
            updated
        }.toModuleResult()
    }

    /**
     * Deletes a task.
     */
    suspend fun deleteTask(taskId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteTask(taskId)
            publishTaskDeletion(taskId)
        }.toModuleResult()
    }

    /**
     * Updates task status.
     */
    suspend fun updateStatus(taskId: String, status: TaskStatus): ModuleResult<Unit> {
        return runCatching {
            repository.updateTaskStatus(taskId, status)
            val task = repository.getTask(taskId)
            if (task != null) {
                publishTaskToNostr(task)
            }
        }.toModuleResult()
    }

    /**
     * Assigns a task to a user.
     */
    suspend fun assignTask(taskId: String, assigneePubkey: String?): ModuleResult<Unit> {
        return runCatching {
            repository.assignTask(taskId, assigneePubkey)
            val task = repository.getTask(taskId)
            if (task != null) {
                publishTaskToNostr(task)
            }
        }.toModuleResult()
    }

    /**
     * Gets all tasks for a group.
     */
    fun getTasks(groupId: String): Flow<List<TaskEntity>> {
        return repository.getTasksByGroup(groupId)
    }

    /**
     * Gets tasks filtered by status.
     */
    fun getTasksByStatus(groupId: String, status: TaskStatus): Flow<List<TaskEntity>> {
        return repository.getTasksByGroupAndStatus(groupId, status)
    }

    /**
     * Gets tasks assigned to the current user.
     */
    fun getMyTasks(): Flow<List<TaskEntity>> {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return kotlinx.coroutines.flow.flowOf(emptyList())
        return repository.getTasksAssignedTo(pubkey)
    }

    /**
     * Gets a specific task.
     */
    suspend fun getTask(id: String): TaskEntity? {
        return repository.getTask(id)
    }

    /**
     * Observes a specific task.
     */
    fun observeTask(id: String): Flow<TaskEntity?> {
        return repository.observeTask(id)
    }

    /**
     * Gets overdue tasks for a group.
     */
    fun getOverdueTasks(groupId: String): Flow<List<TaskEntity>> {
        return repository.getOverdueTasks(groupId)
    }

    /**
     * Gets subtasks of a parent task.
     */
    fun getSubtasks(parentId: String): Flow<List<TaskEntity>> {
        return repository.getSubtasks(parentId)
    }

    /**
     * Searches tasks.
     */
    fun searchTasks(groupId: String, query: String): Flow<List<TaskEntity>> {
        return repository.searchTasks(groupId, query)
    }

    /**
     * Gets task count by status.
     */
    suspend fun getTaskCountByStatus(groupId: String, status: TaskStatus): Int {
        return repository.getTaskCountByStatus(groupId, status)
    }

    /**
     * Publishes a task to Nostr relays.
     */
    private suspend fun publishTaskToNostr(task: TaskEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to task.schemaVersion,
                "id" to task.id,
                "title" to task.title,
                "description" to (task.description ?: ""),
                "status" to task.status.value,
                "priority" to task.priority.value,
                "assignee" to (task.assigneePubkey ?: ""),
                "dueDate" to (task.dueDate?.toString() ?: ""),
                "parentTaskId" to (task.parentTaskId ?: "")
            )
        )

        val tags = mutableListOf<List<String>>()
        tags.add(listOf("g", task.groupId))
        tags.add(listOf("d", task.id))
        task.assigneePubkey?.let { tags.add(listOf("p", it)) }

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_TASK,
            tags = tags,
            content = content
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return
        nostrClient.publishEvent(
            NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    /**
     * Publishes task deletion to Nostr.
     */
    private suspend fun publishTaskDeletion(taskId: String) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val deleteEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = NostrClient.KIND_DELETE,
            tags = listOf(listOf("e", taskId)),
            content = ""
        )

        val signed = cryptoManager.signEvent(deleteEvent) ?: return
        nostrClient.publishEvent(
            NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }

    companion object {
        const val KIND_TASK = 31925 // Parameterized replaceable event for tasks
    }
}
