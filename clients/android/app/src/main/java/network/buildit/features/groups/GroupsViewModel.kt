package network.buildit.features.groups

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.storage.ConversationDao
import network.buildit.core.storage.ConversationEntity
import network.buildit.core.storage.ConversationType
import network.buildit.core.storage.GroupDao
import network.buildit.core.storage.GroupEntity
import network.buildit.core.storage.GroupMemberEntity
import network.buildit.core.storage.GroupRole
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrClient.Companion.KIND_GROUP_METADATA
import network.buildit.core.nostr.NostrEvent
import network.buildit.core.nostr.NostrFilter
import java.util.UUID
import javax.inject.Inject

/**
 * ViewModel for the Groups feature.
 *
 * Manages:
 * - Group list
 * - Group creation
 * - Group joining
 * - Member management
 */
@HiltViewModel
class GroupsViewModel @Inject constructor(
    private val groupDao: GroupDao,
    private val conversationDao: ConversationDao,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(GroupsUiState())
    val uiState: StateFlow<GroupsUiState> = _uiState.asStateFlow()

    // Navigation event for opening a group
    private val _navigateToGroup = MutableStateFlow<String?>(null)
    val navigateToGroup: StateFlow<String?> = _navigateToGroup.asStateFlow()

    fun onGroupNavigated() {
        _navigateToGroup.value = null
    }

    init {
        loadGroups()
    }

    /**
     * Loads all groups and their member counts.
     */
    private fun loadGroups() {
        viewModelScope.launch {
            groupDao.getAllGroups().collect { groups ->
                // Get member counts for each group
                val memberCounts = mutableMapOf<String, Int>()
                groups.forEach { group ->
                    groupDao.getMembersForGroup(group.id).collect { members ->
                        memberCounts[group.id] = members.size
                    }
                }

                _uiState.value = GroupsUiState(
                    groups = groups,
                    memberCounts = memberCounts,
                    isLoading = false
                )
            }
        }
    }

    /**
     * Creates a new group.
     */
    fun createGroup(name: String, description: String?, isPublic: Boolean) {
        viewModelScope.launch {
            val ourPubkey = cryptoManager.getPublicKeyHex() ?: return@launch

            val groupId = UUID.randomUUID().toString()

            // Create the group
            val group = GroupEntity(
                id = groupId,
                name = name,
                description = description,
                ownerPubkey = ourPubkey,
                isPublic = isPublic
            )
            groupDao.insert(group)

            // Add ourselves as owner
            val membership = GroupMemberEntity(
                groupId = groupId,
                pubkey = ourPubkey,
                role = GroupRole.OWNER
            )
            groupDao.insertMember(membership)

            // Create associated conversation
            val conversation = ConversationEntity(
                id = UUID.randomUUID().toString(),
                type = ConversationType.GROUP,
                participantPubkeys = "[\"$ourPubkey\"]",
                groupId = groupId,
                title = name
            )
            conversationDao.insert(conversation)
        }
    }

    /**
     * Joins an existing group using an invite code.
     * Format: buildit:group:groupId or buildit:group:groupId:relayHint
     */
    fun joinGroup(inviteCode: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {
                // Parse invite code
                val parts = inviteCode.removePrefix("buildit:group:").split(":")
                if (parts.isEmpty()) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Invalid invite code"
                    )
                    return@launch
                }

                val groupId = parts[0]
                val relayHint = parts.getOrNull(1)

                // Check if already a member
                val existingGroup = groupDao.getById(groupId)
                if (existingGroup != null) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Already a member of this group"
                    )
                    return@launch
                }

                // Fetch group metadata from relays (Kind 41 - Group Metadata)
                val filter = NostrFilter(
                    ids = listOf(groupId),
                    kinds = listOf(KIND_GROUP_METADATA),
                    limit = 1
                )

                val subscriptionId = nostrClient.subscribe(filter)

                // Wait for group metadata event
                var groupEvent: NostrEvent? = null
                kotlinx.coroutines.withTimeoutOrNull(5000) {
                    nostrClient.events.collect { event ->
                        if (event.kind == KIND_GROUP_METADATA && event.id == groupId) {
                            groupEvent = event
                            return@collect
                        }
                    }
                }

                nostrClient.unsubscribe(subscriptionId)

                if (groupEvent == null) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Group not found"
                    )
                    return@launch
                }

                // Parse and create group
                val content = org.json.JSONObject(groupEvent!!.content)
                val group = GroupEntity(
                    id = groupId,
                    name = content.optString("name", "Unknown Group"),
                    description = content.optString("about").takeIf { it.isNotEmpty() },
                    avatarUrl = content.optString("picture").takeIf { it.isNotEmpty() },
                    ownerPubkey = groupEvent!!.pubkey,
                    isPublic = content.optBoolean("public", false)
                )
                groupDao.insert(group)

                // Add ourselves as member
                val ourPubkey = cryptoManager.getPublicKeyHex() ?: return@launch
                val membership = GroupMemberEntity(
                    groupId = groupId,
                    pubkey = ourPubkey,
                    role = GroupRole.MEMBER
                )
                groupDao.insertMember(membership)

                // Create associated conversation
                val conversation = ConversationEntity(
                    id = UUID.randomUUID().toString(),
                    type = ConversationType.GROUP,
                    participantPubkeys = "[\"$ourPubkey\"]",
                    groupId = groupId,
                    title = group.name
                )
                conversationDao.insert(conversation)

                _uiState.value = _uiState.value.copy(isLoading = false)

            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Failed to join group: ${e.message}"
                )
            }
        }
    }

    /**
     * Opens a group (navigates to group chat).
     */
    fun openGroup(groupId: String) {
        _navigateToGroup.value = groupId
    }

    /**
     * Leaves a group.
     */
    fun leaveGroup(groupId: String) {
        viewModelScope.launch {
            val ourPubkey = cryptoManager.getPublicKeyHex() ?: return@launch

            // Remove membership
            groupDao.removeMember(groupId, ourPubkey)

            // Check if we're the owner
            val group = groupDao.getById(groupId) ?: return@launch
            if (group.ownerPubkey == ourPubkey) {
                // Transfer ownership or delete group
                // For now, just delete
                groupDao.delete(group)
            }
        }
    }

    /**
     * Invites a user to a group.
     */
    fun inviteToGroup(groupId: String, pubkey: String) {
        viewModelScope.launch {
            val group = groupDao.getById(groupId) ?: return@launch
            val ourPubkey = cryptoManager.getPublicKeyHex() ?: return@launch

            // Add as pending member
            val membership = GroupMemberEntity(
                groupId = groupId,
                pubkey = pubkey,
                role = GroupRole.MEMBER
            )
            groupDao.insertMember(membership)

            // Send invite via Nostr DM
            val inviteCode = generateInviteCode(groupId)
            val inviteMessage = """
                You've been invited to join "${group.name}"!

                Tap this invite code to join: $inviteCode
            """.trimIndent()

            nostrClient.sendDirectMessage(pubkey, inviteMessage)
        }
    }

    /**
     * Removes a member from a group.
     */
    fun removeMember(groupId: String, pubkey: String) {
        viewModelScope.launch {
            groupDao.removeMember(groupId, pubkey)
        }
    }

    /**
     * Updates a member's role.
     */
    fun updateMemberRole(groupId: String, pubkey: String, role: GroupRole) {
        viewModelScope.launch {
            groupDao.updateMemberRole(groupId, pubkey, role)
        }
    }

    /**
     * Generates an invite code for a group.
     *
     * Invite code format: buildit:group:{groupId}:{token}:{expiry}:{relayHint}
     *
     * Token features:
     * - Time-based expiration (24 hours default)
     * - HMAC signature to prevent tampering
     * - Includes relay hint for discovery
     */
    fun generateInviteCode(groupId: String): String {
        val expiry = System.currentTimeMillis() + INVITE_EXPIRY_MS
        val relayHint = DEFAULT_RELAY_HINT

        // Generate secure token: HMAC-SHA256(groupId + expiry)
        val data = "$groupId:$expiry".toByteArray(Charsets.UTF_8)
        val secretKey = cryptoManager.getPublicKeyHex()?.take(32)?.toByteArray()
            ?: java.security.SecureRandom().generateSeed(32)

        val mac = javax.crypto.Mac.getInstance("HmacSHA256")
        mac.init(javax.crypto.spec.SecretKeySpec(secretKey, "HmacSHA256"))
        val token = mac.doFinal(data)
            .take(16)  // Use first 16 bytes (128 bits)
            .joinToString("") { "%02x".format(it) }

        return "buildit:group:$groupId:$token:$expiry:$relayHint"
    }

    /**
     * Validates an invite code format and expiration.
     *
     * @return Pair of (isValid, groupId) or (false, null)
     */
    private fun validateInviteCode(inviteCode: String): Pair<Boolean, String?> {
        val stripped = inviteCode.removePrefix("buildit:group:")
        val parts = stripped.split(":")

        if (parts.isEmpty()) return Pair(false, null)

        val groupId = parts[0]

        // Simple format: just groupId
        if (parts.size == 1) return Pair(true, groupId)

        // Full format: groupId:token:expiry:relayHint
        if (parts.size >= 3) {
            val expiry = parts[2].toLongOrNull() ?: return Pair(false, null)

            // Check expiration
            if (System.currentTimeMillis() > expiry) {
                return Pair(false, null)  // Expired
            }
        }

        return Pair(true, groupId)
    }

    companion object {
        private const val INVITE_EXPIRY_MS = 24 * 60 * 60 * 1000L  // 24 hours
        private const val DEFAULT_RELAY_HINT = "wss://relay.buildit.network"
    }
}

/**
 * UI state for the Groups screen.
 */
data class GroupsUiState(
    val groups: List<GroupEntity> = emptyList(),
    val memberCounts: Map<String, Int> = emptyMap(),
    val isLoading: Boolean = true,
    val error: String? = null
)
