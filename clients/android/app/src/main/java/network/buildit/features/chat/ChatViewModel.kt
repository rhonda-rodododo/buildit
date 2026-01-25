package network.buildit.features.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.Reaction
import network.buildit.core.nostr.ReadReceipt
import network.buildit.core.nostr.TypingIndicator
import network.buildit.core.storage.MessageStatus
import network.buildit.core.storage.AttachmentDao
import network.buildit.core.storage.AttachmentEntity
import network.buildit.core.storage.AttachmentType
import network.buildit.core.storage.ContactDao
import network.buildit.core.storage.ConversationDao
import network.buildit.core.storage.ConversationEntity
import network.buildit.core.storage.MessageContentType
import network.buildit.core.storage.MessageDao
import network.buildit.core.storage.MessageEntity
import network.buildit.core.storage.ReactionDao
import network.buildit.core.storage.ReactionEntity
import network.buildit.core.storage.UploadStatus
import network.buildit.core.transport.TransportRouter
import network.buildit.core.transport.TransportStatus
import javax.inject.Inject

/**
 * ViewModel for the Chat feature.
 *
 * Manages:
 * - Conversation list
 * - Active conversation state
 * - Message sending
 * - Real-time message updates
 */
@HiltViewModel
class ChatViewModel @Inject constructor(
    private val conversationDao: ConversationDao,
    private val messageDao: MessageDao,
    private val contactDao: ContactDao,
    private val reactionDao: ReactionDao,
    private val attachmentDao: AttachmentDao,
    private val transportRouter: TransportRouter,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) : ViewModel() {

    private val _uiState = MutableStateFlow<ChatUiState>(ChatUiState.Loading)
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    /** Typing indicator state for the active conversation */
    private val _isTyping = MutableStateFlow<String?>(null)
    val isTyping: StateFlow<String?> = _isTyping.asStateFlow()

    private var currentConversationId: String? = null
    private var inputText: String = ""
    private var replyToMessage: MessageEntity? = null
    private var typingJob: Job? = null
    private var typingSubscriptionId: String? = null
    private var reactionSubscriptionId: String? = null
    private var lastTypingSentAt: Long = 0

    init {
        loadConversationList()
        observeIncomingMessages()
        observeTypingIndicators()
        observeReadReceipts()
        observeReactions()
        subscribeToReadReceipts()
    }

    /**
     * Loads the conversation list.
     */
    private fun loadConversationList() {
        viewModelScope.launch {
            combine(
                conversationDao.getAllConversations(),
                transportRouter.transportStatus
            ) { conversations, transportStatus ->
                val conversationsWithPreview = conversations.map { conversation ->
                    val lastMessage = conversation.lastMessageId?.let {
                        messageDao.getById(it)
                    }
                    val contactName = getContactName(conversation.participantPubkeys)

                    ConversationWithPreview(
                        conversation = conversation,
                        displayName = conversation.title ?: contactName,
                        lastMessagePreview = lastMessage?.content
                    )
                }

                ChatUiState.ConversationList(
                    conversations = conversationsWithPreview,
                    transportStatus = transportStatus
                )
            }.collect { state ->
                if (currentConversationId == null) {
                    _uiState.value = state
                }
            }
        }
    }

    /**
     * Observes incoming messages from the transport layer.
     */
    private fun observeIncomingMessages() {
        viewModelScope.launch {
            transportRouter.incomingMessages.collect { message ->
                // Process and store the incoming message
                handleIncomingMessage(message)
            }
        }
    }

    /**
     * Observes typing indicators from the Nostr client.
     */
    private fun observeTypingIndicators() {
        viewModelScope.launch {
            nostrClient.typingIndicators.collect { indicator ->
                // Only show typing indicator for active conversation's participants
                val conversationId = currentConversationId ?: return@collect
                val conversation = conversationDao.getById(conversationId) ?: return@collect
                val participants = parseParticipants(conversation.participantPubkeys)

                if (indicator.pubkey in participants && indicator.isActive()) {
                    // Get display name for the typing user
                    val contact = contactDao.getByPubkey(indicator.pubkey)
                    val displayName = contact?.displayName ?: indicator.pubkey.take(8) + "..."
                    _isTyping.value = displayName

                    // Clear typing indicator after 5 seconds
                    typingJob?.cancel()
                    typingJob = viewModelScope.launch {
                        delay(5000)
                        _isTyping.value = null
                    }
                }
            }
        }
    }

    /**
     * Parses participant pubkeys from JSON array string.
     */
    private fun parseParticipants(participantPubkeysJson: String): List<String> {
        return try {
            val pubkeys = org.json.JSONArray(participantPubkeysJson)
            (0 until pubkeys.length()).map { pubkeys.getString(it) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Subscribes to read receipts for messages we've sent.
     */
    private fun subscribeToReadReceipts() {
        nostrClient.subscribeToReadReceipts()
    }

    /**
     * Observes incoming read receipts and updates message status.
     */
    private fun observeReadReceipts() {
        viewModelScope.launch {
            nostrClient.readReceipts.collect { receipt ->
                // Update the message status to READ
                messageDao.updateStatus(receipt.messageId, MessageStatus.READ)
            }
        }
    }

    /**
     * Observes incoming reactions and stores them in the database.
     */
    private fun observeReactions() {
        viewModelScope.launch {
            nostrClient.reactions.collect { reaction ->
                // Store the reaction in the database
                val reactionEntity = ReactionEntity(
                    id = reaction.id,
                    messageId = reaction.messageId,
                    emoji = reaction.emoji,
                    reactorPubkey = reaction.reactorPubkey,
                    createdAt = reaction.timestamp * 1000 // Convert to millis
                )
                reactionDao.insert(reactionEntity)
            }
        }
    }

    /**
     * Sends read receipts for all unread messages in a conversation.
     */
    private suspend fun sendReadReceiptsForConversation(conversationId: String) {
        val ourPubkey = cryptoManager.getPublicKeyHex() ?: return
        val messages = messageDao.getUnreadMessagesForConversation(conversationId, ourPubkey)

        messages.forEach { message ->
            nostrClient.sendReadReceipt(message.id, message.senderPubkey)
        }
    }

    /**
     * Handles an incoming message.
     */
    private suspend fun handleIncomingMessage(message: network.buildit.core.transport.IncomingMessage) {
        // Find or create conversation
        val conversation = conversationDao.findDirectConversation(message.senderPubkey)
            ?: createConversationEntity(message.senderPubkey)

        // Store message
        val messageEntity = MessageEntity(
            id = message.id,
            conversationId = conversation.id,
            senderPubkey = message.senderPubkey,
            content = message.content,
            timestamp = message.timestamp
        )
        messageDao.insert(messageEntity)

        // Update conversation
        conversationDao.update(
            conversation.copy(
                lastMessageId = message.id,
                lastMessageAt = message.timestamp,
                unreadCount = conversation.unreadCount + 1,
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    /**
     * Creates a new conversation entity with a contact.
     */
    private suspend fun createConversationEntity(pubkey: String): ConversationEntity {
        val conversation = ConversationEntity(
            id = java.util.UUID.randomUUID().toString(),
            type = network.buildit.core.storage.ConversationType.DIRECT,
            participantPubkeys = "[\"$pubkey\"]"
        )
        conversationDao.insert(conversation)
        return conversation
    }

    /**
     * Opens a conversation.
     */
    fun openConversation(conversationId: String) {
        currentConversationId = conversationId
        _isTyping.value = null

        viewModelScope.launch {
            val conversation = conversationDao.getById(conversationId) ?: return@launch

            // Mark as read locally
            conversationDao.markAsRead(conversationId)

            // Send read receipts for unread messages
            sendReadReceiptsForConversation(conversationId)

            // Subscribe to typing indicators from conversation participants
            subscribeToTypingIndicators(conversation)

            combine(
                messageDao.getMessagesForConversation(conversationId),
                transportRouter.transportStatus
            ) { messages, transportStatus ->
                ChatUiState.ActiveConversation(
                    conversation = conversation,
                    messages = messages,
                    inputText = inputText,
                    isSending = false,
                    transportStatus = transportStatus,
                    replyToMessage = replyToMessage
                )
            }.collect { state ->
                if (currentConversationId == conversationId) {
                    _uiState.value = state
                }
            }
        }
    }

    /**
     * Subscribes to typing indicators from conversation participants.
     */
    private fun subscribeToTypingIndicators(conversation: ConversationEntity) {
        // Unsubscribe from previous conversation
        typingSubscriptionId?.let { nostrClient.unsubscribe(it) }

        // Subscribe to typing indicators from all participants
        val participants = parseParticipants(conversation.participantPubkeys)
        participants.firstOrNull()?.let { pubkey ->
            typingSubscriptionId = nostrClient.subscribeToTypingIndicators(pubkey)
        }
    }

    /**
     * Closes the active conversation.
     */
    fun closeConversation() {
        // Unsubscribe from typing indicators
        typingSubscriptionId?.let { nostrClient.unsubscribe(it) }
        typingSubscriptionId = null

        // Unsubscribe from reactions
        reactionSubscriptionId?.let { nostrClient.unsubscribe(it) }
        reactionSubscriptionId = null

        typingJob?.cancel()
        typingJob = null
        _isTyping.value = null

        currentConversationId = null
        inputText = ""
        replyToMessage = null
        loadConversationList()
    }

    /**
     * Sets a message to reply to.
     *
     * @param message The message to reply to, or null to clear
     */
    fun setReplyTo(message: MessageEntity?) {
        replyToMessage = message
        updateActiveConversationState()
    }

    /**
     * Clears the reply-to state.
     */
    fun clearReplyTo() {
        replyToMessage = null
        updateActiveConversationState()
    }

    /**
     * Gets the message being replied to by ID.
     *
     * @param messageId The ID of the original message
     * @return The original message, or null if not found
     */
    suspend fun getReplyToMessage(messageId: String): MessageEntity? {
        return messageDao.getById(messageId)
    }

    /**
     * Updates the message input text.
     */
    fun updateInput(text: String) {
        inputText = text
        updateActiveConversationState()

        // Send typing indicator if we haven't sent one recently (debounce 3 seconds)
        if (text.isNotBlank()) {
            val now = System.currentTimeMillis()
            if (now - lastTypingSentAt > 3000) {
                lastTypingSentAt = now
                sendTypingIndicator()
            }
        }
    }

    /**
     * Sends a typing indicator to the current conversation's participants.
     */
    private fun sendTypingIndicator() {
        val conversationId = currentConversationId ?: return

        viewModelScope.launch {
            val conversation = conversationDao.getById(conversationId) ?: return@launch
            val recipientPubkey = parseRecipient(conversation.participantPubkeys)
            if (recipientPubkey.isNotBlank()) {
                nostrClient.sendTypingIndicator(recipientPubkey, conversationId)
            }
        }
    }

    /**
     * Sends the current message.
     */
    fun sendMessage() {
        val text = inputText.trim()
        if (text.isBlank()) return

        val conversationId = currentConversationId ?: return

        viewModelScope.launch {
            // Update UI to show sending state
            updateActiveConversationState(isSending = true)

            val conversation = conversationDao.getById(conversationId) ?: return@launch

            // Parse recipient from conversation
            val recipientPubkey = parseRecipient(conversation.participantPubkeys)

            // Create and store message
            val messageId = java.util.UUID.randomUUID().toString()
            val timestamp = System.currentTimeMillis()

            val messageEntity = MessageEntity(
                id = messageId,
                conversationId = conversationId,
                senderPubkey = cryptoManager.getPublicKeyHex() ?: "",
                content = text,
                replyToId = replyToMessage?.id,
                timestamp = timestamp,
                status = network.buildit.core.storage.MessageStatus.PENDING
            )
            messageDao.insert(messageEntity)

            // Send via transport
            val result = transportRouter.sendMessage(recipientPubkey, text)

            // Update message status based on result
            val status = when {
                result.isSuccess -> {
                    when (result.getOrNull()?.status) {
                        network.buildit.core.transport.DeliveryStatus.SENT,
                        network.buildit.core.transport.DeliveryStatus.DELIVERED ->
                            network.buildit.core.storage.MessageStatus.SENT
                        network.buildit.core.transport.DeliveryStatus.QUEUED ->
                            network.buildit.core.storage.MessageStatus.PENDING
                        else -> network.buildit.core.storage.MessageStatus.FAILED
                    }
                }
                else -> network.buildit.core.storage.MessageStatus.FAILED
            }
            messageDao.updateStatus(messageId, status)

            // Update conversation
            conversationDao.update(
                conversation.copy(
                    lastMessageId = messageId,
                    lastMessageAt = timestamp,
                    updatedAt = timestamp
                )
            )

            // Clear input and reply state
            inputText = ""
            replyToMessage = null
            updateActiveConversationState(isSending = false)
        }
    }

    /**
     * Creates a new conversation with a given pubkey.
     *
     * @param pubkey The public key of the contact
     * @return The conversation ID
     */
    suspend fun createConversation(pubkey: String): String {
        val existing = conversationDao.findDirectConversation(pubkey)
        if (existing != null) {
            return existing.id
        }

        val conversation = ConversationEntity(
            id = java.util.UUID.randomUUID().toString(),
            type = network.buildit.core.storage.ConversationType.DIRECT,
            participantPubkeys = "[\"$pubkey\"]"
        )
        conversationDao.insert(conversation)
        return conversation.id
    }

    /**
     * Opens a group conversation by group ID.
     *
     * @param groupId The group ID
     */
    fun openGroupConversation(groupId: String) {
        viewModelScope.launch {
            // Find conversation for this group
            val conversation = conversationDao.findGroupConversation(groupId)
            if (conversation != null) {
                openConversation(conversation.id)
            }
        }
    }

    /**
     * Sends a reaction to a message.
     *
     * @param messageId The ID of the message to react to
     * @param emoji The reaction emoji (e.g., "👍", "❤️", "+")
     */
    fun sendReaction(messageId: String, emoji: String) {
        viewModelScope.launch {
            val message = messageDao.getById(messageId) ?: return@launch

            // Send via Nostr
            val success = nostrClient.sendReaction(messageId, message.senderPubkey, emoji)

            if (success) {
                // Store locally as well
                val ourPubkey = cryptoManager.getPublicKeyHex() ?: return@launch
                val reactionEntity = ReactionEntity(
                    id = java.util.UUID.randomUUID().toString(),
                    messageId = messageId,
                    emoji = emoji,
                    reactorPubkey = ourPubkey,
                    createdAt = System.currentTimeMillis()
                )
                reactionDao.insert(reactionEntity)
            }
        }
    }

    /**
     * Removes a reaction from a message.
     *
     * @param messageId The ID of the message
     * @param emoji The reaction emoji to remove
     */
    fun removeReaction(messageId: String, emoji: String) {
        viewModelScope.launch {
            val ourPubkey = cryptoManager.getPublicKeyHex() ?: return@launch
            reactionDao.deleteReaction(messageId, ourPubkey, emoji)
        }
    }

    /**
     * Gets reactions for a message.
     *
     * @param messageId The message ID
     * @return Flow of reactions for the message
     */
    fun getReactionsForMessage(messageId: String) = reactionDao.getReactionsForMessage(messageId)

    /**
     * Gets attachments for a message.
     *
     * @param messageId The message ID
     * @return Flow of attachments for the message
     */
    fun getAttachmentsForMessage(messageId: String) = attachmentDao.getAttachmentsForMessage(messageId)

    /**
     * Sends a message with an image attachment.
     *
     * @param localPath The local path to the image file
     * @param mimeType The MIME type of the image (e.g., "image/jpeg")
     * @param width Optional image width
     * @param height Optional image height
     */
    fun sendImageMessage(
        localPath: String,
        mimeType: String,
        width: Int? = null,
        height: Int? = null
    ) {
        val conversationId = currentConversationId ?: return

        viewModelScope.launch {
            // Update UI to show sending state
            updateActiveConversationState(isSending = true)

            val conversation = conversationDao.getById(conversationId) ?: return@launch
            val recipientPubkey = parseRecipient(conversation.participantPubkeys)

            // Create and store message
            val messageId = java.util.UUID.randomUUID().toString()
            val timestamp = System.currentTimeMillis()

            val messageEntity = MessageEntity(
                id = messageId,
                conversationId = conversationId,
                senderPubkey = cryptoManager.getPublicKeyHex() ?: "",
                content = "[Image]",
                contentType = MessageContentType.IMAGE,
                timestamp = timestamp,
                status = MessageStatus.PENDING
            )
            messageDao.insert(messageEntity)

            // Create attachment entity
            val attachmentId = java.util.UUID.randomUUID().toString()
            val fileName = localPath.substringAfterLast("/")
            val attachment = AttachmentEntity(
                id = attachmentId,
                messageId = messageId,
                type = AttachmentType.IMAGE,
                url = "", // Will be set after upload
                localPath = localPath,
                mimeType = mimeType,
                fileName = fileName,
                width = width,
                height = height,
                uploadStatus = UploadStatus.PENDING
            )
            attachmentDao.insert(attachment)

            // Update conversation
            conversationDao.update(
                conversation.copy(
                    lastMessageId = messageId,
                    lastMessageAt = timestamp,
                    updatedAt = timestamp
                )
            )

            // TODO: Implement actual upload to file host
            // For now, just mark as completed with local path as URL
            attachmentDao.updateUrlAndStatus(attachmentId, "file://$localPath", UploadStatus.COMPLETED)

            // Send message via transport (with attachment URL in content)
            val messageContent = "[Image: file://$localPath]"
            val result = transportRouter.sendMessage(recipientPubkey, messageContent)

            // Update message status based on result
            val status = when {
                result.isSuccess -> {
                    when (result.getOrNull()?.status) {
                        network.buildit.core.transport.DeliveryStatus.SENT,
                        network.buildit.core.transport.DeliveryStatus.DELIVERED ->
                            MessageStatus.SENT
                        network.buildit.core.transport.DeliveryStatus.QUEUED ->
                            MessageStatus.PENDING
                        else -> MessageStatus.FAILED
                    }
                }
                else -> MessageStatus.FAILED
            }
            messageDao.updateStatus(messageId, status)

            updateActiveConversationState(isSending = false)
        }
    }

    /**
     * Updates the active conversation UI state.
     */
    private fun updateActiveConversationState(isSending: Boolean = false) {
        val currentState = _uiState.value
        if (currentState is ChatUiState.ActiveConversation) {
            _uiState.value = currentState.copy(
                inputText = inputText,
                isSending = isSending,
                replyToMessage = replyToMessage
            )
        }
    }

    /**
     * Gets a contact's display name from their pubkey.
     */
    private suspend fun getContactName(participantPubkeysJson: String): String {
        return try {
            val pubkeys = org.json.JSONArray(participantPubkeysJson)
            if (pubkeys.length() > 0) {
                val pubkey = pubkeys.getString(0)
                contactDao.getByPubkey(pubkey)?.displayName ?: pubkey.take(8) + "..."
            } else {
                "Unknown"
            }
        } catch (e: Exception) {
            "Unknown"
        }
    }

    /**
     * Parses the recipient pubkey from participant list.
     */
    private fun parseRecipient(participantPubkeysJson: String): String {
        return try {
            val pubkeys = org.json.JSONArray(participantPubkeysJson)
            if (pubkeys.length() > 0) {
                pubkeys.getString(0)
            } else {
                ""
            }
        } catch (e: Exception) {
            ""
        }
    }
}

/**
 * UI state for the Chat screen.
 */
sealed class ChatUiState {
    data object Loading : ChatUiState()

    data class ConversationList(
        val conversations: List<ConversationWithPreview>,
        val transportStatus: TransportStatus
    ) : ChatUiState()

    data class ActiveConversation(
        val conversation: ConversationEntity,
        val messages: List<MessageEntity>,
        val inputText: String,
        val isSending: Boolean,
        val transportStatus: TransportStatus,
        val replyToMessage: MessageEntity? = null
    ) : ChatUiState()
}
