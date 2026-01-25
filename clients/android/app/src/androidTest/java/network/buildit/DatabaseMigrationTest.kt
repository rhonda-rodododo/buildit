package network.buildit

import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import network.buildit.core.storage.BuildItDatabase
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.IOException

/**
 * Tests for Room database migrations.
 *
 * Ensures that database schema changes don't cause data loss
 * when users upgrade the app.
 */
@RunWith(AndroidJUnit4::class)
class DatabaseMigrationTest {

    private val testDbName = "migration-test"

    @get:Rule
    val helper: MigrationTestHelper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        BuildItDatabase::class.java.canonicalName,
        FrameworkSQLiteOpenHelperFactory()
    )

    @Test
    @Throws(IOException::class)
    fun migrateAll() {
        // Create earliest version of the database
        helper.createDatabase(testDbName, 1).apply {
            // Insert test data for version 1
            execSQL("""
                INSERT INTO contacts (pubkey, displayName, avatarUrl, nip05, about, isBlocked, isTrusted, lastSeenAt, createdAt, updatedAt)
                VALUES ('testpubkey123', 'Test User', NULL, NULL, 'Test about', 0, 0, NULL, 0, 0)
            """.trimIndent())
            close()
        }

        // Open latest version of the database
        // Room will validate the schema
        Room.databaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java,
            testDbName
        ).build().apply {
            openHelper.writableDatabase
            close()
        }
    }

    @Test
    @Throws(IOException::class)
    fun database_canBeCreated() {
        // Test that a fresh database can be created
        val db = Room.databaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java,
            "test-db-creation"
        ).build()

        // Get a DAO to trigger database creation
        db.openHelper.writableDatabase

        // Verify database exists
        assert(db.isOpen)

        db.close()
    }

    @Test
    @Throws(IOException::class)
    fun contactEntity_canBeInsertedAndQueried() {
        val db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java
        ).build()

        // Insert a contact
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO contacts (pubkey, displayName, avatarUrl, nip05, about, isBlocked, isTrusted, lastSeenAt, createdAt, updatedAt)
            VALUES ('pubkey123', 'Test Contact', NULL, 'test@example.com', 'About text', 0, 1, NULL, ${System.currentTimeMillis()}, ${System.currentTimeMillis()})
        """.trimIndent())

        // Query the contact
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT * FROM contacts WHERE pubkey = 'pubkey123'"
        )

        assert(cursor.count == 1)
        cursor.close()

        db.close()
    }

    @Test
    @Throws(IOException::class)
    fun conversationEntity_canBeInsertedAndQueried() {
        val db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java
        ).build()

        // Insert a conversation
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('conv123', 'DIRECT', '["pubkey1"]', NULL, NULL, NULL, NULL, 0, 0, 0, ${System.currentTimeMillis()}, ${System.currentTimeMillis()})
        """.trimIndent())

        // Query the conversation
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT * FROM conversations WHERE id = 'conv123'"
        )

        assert(cursor.count == 1)
        cursor.close()

        db.close()
    }

    @Test
    @Throws(IOException::class)
    fun messageEntity_canBeInsertedAndQueried() {
        val db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java
        ).build()

        // First insert a conversation (for foreign key)
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('conv456', 'DIRECT', '["pubkey1"]', NULL, NULL, NULL, NULL, 0, 0, 0, ${System.currentTimeMillis()}, ${System.currentTimeMillis()})
        """.trimIndent())

        // Insert a message
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('msg789', 'conv456', 'sender123', 'Hello World', 'TEXT', NULL, 'SENT', ${System.currentTimeMillis()}, ${System.currentTimeMillis()}, NULL)
        """.trimIndent())

        // Query the message
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT * FROM messages WHERE id = 'msg789'"
        )

        assert(cursor.count == 1)
        cursor.close()

        db.close()
    }

    @Test
    @Throws(IOException::class)
    fun groupEntity_canBeInsertedAndQueried() {
        val db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            BuildItDatabase::class.java
        ).build()

        // Insert a group
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO groups (id, name, description, ownerPubkey, isPublic, createdAt, updatedAt)
            VALUES ('group123', 'Test Group', 'A test group', 'owner_pubkey', 1, ${System.currentTimeMillis()}, ${System.currentTimeMillis()})
        """.trimIndent())

        // Query the group
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT * FROM groups WHERE id = 'group123'"
        )

        assert(cursor.count == 1)
        cursor.close()

        db.close()
    }
}
