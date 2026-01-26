package network.buildit.core.deeplink

/**
 * Sealed class representing all possible deep link destinations in the BuildIt app.
 *
 * This provides a type-safe way to represent navigation targets from deep links,
 * whether they come from buildit://, nostr://, or https://buildit.network URLs.
 */
sealed class DeepLinkDestination {

    /**
     * Navigate to the main chat screen.
     */
    data object Chat : DeepLinkDestination()

    /**
     * Navigate to a direct message conversation with a specific user.
     *
     * @param pubkey The hex-encoded public key of the user
     * @param relayHints Optional list of relay URLs where the user can be found
     */
    data class DirectMessage(
        val pubkey: String,
        val relayHints: List<String> = emptyList()
    ) : DeepLinkDestination()

    /**
     * Navigate to a user's profile.
     *
     * @param pubkey The hex-encoded public key of the user
     * @param relayHints Optional list of relay URLs where the profile can be found
     */
    data class Profile(
        val pubkey: String,
        val relayHints: List<String> = emptyList()
    ) : DeepLinkDestination()

    /**
     * Navigate to view a specific Nostr event/note.
     *
     * @param eventId The hex-encoded event ID
     * @param authorPubkey Optional author public key (from nevent TLV)
     * @param kind Optional event kind (from nevent TLV)
     * @param relayHints Optional list of relay URLs where the event can be found
     */
    data class Event(
        val eventId: String,
        val authorPubkey: String? = null,
        val kind: Int? = null,
        val relayHints: List<String> = emptyList()
    ) : DeepLinkDestination()

    /**
     * Navigate to a group chat.
     *
     * @param groupId The group identifier
     */
    data class Group(
        val groupId: String
    ) : DeepLinkDestination()

    /**
     * Navigate to an event (calendar event, not Nostr event).
     *
     * @param eventId The calendar event identifier
     */
    data class CalendarEvent(
        val eventId: String
    ) : DeepLinkDestination()

    /**
     * Navigate to the settings screen.
     */
    data object Settings : DeepLinkDestination()

    /**
     * Navigate to device sync screen.
     */
    data object DeviceSync : DeepLinkDestination()

    /**
     * Navigate to a specific document.
     *
     * @param documentId The document identifier
     */
    data class Document(
        val documentId: String
    ) : DeepLinkDestination()

    /**
     * Navigate to a governance proposal.
     *
     * @param proposalId The proposal identifier
     */
    data class Proposal(
        val proposalId: String
    ) : DeepLinkDestination()

    /**
     * Navigate to a mutual aid request.
     *
     * @param requestId The request identifier
     */
    data class MutualAidRequest(
        val requestId: String
    ) : DeepLinkDestination()

    /**
     * Navigate to a social feed post/thread.
     *
     * @param postId The post identifier
     */
    data class SocialPost(
        val postId: String
    ) : DeepLinkDestination()

    /**
     * Represents an invalid or unrecognized deep link.
     *
     * @param uri The original URI that could not be parsed
     * @param reason Human-readable reason for the failure
     */
    data class Invalid(
        val uri: String,
        val reason: String
    ) : DeepLinkDestination()

    /**
     * Checks if this destination requires authentication before navigating.
     */
    fun requiresAuthentication(): Boolean = when (this) {
        is Chat, is DirectMessage, is Group, is Settings, is DeviceSync,
        is Document, is Proposal, is MutualAidRequest -> true
        is Profile, is Event, is CalendarEvent, is SocialPost, is Invalid -> false
    }
}
