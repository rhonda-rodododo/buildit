package network.buildit.modules.files.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Type of file entry.
 */
enum class FileEntryType {
    FILE,
    FOLDER
}

/**
 * Permission level for a shared file.
 */
enum class FilePermission {
    VIEW,
    EDIT,
    ADMIN
}

/**
 * Room entity for files and folders.
 */
@Entity(
    tableName = "files",
    indices = [
        Index("groupId"),
        Index("parentFolderId"),
        Index("createdBy"),
        Index("entryType"),
        Index(value = ["groupId", "parentFolderId", "name"], unique = true)
    ]
)
data class FileEntity(
    @PrimaryKey
    val id: String,
    val schemaVersion: String = "1.0.0",
    val groupId: String,
    val name: String,
    val entryType: FileEntryType = FileEntryType.FILE,
    val parentFolderId: String?,
    val mimeType: String?,
    val fileSize: Long?,
    val encryptedUrl: String?,
    val localPath: String?,
    val thumbnailUrl: String?,
    val blurhash: String?,
    val description: String?,
    val tagsJson: String = "[]",
    val permissionsJson: String?,
    val createdBy: String,
    val createdAt: Long = System.currentTimeMillis() / 1000,
    val updatedAt: Long? = null,
    val deletedAt: Long? = null
) {
    val isFolder: Boolean get() = entryType == FileEntryType.FOLDER
    val isDeleted: Boolean get() = deletedAt != null

    val extension: String? get() = if (!isFolder) {
        name.substringAfterLast('.', "").ifEmpty { null }
    } else null

    val formattedSize: String get() {
        val size = fileSize ?: return ""
        return when {
            size < 1024 -> "$size B"
            size < 1024 * 1024 -> "${size / 1024} KB"
            size < 1024 * 1024 * 1024 -> "${size / (1024 * 1024)} MB"
            else -> "${size / (1024 * 1024 * 1024)} GB"
        }
    }
}
