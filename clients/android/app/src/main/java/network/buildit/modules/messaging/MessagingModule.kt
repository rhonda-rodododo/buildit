package network.buildit.modules.messaging

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import kotlinx.serialization.json.Json
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.modules.BuildItModule
import network.buildit.core.modules.ModuleRoute
import network.buildit.core.nostr.NostrClient
import network.buildit.core.nostr.NostrEvent
import network.buildit.generated.schemas.DirectMessage
import network.buildit.generated.schemas.GroupMessage
import network.buildit.generated.schemas.Reaction
import network.buildit.generated.schemas.ReadReceipt
import network.buildit.modules.messaging.domain.MessagingUseCase
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Messaging module for BuildIt.
 *
 * Provides enhanced messaging features including:
 * - Direct messages (NIP-17)
 * - Group messages
 * - Read receipts
 * - Reactions
 * - Typing indicators
 */
class MessagingModule @Inject constructor(
    private val messagingUseCase: MessagingUseCase,
    private val cryptoManager: CryptoManager,
    private val nostrClient: NostrClient
) : BuildItModule {
    override val identifier: String = "messaging"
    override val version: String = "1.0.0"
    override val displayName: String = "Messaging"
    override val description: String = "Enhanced messaging with read receipts, reactions, and typing indicators"

    private var subscriptionId: String? = null

    override suspend fun initialize() {
        // Subscribe to messaging-related events
        subscriptionId = nostrClient.subscribe(
            network.buildit.core.nostr.NostrFilter(
                kinds = getHandledEventKinds(),
                since = System.currentTimeMillis() / 1000 - 86400 // Last 24 hours
            )
        )
    }

    override suspend fun shutdown() {
        subscriptionId?.let { nostrClient.unsubscribe(it) }
    }

    override suspend fun handleEvent(event: NostrEvent): Boolean {
        return when (event.kind) {
            1059 -> { // NIP-17 gift wrap
                handleGiftWrap(event)
                true
            }
            NostrClient.KIND_REACTION -> {
                handleReaction(event)
                true
            }
            NostrClient.KIND_READ_RECEIPT -> {
                handleReadReceipt(event)
                true
            }
            NostrClient.KIND_TYPING_INDICATOR -> {
                // Handled by NostrClient's typing indicator flow
                true
            }
            NostrClient.KIND_CHANNEL_MESSAGE -> {
                handleGroupMessage(event)
                true
            }
            else -> false
        }
    }

    override fun getNavigationRoutes(): List<ModuleRoute> {
        return listOf(
            ModuleRoute(
                route = "messages",
                title = "Messages",
                icon = Icons.Default.Chat,
                showInNavigation = true,
                content = { args ->
                    // ConversationsScreen()
                }
            ),
            ModuleRoute(
                route = "messages/{conversationId}",
                title = "Chat",
                icon = null,
                showInNavigation = false,
                content = { args ->
                    val conversationId = args["conversationId"] ?: return@ModuleRoute
                    // ChatScreen(conversationId = conversationId)
                }
            )
        )
    }

    override fun getHandledEventKinds(): List<Int> {
        return listOf(
            1059, // NIP-17 gift wrap
            NostrClient.KIND_REACTION,
            NostrClient.KIND_READ_RECEIPT,
            NostrClient.KIND_TYPING_INDICATOR,
            NostrClient.KIND_CHANNEL_MESSAGE
        )
    }

    /**
     * Handles incoming NIP-17 gift-wrapped messages.
     */
    private suspend fun handleGiftWrap(event: NostrEvent) {
        try {
            val giftWrap = network.buildit.core.crypto.GiftWrapEvent(
                id = event.id,
                pubkey = event.pubkey,
                createdAt = event.createdAt,
                kind = event.kind,
                tags = event.tags,
                content = event.content,
                sig = event.sig
            )

            val unwrapped = cryptoManager.unwrapGiftWrap(giftWrap) ?: return

            // Parse the unwrapped content as a DirectMessage
            val directMessage = try {
                Json.decodeFromString<DirectMessage>(unwrapped.content)
            } catch (e: Exception) {
                android.util.Log.e("MessagingModule", "Failed to parse direct message", e)
                return
            }

            // Save to local storage
            // This would typically be done through the existing chat infrastructure
            // For now, just log
            android.util.Log.d("MessagingModule", "Received direct message from ${unwrapped.senderPubkey}")
        } catch (e: Exception) {
            android.util.Log.e("MessagingModule", "Failed to handle gift wrap", e)
        }
    }

    /**
     * Handles incoming reaction events.
     */
    private suspend fun handleReaction(event: NostrEvent) {
        try {
            val messageId = event.tags.find { it.firstOrNull() == "e" }?.getOrNull(1) ?: return

            val reaction = Reaction(
                v = "1.0.0",
                targetID = messageId,
                emoji = event.content.ifEmpty { "+" }
            )

            // Save locally (this would integrate with existing chat data)
            android.util.Log.d("MessagingModule", "Reaction ${reaction.emoji} on message $messageId")
        } catch (e: Exception) {
            android.util.Log.e("MessagingModule", "Failed to handle reaction", e)
        }
    }

    /**
     * Handles incoming read receipt events.
     */
    private suspend fun handleReadReceipt(event: NostrEvent) {
        try {
            val receipt = Json.decodeFromString<ReadReceipt>(event.content)

            // Save locally
            android.util.Log.d("MessagingModule", "Read receipt for conversation ${receipt.conversationID}")
        } catch (e: Exception) {
            android.util.Log.e("MessagingModule", "Failed to handle read receipt", e)
        }
    }

    /**
     * Handles incoming group messages.
     */
    private suspend fun handleGroupMessage(event: NostrEvent) {
        try {
            val groupMessage = Json.decodeFromString<GroupMessage>(event.content)

            // Extract group ID from tags
            val groupId = event.tags.find { it.firstOrNull() == "e" && it.getOrNull(3) == "root" }
                ?.getOrNull(1) ?: return

            // Save locally
            android.util.Log.d("MessagingModule", "Group message in $groupId")
        } catch (e: Exception) {
            android.util.Log.e("MessagingModule", "Failed to handle group message", e)
        }
    }
}

/**
 * Hilt module for Messaging dependencies.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class MessagingHiltModule {
    @Binds
    @IntoSet
    abstract fun bindMessagingModule(impl: MessagingModule): BuildItModule
}
