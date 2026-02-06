package network.buildit.modules.polls

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
import network.buildit.modules.polls.data.PollRepository
import network.buildit.modules.polls.data.local.PollDao
import network.buildit.modules.polls.data.local.PollVoteDao
import network.buildit.modules.polls.domain.PollsUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * BuildIt module definition for Polls.
 */
class PollsBuildItModule @Inject constructor(
    private val pollsUseCase: PollsUseCase
) : BuildItModule {
    override val identifier: String = "polls"
    override val version: String = "1.0.0"
    override val displayName: String = "Polls"
    override val description: String = "Create polls and surveys with multiple voting types"
    override val dependencies: List<String> = emptyList()

    override suspend fun initialize() {
        // No special initialization needed
    }

    override suspend fun shutdown() {
        // No cleanup needed
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            PollsUseCase.KIND_POLL -> true
            PollsUseCase.KIND_POLL_VOTE -> true
            NostrClient.KIND_DELETE -> {
                val pollIds = event.tags.filter { it.firstOrNull() == "e" }
                    .mapNotNull { it.getOrNull(1) }
                pollIds.forEach { pollsUseCase.deletePoll(it) }
                pollIds.isNotEmpty()
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> = emptyList()

    override fun getHandledEventKinds(): List<Int> = listOf(
        PollsUseCase.KIND_POLL,
        PollsUseCase.KIND_POLL_VOTE,
        NostrClient.KIND_DELETE
    )
}

/**
 * Hilt module for Polls dependency injection.
 */
@Module
@InstallIn(SingletonComponent::class)
object PollsHiltModule {

    @Provides
    fun providePollDao(database: BuildItDatabase): PollDao {
        return database.pollDao()
    }

    @Provides
    fun providePollVoteDao(database: BuildItDatabase): PollVoteDao {
        return database.pollVoteDao()
    }

    @Provides
    @Singleton
    fun providePollRepository(pollDao: PollDao, voteDao: PollVoteDao): PollRepository {
        return PollRepository(pollDao, voteDao)
    }

    @Provides
    @Singleton
    fun providePollsUseCase(
        repository: PollRepository,
        cryptoManager: CryptoManager,
        nostrClient: NostrClient
    ): PollsUseCase {
        return PollsUseCase(repository, cryptoManager, nostrClient)
    }

    @Provides
    @Singleton
    fun providePollsBuildItModule(
        pollsUseCase: PollsUseCase
    ): PollsBuildItModule {
        return PollsBuildItModule(pollsUseCase)
    }
}

/**
 * Binds PollsBuildItModule into the BuildItModule set.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class PollsBindingModule {
    @Binds
    @IntoSet
    abstract fun bindPollsModule(impl: PollsBuildItModule): BuildItModule
}
