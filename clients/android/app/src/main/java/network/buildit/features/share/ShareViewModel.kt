package network.buildit.features.share

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.nostr.NostrClient
import network.buildit.core.storage.AttachmentDao
import network.buildit.core.storage.AttachmentEntity
import network.buildit.core.storage.AttachmentType
import network.buildit.core.storage.ContactDao
import network.buildit.core.storage.ContactEntity
import network.buildit.core.storage.ConversationDao
import network.buildit.core.storage.ConversationEntity
import network.buildit.core.storage.ConversationType
import network.buildit.core.storage.FileUploadService
import network.buildit.core.storage.GroupDao
import network.buildit.core.storage.GroupEntity
import network.buildit.core.storage.MessageContentType
import network.buildit.core.storage.MessageDao
import network.buildit.core.storage.MessageEntity
import network.buildit.core.storage.MessageStatus
import network.buildit.core.storage.UploadStatus
import network.buildit.core.transport.DeliveryStatus
import network.buildit.core.transport.MessageQueue
import network.buildit.core.transport.QueuedMessage
import network.buildit.core.transport.TransportRouter
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import javax.inject.Inject

/**
 * ViewModel for the Share Composer screen.
 *
 * Manages:
 * - Shared content (text, images, files)
 * - Recent conversations for quick selection
 * - Contact search for destination selection
 * - Message sending with encryption
 * - Offline message queuing
 */
@HiltViewModel
class ShareViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val conversationDao: ConversationDao,
    private val messageDao: MessageDao,
    private val contactDao: ContactDao,
    private val groupDao: GroupDao,
    private val attachmentDao: AttachmentDao,
    private val transportRouter: TransportRouter,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient,
    private val fileUploadService: FileUploadService,
    private val messageQueue: MessageQueue
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShareUiState())
    val uiState: StateFlow<ShareUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")

    private val sharedMedia = mutableListOf<SharedMediaItem>()
    private var sharedText: String? = null
    private var sharedSubject: String? = null

    init {
        loadRecentConversations()
        observeSearch()
    }

    /**
     * Loads recent conversations for quick destination selection.
     */
    private fun loadRecentConversations() {
        viewModelScope.launch {
            conversationDao.getAllConversations().collect { conversations ->
                val recentDestinations = conversations
                    .take(MAX_RECENT_DESTINATIONS)
                    .map { conversation ->
                        val displayName = conversation.title
                            ?: getConversationDisplayName(conversation)

                        val participants = parseParticipants(conversation.participantPubkeys)
                        val avatarUrl = resolveAvatarUrl(participants.firstOrNull())

                        ShareDestination(
                            id = conversation.id,
                            type = if (conversation.type == ConversationType.GROUP) {
                                DestinationType.GROUP
                            } else {
                                DestinationType.DIRECT
                            },
                            displayName = displayName,
                            avatarUrl = avatarUrl,
                            participantPubkeys = participants,
                            groupId = conversation.groupId
                        )
                    }

                _uiState.value = _uiState.value.copy(
                    recentDestinations = recentDestinations,
                    isLoading = false
                )
            }
        }
    }

    /**
     * Observes search query changes and filters contacts.
     */
    private fun observeSearch() {
        viewModelScope.launch {
            combine(
                contactDao.getAllContacts(),
                _searchQuery
            ) { contacts, query ->
                if (query.isBlank()) {
                    emptyList()
                } else {
                    contacts.filter { contact ->
                        contact.displayName?.contains(query, ignoreCase = true) == true ||
                                contact.nip05?.contains(query, ignoreCase = true) == true ||
                                contact.pubkey.contains(query, ignoreCase = true)
                    }.take(MAX_SEARCH_RESULTS)
                }
            }.collect { filteredContacts ->
                _uiState.value = _uiState.value.copy(
                    searchResults = filteredContacts.map { contact ->
                        ShareDestination(
                            id = contact.pubkey,
                            type = DestinationType.CONTACT,
                            displayName = contact.displayName ?: formatPubkey(contact.pubkey),
                            avatarUrl = contact.avatarUrl,
                            participantPubkeys = listOf(contact.pubkey)
                        )
                    }
                )
            }
        }
    }

    /**
     * Sets the shared text content.
     */
    fun setSharedText(text: String, subject: String? = null) {
        sharedText = text
        sharedSubject = subject

        _uiState.value = _uiState.value.copy(
            sharedContent = SharedContent(
                text = text,
                subject = subject,
                mediaItems = sharedMedia.toList()
            )
        )
    }

    /**
     * Adds a shared media item (image, file, etc.).
     */
    fun addSharedMedia(item: SharedMediaItem) {
        // Resolve file name and size from URI
        val resolvedItem = resolveMediaItemDetails(item)
        sharedMedia.add(resolvedItem)

        _uiState.value = _uiState.value.copy(
            sharedContent = SharedContent(
                text = sharedText,
                subject = sharedSubject,
                mediaItems = sharedMedia.toList()
            )
        )
    }

    /**
     * Removes a shared media item.
     */
    fun removeSharedMedia(item: SharedMediaItem) {
        sharedMedia.remove(item)

        _uiState.value = _uiState.value.copy(
            sharedContent = SharedContent(
                text = sharedText,
                subject = sharedSubject,
                mediaItems = sharedMedia.toList()
            )
        )
    }

    /**
     * Updates the additional message text.
     */
    fun updateMessageText(text: String) {
        _uiState.value = _uiState.value.copy(
            additionalMessage = text
        )
    }

    /**
     * Updates the search query.
     */
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    /**
     * Selects a destination for sharing.
     */
    fun selectDestination(destination: ShareDestination) {
        val currentSelected = _uiState.value.selectedDestinations.toMutableList()

        if (currentSelected.any { it.id == destination.id }) {
            // Deselect if already selected
            currentSelected.removeAll { it.id == destination.id }
        } else {
            // Add to selected
            currentSelected.add(destination)
        }

        _uiState.value = _uiState.value.copy(
            selectedDestinations = currentSelected
        )
    }

    /**
     * Clears all selected destinations.
     */
    fun clearSelectedDestinations() {
        _uiState.value = _uiState.value.copy(
            selectedDestinations = emptyList()
        )
    }

    /**
     * Sends the shared content to all selected destinations.
     */
    fun send() {
        val state = _uiState.value
        val destinations = state.selectedDestinations

        if (destinations.isEmpty()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSending = true)

            try {
                for (destination in destinations) {
                    sendToDestination(destination, state)
                }

                _uiState.value = _uiState.value.copy(
                    isSending = false,
                    sendComplete = true
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send shared content", e)
                _uiState.value = _uiState.value.copy(
                    isSending = false,
                    error = "Failed to send: ${e.message}"
                )
            }
        }
    }

    /**
     * Sends shared content to a single destination.
     */
    private suspend fun sendToDestination(
        destination: ShareDestination,
        state: ShareUiState
    ) {
        val ourPubkey = cryptoManager.getPublicKeyHex() ?: return

        // Find or create conversation
        val conversationId = when (destination.type) {
            DestinationType.DIRECT, DestinationType.CONTACT -> {
                val recipientPubkey = destination.participantPubkeys.firstOrNull() ?: return
                findOrCreateDirectConversation(recipientPubkey)
            }
            DestinationType.GROUP -> {
                destination.groupId?.let { groupId ->
                    conversationDao.findGroupConversation(groupId)?.id
                } ?: return
            }
        }

        val timestamp = System.currentTimeMillis()
        val recipientPubkeys = destination.participantPubkeys

        // Build message content
        val content = buildMessageContent(state)

        // Handle media items (upload each and send as separate messages or inline)
        if (sharedMedia.isNotEmpty()) {
            for (mediaItem in sharedMedia) {
                sendMediaMessage(
                    conversationId = conversationId,
                    mediaItem = mediaItem,
                    ourPubkey = ourPubkey,
                    recipientPubkeys = recipientPubkeys,
                    timestamp = timestamp
                )
            }
        }

        // Send text message if present
        if (content.isNotBlank()) {
            sendTextMessage(
                conversationId = conversationId,
                content = content,
                ourPubkey = ourPubkey,
                recipientPubkeys = recipientPubkeys,
                timestamp = timestamp
            )
        }
    }

    /**
     * Sends a text message.
     */
    private suspend fun sendTextMessage(
        conversationId: String,
        content: String,
        ourPubkey: String,
        recipientPubkeys: List<String>,
        timestamp: Long
    ) {
        val messageId = UUID.randomUUID().toString()

        // Create message entity
        val messageEntity = MessageEntity(
            id = messageId,
            conversationId = conversationId,
            senderPubkey = ourPubkey,
            content = content,
            contentType = MessageContentType.TEXT,
            timestamp = timestamp,
            status = MessageStatus.PENDING
        )
        messageDao.insert(messageEntity)

        // Update conversation
        updateConversation(conversationId, messageId, timestamp)

        // Send via transport for each recipient
        for (recipientPubkey in recipientPubkeys) {
            val result = transportRouter.sendMessage(recipientPubkey, content)

            val status = when {
                result.isSuccess -> {
                    when (result.getOrNull()?.status) {
                        DeliveryStatus.SENT, DeliveryStatus.DELIVERED -> MessageStatus.SENT
                        DeliveryStatus.QUEUED -> MessageStatus.PENDING
                        else -> MessageStatus.FAILED
                    }
                }
                else -> {
                    // Queue for later if send fails
                    queueForOfflineSending(messageId, recipientPubkey, content)
                    MessageStatus.PENDING
                }
            }
            messageDao.updateStatus(messageId, status)
        }
    }

    /**
     * Sends a media message (image, file, etc.).
     */
    private suspend fun sendMediaMessage(
        conversationId: String,
        mediaItem: SharedMediaItem,
        ourPubkey: String,
        recipientPubkeys: List<String>,
        timestamp: Long
    ) {
        val messageId = UUID.randomUUID().toString()
        val attachmentId = UUID.randomUUID().toString()

        // Copy file to app storage
        val localPath = copyUriToLocalStorage(mediaItem.uri, mediaItem.mimeType)
            ?: return

        // Determine content type
        val contentType = when (mediaItem.type) {
            SharedMediaType.IMAGE -> MessageContentType.IMAGE
            SharedMediaType.VIDEO, SharedMediaType.AUDIO, SharedMediaType.FILE -> MessageContentType.FILE
        }

        // Create message entity
        val messageEntity = MessageEntity(
            id = messageId,
            conversationId = conversationId,
            senderPubkey = ourPubkey,
            content = mediaItem.fileName ?: "[Attachment]",
            contentType = contentType,
            timestamp = timestamp,
            status = MessageStatus.PENDING
        )
        messageDao.insert(messageEntity)

        // Create attachment entity
        val attachmentEntity = AttachmentEntity(
            id = attachmentId,
            messageId = messageId,
            type = when (mediaItem.type) {
                SharedMediaType.IMAGE -> AttachmentType.IMAGE
                SharedMediaType.VIDEO -> AttachmentType.VIDEO
                SharedMediaType.AUDIO -> AttachmentType.AUDIO
                SharedMediaType.FILE -> AttachmentType.FILE
            },
            url = "",
            localPath = localPath,
            mimeType = mediaItem.mimeType,
            fileName = mediaItem.fileName,
            fileSize = mediaItem.fileSize,
            uploadStatus = UploadStatus.PENDING
        )
        attachmentDao.insert(attachmentEntity)

        // Update conversation
        updateConversation(conversationId, messageId, timestamp)

        // Upload file
        attachmentDao.updateUploadStatus(attachmentId, UploadStatus.UPLOADING)

        val uploadResult = fileUploadService.uploadFromUri(mediaItem.uri, mediaItem.mimeType)

        if (uploadResult.isSuccess) {
            val upload = uploadResult.getOrThrow()
            attachmentDao.updateUrlAndStatus(attachmentId, upload.url, UploadStatus.COMPLETED)

            // Send via transport with file URL
            for (recipientPubkey in recipientPubkeys) {
                val result = transportRouter.sendMessage(recipientPubkey, upload.url)

                val status = when {
                    result.isSuccess -> {
                        when (result.getOrNull()?.status) {
                            DeliveryStatus.SENT, DeliveryStatus.DELIVERED -> MessageStatus.SENT
                            DeliveryStatus.QUEUED -> MessageStatus.PENDING
                            else -> MessageStatus.FAILED
                        }
                    }
                    else -> {
                        queueForOfflineSending(messageId, recipientPubkey, upload.url)
                        MessageStatus.PENDING
                    }
                }
                messageDao.updateStatus(messageId, status)
            }
        } else {
            attachmentDao.updateUploadStatus(attachmentId, UploadStatus.FAILED)
            messageDao.updateStatus(messageId, MessageStatus.FAILED)
        }
    }

    /**
     * Queues a message for offline sending.
     */
    private suspend fun queueForOfflineSending(
        messageId: String,
        recipientPubkey: String,
        content: String
    ) {
        messageQueue.enqueue(
            QueuedMessage(
                id = messageId,
                recipientPubkey = recipientPubkey,
                content = content,
                timestamp = System.currentTimeMillis()
            )
        )
    }

    /**
     * Finds or creates a direct conversation with a recipient.
     */
    private suspend fun findOrCreateDirectConversation(recipientPubkey: String): String {
        val existing = conversationDao.findDirectConversation(recipientPubkey)
        if (existing != null) {
            return existing.id
        }

        val conversationId = UUID.randomUUID().toString()
        val conversation = ConversationEntity(
            id = conversationId,
            type = ConversationType.DIRECT,
            participantPubkeys = "[\"$recipientPubkey\"]"
        )
        conversationDao.insert(conversation)
        return conversationId
    }

    /**
     * Updates conversation with new message info.
     */
    private suspend fun updateConversation(
        conversationId: String,
        messageId: String,
        timestamp: Long
    ) {
        val conversation = conversationDao.getById(conversationId) ?: return
        conversationDao.update(
            conversation.copy(
                lastMessageId = messageId,
                lastMessageAt = timestamp,
                updatedAt = timestamp
            )
        )
    }

    /**
     * Builds the message content from shared data.
     */
    private fun buildMessageContent(state: ShareUiState): String {
        val parts = mutableListOf<String>()

        // Add subject if present
        sharedSubject?.let { subject ->
            if (subject.isNotBlank()) {
                parts.add(subject)
            }
        }

        // Add shared text
        sharedText?.let { text ->
            if (text.isNotBlank()) {
                parts.add(text)
            }
        }

        // Add additional message
        if (state.additionalMessage.isNotBlank()) {
            parts.add(state.additionalMessage)
        }

        return parts.joinToString("\n\n")
    }

    /**
     * Resolves media item details from URI.
     */
    private fun resolveMediaItemDetails(item: SharedMediaItem): SharedMediaItem {
        var fileName: String? = null
        var fileSize: Long? = null

        context.contentResolver.query(
            item.uri,
            arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
            null,
            null,
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)

                if (nameIndex >= 0) {
                    fileName = cursor.getString(nameIndex)
                }
                if (sizeIndex >= 0) {
                    fileSize = cursor.getLong(sizeIndex)
                }
            }
        }

        return item.copy(
            fileName = fileName ?: item.fileName,
            fileSize = fileSize ?: item.fileSize
        )
    }

    /**
     * Copies URI content to local app storage.
     */
    private fun copyUriToLocalStorage(uri: Uri, mimeType: String): String? {
        return try {
            val extension = mimeType.substringAfter("/").substringBefore(";")
            val fileName = "${UUID.randomUUID()}.$extension"
            val outputFile = File(context.cacheDir, fileName)

            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(outputFile).use { output ->
                    input.copyTo(output)
                }
            }

            outputFile.absolutePath
        } catch (e: Exception) {
            Log.e(TAG, "Failed to copy URI to local storage", e)
            null
        }
    }

    /**
     * Resolves avatar URL for a pubkey from the local contact database,
     * falling back to fetching from Nostr profile metadata (kind:0).
     */
    private suspend fun resolveAvatarUrl(pubkey: String?): String? {
        if (pubkey == null) return null

        // First try local contact database
        val contact = contactDao.getByPubkey(pubkey)
        if (contact?.avatarUrl != null) return contact.avatarUrl

        // Fall back to fetching from Nostr profile metadata (kind:0)
        return try {
            val profile = nostrClient.fetchProfile(pubkey)
            profile?.picture
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch profile for avatar: ${e.message}")
            null
        }
    }

    /**
     * Gets display name for a conversation.
     */
    private suspend fun getConversationDisplayName(conversation: ConversationEntity): String {
        val participants = parseParticipants(conversation.participantPubkeys)
        val firstParticipant = participants.firstOrNull() ?: return "Unknown"

        val contact = contactDao.getByPubkey(firstParticipant)
        return contact?.displayName ?: formatPubkey(firstParticipant)
    }

    /**
     * Parses participant pubkeys from JSON string.
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
     * Formats a public key for display.
     */
    private fun formatPubkey(pubkey: String): String {
        return if (pubkey.length > 16) {
            "${pubkey.take(8)}...${pubkey.takeLast(8)}"
        } else {
            pubkey
        }
    }

    /**
     * Clears any error state.
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    companion object {
        private const val TAG = "ShareViewModel"
        private const val MAX_RECENT_DESTINATIONS = 10
        private const val MAX_SEARCH_RESULTS = 20
    }
}

/**
 * UI state for the Share Composer screen.
 */
data class ShareUiState(
    val sharedContent: SharedContent = SharedContent(),
    val recentDestinations: List<ShareDestination> = emptyList(),
    val searchResults: List<ShareDestination> = emptyList(),
    val selectedDestinations: List<ShareDestination> = emptyList(),
    val searchQuery: String = "",
    val additionalMessage: String = "",
    val isLoading: Boolean = true,
    val isSending: Boolean = false,
    val sendComplete: Boolean = false,
    val error: String? = null
)

/**
 * Represents shared content to be sent.
 */
data class SharedContent(
    val text: String? = null,
    val subject: String? = null,
    val mediaItems: List<SharedMediaItem> = emptyList()
) {
    val hasContent: Boolean
        get() = !text.isNullOrBlank() || mediaItems.isNotEmpty()
}

/**
 * Represents a shared media item (image, file, etc.).
 */
data class SharedMediaItem(
    val uri: Uri,
    val mimeType: String,
    val type: SharedMediaType,
    val fileName: String? = null,
    val fileSize: Long? = null
)

/**
 * Type of shared media.
 */
enum class SharedMediaType {
    IMAGE,
    VIDEO,
    AUDIO,
    FILE
}

/**
 * Represents a destination for sharing.
 */
data class ShareDestination(
    val id: String,
    val type: DestinationType,
    val displayName: String,
    val avatarUrl: String? = null,
    val participantPubkeys: List<String> = emptyList(),
    val groupId: String? = null
)

/**
 * Type of share destination.
 */
enum class DestinationType {
    DIRECT,
    GROUP,
    CONTACT
}
