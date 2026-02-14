package network.buildit.modules.contacts.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import network.buildit.generated.schemas.contacts.NoteCategory
import network.buildit.modules.contacts.data.ContactNotesRepository
import network.buildit.modules.contacts.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for contact notes and tags business logic.
 */
@Singleton
class ContactNotesUseCase @Inject constructor(
    private val repository: ContactNotesRepository
) {
    // MARK: - Notes

    fun getAllNotes(): Flow<List<ContactNoteEntity>> = repository.getAllNotes()

    fun getNotesByContact(contactPubkey: String): Flow<List<ContactNoteEntity>> =
        repository.getNotesByContact(contactPubkey)

    fun getFollowUpNotes(): Flow<List<ContactNoteEntity>> =
        repository.getNotesByCategory(NoteCategory.FollowUp)

    suspend fun getMostRecentNote(contactPubkey: String): ContactNoteEntity? =
        repository.getNotesByContact(contactPubkey).first().firstOrNull()

    suspend fun createNote(
        contactPubkey: String,
        content: String,
        category: NoteCategory = NoteCategory.General
    ): ContactNoteEntity = repository.createNote(contactPubkey, content, category)

    suspend fun updateNote(
        note: ContactNoteEntity,
        content: String,
        category: NoteCategory
    ): ContactNoteEntity {
        val updated = note.copy(
            content = content,
            category = category,
            updatedAt = System.currentTimeMillis()
        )
        repository.updateNote(updated)
        return updated
    }

    suspend fun deleteNote(id: String) = repository.deleteNote(id)

    suspend fun searchNotes(query: String): List<ContactNoteEntity> =
        repository.searchNotes(query)

    // MARK: - Tags

    fun getAllTags(): Flow<List<ContactTagEntity>> = repository.getAllTags()

    fun getTagsByGroup(groupId: String): Flow<List<ContactTagEntity>> =
        repository.getTagsByGroup(groupId)

    fun getTagsForContact(contactPubkey: String): Flow<List<ContactTagEntity>> =
        repository.observeTagsForContact(contactPubkey)

    suspend fun createTag(
        name: String,
        color: String = "#3B82F6",
        groupId: String? = null
    ): ContactTagEntity = repository.createTag(name, color, groupId)

    suspend fun updateTag(
        tag: ContactTagEntity,
        name: String,
        color: String
    ): ContactTagEntity {
        val updated = tag.copy(name = name, color = color)
        repository.updateTag(updated)
        return updated
    }

    suspend fun deleteTag(id: String) = repository.deleteTag(id)

    suspend fun getTagUsageCount(tagId: String): Int = repository.getTagUsageCount(tagId)

    // MARK: - Tag Assignments

    suspend fun assignTag(contactPubkey: String, tagId: String) =
        repository.assignTag(contactPubkey, tagId)

    suspend fun removeTag(contactPubkey: String, tagId: String) =
        repository.removeTag(contactPubkey, tagId)

    suspend fun setTags(contactPubkey: String, tagIds: List<String>) =
        repository.setTags(contactPubkey, tagIds)

    suspend fun getContactsWithTag(tagId: String): List<String> =
        repository.getContactsWithTag(tagId)

    // MARK: - Combined Data

    fun getContactData(
        contactPubkey: String,
        displayName: String?
    ): Flow<ContactWithNotesAndTags> {
        return combine(
            repository.getNotesByContact(contactPubkey),
            repository.observeTagsForContact(contactPubkey)
        ) { notes, tags ->
            ContactWithNotesAndTags(
                contactPubkey = contactPubkey,
                displayName = displayName,
                notes = notes,
                tags = tags
            )
        }
    }

    // MARK: - Filtering

    suspend fun filterContactsByTags(
        pubkeys: List<String>,
        filter: ContactTagFilter
    ): List<String> {
        if (filter.isEmpty) return pubkeys

        return pubkeys.filter { pubkey ->
            val tagIds = repository.getTagIdsForContact(pubkey).toSet()
            filter.matches(tagIds)
        }
    }

    // MARK: - Setup

    suspend fun ensurePredefinedTags(groupId: String? = null) =
        repository.ensurePredefinedTags(groupId)
}
