package network.buildit.modules.forms.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * DAO for form operations.
 */
@Dao
interface FormsDao {
    @Query("SELECT * FROM forms ORDER BY createdAt DESC")
    fun getAllForms(): Flow<List<FormEntity>>

    @Query("SELECT * FROM forms WHERE groupId = :groupId ORDER BY createdAt DESC")
    fun getFormsByGroup(groupId: String): Flow<List<FormEntity>>

    @Query("SELECT * FROM forms WHERE createdBy = :pubkey ORDER BY createdAt DESC")
    fun getFormsByCreator(pubkey: String): Flow<List<FormEntity>>

    @Query("SELECT * FROM forms WHERE status = :status ORDER BY createdAt DESC")
    fun getFormsByStatus(status: FormStatus): Flow<List<FormEntity>>

    @Query("SELECT * FROM forms WHERE status = 'OPEN' ORDER BY createdAt DESC")
    fun getOpenForms(): Flow<List<FormEntity>>

    @Query("SELECT * FROM forms WHERE status = 'OPEN' AND groupId = :groupId ORDER BY createdAt DESC")
    fun getOpenFormsByGroup(groupId: String): Flow<List<FormEntity>>

    @Query("SELECT * FROM forms WHERE id = :id")
    fun observeForm(id: String): Flow<FormEntity?>

    @Query("SELECT * FROM forms WHERE id = :id")
    suspend fun getFormById(id: String): FormEntity?

    @Query("SELECT * FROM forms WHERE nostrEventId = :eventId")
    suspend fun getFormByEventId(eventId: String): FormEntity?

    @Query("SELECT * FROM forms WHERE title LIKE '%' || :query || '%' OR description LIKE '%' || :query || '%' ORDER BY createdAt DESC")
    fun searchForms(query: String): Flow<List<FormEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertForm(form: FormEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertForms(forms: List<FormEntity>)

    @Update
    suspend fun updateForm(form: FormEntity)

    @Query("UPDATE forms SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateFormStatus(id: String, status: FormStatus, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE forms SET responseCount = responseCount + 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun incrementResponseCount(id: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE forms SET syncedAt = :syncedAt WHERE id = :id")
    suspend fun markSynced(id: String, syncedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM forms WHERE id = :id")
    suspend fun deleteForm(id: String)

    @Delete
    suspend fun deleteForm(form: FormEntity)

    @Query("SELECT COUNT(*) FROM forms WHERE status = 'OPEN'")
    fun getOpenFormCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM forms WHERE groupId = :groupId")
    fun getFormCountByGroup(groupId: String): Flow<Int>

    @Query("SELECT * FROM forms WHERE syncedAt IS NULL OR updatedAt > syncedAt")
    suspend fun getUnsyncedForms(): List<FormEntity>
}

/**
 * DAO for form response operations.
 */
@Dao
interface FormResponsesDao {
    @Query("SELECT * FROM form_responses WHERE formId = :formId ORDER BY submittedAt DESC")
    fun getResponsesForForm(formId: String): Flow<List<FormResponseEntity>>

    @Query("SELECT * FROM form_responses WHERE respondent = :pubkey ORDER BY submittedAt DESC")
    fun getResponsesByUser(pubkey: String): Flow<List<FormResponseEntity>>

    @Query("SELECT * FROM form_responses WHERE id = :id")
    suspend fun getResponseById(id: String): FormResponseEntity?

    @Query("SELECT * FROM form_responses WHERE formId = :formId AND respondent = :pubkey LIMIT 1")
    suspend fun getUserResponse(formId: String, pubkey: String): FormResponseEntity?

    @Query("SELECT EXISTS(SELECT 1 FROM form_responses WHERE formId = :formId AND respondent = :pubkey)")
    suspend fun hasResponded(formId: String, pubkey: String): Boolean

    @Query("SELECT * FROM form_responses WHERE nostrEventId = :eventId")
    suspend fun getResponseByEventId(eventId: String): FormResponseEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertResponse(response: FormResponseEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertResponses(responses: List<FormResponseEntity>)

    @Update
    suspend fun updateResponse(response: FormResponseEntity)

    @Query("UPDATE form_responses SET syncedAt = :syncedAt WHERE id = :id")
    suspend fun markSynced(id: String, syncedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM form_responses WHERE id = :id")
    suspend fun deleteResponse(id: String)

    @Query("DELETE FROM form_responses WHERE formId = :formId")
    suspend fun deleteResponsesForForm(formId: String)

    @Query("SELECT COUNT(*) FROM form_responses WHERE formId = :formId")
    suspend fun getResponseCount(formId: String): Int

    @Query("SELECT COUNT(*) FROM form_responses WHERE formId = :formId")
    fun observeResponseCount(formId: String): Flow<Int>

    @Query("SELECT * FROM form_responses WHERE syncedAt IS NULL")
    suspend fun getUnsyncedResponses(): List<FormResponseEntity>
}
