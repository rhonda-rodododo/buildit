package network.buildit.modules.files.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.modules.files.data.FileRepository
import network.buildit.modules.files.data.local.FileEntity
import network.buildit.modules.files.data.local.FileEntryType
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for files module operations.
 *
 * Handles:
 * - File and folder management
 * - File upload with NIP-44 encryption
 * - Sharing and permissions
 * - Nostr event publishing for sync
 */
@Singleton
class FilesUseCase @Inject constructor(
    private val repository: FileRepository,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) {
    /**
     * Creates a new folder.
     */
    suspend fun createFolder(
        groupId: String,
        name: String,
        parentFolderId: String? = null,
        description: String? = null
    ): ModuleResult<FileEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val folder = FileEntity(
                id = UUID.randomUUID().toString(),
                groupId = groupId,
                name = name,
                entryType = FileEntryType.FOLDER,
                parentFolderId = parentFolderId,
                mimeType = null,
                fileSize = null,
                encryptedUrl = null,
                localPath = null,
                thumbnailUrl = null,
                blurhash = null,
                description = description,
                permissionsJson = null,
                createdBy = pubkey
            )

            repository.saveFile(folder)
            publishFileMetadataToNostr(folder)
            folder
        }.toModuleResult()
    }

    /**
     * Records a file upload (after encryption and upload to storage).
     */
    suspend fun saveFileRecord(
        groupId: String,
        name: String,
        mimeType: String,
        fileSize: Long,
        encryptedUrl: String,
        localPath: String? = null,
        thumbnailUrl: String? = null,
        parentFolderId: String? = null,
        description: String? = null
    ): ModuleResult<FileEntity> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val file = FileEntity(
                id = UUID.randomUUID().toString(),
                groupId = groupId,
                name = name,
                entryType = FileEntryType.FILE,
                parentFolderId = parentFolderId,
                mimeType = mimeType,
                fileSize = fileSize,
                encryptedUrl = encryptedUrl,
                localPath = localPath,
                thumbnailUrl = thumbnailUrl,
                blurhash = null,
                description = description,
                permissionsJson = null,
                createdBy = pubkey
            )

            repository.saveFile(file)
            publishFileMetadataToNostr(file)
            file
        }.toModuleResult()
    }

    /**
     * Deletes a file or folder.
     */
    suspend fun deleteFile(fileId: String): ModuleResult<Unit> {
        return runCatching {
            repository.deleteFile(fileId)
            publishFileDeletion(fileId)
        }.toModuleResult()
    }

    /**
     * Moves a file to a different folder.
     */
    suspend fun moveFile(fileId: String, newFolderId: String?): ModuleResult<Unit> {
        return runCatching {
            repository.moveFile(fileId, newFolderId)
            val file = repository.getFile(fileId)
            if (file != null) {
                publishFileMetadataToNostr(file)
            }
        }.toModuleResult()
    }

    /**
     * Renames a file or folder.
     */
    suspend fun renameFile(fileId: String, newName: String): ModuleResult<FileEntity> {
        return runCatching {
            val file = repository.getFile(fileId)
                ?: throw IllegalStateException("File not found")

            val updated = file.copy(
                name = newName,
                updatedAt = System.currentTimeMillis() / 1000
            )
            repository.updateFile(updated)
            publishFileMetadataToNostr(updated)
            updated
        }.toModuleResult()
    }

    fun getRootFiles(groupId: String): Flow<List<FileEntity>> {
        return repository.getRootFiles(groupId)
    }

    fun getFilesInFolder(groupId: String, folderId: String): Flow<List<FileEntity>> {
        return repository.getFilesInFolder(groupId, folderId)
    }

    suspend fun getFile(id: String): FileEntity? {
        return repository.getFile(id)
    }

    fun observeFile(id: String): Flow<FileEntity?> {
        return repository.observeFile(id)
    }

    fun getFolders(groupId: String): Flow<List<FileEntity>> {
        return repository.getFolders(groupId)
    }

    fun searchFiles(groupId: String, query: String): Flow<List<FileEntity>> {
        return repository.searchFiles(groupId, query)
    }

    fun getRecentFiles(groupId: String): Flow<List<FileEntity>> {
        return repository.getRecentFiles(groupId)
    }

    suspend fun getFileCount(groupId: String): Int {
        return repository.getFileCount(groupId)
    }

    suspend fun getTotalSize(groupId: String): Long {
        return repository.getTotalSize(groupId)
    }

    private suspend fun publishFileMetadataToNostr(file: FileEntity) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(
            mapOf(
                "_v" to file.schemaVersion,
                "id" to file.id,
                "name" to file.name,
                "type" to file.entryType.name.lowercase(),
                "mimeType" to (file.mimeType ?: ""),
                "fileSize" to (file.fileSize?.toString() ?: ""),
                "parentFolderId" to (file.parentFolderId ?: "")
            )
        )

        val tags = mutableListOf<List<String>>()
        tags.add(listOf("g", file.groupId))
        tags.add(listOf("d", file.id))

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = KIND_FILE,
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

    private suspend fun publishFileDeletion(fileId: String) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val deleteEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = System.currentTimeMillis() / 1000,
            kind = NostrClient.KIND_DELETE,
            tags = listOf(listOf("e", fileId)),
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
        const val KIND_FILE = 31926 // Parameterized replaceable event for files
    }
}
