package network.buildit.modules.files.data

import kotlinx.coroutines.flow.Flow
import network.buildit.modules.files.data.local.FileDao
import network.buildit.modules.files.data.local.FileEntity
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for file data.
 */
@Singleton
class FileRepository @Inject constructor(
    private val fileDao: FileDao
) {
    fun getRootFiles(groupId: String): Flow<List<FileEntity>> {
        return fileDao.getRootFiles(groupId)
    }

    fun getFilesInFolder(groupId: String, folderId: String): Flow<List<FileEntity>> {
        return fileDao.getFilesInFolder(groupId, folderId)
    }

    suspend fun getFile(id: String): FileEntity? {
        return fileDao.getFile(id)
    }

    fun observeFile(id: String): Flow<FileEntity?> {
        return fileDao.observeFile(id)
    }

    fun getFolders(groupId: String): Flow<List<FileEntity>> {
        return fileDao.getFolders(groupId)
    }

    fun searchFiles(groupId: String, query: String): Flow<List<FileEntity>> {
        return fileDao.searchFiles(groupId, query)
    }

    fun getRecentFiles(groupId: String, limit: Int = 20): Flow<List<FileEntity>> {
        return fileDao.getRecentFiles(groupId, limit)
    }

    suspend fun getFileCount(groupId: String): Int {
        return fileDao.getFileCount(groupId)
    }

    suspend fun getTotalSize(groupId: String): Long {
        return fileDao.getTotalSize(groupId)
    }

    suspend fun saveFile(file: FileEntity) {
        fileDao.insertFile(file)
    }

    suspend fun updateFile(file: FileEntity) {
        fileDao.updateFile(file)
    }

    suspend fun deleteFile(fileId: String) {
        fileDao.softDeleteFile(fileId)
    }

    suspend fun moveFile(fileId: String, newFolderId: String?) {
        fileDao.moveFile(fileId, newFolderId)
    }
}
