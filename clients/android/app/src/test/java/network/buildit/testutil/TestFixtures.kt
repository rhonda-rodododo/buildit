package network.buildit.testutil

import android.bluetooth.BluetoothDevice
import io.mockk.every
import io.mockk.mockk
import network.buildit.core.ble.DiscoveredDevice
import network.buildit.core.ble.MeshMessage
import network.buildit.core.ble.ReceivedMessage
import network.buildit.core.ble.RoutingEntry
import network.buildit.core.crypto.EncryptedData
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import network.buildit.core.nostr.RelayConfig
import network.buildit.core.storage.ContactEntity
import network.buildit.core.storage.ConversationEntity
import network.buildit.core.storage.ConversationType
import network.buildit.core.storage.MessageContentType
import network.buildit.core.storage.MessageEntity
import network.buildit.core.storage.MessageStatus
import network.buildit.core.transport.DeliveryStatus
import network.buildit.core.transport.IncomingMessage
import network.buildit.core.transport.SendResult
import network.buildit.core.transport.Transport
import network.buildit.core.transport.TransportStatus
import java.util.UUID

/**
 * Test fixtures for BuildIt unit tests.
 * Provides factory methods for creating test data objects.
 */
object TestFixtures {

    // ============== Crypto Test Data ==============

    const val TEST_PUBLIC_KEY_HEX = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    const val TEST_PUBLIC_KEY_HEX_2 = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"
    const val TEST_PRIVATE_KEY_HEX = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

    val testPublicKeyBytes: ByteArray
        get() = TEST_PUBLIC_KEY_HEX.hexToByteArray()

    val testPrivateKeyBytes: ByteArray
        get() = TEST_PRIVATE_KEY_HEX.hexToByteArray()

    fun createEncryptedData(
        ciphertext: ByteArray = "encrypted_data".toByteArray(),
        iv: ByteArray = ByteArray(12) { it.toByte() }
    ): EncryptedData = EncryptedData(ciphertext, iv)

    // ============== BLE Test Data ==============

    const val TEST_DEVICE_ADDRESS = "AA:BB:CC:DD:EE:FF"
    const val TEST_DEVICE_ADDRESS_2 = "11:22:33:44:55:66"

    fun createMeshMessage(
        id: String = UUID.randomUUID().toString(),
        senderPublicKey: String = TEST_PUBLIC_KEY_HEX,
        recipientPublicKey: String = TEST_PUBLIC_KEY_HEX_2,
        payload: ByteArray = "test message".toByteArray(),
        hopCount: Int = 0,
        timestamp: Long = System.currentTimeMillis()
    ): MeshMessage = MeshMessage(
        id = id,
        senderPublicKey = senderPublicKey,
        recipientPublicKey = recipientPublicKey,
        payload = payload,
        hopCount = hopCount,
        timestamp = timestamp
    )

    fun createReceivedMessage(
        senderAddress: String = TEST_DEVICE_ADDRESS,
        data: ByteArray = "received_data".toByteArray()
    ): ReceivedMessage = ReceivedMessage(
        senderAddress = senderAddress,
        data = data
    )

    fun createRoutingEntry(
        publicKey: String = TEST_PUBLIC_KEY_HEX,
        deviceAddress: String = TEST_DEVICE_ADDRESS,
        hopCount: Int = 1,
        lastSeen: Long = System.currentTimeMillis()
    ): RoutingEntry = RoutingEntry(
        publicKey = publicKey,
        deviceAddress = deviceAddress,
        hopCount = hopCount,
        lastSeen = lastSeen
    )

    // ============== Nostr Test Data ==============

    const val TEST_NOSTR_EVENT_ID = "event123456789abcdef"
    const val TEST_RELAY_URL = "wss://relay.test.com"
    const val TEST_RELAY_URL_2 = "wss://relay2.test.com"

    fun createNostrEvent(
        id: String = TEST_NOSTR_EVENT_ID,
        pubkey: String = TEST_PUBLIC_KEY_HEX,
        createdAt: Long = System.currentTimeMillis() / 1000,
        kind: Int = 4, // Encrypted DM
        tags: List<List<String>> = listOf(listOf("p", TEST_PUBLIC_KEY_HEX_2)),
        content: String = "encrypted_content",
        sig: String = "signature"
    ): NostrEvent = NostrEvent(
        id = id,
        pubkey = pubkey,
        createdAt = createdAt,
        kind = kind,
        tags = tags,
        content = content,
        sig = sig
    )

    fun createNostrFilter(
        ids: List<String>? = null,
        authors: List<String>? = null,
        kinds: List<Int>? = listOf(4, 14),
        since: Long? = null,
        until: Long? = null,
        limit: Int? = 100
    ): NostrFilter = NostrFilter(
        ids = ids,
        authors = authors,
        kinds = kinds,
        since = since,
        until = until,
        limit = limit
    )

    fun createRelayConfig(
        url: String = TEST_RELAY_URL,
        read: Boolean = true,
        write: Boolean = true
    ): RelayConfig = RelayConfig(
        url = url,
        read = read,
        write = write
    )

    // ============== Storage Test Data ==============

    const val TEST_CONVERSATION_ID = "conv_123"
    const val TEST_MESSAGE_ID = "msg_456"
    const val TEST_CONTACT_PUBKEY = TEST_PUBLIC_KEY_HEX

    fun createContactEntity(
        pubkey: String = TEST_CONTACT_PUBKEY,
        displayName: String? = "Test Contact",
        avatarUrl: String? = null,
        nip05: String? = "test@example.com",
        about: String? = "A test contact",
        isBlocked: Boolean = false,
        isTrusted: Boolean = false,
        lastSeenAt: Long? = System.currentTimeMillis(),
        createdAt: Long = System.currentTimeMillis(),
        updatedAt: Long = System.currentTimeMillis()
    ): ContactEntity = ContactEntity(
        pubkey = pubkey,
        displayName = displayName,
        avatarUrl = avatarUrl,
        nip05 = nip05,
        about = about,
        isBlocked = isBlocked,
        isTrusted = isTrusted,
        lastSeenAt = lastSeenAt,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    fun createConversationEntity(
        id: String = TEST_CONVERSATION_ID,
        type: ConversationType = ConversationType.DIRECT,
        participantPubkeys: String = "[\"$TEST_PUBLIC_KEY_HEX\"]",
        groupId: String? = null,
        title: String? = null,
        lastMessageId: String? = null,
        lastMessageAt: Long? = null,
        unreadCount: Int = 0,
        isPinned: Boolean = false,
        isMuted: Boolean = false,
        createdAt: Long = System.currentTimeMillis(),
        updatedAt: Long = System.currentTimeMillis()
    ): ConversationEntity = ConversationEntity(
        id = id,
        type = type,
        participantPubkeys = participantPubkeys,
        groupId = groupId,
        title = title,
        lastMessageId = lastMessageId,
        lastMessageAt = lastMessageAt,
        unreadCount = unreadCount,
        isPinned = isPinned,
        isMuted = isMuted,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    fun createMessageEntity(
        id: String = TEST_MESSAGE_ID,
        conversationId: String = TEST_CONVERSATION_ID,
        senderPubkey: String = TEST_PUBLIC_KEY_HEX,
        content: String = "Test message content",
        contentType: MessageContentType = MessageContentType.TEXT,
        replyToId: String? = null,
        status: MessageStatus = MessageStatus.SENT,
        timestamp: Long = System.currentTimeMillis(),
        receivedAt: Long = System.currentTimeMillis(),
        readAt: Long? = null
    ): MessageEntity = MessageEntity(
        id = id,
        conversationId = conversationId,
        senderPubkey = senderPubkey,
        content = content,
        contentType = contentType,
        replyToId = replyToId,
        status = status,
        timestamp = timestamp,
        receivedAt = receivedAt,
        readAt = readAt
    )

    // ============== Transport Test Data ==============

    fun createTransportStatus(
        bleAvailable: Boolean = false,
        nostrAvailable: Boolean = true
    ): TransportStatus = TransportStatus(
        bleAvailable = bleAvailable,
        nostrAvailable = nostrAvailable
    )

    fun createIncomingMessage(
        id: String = UUID.randomUUID().toString(),
        senderPubkey: String = TEST_PUBLIC_KEY_HEX,
        content: String = "Incoming test message",
        timestamp: Long = System.currentTimeMillis(),
        transport: Transport = Transport.NOSTR
    ): IncomingMessage = IncomingMessage(
        id = id,
        senderPubkey = senderPubkey,
        content = content,
        timestamp = timestamp,
        transport = transport
    )

    fun createSendResult(
        messageId: String = UUID.randomUUID().toString(),
        transport: Transport? = Transport.NOSTR,
        status: DeliveryStatus = DeliveryStatus.SENT
    ): SendResult = SendResult(
        messageId = messageId,
        transport = transport,
        status = status
    )

    // ============== Discovered Devices ==============

    fun createDiscoveredDevice(
        address: String = TEST_DEVICE_ADDRESS,
        name: String? = "BuildIt Device",
        rssi: Int = -60,
        publicKey: String? = TEST_PUBLIC_KEY_HEX
    ): DiscoveredDevice {
        val mockDevice = mockk<BluetoothDevice>()
        every { mockDevice.address } returns address
        every { mockDevice.name } returns name
        return DiscoveredDevice(
            bluetoothDevice = mockDevice,
            publicKey = publicKey,
            rssi = rssi
        )
    }

    // ============== Utility Extensions ==============

    private fun String.hexToByteArray(): ByteArray {
        check(length % 2 == 0) { "Hex string must have even length" }
        return chunked(2)
            .map { it.toInt(16).toByte() }
            .toByteArray()
    }
}
