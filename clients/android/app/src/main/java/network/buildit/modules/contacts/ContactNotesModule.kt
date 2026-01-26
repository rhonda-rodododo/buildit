package network.buildit.modules.contacts

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import network.buildit.core.storage.AppDatabase
import network.buildit.modules.BuildItModule
import network.buildit.modules.contacts.data.ContactNotesRepository
import network.buildit.modules.contacts.data.local.ContactNotesDao
import network.buildit.modules.contacts.data.local.ContactTagAssignmentsDao
import network.buildit.modules.contacts.data.local.ContactTagsDao
import network.buildit.modules.contacts.domain.ContactNotesUseCase
import javax.inject.Singleton

/**
 * BuildIt module definition for Contact Notes and Tags.
 */
class ContactNotesBuildItModule : BuildItModule {
    override val id: String = "contact-notes"
    override val name: String = "Contact Notes & Tags"
    override val description: String = "Track notes and organize contacts with custom tags"
    override val version: String = "1.0.0"
    override val icon: String = "note_text_badge_plus"

    // Contact notes are local-only, no Nostr event kinds
    override val nostrKinds: List<Int> = emptyList()

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
 * Hilt module for Contact Notes dependency injection.
 */
@Module
@InstallIn(SingletonComponent::class)
object ContactNotesHiltModule {

    @Provides
    @Singleton
    fun provideContactNotesDao(database: AppDatabase): ContactNotesDao {
        return database.contactNotesDao()
    }

    @Provides
    @Singleton
    fun provideContactTagsDao(database: AppDatabase): ContactTagsDao {
        return database.contactTagsDao()
    }

    @Provides
    @Singleton
    fun provideContactTagAssignmentsDao(database: AppDatabase): ContactTagAssignmentsDao {
        return database.contactTagAssignmentsDao()
    }

    @Provides
    @Singleton
    fun provideContactNotesRepository(
        notesDao: ContactNotesDao,
        tagsDao: ContactTagsDao,
        assignmentsDao: ContactTagAssignmentsDao
    ): ContactNotesRepository {
        return ContactNotesRepository(notesDao, tagsDao, assignmentsDao)
    }

    @Provides
    @Singleton
    fun provideContactNotesUseCase(
        repository: ContactNotesRepository
    ): ContactNotesUseCase {
        return ContactNotesUseCase(repository)
    }

    @Provides
    @Singleton
    fun provideContactNotesBuildItModule(): ContactNotesBuildItModule {
        return ContactNotesBuildItModule()
    }
}
