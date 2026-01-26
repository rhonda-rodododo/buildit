package network.buildit.modules.contacts.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import network.buildit.modules.contacts.data.local.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for contact notes and tags data operations.
 */
@Singleton
class ContactNotesRepository @Inject constructor(
    private val notesDao: ContactNotesDao,
    private val tagsDao: ContactTagsDao,
    private val assignmentsDao: ContactTagAssignmentsDao
) {
    // MARK: - Notes

    fun getAllNotes(): Flow<List<ContactNoteEntity>> = notesDao.getAllNotes()

    fun getNotesByContact(contactPubkey: String): Flow<List<ContactNoteEntity>> =
        notesDao.getNotesByContact(contactPubkey)

    fun getNotesByCategory(category: NoteCategory): Flow<List<ContactNoteEntity>> =
        notesDao.getNotesByCategory(category)

    suspend fun getNoteById(id: String): ContactNoteEntity? = notesDao.getNoteById(id)

    suspend fun searchNotes(query: String): List<ContactNoteEntity> = notesDao.searchNotes(query)

    suspend fun createNote(
        contactPubkey: String,
        content: String,
        category: NoteCategory = NoteCategory.GENERAL
    ): ContactNoteEntity {
        val note = ContactNoteEntity(
            id = java.util.UUID.randomUUID().toString(),
            contactPubkey = contactPubkey,
            content = content,
            category = category
        )
        notesDao.insertNote(note)
        return note
    }

    suspend fun updateNote(note: ContactNoteEntity) {
        notesDao.updateNote(note.copy(updatedAt = System.currentTimeMillis()))
    }

    suspend fun deleteNote(id: String) {
        notesDao.deleteNote(id)
    }

    // MARK: - Tags

    fun getAllTags(): Flow<List<ContactTagEntity>> = tagsDao.getAllTags()

    fun getTagsByGroup(groupId: String): Flow<List<ContactTagEntity>> =
        tagsDao.getTagsByGroup(groupId)

    suspend fun getTagById(id: String): ContactTagEntity? = tagsDao.getTagById(id)

    suspend fun getTagByName(name: String): ContactTagEntity? = tagsDao.getTagByName(name)

    suspend fun createTag(
        name: String,
        color: String = "#3B82F6",
        groupId: String? = null
    ): ContactTagEntity {
        val tag = ContactTagEntity(
            id = java.util.UUID.randomUUID().toString(),
            name = name,
            color = color,
            groupId = groupId
        )
        tagsDao.insertTag(tag)
        return tag
    }

    suspend fun updateTag(tag: ContactTagEntity) {
        tagsDao.updateTag(tag)
    }

    suspend fun deleteTag(id: String) {
        // Delete all assignments first
        assignmentsDao.deleteAllAssignmentsForTag(id)
        tagsDao.deleteTag(id)
    }

    // MARK: - Tag Assignments

    fun getTagAssignmentsByContact(contactPubkey: String): Flow<List<ContactTagAssignmentEntity>> =
        assignmentsDao.getAssignmentsByContact(contactPubkey)

    suspend fun getTagIdsForContact(contactPubkey: String): List<String> =
        assignmentsDao.getTagIdsForContact(contactPubkey)

    suspend fun getContactsWithTag(tagId: String): List<String> =
        assignmentsDao.getContactsWithTag(tagId)

    suspend fun getTagUsageCount(tagId: String): Int =
        assignmentsDao.getTagUsageCount(tagId)

    suspend fun assignTag(contactPubkey: String, tagId: String) {
        val assignment = ContactTagAssignmentEntity(
            contactPubkey = contactPubkey,
            tagId = tagId
        )
        assignmentsDao.insertAssignment(assignment)
    }

    suspend fun removeTag(contactPubkey: String, tagId: String) {
        assignmentsDao.deleteAssignment(contactPubkey, tagId)
    }

    suspend fun setTags(contactPubkey: String, tagIds: List<String>) {
        // Remove all existing assignments
        assignmentsDao.deleteAllAssignmentsForContact(contactPubkey)

        // Add new assignments
        for (tagId in tagIds) {
            val assignment = ContactTagAssignmentEntity(
                contactPubkey = contactPubkey,
                tagId = tagId
            )
            assignmentsDao.insertAssignment(assignment)
        }
    }

    // MARK: - Combined Data

    suspend fun getTagsForContact(contactPubkey: String): List<ContactTagEntity> {
        val tagIds = assignmentsDao.getTagIdsForContact(contactPubkey)
        val allTags = tagsDao.getAllTags().first()
        return allTags.filter { it.id in tagIds }
    }

    fun observeTagsForContact(contactPubkey: String): Flow<List<ContactTagEntity>> {
        return assignmentsDao.getAssignmentsByContact(contactPubkey).map { assignments ->
            val tagIds = assignments.map { it.tagId }.toSet()
            val allTags = tagsDao.getAllTags().first()
            allTags.filter { it.id in tagIds }
        }
    }

    // MARK: - Predefined Tags

    suspend fun ensurePredefinedTags(groupId: String? = null) {
        val existingTags = tagsDao.getAllTags().first()
        val existingNames = existingTags.map { it.name }.toSet()

        val newTags = PredefinedTag.entries
            .filter { it.displayName !in existingNames }
            .map { it.toEntity(groupId) }

        if (newTags.isNotEmpty()) {
            tagsDao.insertTags(newTags)
        }
    }
}
