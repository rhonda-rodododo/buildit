package network.buildit.modules.wiki

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import network.buildit.core.nostr.NostrClient
import network.buildit.core.storage.AppDatabase
import network.buildit.modules.BuildItModule
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
    override val id: String = "wiki"
    override val name: String = "Knowledge Base"
    override val description: String = "Collaborative wiki and documentation for your group"
    override val version: String = "1.0.0"
    override val icon: String = "book"

    override val nostrKinds: List<Int> = listOf(
        WikiUseCase.KIND_WIKI_PAGE,      // 40301
        WikiUseCase.KIND_WIKI_CATEGORY,  // 40302
        WikiUseCase.KIND_PAGE_REVISION   // 40303
    )

    override val requiredPermissions: List<String> = emptyList()
    override val dependencies: List<String> = emptyList()

    override fun isEnabled(): Boolean = true

    override suspend fun initialize() {
        // No special initialization needed
    }

    override suspend fun cleanup() {
        // No cleanup needed
    }
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
        nostrClient: NostrClient
    ): WikiUseCase {
        return WikiUseCase(repository, nostrClient)
    }

    @Provides
    @Singleton
    fun provideWikiBuildItModule(): WikiBuildItModule {
        return WikiBuildItModule()
    }
}
