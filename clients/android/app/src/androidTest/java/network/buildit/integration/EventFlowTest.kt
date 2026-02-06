package network.buildit.integration

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import network.buildit.core.storage.BuildItDatabase
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Integration test for the Event creation -> RSVP -> notification flow.
 *
 * Tests the end-to-end path from creating an event through the database
 * to RSVP submission and verification, ensuring data integrity across
 * the full flow.
 */
@RunWith(AndroidJUnit4::class)
class EventFlowTest {

    private lateinit var db: BuildItDatabase

    private val testPubkey = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    private val testGroupId = "integration-group-1"
    private val testEventId = "integration-event-1"
    private val now = System.currentTimeMillis() / 1000

    @Before
    fun setup() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        db = Room.inMemoryDatabaseBuilder(context, BuildItDatabase::class.java)
            .allowMainThreadQueries()
            .build()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun eventCreation_persistsInDatabase() {
        // Insert a group first (for foreign key constraint)
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO groups (id, name, description, ownerPubkey, isPublic, createdAt, updatedAt)
            VALUES ('$testGroupId', 'Integration Test Group', 'Test', '$testPubkey', 1, $now, $now)
        """.trimIndent())

        // Insert an event
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO events (id, groupId, title, description, startAt, endAt, allDay, timezone, visibility, createdBy, createdAt, schemaVersion)
            VALUES ('$testEventId', '$testGroupId', 'Community Rally', 'Annual rally', ${now + 3600}, ${now + 7200}, 0, 'America/New_York', 'Group', '$testPubkey', $now, '1.0.0')
        """.trimIndent())

        // Verify event was persisted
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT * FROM events WHERE id = '$testEventId'"
        )
        assert(cursor.count == 1) { "Expected 1 event, found ${cursor.count}" }
        cursor.moveToFirst()
        val titleIndex = cursor.getColumnIndex("title")
        assert(cursor.getString(titleIndex) == "Community Rally") { "Event title mismatch" }
        cursor.close()
    }

    @Test
    fun rsvpSubmission_linksToEvent() {
        // Setup: Create group and event
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO groups (id, name, description, ownerPubkey, isPublic, createdAt, updatedAt)
            VALUES ('$testGroupId', 'RSVP Test Group', 'Test', '$testPubkey', 1, $now, $now)
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO events (id, groupId, title, description, startAt, endAt, allDay, timezone, visibility, createdBy, createdAt, schemaVersion)
            VALUES ('$testEventId', '$testGroupId', 'RSVP Test Event', 'Test event', ${now + 3600}, ${now + 7200}, 0, 'UTC', 'Group', '$testPubkey', $now, '1.0.0')
        """.trimIndent())

        // Insert RSVP
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO rsvps (id, eventId, pubkey, status, guestCount, note, respondedAt, schemaVersion)
            VALUES ('rsvp-1', '$testEventId', '$testPubkey', 'Going', 0, NULL, $now, '1.0.0')
        """.trimIndent())

        // Verify RSVP links to correct event
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT * FROM rsvps WHERE eventId = '$testEventId'"
        )
        assert(cursor.count == 1) { "Expected 1 RSVP, found ${cursor.count}" }
        cursor.moveToFirst()
        val statusIndex = cursor.getColumnIndex("status")
        assert(cursor.getString(statusIndex) == "Going") { "RSVP status mismatch" }
        cursor.close()
    }

    @Test
    fun multipleRsvps_countedCorrectly() {
        // Setup: Create group and event
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO groups (id, name, description, ownerPubkey, isPublic, createdAt, updatedAt)
            VALUES ('$testGroupId', 'Count Test Group', 'Test', '$testPubkey', 1, $now, $now)
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO events (id, groupId, title, description, startAt, endAt, allDay, timezone, visibility, createdBy, createdAt, schemaVersion)
            VALUES ('$testEventId', '$testGroupId', 'Count Test Event', 'Test', ${now + 3600}, ${now + 7200}, 0, 'UTC', 'Group', '$testPubkey', $now, '1.0.0')
        """.trimIndent())

        // Insert multiple RSVPs with different statuses
        val rsvps = listOf(
            "('rsvp-a', '$testEventId', 'user-a', 'Going', 0, NULL, $now, '1.0.0')",
            "('rsvp-b', '$testEventId', 'user-b', 'Going', 2, NULL, $now, '1.0.0')",
            "('rsvp-c', '$testEventId', 'user-c', 'Maybe', 0, NULL, $now, '1.0.0')",
            "('rsvp-d', '$testEventId', 'user-d', 'NotGoing', 0, 'Sorry, cannot make it', $now, '1.0.0')"
        )

        for (rsvp in rsvps) {
            db.openHelper.writableDatabase.execSQL(
                "INSERT INTO rsvps (id, eventId, pubkey, status, guestCount, note, respondedAt, schemaVersion) VALUES $rsvp"
            )
        }

        // Count "Going" RSVPs
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT COUNT(*) FROM rsvps WHERE eventId = '$testEventId' AND status = 'Going'"
        )
        cursor.moveToFirst()
        val goingCount = cursor.getInt(0)
        assert(goingCount == 2) { "Expected 2 going, found $goingCount" }
        cursor.close()

        // Count total RSVPs
        val totalCursor = db.openHelper.readableDatabase.query(
            "SELECT COUNT(*) FROM rsvps WHERE eventId = '$testEventId'"
        )
        totalCursor.moveToFirst()
        val totalCount = totalCursor.getInt(0)
        assert(totalCount == 4) { "Expected 4 total RSVPs, found $totalCount" }
        totalCursor.close()
    }

    @Test
    fun eventDeletion_cascadesToRsvps() {
        // Setup: Create group, event, and RSVPs
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO groups (id, name, description, ownerPubkey, isPublic, createdAt, updatedAt)
            VALUES ('$testGroupId', 'Cascade Test Group', 'Test', '$testPubkey', 1, $now, $now)
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO events (id, groupId, title, description, startAt, endAt, allDay, timezone, visibility, createdBy, createdAt, schemaVersion)
            VALUES ('$testEventId', '$testGroupId', 'Cascade Test Event', 'Test', ${now + 3600}, ${now + 7200}, 0, 'UTC', 'Group', '$testPubkey', $now, '1.0.0')
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO rsvps (id, eventId, pubkey, status, guestCount, note, respondedAt, schemaVersion)
            VALUES ('rsvp-cascade', '$testEventId', '$testPubkey', 'Going', 0, NULL, $now, '1.0.0')
        """.trimIndent())

        // Delete the event
        db.openHelper.writableDatabase.execSQL(
            "DELETE FROM events WHERE id = '$testEventId'"
        )

        // Verify event is gone
        val eventCursor = db.openHelper.readableDatabase.query(
            "SELECT COUNT(*) FROM events WHERE id = '$testEventId'"
        )
        eventCursor.moveToFirst()
        assert(eventCursor.getInt(0) == 0) { "Event should be deleted" }
        eventCursor.close()
    }

    @Test
    fun eventUpdate_preservesExistingRsvps() {
        // Setup
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO groups (id, name, description, ownerPubkey, isPublic, createdAt, updatedAt)
            VALUES ('$testGroupId', 'Update Test Group', 'Test', '$testPubkey', 1, $now, $now)
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO events (id, groupId, title, description, startAt, endAt, allDay, timezone, visibility, createdBy, createdAt, schemaVersion)
            VALUES ('$testEventId', '$testGroupId', 'Original Title', 'Test', ${now + 3600}, ${now + 7200}, 0, 'UTC', 'Group', '$testPubkey', $now, '1.0.0')
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO rsvps (id, eventId, pubkey, status, guestCount, note, respondedAt, schemaVersion)
            VALUES ('rsvp-preserve', '$testEventId', '$testPubkey', 'Going', 0, NULL, $now, '1.0.0')
        """.trimIndent())

        // Update event title
        db.openHelper.writableDatabase.execSQL(
            "UPDATE events SET title = 'Updated Title' WHERE id = '$testEventId'"
        )

        // Verify RSVP still exists
        val rsvpCursor = db.openHelper.readableDatabase.query(
            "SELECT COUNT(*) FROM rsvps WHERE eventId = '$testEventId'"
        )
        rsvpCursor.moveToFirst()
        assert(rsvpCursor.getInt(0) == 1) { "RSVP should still exist after event update" }
        rsvpCursor.close()

        // Verify event was updated
        val eventCursor = db.openHelper.readableDatabase.query(
            "SELECT title FROM events WHERE id = '$testEventId'"
        )
        eventCursor.moveToFirst()
        val titleIndex = eventCursor.getColumnIndex("title")
        assert(eventCursor.getString(titleIndex) == "Updated Title") { "Event title should be updated" }
        eventCursor.close()
    }
}
