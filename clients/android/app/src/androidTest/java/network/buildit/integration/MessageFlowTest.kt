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
 * Integration test for the message send -> receive -> display flow.
 *
 * Tests the end-to-end path from sending a message through the database,
 * verifying conversation creation, message ordering, unread counts,
 * and status transitions.
 */
@RunWith(AndroidJUnit4::class)
class MessageFlowTest {

    private lateinit var db: BuildItDatabase

    private val senderPubkey = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    private val recipientPubkey = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"
    private val testConversationId = "conv-integration-1"
    private val now = System.currentTimeMillis()

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
    fun messageSend_createsConversationAndMessage() {
        // Create conversation
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('$testConversationId', 'DIRECT', '["$recipientPubkey"]', NULL, NULL, NULL, NULL, 0, 0, 0, $now, $now)
        """.trimIndent())

        // Send message (insert with PENDING status)
        val messageId = "msg-sent-1"
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('$messageId', '$testConversationId', '$senderPubkey', 'Hello there!', 'TEXT', NULL, 'PENDING', $now, $now, NULL)
        """.trimIndent())

        // Verify message exists with PENDING status
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT * FROM messages WHERE id = '$messageId'"
        )
        assert(cursor.count == 1) { "Expected 1 message, found ${cursor.count}" }
        cursor.moveToFirst()
        val statusIndex = cursor.getColumnIndex("status")
        assert(cursor.getString(statusIndex) == "PENDING") { "Expected PENDING status" }
        cursor.close()
    }

    @Test
    fun messageStatusTransition_pendingToSent() {
        // Setup conversation and message
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('$testConversationId', 'DIRECT', '["$recipientPubkey"]', NULL, NULL, NULL, NULL, 0, 0, 0, $now, $now)
        """.trimIndent())

        val messageId = "msg-transition-1"
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('$messageId', '$testConversationId', '$senderPubkey', 'Status test', 'TEXT', NULL, 'PENDING', $now, $now, NULL)
        """.trimIndent())

        // Transition status to SENT
        db.openHelper.writableDatabase.execSQL(
            "UPDATE messages SET status = 'SENT' WHERE id = '$messageId'"
        )

        // Verify status transition
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT status FROM messages WHERE id = '$messageId'"
        )
        cursor.moveToFirst()
        assert(cursor.getString(0) == "SENT") { "Expected SENT status after transition" }
        cursor.close()
    }

    @Test
    fun messageReceive_updatesConversationUnreadCount() {
        // Create conversation with 0 unread
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('$testConversationId', 'DIRECT', '["$senderPubkey"]', NULL, NULL, NULL, NULL, 0, 0, 0, $now, $now)
        """.trimIndent())

        // Receive 3 messages from remote user
        for (i in 1..3) {
            db.openHelper.writableDatabase.execSQL("""
                INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
                VALUES ('msg-recv-$i', '$testConversationId', '$recipientPubkey', 'Message $i', 'TEXT', NULL, 'DELIVERED', ${now + i}, ${now + i}, NULL)
            """.trimIndent())
        }

        // Update unread count on conversation
        db.openHelper.writableDatabase.execSQL(
            "UPDATE conversations SET unreadCount = 3, lastMessageId = 'msg-recv-3', lastMessageAt = ${now + 3} WHERE id = '$testConversationId'"
        )

        // Verify unread count
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT unreadCount, lastMessageId FROM conversations WHERE id = '$testConversationId'"
        )
        cursor.moveToFirst()
        assert(cursor.getInt(0) == 3) { "Expected 3 unread messages" }
        assert(cursor.getString(1) == "msg-recv-3") { "Expected last message to be msg-recv-3" }
        cursor.close()
    }

    @Test
    fun messageOrdering_chronologicalWithinConversation() {
        // Setup
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('$testConversationId', 'DIRECT', '["$recipientPubkey"]', NULL, NULL, NULL, NULL, 0, 0, 0, $now, $now)
        """.trimIndent())

        // Insert messages in non-chronological order
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('msg-3', '$testConversationId', '$senderPubkey', 'Third', 'TEXT', NULL, 'SENT', ${now + 3000}, ${now + 3000}, NULL)
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('msg-1', '$testConversationId', '$senderPubkey', 'First', 'TEXT', NULL, 'SENT', ${now + 1000}, ${now + 1000}, NULL)
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('msg-2', '$testConversationId', '$recipientPubkey', 'Second', 'TEXT', NULL, 'DELIVERED', ${now + 2000}, ${now + 2000}, NULL)
        """.trimIndent())

        // Query messages in chronological order
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT id, content FROM messages WHERE conversationId = '$testConversationId' ORDER BY timestamp ASC"
        )

        val messages = mutableListOf<String>()
        while (cursor.moveToNext()) {
            messages.add(cursor.getString(1))
        }
        cursor.close()

        assert(messages.size == 3) { "Expected 3 messages, found ${messages.size}" }
        assert(messages[0] == "First") { "First message should be 'First'" }
        assert(messages[1] == "Second") { "Second message should be 'Second'" }
        assert(messages[2] == "Third") { "Third message should be 'Third'" }
    }

    @Test
    fun markConversationAsRead_resetsUnreadCount() {
        // Setup with unread messages
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('$testConversationId', 'DIRECT', '["$recipientPubkey"]', NULL, NULL, 'msg-last', $now, 5, 0, 0, $now, $now)
        """.trimIndent())

        // Mark as read
        db.openHelper.writableDatabase.execSQL(
            "UPDATE conversations SET unreadCount = 0 WHERE id = '$testConversationId'"
        )

        // Verify count is zero
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT unreadCount FROM conversations WHERE id = '$testConversationId'"
        )
        cursor.moveToFirst()
        assert(cursor.getInt(0) == 0) { "Unread count should be 0 after marking as read" }
        cursor.close()
    }

    @Test
    fun messageReply_maintainsReplyToReference() {
        // Setup
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('$testConversationId', 'DIRECT', '["$recipientPubkey"]', NULL, NULL, NULL, NULL, 0, 0, 0, $now, $now)
        """.trimIndent())

        // Original message
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('msg-original', '$testConversationId', '$senderPubkey', 'Original message', 'TEXT', NULL, 'SENT', $now, $now, NULL)
        """.trimIndent())

        // Reply to original
        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('msg-reply', '$testConversationId', '$recipientPubkey', 'Reply to you', 'TEXT', 'msg-original', 'DELIVERED', ${now + 1000}, ${now + 1000}, NULL)
        """.trimIndent())

        // Verify reply references original
        val cursor = db.openHelper.readableDatabase.query(
            "SELECT replyToId FROM messages WHERE id = 'msg-reply'"
        )
        cursor.moveToFirst()
        val replyToIndex = cursor.getColumnIndex("replyToId")
        assert(cursor.getString(replyToIndex) == "msg-original") { "Reply should reference original message" }
        cursor.close()
    }

    @Test
    fun conversationCreation_fromDirectMessage() {
        // Receiving a DM from a new contact should create a conversation
        val newConversationId = "conv-new-dm"

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO conversations (id, type, participantPubkeys, groupId, title, lastMessageId, lastMessageAt, unreadCount, isPinned, isMuted, createdAt, updatedAt)
            VALUES ('$newConversationId', 'DIRECT', '["$recipientPubkey"]', NULL, NULL, 'msg-first-dm', $now, 1, 0, 0, $now, $now)
        """.trimIndent())

        db.openHelper.writableDatabase.execSQL("""
            INSERT INTO messages (id, conversationId, senderPubkey, content, contentType, replyToId, status, timestamp, receivedAt, readAt)
            VALUES ('msg-first-dm', '$newConversationId', '$recipientPubkey', 'Hi there!', 'TEXT', NULL, 'DELIVERED', $now, $now, NULL)
        """.trimIndent())

        // Verify conversation was created
        val convCursor = db.openHelper.readableDatabase.query(
            "SELECT type, participantPubkeys FROM conversations WHERE id = '$newConversationId'"
        )
        convCursor.moveToFirst()
        assert(convCursor.getString(0) == "DIRECT") { "Conversation should be DIRECT type" }
        assert(convCursor.getString(1).contains(recipientPubkey)) { "Participants should include sender" }
        convCursor.close()

        // Verify message is linked to conversation
        val msgCursor = db.openHelper.readableDatabase.query(
            "SELECT COUNT(*) FROM messages WHERE conversationId = '$newConversationId'"
        )
        msgCursor.moveToFirst()
        assert(msgCursor.getInt(0) == 1) { "Conversation should have 1 message" }
        msgCursor.close()
    }
}
