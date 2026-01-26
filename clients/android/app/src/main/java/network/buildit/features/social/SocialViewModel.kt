package network.buildit.features.social

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.storage.ContactDao
import java.util.UUID
import javax.inject.Inject

/**
 * ViewModel for Social features (activity feed, posts, reactions).
 *
 * Implements NIP-01 kind 1 (text notes) for microblogging.
 */
@HiltViewModel
class SocialViewModel @Inject constructor(
    private val nostrClient: NostrClient,
    private val cryptoManager: CryptoManager,
    private val contactDao: ContactDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(SocialUiState())
    val uiState: StateFlow<SocialUiState> = _uiState.asStateFlow()

    private val _posts = MutableStateFlow<List<Post>>(emptyList())
    val posts: StateFlow<List<Post>> = _posts.asStateFlow()

    init {
        loadFeed()
    }

    /**
     * Loads the activity feed from followed contacts.
     */
    fun loadFeed() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                // Get followed contacts
                val contacts = contactDao.getAllContactsSync()
                val pubkeys = contacts.map { it.pubkey }

                // Subscribe to kind 1 events from contacts
                nostrClient.subscribeToKind1(pubkeys) { event ->
                    val post = eventToPost(event)
                    if (post != null) {
                        val currentPosts = _posts.value.toMutableList()
                        if (currentPosts.none { it.id == post.id }) {
                            currentPosts.add(0, post)
                            currentPosts.sortByDescending { it.createdAt }
                            _posts.value = currentPosts.take(100) // Keep last 100
                        }
                    }
                }

                _uiState.value = _uiState.value.copy(isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message
                )
            }
        }
    }

    /**
     * Creates a new post (NIP-01 kind 1 event).
     */
    fun createPost(content: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPosting = true)

            try {
                val event = nostrClient.createKind1Event(content)
                nostrClient.publishEvent(event)

                // Add to local feed
                val post = eventToPost(event)
                if (post != null) {
                    val currentPosts = _posts.value.toMutableList()
                    currentPosts.add(0, post)
                    _posts.value = currentPosts
                }

                _uiState.value = _uiState.value.copy(isPosting = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isPosting = false,
                    error = e.message
                )
            }
        }
    }

    /**
     * Creates a reply to a post.
     */
    fun replyToPost(parentId: String, content: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPosting = true)

            try {
                val event = nostrClient.createReplyEvent(content, parentId)
                nostrClient.publishEvent(event)

                // Reload the thread
                loadReplies(parentId)

                _uiState.value = _uiState.value.copy(isPosting = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isPosting = false,
                    error = e.message
                )
            }
        }
    }

    /**
     * Reacts to a post (NIP-25 kind 7 event).
     */
    fun reactToPost(postId: String, emoji: String = "+") {
        viewModelScope.launch {
            try {
                val event = nostrClient.createReactionEvent(postId, emoji)
                nostrClient.publishEvent(event)

                // Update local reaction count
                val currentPosts = _posts.value.toMutableList()
                val index = currentPosts.indexOfFirst { it.id == postId }
                if (index >= 0) {
                    val post = currentPosts[index]
                    currentPosts[index] = post.copy(
                        reactionCount = post.reactionCount + 1,
                        userReacted = true
                    )
                    _posts.value = currentPosts
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    /**
     * Loads replies to a specific post.
     */
    fun loadReplies(postId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loadingReplies = true)

            try {
                nostrClient.subscribeToReplies(postId) { event ->
                    val reply = eventToPost(event)
                    if (reply != null) {
                        // Update the post's reply count
                        val currentPosts = _posts.value.toMutableList()
                        val index = currentPosts.indexOfFirst { it.id == postId }
                        if (index >= 0) {
                            val post = currentPosts[index]
                            val replies = post.replies.toMutableList()
                            if (replies.none { it.id == reply.id }) {
                                replies.add(reply)
                                currentPosts[index] = post.copy(
                                    replies = replies,
                                    replyCount = replies.size
                                )
                                _posts.value = currentPosts
                            }
                        }
                    }
                }

                _uiState.value = _uiState.value.copy(loadingReplies = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    loadingReplies = false,
                    error = e.message
                )
            }
        }
    }

    /**
     * Converts a Nostr event to a Post model.
     */
    private suspend fun eventToPost(event: NostrEvent): Post? {
        if (event.kind != 1) return null

        val contact = contactDao.getByPubkey(event.pubkey)

        return Post(
            id = event.id,
            content = event.content,
            authorPubkey = event.pubkey,
            authorName = contact?.displayName,
            authorAvatar = contact?.avatarUrl,
            createdAt = event.createdAt,
            replyToId = event.tags.find { it.firstOrNull() == "e" }?.getOrNull(1),
            reactionCount = 0, // Will be updated by subscription
            replyCount = 0,
            userReacted = false,
            replies = emptyList()
        )
    }

    /**
     * Clears any error state.
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    /**
     * Refreshes the feed.
     */
    fun refresh() {
        _posts.value = emptyList()
        loadFeed()
    }
}

/**
 * UI state for Social features.
 */
data class SocialUiState(
    val isLoading: Boolean = false,
    val isPosting: Boolean = false,
    val loadingReplies: Boolean = false,
    val error: String? = null
)

/**
 * Represents a social post (kind 1 event).
 */
data class Post(
    val id: String,
    val content: String,
    val authorPubkey: String,
    val authorName: String?,
    val authorAvatar: String?,
    val createdAt: Long,
    val replyToId: String?,
    val reactionCount: Int,
    val replyCount: Int,
    val userReacted: Boolean,
    val replies: List<Post>
)
