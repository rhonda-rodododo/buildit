package network.buildit.modules.files.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for files and folders.
 */
@Dao
interface FileDao {
    @Query("SELECT * FROM files WHERE groupId = :groupId AND parentFolderId IS NULL AND deletedAt IS NULL ORDER BY entryType DESC, name ASC")
    fun getRootFiles(groupId: String): Flow<List<FileEntity>>

    @Query("SELECT * FROM files WHERE groupId = :groupId AND parentFolderId = :folderId AND deletedAt IS NULL ORDER BY entryType DESC, name ASC")
    fun getFilesInFolder(groupId: String, folderId: String): Flow<List<FileEntity>>

    @Query("SELECT * FROM files WHERE id = :id")
    suspend fun getFile(id: String): FileEntity?

    @Query("SELECT * FROM files WHERE id = :id")
    fun observeFile(id: String): Flow<FileEntity?>

    @Query("SELECT * FROM files WHERE groupId = :groupId AND entryType = 'FOLDER' AND deletedAt IS NULL ORDER BY name ASC")
    fun getFolders(groupId: String): Flow<List<FileEntity>>

    @Query("SELECT * FROM files WHERE groupId = :groupId AND (name LIKE '%' || :query || '%' OR description LIKE '%' || :query || '%') AND deletedAt IS NULL ORDER BY name ASC")
    fun searchFiles(groupId: String, query: String): Flow<List<FileEntity>>

    @Query("SELECT * FROM files WHERE groupId = :groupId AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT :limit")
    fun getRecentFiles(groupId: String, limit: Int = 20): Flow<List<FileEntity>>

    @Query("SELECT * FROM files WHERE createdBy = :pubkey AND deletedAt IS NULL ORDER BY createdAt DESC")
    fun getFilesByCreator(pubkey: String): Flow<List<FileEntity>>

    @Query("SELECT COUNT(*) FROM files WHERE groupId = :groupId AND entryType = 'FILE' AND deletedAt IS NULL")
    suspend fun getFileCount(groupId: String): Int

    @Query("SELECT COALESCE(SUM(fileSize), 0) FROM files WHERE groupId = :groupId AND entryType = 'FILE' AND deletedAt IS NULL")
    suspend fun getTotalSize(groupId: String): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFile(file: FileEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFiles(files: List<FileEntity>)

    @Update
    suspend fun updateFile(file: FileEntity)

    @Query("DELETE FROM files WHERE id = :id")
    suspend fun deleteFile(id: String)

    @Query("UPDATE files SET deletedAt = :deletedAt WHERE id = :id")
    suspend fun softDeleteFile(id: String, deletedAt: Long = System.currentTimeMillis() / 1000)

    @Query("UPDATE files SET parentFolderId = :newFolderId, updatedAt = :updatedAt WHERE id = :id")
    suspend fun moveFile(id: String, newFolderId: String?, updatedAt: Long = System.currentTimeMillis() / 1000)
}
