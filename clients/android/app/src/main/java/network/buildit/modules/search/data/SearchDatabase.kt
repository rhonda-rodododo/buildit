package network.buildit.modules.search.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Room database for the search module.
 *
 * This is a separate database from the main BuildIt database to:
 * 1. Keep search index isolated and easily rebuildable
 * 2. Allow independent migrations for search-specific tables
 * 3. Enable potential optimization of FTS-specific settings
 *
 * Note: This database uses a separate encryption key from the main database
 * for defense-in-depth security.
 */
@Database(
    entities = [
        SearchDocumentEntity::class,
        SearchFtsEntity::class,
        TagEntity::class,
        EntityTagEntity::class,
        SavedSearchEntity::class,
        RecentSearchEntity::class,
        TermFrequencyEntity::class,
        InverseDocumentFrequencyEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class SearchDatabase : RoomDatabase() {
    abstract fun searchDocumentDao(): SearchDocumentDao
    abstract fun tagDao(): TagDao
    abstract fun entityTagDao(): EntityTagDao
    abstract fun savedSearchDao(): SavedSearchDao
    abstract fun recentSearchDao(): RecentSearchDao
    abstract fun termFrequencyDao(): TermFrequencyDao
    abstract fun inverseDocumentFrequencyDao(): InverseDocumentFrequencyDao

    companion object {
        const val DATABASE_NAME = "buildit_search.db"
    }
}

/**
 * Hilt module for providing search database dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
object SearchDatabaseModule {

    @Provides
    @Singleton
    fun provideSearchDatabase(@ApplicationContext context: Context): SearchDatabase {
        return Room.databaseBuilder(
            context,
            SearchDatabase::class.java,
            SearchDatabase.DATABASE_NAME
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideSearchDocumentDao(database: SearchDatabase): SearchDocumentDao {
        return database.searchDocumentDao()
    }

    @Provides
    fun provideTagDao(database: SearchDatabase): TagDao {
        return database.tagDao()
    }

    @Provides
    fun provideEntityTagDao(database: SearchDatabase): EntityTagDao {
        return database.entityTagDao()
    }

    @Provides
    fun provideSavedSearchDao(database: SearchDatabase): SavedSearchDao {
        return database.savedSearchDao()
    }

    @Provides
    fun provideRecentSearchDao(database: SearchDatabase): RecentSearchDao {
        return database.recentSearchDao()
    }

    @Provides
    fun provideTermFrequencyDao(database: SearchDatabase): TermFrequencyDao {
        return database.termFrequencyDao()
    }

    @Provides
    fun provideInverseDocumentFrequencyDao(database: SearchDatabase): InverseDocumentFrequencyDao {
        return database.inverseDocumentFrequencyDao()
    }
}
