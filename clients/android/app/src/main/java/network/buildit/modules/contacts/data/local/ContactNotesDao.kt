package network.buildit.modules.contacts.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import network.buildit.generated.schemas.contacts.NoteCategory

/**
 * DAO for contact notes operations.
 */
@Dao
interface ContactNotesDao {
    @Query("SELECT * FROM contact_notes ORDER BY createdAt DESC")
    fun getAllNotes(): Flow<List<ContactNoteEntity>>

    @Query("SELECT * FROM contact_notes WHERE contactPubkey = :contactPubkey ORDER BY createdAt DESC")
    fun getNotesByContact(contactPubkey: String): Flow<List<ContactNoteEntity>>

    @Query("SELECT * FROM contact_notes WHERE category = :category ORDER BY createdAt DESC")
    fun getNotesByCategory(category: NoteCategory): Flow<List<ContactNoteEntity>>

    @Query("SELECT * FROM contact_notes WHERE id = :id")
    suspend fun getNoteById(id: String): ContactNoteEntity?

    @Query("SELECT * FROM contact_notes WHERE content LIKE '%' || :query || '%' ORDER BY createdAt DESC")
    suspend fun searchNotes(query: String): List<ContactNoteEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNote(note: ContactNoteEntity)

    @Update
    suspend fun updateNote(note: ContactNoteEntity)

    @Query("DELETE FROM contact_notes WHERE id = :id")
    suspend fun deleteNote(id: String)

    @Query("DELETE FROM contact_notes WHERE contactPubkey = :contactPubkey")
    suspend fun deleteNotesByContact(contactPubkey: String)
}

/**
 * DAO for contact tags operations.
 */
@Dao
interface ContactTagsDao {
    @Query("SELECT * FROM contact_tags ORDER BY name ASC")
    fun getAllTags(): Flow<List<ContactTagEntity>>

    @Query("SELECT * FROM contact_tags WHERE groupId = :groupId OR groupId IS NULL ORDER BY name ASC")
    fun getTagsByGroup(groupId: String): Flow<List<ContactTagEntity>>

    @Query("SELECT * FROM contact_tags WHERE id = :id")
    suspend fun getTagById(id: String): ContactTagEntity?

    @Query("SELECT * FROM contact_tags WHERE name = :name")
    suspend fun getTagByName(name: String): ContactTagEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTag(tag: ContactTagEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTags(tags: List<ContactTagEntity>)

    @Update
    suspend fun updateTag(tag: ContactTagEntity)

    @Query("DELETE FROM contact_tags WHERE id = :id")
    suspend fun deleteTag(id: String)
}

/**
 * DAO for contact tag assignments.
 */
@Dao
interface ContactTagAssignmentsDao {
    @Query("SELECT * FROM contact_tag_assignments WHERE contactPubkey = :contactPubkey")
    fun getAssignmentsByContact(contactPubkey: String): Flow<List<ContactTagAssignmentEntity>>

    @Query("SELECT * FROM contact_tag_assignments WHERE tagId = :tagId")
    fun getAssignmentsByTag(tagId: String): Flow<List<ContactTagAssignmentEntity>>

    @Query("SELECT contactPubkey FROM contact_tag_assignments WHERE tagId = :tagId")
    suspend fun getContactsWithTag(tagId: String): List<String>

    @Query("SELECT tagId FROM contact_tag_assignments WHERE contactPubkey = :contactPubkey")
    suspend fun getTagIdsForContact(contactPubkey: String): List<String>

    @Query("SELECT COUNT(*) FROM contact_tag_assignments WHERE tagId = :tagId")
    suspend fun getTagUsageCount(tagId: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAssignment(assignment: ContactTagAssignmentEntity)

    @Query("DELETE FROM contact_tag_assignments WHERE contactPubkey = :contactPubkey AND tagId = :tagId")
    suspend fun deleteAssignment(contactPubkey: String, tagId: String)

    @Query("DELETE FROM contact_tag_assignments WHERE contactPubkey = :contactPubkey")
    suspend fun deleteAllAssignmentsForContact(contactPubkey: String)

    @Query("DELETE FROM contact_tag_assignments WHERE tagId = :tagId")
    suspend fun deleteAllAssignmentsForTag(tagId: String)
}
