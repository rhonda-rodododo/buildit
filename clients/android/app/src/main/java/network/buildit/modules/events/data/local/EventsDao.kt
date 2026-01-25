package network.buildit.modules.events.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

/**
 * Data Access Object for events.
 */
@Dao
interface EventsDao {
    @Query("SELECT * FROM events WHERE groupId = :groupId ORDER BY startAt ASC")
    fun getEventsByGroup(groupId: String): Flow<List<EventEntity>>

    @Query("SELECT * FROM events WHERE groupId IS NULL ORDER BY startAt ASC")
    fun getPublicEvents(): Flow<List<EventEntity>>

    @Query("SELECT * FROM events WHERE id = :id")
    suspend fun getEvent(id: String): EventEntity?

    @Query("SELECT * FROM events WHERE id = :id")
    fun observeEvent(id: String): Flow<EventEntity?>

    @Query("SELECT * FROM events WHERE startAt >= :startTime AND startAt <= :endTime AND groupId = :groupId ORDER BY startAt ASC")
    fun getEventsInRange(groupId: String, startTime: Long, endTime: Long): Flow<List<EventEntity>>

    @Query("SELECT * FROM events WHERE visibility = :visibility ORDER BY startAt DESC")
    fun getEventsByVisibility(visibility: String): Flow<List<EventEntity>>

    @Query("SELECT * FROM events WHERE createdBy = :pubkey ORDER BY startAt DESC")
    fun getEventsByCreator(pubkey: String): Flow<List<EventEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvent(event: EventEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvents(events: List<EventEntity>)

    @Update
    suspend fun updateEvent(event: EventEntity)

    @Delete
    suspend fun deleteEvent(event: EventEntity)

    @Query("DELETE FROM events WHERE id = :id")
    suspend fun deleteEventById(id: String)

    @Query("SELECT COUNT(*) FROM events WHERE groupId = :groupId AND startAt >= :currentTime")
    suspend fun getUpcomingEventCount(groupId: String, currentTime: Long): Int
}

/**
 * Data Access Object for RSVPs.
 */
@Dao
interface RsvpsDao {
    @Query("SELECT * FROM event_rsvps WHERE eventId = :eventId")
    fun getRsvpsForEvent(eventId: String): Flow<List<RsvpEntity>>

    @Query("SELECT * FROM event_rsvps WHERE eventId = :eventId AND pubkey = :pubkey")
    suspend fun getRsvp(eventId: String, pubkey: String): RsvpEntity?

    @Query("SELECT * FROM event_rsvps WHERE eventId = :eventId AND status = :status")
    fun getRsvpsByStatus(eventId: String, status: String): Flow<List<RsvpEntity>>

    @Query("SELECT COUNT(*) FROM event_rsvps WHERE eventId = :eventId AND status = 'going'")
    suspend fun getGoingCount(eventId: String): Int

    @Query("SELECT * FROM event_rsvps WHERE pubkey = :pubkey ORDER BY respondedAt DESC")
    fun getRsvpsByUser(pubkey: String): Flow<List<RsvpEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRsvp(rsvp: RsvpEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRsvps(rsvps: List<RsvpEntity>)

    @Delete
    suspend fun deleteRsvp(rsvp: RsvpEntity)

    @Query("DELETE FROM event_rsvps WHERE eventId = :eventId AND pubkey = :pubkey")
    suspend fun deleteRsvpById(eventId: String, pubkey: String)
}
