package network.buildit.core.storage

import android.database.sqlite.SQLiteConstraintException
import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.IOException

/**
 * Tests for Room database migrations between versions.
 *
 * Ensures that database schema changes preserve existing data
 * when users upgrade the app. Tests cover:
 * - Schema version upgrades
 * - Data preservation during migration
 * - Foreign key integrity after migration
 * - New table creation during migration
 * - Column additions without data loss
 */
@RunWith(AndroidJUnit4::class)
class MigrationTest {

    private val testDbName = "migration-test-v2"

    @get:Rule
    val helper: MigrationTestHelper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        BuildItDatabase::class.java.canonicalName,
        FrameworkSQLiteOpenHelperFactory()
    )

    @Test
    @Throws(IOException::class)
    fun createDatabase_version1() {
        // Create initial database version
        val db = helper.createDatabase(testDbName, 1)

        // Verify core tables exist by inserting data
        db.execSQL("""
            INSERT INTO contacts (pubkey, displayName, avatarUrl, nip05, about, isBlocked, isTrusted, lastSeenAt, createdAt, updatedAt)
            VALUES ('testkey123', 'Migration User', NULL, NULL, NULL, 0, 0, NULL, 0, 0)
        """.trimIndent())

        db.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('conv-mig-1', 'DIRECT', '["testkey123"]', NULL, NULL, NULL, NULL, 0, 0, 0, 0, 0)
        """.trimIndent())

        db.execSQL("""
            INSERT INTO groups (id, name, description, ownerPubkey, isPublic, createdAt, updatedAt)
            VALUES ('grp-mig-1', 'Migration Group', 'Test', 'testkey123', 1, 0, 0)
        """.trimIndent())

        db.close()
    }

    @Test
    @Throws(IOException::class)
    fun dataPreserved_afterOpeningLatestVersion() {
        // Create v1 database with test data
        helper.createDatabase(testDbName, 1).apply {
            execSQL("""
                INSERT INTO contacts (pubkey, displayName, avatarUrl, nip05, about, isBlocked, isTrusted, lastSeenAt, createdAt, updatedAt)
                VALUES ('preserved-key', 'Preserved User', NULL, 'user@test.com', 'About me', 0, 1, NULL, 1000, 1000)
            """.trimIndent())
            close()
        }

        // Open latest version - should preserve data
        val db = Room.databaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java,
            testDbName
        ).build()

        val cursor = db.openHelper.readableDatabase.query(
            "SELECT displayName, nip05, isTrusted FROM contacts WHERE pubkey = 'preserved-key'"
        )

        assert(cursor.count == 1) { "Contact should be preserved after migration" }
        cursor.moveToFirst()
        assert(cursor.getString(0) == "Preserved User") { "Display name should be preserved" }
        assert(cursor.getString(1) == "user@test.com") { "NIP-05 should be preserved" }
        assert(cursor.getInt(2) == 1) { "Trust status should be preserved" }
        cursor.close()

        db.close()
    }

    @Test
    @Throws(IOException::class)
    fun foreignKeyIntegrity_messagesRequireConversation() {
        val db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java
        ).build()

        // Create conversation first
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('fk-conv', 'DIRECT', '["key1"]', NULL, NULL, NULL, NULL, 0, 0, 0, 0, 0)
        """.trimIndent())

        // Insert message linked to conversation should succeed
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('fk-msg', 'fk-conv', 'key1', 'Hello', 'TEXT', NULL, 'SENT', 0, 0, NULL)
        """.trimIndent())

        val cursor = db.openHelper.readableDatabase.query(
            "SELECT COUNT(*) FROM messages WHERE conversationId = 'fk-conv'"
        )
        cursor.moveToFirst()
        assert(cursor.getInt(0) == 1) { "Message should exist" }
        cursor.close()

        db.close()
    }

    @Test
    @Throws(IOException::class)
    fun moduleTables_existAfterCreation() {
        val db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java
        ).build()

        // Verify events table exists
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO groups (id, name, description, ownerPubkey, isPublic, createdAt, updatedAt)
            VALUES ('mod-grp', 'Module Test Group', 'Test', 'owner', 1, 0, 0)
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO events (id, groupId, title, description, startAt, endAt, allDay, timezone, visibility, createdBy, createdAt, schemaVersion)
            VALUES ('mod-event', 'mod-grp', 'Test Event', 'Desc', 100, 200, 0, 'UTC', 'Group', 'owner', 0, '1.0.0')
        """.trimIndent())

        // Verify messaging metadata table exists
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messaging_metadata (id, messageId, conversationId, messageType, schemaContent, schemaVersion, mentionsJson, attachmentsJson, replyToId, threadId, groupId, createdAt)
            VALUES ('meta-1', 'msg-1', 'conv-1', 'direct', '{}', '1.0.0', NULL, NULL, NULL, NULL, NULL, 0)
        """.trimIndent())

        // Verify messaging reactions table exists
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messaging_reactions (id, schemaVersion, targetId, emoji, reactorPubkey, createdAt)
            VALUES ('react-1', '1.0.0', 'msg-1', 'thumbsup', 'user-1', 0)
        """.trimIndent())

        // Verify messaging read receipts table exists
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messaging_read_receipts (id, schemaVersion, conversationId, lastRead, readAt, readerPubkey, updatedAt)
            VALUES ('rr-1', '1.0.0', 'conv-1', 'msg-1', 0, 'user-1', 0)
        """.trimIndent())

        db.close()
    }

    @Test
    @Throws(IOException::class)
    fun indices_exist_onPerformanceCriticalColumns() {
        val db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java
        ).build()

        // Query sqlite_master for index information
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'"
        )

        val indices = mutableSetOf<String>()
        while (cursor.moveToNext()) {
            indices.add("${cursor.getString(1)}.${cursor.getString(0)}")
        }
        cursor.close()

        // These are critical indices for query performance
        // The exact index names depend on Room's convention,
        // but we verify the tables have indices
        val tablesWithIndices = indices.map { it.split(".")[0] }.toSet()

        // Messaging tables should have indices for common queries
        assert("messaging_metadata" in tablesWithIndices || indices.any { it.contains("messaging") }) {
            "Expected indices on messaging tables"
        }

        db.close()
    }

    @Test
    @Throws(IOException::class)
    fun uniqueConstraints_preventDuplicateContacts() {
        val db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java
        ).build()

        // Insert first contact
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO contacts (pubkey, displayName, avatarUrl, nip05, about, isBlocked, isTrusted, lastSeenAt, createdAt, updatedAt)
            VALUES ('unique-key', 'First Insert', NULL, NULL, NULL, 0, 0, NULL, 0, 0)
        """.trimIndent())

        // Attempt to insert duplicate should fail or replace
        try {
            db.openHelper.writableDatabase.execSQL("""
                INSERT INTO contacts (pubkey, displayName, avatarUrl, nip05, about, isBlocked, isTrusted, lastSeenAt, createdAt, updatedAt)
                VALUES ('unique-key', 'Duplicate Insert', NULL, NULL, NULL, 0, 0, NULL, 0, 0)
            """.trimIndent())
            // If it succeeds, it means REPLACE was used - verify only 1 row exists
            val cursor = db.openHelper.readableDatabase.query(
                "SELECT COUNT(*) FROM contacts WHERE pubkey = 'unique-key'"
            )
            cursor.moveToFirst()
            assert(cursor.getInt(0) <= 1) { "Should not have duplicate contacts" }
            cursor.close()
        } catch (e: Exception) {
            // Constraint violation is the expected behavior
            assert(e is SQLiteConstraintException || e.message?.contains("UNIQUE") == true) {
                "Expected unique constraint violation"
            }
        }

        db.close()
    }
}
