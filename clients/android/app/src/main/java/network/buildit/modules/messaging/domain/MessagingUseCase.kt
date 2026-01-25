package network.buildit.modules.messaging.domain

import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.core.ble.BLEManager
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.UnsignedNostrEvent
import network.buildit.core.modules.ModuleResult
import network.buildit.core.modules.toModuleResult
import network.buildit.core.nostr.NostrClient
import network.buildit.generated.schemas.DirectMessage
import network.buildit.generated.schemas.GroupMessage
import network.buildit.generated.schemas.Reaction
import network.buildit.generated.schemas.ReadReceipt
import network.buildit.modules.messaging.data.MessagingRepository
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Use case for messaging module operations.
 *
 * Handles:
 * - Sending direct and group messages with NIP-17 encryption
 * - Read receipts
 * - Reactions
 * - Typing indicators
 */
@Singleton
class MessagingUseCase @Inject constructor(
    private val repository: MessagingRepository,
    private val cryptoManager: CryptoManager,
    private val bleManager: BLEManager,
    private val nostrClient: NostrClient
) {
    /**
     * Sends a direct message using NIP-17 gift wrap encryption.
     *
     * @param message The direct message to send
     * @param recipientPubkey The recipient's public key
     * @return Result indicating success or failure
     */
    suspend fun sendDirectMessage(
        message: DirectMessage,
        recipientPubkey: String
    ): ModuleResult<Unit> {
        return runCatching {
            val messageId = java.util.UUID.randomUUID().toString()
            val conversationId = recipientPubkey // Direct conversation ID is the pubkey

            // Save message locally first
            repository.saveDirectMessage(messageId, conversationId, message)

            // Serialize message
            val content = Json.encodeToString(message)

            // Create NIP-17 gift wrap
            val giftWrap = cryptoManager.createGiftWrap(recipientPubkey, content)
                ?: throw IllegalStateException("Failed to create gift wrap")

            // Publish to Nostr
            val published = nostrClient.publishEvent(
                network.buildit.core.nostr.NostrEvent(
                    id = giftWrap.id,
                    pubkey = giftWrap.pubkey,
                    createdAt = giftWrap.createdAt,
                    kind = giftWrap.kind,
                    tags = giftWrap.tags,
                    content = giftWrap.content,
                    sig = giftWrap.sig
                )
            )

            if (!published) {
                throw IllegalStateException("Failed to publish message to Nostr")
            }

            // Also attempt BLE delivery for offline support
            tryBleDelivery(recipientPubkey, content)
        }.toModuleResult()
    }

    /**
     * Sends a group message (encrypted to group members).
     *
     * @param message The group message to send
     * @param groupId The group ID
     * @return Result indicating success or failure
     */
    suspend fun sendGroupMessage(
        message: GroupMessage,
        groupId: String
    ): ModuleResult<Unit> {
        return runCatching {
            val messageId = java.util.UUID.randomUUID().toString()

            // Save message locally
            repository.saveGroupMessage(messageId, groupId, message)

            // Serialize message
            val content = Json.encodeToString(message)

            // For group messages, we publish to a group channel (NIP-28 style)
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val nostrEvent = UnsignedNostrEvent(
                pubkey = pubkey,
                createdAt = System.currentTimeMillis() / 1000,
                kind = NostrClient.KIND_CHANNEL_MESSAGE,
                tags = listOf(
                    listOf("e", groupId, "", "root"),
                    message.threadID?.let { listOf("e", it, "", "reply") }
                ).filterNotNull(),
                content = content
            )

            val signed = cryptoManager.signEvent(nostrEvent)
                ?: throw IllegalStateException("Failed to sign event")

            val published = nostrClient.publishEvent(
                network.buildit.core.nostr.NostrEvent(
                    id = signed.id,
                    pubkey = signed.pubkey,
                    createdAt = signed.createdAt,
                    kind = signed.kind,
                    tags = signed.tags,
                    content = signed.content,
                    sig = signed.sig
                )
            )

            if (!published) {
                throw IllegalStateException("Failed to publish message")
            }
        }.toModuleResult()
    }

    /**
     * Marks a message as read.
     *
     * @param messageId The message ID
     * @param conversationId The conversation ID
     * @return Result containing the read receipt
     */
    suspend fun markAsRead(
        messageId: String,
        conversationId: String
    ): ModuleResult<ReadReceipt> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            val receipt = ReadReceipt(
                v = "1.0.0",
                conversationID = conversationId,
                lastRead = messageId,
                readAt = System.currentTimeMillis() / 1000
            )

            // Save locally
            repository.saveReadReceipt(receipt, pubkey)

            // Publish to Nostr
            publishReadReceipt(receipt)

            receipt
        }.toModuleResult()
    }

    /**
     * Gets read receipts for a message.
     *
     * @param messageId The message ID
     * @return Flow of read receipts
     */
    fun getReadReceipts(messageId: String): Flow<List<ReadReceipt>> {
        return repository.getReadReceiptsForMessage(messageId)
    }

    /**
     * Adds a reaction to a message.
     *
     * @param reaction The reaction to add
     * @param messageId The target message ID
     * @return Result indicating success
     */
    suspend fun addReaction(
        reaction: Reaction,
        messageId: String
    ): ModuleResult<Unit> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            // Save locally
            repository.saveReaction(reaction, pubkey)

            // Publish to Nostr (using NIP-25 reaction event)
            val nostrEvent = UnsignedNostrEvent(
                pubkey = pubkey,
                createdAt = System.currentTimeMillis() / 1000,
                kind = NostrClient.KIND_REACTION,
                tags = listOf(
                    listOf("e", messageId)
                ),
                content = reaction.emoji
            )

            val signed = cryptoManager.signEvent(nostrEvent)
                ?: throw IllegalStateException("Failed to sign reaction")

            nostrClient.publishEvent(
                network.buildit.core.nostr.NostrEvent(
                    id = signed.id,
                    pubkey = signed.pubkey,
                    createdAt = signed.createdAt,
                    kind = signed.kind,
                    tags = signed.tags,
                    content = signed.content,
                    sig = signed.sig
                )
            )
        }.toModuleResult()
    }

    /**
     * Gets reactions for a message.
     *
     * @param messageId The message ID
     * @return Flow of reactions
     */
    fun getReactions(messageId: String): Flow<List<Reaction>> {
        return repository.getReactionsForMessage(messageId)
    }

    /**
     * Removes a reaction from a message.
     *
     * @param messageId The message ID
     * @param emoji The emoji to remove
     * @return Result indicating success
     */
    suspend fun removeReaction(
        messageId: String,
        emoji: String
    ): ModuleResult<Unit> {
        return runCatching {
            val pubkey = cryptoManager.getPublicKeyHex()
                ?: throw IllegalStateException("No public key available")

            repository.deleteReaction(messageId, pubkey, emoji)

            // Note: NIP-25 doesn't have a delete mechanism, reactions expire
        }.toModuleResult()
    }

    /**
     * Sends a typing indicator.
     *
     * @param conversationId The conversation ID
     * @param typing Whether currently typing
     * @return Result indicating success
     */
    suspend fun sendTypingIndicator(
        conversationId: String,
        typing: Boolean = true
    ): ModuleResult<Unit> {
        return runCatching {
            // For direct messages, conversationId is the recipient pubkey
            nostrClient.sendTypingIndicator(conversationId, conversationId)
        }.toModuleResult()
    }

    /**
     * Observes typing indicators for a conversation.
     *
     * @param conversationId The conversation ID
     * @return Flow of typing indicators
     */
    fun observeTypingIndicators(conversationId: String): Flow<network.buildit.core.nostr.TypingIndicator> {
        // Subscribe to typing indicators and filter by conversation
        return nostrClient.typingIndicators
    }

    /**
     * Attempts to deliver a message via BLE for offline support.
     */
    private suspend fun tryBleDelivery(recipientPubkey: String, content: String) {
        try {
            // BLE delivery is best-effort
            // The TransportRouter would handle the actual delivery
            // For now, this is a placeholder
        } catch (e: Exception) {
            // Log but don't fail the operation
            android.util.Log.w("MessagingUseCase", "BLE delivery failed", e)
        }
    }

    /**
     * Publishes a read receipt to Nostr.
     */
    private suspend fun publishReadReceipt(receipt: ReadReceipt) {
        val pubkey = cryptoManager.getPublicKeyHex() ?: return

        val content = Json.encodeToString(receipt)

        val nostrEvent = UnsignedNostrEvent(
            pubkey = pubkey,
            createdAt = receipt.readAt ?: (System.currentTimeMillis() / 1000),
            kind = NostrClient.KIND_READ_RECEIPT,
            tags = listOf(
                listOf("e", receipt.lastRead)
            ),
            content = content
        )

        val signed = cryptoManager.signEvent(nostrEvent) ?: return

        nostrClient.publishEvent(
            network.buildit.core.nostr.NostrEvent(
                id = signed.id,
                pubkey = signed.pubkey,
                createdAt = signed.createdAt,
                kind = signed.kind,
                tags = signed.tags,
                content = signed.content,
                sig = signed.sig
            )
        )
    }
}
