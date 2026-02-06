package network.buildit.modules.tasks.data

import kotlinx.coroutines.flow.Flow
import network.buildit.modules.tasks.data.local.TaskDao
import network.buildit.modules.tasks.data.local.TaskEntity
import network.buildit.modules.tasks.data.local.TaskPriority
import network.buildit.modules.tasks.data.local.TaskStatus
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for task data.
 *
 * Provides a clean API for accessing tasks from local storage.
 */
@Singleton
class TaskRepository @Inject constructor(
    private val taskDao: TaskDao
) {
    fun getTasksByGroup(groupId: String): Flow<List<TaskEntity>> {
        return taskDao.getTasksByGroup(groupId)
    }

    fun getTasksByGroupAndStatus(groupId: String, status: TaskStatus): Flow<List<TaskEntity>> {
        return taskDao.getTasksByGroupAndStatus(groupId, status)
    }

    fun getTasksAssignedTo(pubkey: String): Flow<List<TaskEntity>> {
        return taskDao.getTasksAssignedTo(pubkey)
    }

    fun getTasksCreatedBy(pubkey: String): Flow<List<TaskEntity>> {
        return taskDao.getTasksCreatedBy(pubkey)
    }

    suspend fun getTask(id: String): TaskEntity? {
        return taskDao.getTask(id)
    }

    fun observeTask(id: String): Flow<TaskEntity?> {
        return taskDao.observeTask(id)
    }

    fun getOverdueTasks(groupId: String): Flow<List<TaskEntity>> {
        val now = System.currentTimeMillis() / 1000
        return taskDao.getOverdueTasks(groupId, now)
    }

    fun getSubtasks(parentId: String): Flow<List<TaskEntity>> {
        return taskDao.getSubtasks(parentId)
    }

    fun searchTasks(groupId: String, query: String): Flow<List<TaskEntity>> {
        return taskDao.searchTasks(groupId, query)
    }

    suspend fun getTaskCountByStatus(groupId: String, status: TaskStatus): Int {
        return taskDao.getTaskCountByStatus(groupId, status)
    }

    suspend fun saveTask(task: TaskEntity) {
        taskDao.insertTask(task)
    }

    suspend fun updateTask(task: TaskEntity) {
        taskDao.updateTask(task)
    }

    suspend fun deleteTask(taskId: String) {
        taskDao.deleteTaskById(taskId)
    }

    suspend fun updateTaskStatus(taskId: String, status: TaskStatus) {
        val completedAt = if (status == TaskStatus.DONE) System.currentTimeMillis() / 1000 else null
        taskDao.updateTaskStatus(taskId, status, completedAt = completedAt)
    }

    suspend fun assignTask(taskId: String, assigneePubkey: String?) {
        taskDao.assignTask(taskId, assigneePubkey)
    }
}
