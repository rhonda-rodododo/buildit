package network.buildit.modules.tasks.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for tasks.
 */
@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks WHERE groupId = :groupId ORDER BY sortOrder ASC, createdAt DESC")
    fun getTasksByGroup(groupId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE groupId = :groupId AND status = :status ORDER BY sortOrder ASC, createdAt DESC")
    fun getTasksByGroupAndStatus(groupId: String, status: TaskStatus): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE assigneePubkey = :pubkey AND status != 'DONE' AND status != 'CANCELLED' ORDER BY dueDate ASC")
    fun getTasksAssignedTo(pubkey: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE createdBy = :pubkey ORDER BY createdAt DESC")
    fun getTasksCreatedBy(pubkey: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE id = :id")
    suspend fun getTask(id: String): TaskEntity?

    @Query("SELECT * FROM tasks WHERE id = :id")
    fun observeTask(id: String): Flow<TaskEntity?>

    @Query("SELECT * FROM tasks WHERE groupId = :groupId AND dueDate IS NOT NULL AND dueDate <= :deadline AND status != 'DONE' AND status != 'CANCELLED' ORDER BY dueDate ASC")
    fun getOverdueTasks(groupId: String, deadline: Long): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE parentTaskId = :parentId ORDER BY sortOrder ASC")
    fun getSubtasks(parentId: String): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE groupId = :groupId AND (title LIKE '%' || :query || '%' OR description LIKE '%' || :query || '%') ORDER BY createdAt DESC")
    fun searchTasks(groupId: String, query: String): Flow<List<TaskEntity>>

    @Query("SELECT COUNT(*) FROM tasks WHERE groupId = :groupId AND status = :status")
    suspend fun getTaskCountByStatus(groupId: String, status: TaskStatus): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTask(task: TaskEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTasks(tasks: List<TaskEntity>)

    @Update
    suspend fun updateTask(task: TaskEntity)

    @Delete
    suspend fun deleteTask(task: TaskEntity)

    @Query("DELETE FROM tasks WHERE id = :id")
    suspend fun deleteTaskById(id: String)

    @Query("UPDATE tasks SET status = :status, updatedAt = :updatedAt, completedAt = :completedAt WHERE id = :id")
    suspend fun updateTaskStatus(
        id: String,
        status: TaskStatus,
        updatedAt: Long = System.currentTimeMillis() / 1000,
        completedAt: Long? = null
    )

    @Query("UPDATE tasks SET assigneePubkey = :assignee, updatedAt = :updatedAt WHERE id = :id")
    suspend fun assignTask(id: String, assignee: String?, updatedAt: Long = System.currentTimeMillis() / 1000)
}
