package network.buildit.modules.wiki

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.storage.AppDatabase
import network.buildit.modules.wiki.data.WikiRepository
import network.buildit.modules.wiki.data.local.PageRevisionsDao
import network.buildit.modules.wiki.data.local.WikiCategoriesDao
import network.buildit.modules.wiki.data.local.WikiPagesDao
import network.buildit.modules.wiki.domain.WikiUseCase
import javax.inject.Singleton

/**
 * BuildIt module definition for Wiki/Knowledge Base.
 */
class WikiBuildItModule : BuildItModule {
    override val identifier: String = "wiki"
    override val displayName: String = "Knowledge Base"
    override val description: String = "Collaborative wiki and documentation for your group"
    override val version: String = "1.0.0"
    override val dependencies: List<String> = emptyList()

    override suspend fun initialize() {
        // No special initialization needed
    }

    override suspend fun shutdown() {
        // No cleanup needed
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        // Handle wiki-related Nostr events
        return when (event.kind) {
            WikiUseCase.KIND_WIKI_PAGE,
            WikiUseCase.KIND_WIKI_CATEGORY,
            WikiUseCase.KIND_PAGE_REVISION -> true
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> = emptyList()

    override fun getHandledEventKinds(): List<Int> = listOf(
        WikiUseCase.KIND_WIKI_PAGE,      // 40301
        WikiUseCase.KIND_WIKI_CATEGORY,  // 40302
        WikiUseCase.KIND_PAGE_REVISION   // 40303
    )
}

/**
 * Hilt module for Wiki dependency injection.
 */
@Module
@InstallIn(SingletonComponent::class)
object WikiHiltModule {

    @Provides
    @Singleton
    fun provideWikiPagesDao(database: AppDatabase): WikiPagesDao {
        return database.wikiPagesDao()
    }

    @Provides
    @Singleton
    fun provideWikiCategoriesDao(database: AppDatabase): WikiCategoriesDao {
        return database.wikiCategoriesDao()
    }

    @Provides
    @Singleton
    fun providePageRevisionsDao(database: AppDatabase): PageRevisionsDao {
        return database.pageRevisionsDao()
    }

    @Provides
    @Singleton
    fun provideWikiRepository(
        pagesDao: WikiPagesDao,
        categoriesDao: WikiCategoriesDao,
        revisionsDao: PageRevisionsDao
    ): WikiRepository {
        return WikiRepository(pagesDao, categoriesDao, revisionsDao)
    }

    @Provides
    @Singleton
    fun provideWikiUseCase(
        repository: WikiRepository,
        nostrClient: NostrClient,
        cryptoManager: CryptoManager
    ): WikiUseCase {
        return WikiUseCase(repository, nostrClient, cryptoManager)
    }

    @Provides
    @Singleton
    fun provideWikiBuildItModule(): WikiBuildItModule {
        return WikiBuildItModule()
    }
}
