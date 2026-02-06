package network.buildit.modules.files

import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.storage.BuildItDatabase
import network.buildit.modules.files.data.FileRepository
import network.buildit.modules.files.data.local.FileDao
import network.buildit.modules.files.domain.FilesUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * BuildIt module definition for Files.
 */
class FilesBuildItModule @Inject constructor(
    private val filesUseCase: FilesUseCase
) : BuildItModule {
    override val identifier: String = "files"
    override val version: String = "1.0.0"
    override val displayName: String = "Files"
    override val description: String = "Shared file storage with encryption and folder organization"
    override val dependencies: List<String> = emptyList()

    override suspend fun initialize() {
        // No special initialization needed
    }

    override suspend fun shutdown() {
        // No cleanup needed
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            FilesUseCase.KIND_FILE -> {
                // Handle incoming file metadata from Nostr
                true
            }
            NostrClient.KIND_DELETE -> {
                val fileIds = event.tags.filter { it.firstOrNull() == "e" }
                    .mapNotNull { it.getOrNull(1) }
                fileIds.forEach { filesUseCase.deleteFile(it) }
                fileIds.isNotEmpty()
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> = emptyList()

    override fun getHandledEventKinds(): List<Int> = listOf(
        FilesUseCase.KIND_FILE,
        NostrClient.KIND_DELETE
    )
}

/**
 * Hilt module for Files dependency injection.
 */
@Module
@InstallIn(SingletonComponent::class)
object FilesHiltModule {

    @Provides
    fun provideFileDao(database: BuildItDatabase): FileDao {
        return database.fileDao()
    }

    @Provides
    @Singleton
    fun provideFileRepository(fileDao: FileDao): FileRepository {
        return FileRepository(fileDao)
    }

    @Provides
    @Singleton
    fun provideFilesUseCase(
        repository: FileRepository,
        cryptoManager: CryptoManager,
        nostrClient: NostrClient
    ): FilesUseCase {
        return FilesUseCase(repository, cryptoManager, nostrClient)
    }

    @Provides
    @Singleton
    fun provideFilesBuildItModule(
        filesUseCase: FilesUseCase
    ): FilesBuildItModule {
        return FilesBuildItModule(filesUseCase)
    }
}

/**
 * Binds FilesBuildItModule into the BuildItModule set.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class FilesBindingModule {
    @Binds
    @IntoSet
    abstract fun bindFilesModule(impl: FilesBuildItModule): BuildItModule
}
