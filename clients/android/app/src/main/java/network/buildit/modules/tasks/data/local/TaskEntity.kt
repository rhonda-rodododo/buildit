package network.buildit.modules.tasks.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import network.buildit.generated.schemas.tasks.TaskPriority as GeneratedTaskPriority
import network.buildit.generated.schemas.tasks.TaskStatus as GeneratedTaskStatus

/**
 * Re-export generated protocol types so consumers can import from data.local.
 */
typealias TaskPriority = GeneratedTaskPriority
typealias TaskStatus = GeneratedTaskStatus

/**
 * Room entity for tasks.
 */
@Entity(
    tableName = "tasks",
    indices = [
        Index("groupId"),
        Index("assigneePubkey"),
        Index("status"),
        Index("dueDate"),
        Index("createdBy")
    ]
)
data class TaskEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = "1.0.0",
    val groupId: String,
    val title: String,
    val description: String?,
    val status: TaskStatus = TaskStatus.Todo,
    val priority: TaskPriority = TaskPriority.Medium,
    val assigneePubkey: String?,
    val createdBy: String,
    val dueDate: Long?,
    val completedAt: Long?,
    val tagsJson: String = "[]",
    val checklistJson: String?,
    val parentTaskId: String?,
    val sortOrder: Int = 0,
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val updatedAt: Long? = null
)
