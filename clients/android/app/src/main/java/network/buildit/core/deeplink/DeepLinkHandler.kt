package network.buildit.core.deeplink

import android.content.Intent
import android.net.Uri
import android.util.Log
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Handles parsing and validation of deep links from various sources.
 *
 * Supported URI schemes:
 * - buildit:// - Custom scheme for in-app navigation
 * - nostr:// - Nostr protocol URIs (NIP-21)
 * - https://buildit.network/... - App Links for web-to-app navigation
 *
 * Example URIs:
 * - buildit://chat
 * - buildit://profile/npub1...
 * - buildit://group/abc123
 * - nostr:npub1...
 * - nostr:nevent1...
 * - https://buildit.network/p/npub1...
 * - https://buildit.network/e/note1...
 */
@Singleton
class DeepLinkHandler @Inject constructor() {

    companion object {
        private const val TAG = "DeepLinkHandler"

        // Supported schemes
        const val SCHEME_BUILDIT = "buildit"
        const val SCHEME_NOSTR = "nostr"
        const val SCHEME_HTTPS = "https"

        // App Link host
        const val HOST_BUILDIT_NETWORK = "buildit.network"
        const val HOST_WWW_BUILDIT_NETWORK = "www.buildit.network"

        // BuildIt scheme paths
        const val PATH_CHAT = "chat"
        const val PATH_DM = "dm"
        const val PATH_PROFILE = "profile"
        const val PATH_GROUP = "group"
        const val PATH_EVENT = "event"
        const val PATH_CALENDAR_EVENT = "calendar"
        const val PATH_SETTINGS = "settings"
        const val PATH_SYNC = "sync"
        const val PATH_DOCUMENT = "document"
        const val PATH_PROPOSAL = "proposal"
        const val PATH_MUTUAL_AID = "mutualaid"
        const val PATH_SOCIAL = "social"

        // App Link paths
        const val WEB_PATH_PROFILE = "p"
        const val WEB_PATH_EVENT = "e"
        const val WEB_PATH_GROUP = "g"
        const val WEB_PATH_CALENDAR = "calendar"
        const val WEB_PATH_DOCUMENT = "doc"
    }

    /**
     * Parses a deep link from an Intent.
     *
     * @param intent The incoming intent containing the deep link
     * @return The parsed DeepLinkDestination, or null if no valid deep link
     */
    fun parseIntent(intent: Intent?): DeepLinkDestination? {
        if (intent == null) return null

        val uri = intent.data ?: return null
        return parseUri(uri)
    }

    /**
     * Parses a deep link URI string.
     *
     * @param uriString The URI string to parse
     * @return The parsed DeepLinkDestination
     */
    fun parseUriString(uriString: String): DeepLinkDestination {
        return try {
            val uri = Uri.parse(uriString)
            parseUri(uri)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse URI: $uriString", e)
            DeepLinkDestination.Invalid(uriString, "Malformed URI: ${e.message}")
        }
    }

    /**
     * Parses a deep link URI.
     *
     * @param uri The URI to parse
     * @return The parsed DeepLinkDestination
     */
    fun parseUri(uri: Uri): DeepLinkDestination {
        Log.d(TAG, "Parsing deep link: $uri")

        return when (uri.scheme?.lowercase()) {
            SCHEME_BUILDIT -> parseBuilditUri(uri)
            SCHEME_NOSTR -> parseNostrUri(uri)
            SCHEME_HTTPS, "http" -> parseAppLink(uri)
            else -> DeepLinkDestination.Invalid(
                uri = uri.toString(),
                reason = "Unsupported scheme: ${uri.scheme}"
            )
        }
    }

    /**
     * Parses a buildit:// URI.
     *
     * Format: buildit://[path]/[identifier]?[params]
     *
     * Examples:
     * - buildit://chat
     * - buildit://dm/npub1...
     * - buildit://profile/npub1...
     * - buildit://group/abc123
     * - buildit://event/note1...
     * - buildit://settings
     */
    private fun parseBuilditUri(uri: Uri): DeepLinkDestination {
        val path = uri.host ?: uri.pathSegments.firstOrNull()
            ?: return DeepLinkDestination.Chat

        val identifier = uri.pathSegments.getOrNull(
            if (uri.host != null) 0 else 1
        )

        return when (path.lowercase()) {
            PATH_CHAT -> DeepLinkDestination.Chat

            PATH_DM -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "DM requires a recipient")
                }
                val pubkey = resolveNostrIdentifier(identifier)
                    ?: return DeepLinkDestination.Invalid(uri.toString(), "Invalid pubkey: $identifier")
                DeepLinkDestination.DirectMessage(pubkey)
            }

            PATH_PROFILE -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Profile requires a pubkey")
                }
                val pubkey = resolveNostrIdentifier(identifier)
                    ?: return DeepLinkDestination.Invalid(uri.toString(), "Invalid pubkey: $identifier")
                DeepLinkDestination.Profile(pubkey)
            }

            PATH_GROUP -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Group requires an ID")
                }
                DeepLinkDestination.Group(identifier)
            }

            PATH_EVENT, PATH_SOCIAL -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Event requires an ID")
                }
                val eventId = resolveEventIdentifier(identifier)
                    ?: return DeepLinkDestination.Invalid(uri.toString(), "Invalid event ID: $identifier")
                DeepLinkDestination.Event(eventId)
            }

            PATH_CALENDAR_EVENT -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Calendar event requires an ID")
                }
                DeepLinkDestination.CalendarEvent(identifier)
            }

            PATH_SETTINGS -> DeepLinkDestination.Settings

            PATH_SYNC -> DeepLinkDestination.DeviceSync

            PATH_DOCUMENT -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Document requires an ID")
                }
                DeepLinkDestination.Document(identifier)
            }

            PATH_PROPOSAL -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Proposal requires an ID")
                }
                DeepLinkDestination.Proposal(identifier)
            }

            PATH_MUTUAL_AID -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Mutual aid request requires an ID")
                }
                DeepLinkDestination.MutualAidRequest(identifier)
            }

            else -> DeepLinkDestination.Invalid(uri.toString(), "Unknown path: $path")
        }
    }

    /**
     * Parses a nostr:// URI (NIP-21).
     *
     * The URI contains a bech32-encoded entity (npub, note, nevent, nprofile, naddr).
     */
    private fun parseNostrUri(uri: Uri): DeepLinkDestination {
        // nostr: URIs have the bech32 as the "host" or full string after scheme
        val bech32 = uri.schemeSpecificPart
            ?: return DeepLinkDestination.Invalid(uri.toString(), "Empty nostr URI")

        val entity = NostrURIParser.parse(bech32)
        return NostrURIParser.toDeepLinkDestination(entity)
    }

    /**
     * Parses an App Link (https://buildit.network/...).
     *
     * Supported paths:
     * - /p/[npub|hex] - Profile
     * - /e/[note|nevent|hex] - Event
     * - /g/[groupId] - Group
     * - /calendar/[eventId] - Calendar event
     * - /doc/[docId] - Document
     */
    private fun parseAppLink(uri: Uri): DeepLinkDestination {
        val host = uri.host?.lowercase()
        if (host != HOST_BUILDIT_NETWORK && host != HOST_WWW_BUILDIT_NETWORK) {
            return DeepLinkDestination.Invalid(uri.toString(), "Unknown host: $host")
        }

        val pathSegments = uri.pathSegments
        if (pathSegments.isEmpty()) {
            return DeepLinkDestination.Chat
        }

        val path = pathSegments[0].lowercase()
        val identifier = pathSegments.getOrNull(1)

        return when (path) {
            WEB_PATH_PROFILE -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Profile requires identifier")
                }
                val pubkey = resolveNostrIdentifier(identifier)
                    ?: return DeepLinkDestination.Invalid(uri.toString(), "Invalid pubkey: $identifier")
                DeepLinkDestination.Profile(pubkey)
            }

            WEB_PATH_EVENT -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Event requires identifier")
                }
                val eventId = resolveEventIdentifier(identifier)
                    ?: return DeepLinkDestination.Invalid(uri.toString(), "Invalid event ID: $identifier")
                DeepLinkDestination.Event(eventId)
            }

            WEB_PATH_GROUP -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Group requires identifier")
                }
                DeepLinkDestination.Group(identifier)
            }

            WEB_PATH_CALENDAR -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Calendar event requires identifier")
                }
                DeepLinkDestination.CalendarEvent(identifier)
            }

            WEB_PATH_DOCUMENT -> {
                if (identifier == null) {
                    return DeepLinkDestination.Invalid(uri.toString(), "Document requires identifier")
                }
                DeepLinkDestination.Document(identifier)
            }

            "chat" -> DeepLinkDestination.Chat
            "settings" -> DeepLinkDestination.Settings
            "sync", "device-sync" -> DeepLinkDestination.DeviceSync

            else -> DeepLinkDestination.Invalid(uri.toString(), "Unknown path: $path")
        }
    }

    /**
     * Resolves a Nostr identifier (npub, nprofile, or hex) to a hex pubkey.
     */
    private fun resolveNostrIdentifier(identifier: String): String? {
        // Check if it's already a hex pubkey
        if (identifier.length == 64 && identifier.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) {
            return identifier.lowercase()
        }

        // Try parsing as nostr entity
        return when (val entity = NostrURIParser.parse(identifier)) {
            is NostrURIParser.NostrEntity.Pubkey -> entity.hex
            else -> null
        }
    }

    /**
     * Resolves an event identifier (note, nevent, or hex) to a hex event ID.
     */
    private fun resolveEventIdentifier(identifier: String): String? {
        // Check if it's already a hex event ID
        if (identifier.length == 64 && identifier.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) {
            return identifier.lowercase()
        }

        // Try parsing as nostr entity
        return when (val entity = NostrURIParser.parse(identifier)) {
            is NostrURIParser.NostrEntity.EventId -> entity.hex
            else -> null
        }
    }

    /**
     * Validates an intent to ensure it contains a valid deep link.
     *
     * @param intent The intent to validate
     * @return True if the intent contains a valid deep link
     */
    fun isValidDeepLink(intent: Intent?): Boolean {
        val destination = parseIntent(intent)
        return destination != null && destination !is DeepLinkDestination.Invalid
    }

    /**
     * Creates a buildit:// URI for a destination.
     *
     * @param destination The destination to create a URI for
     * @return The URI string, or null if the destination cannot be represented as a URI
     */
    fun createUri(destination: DeepLinkDestination): String? = when (destination) {
        is DeepLinkDestination.Chat -> "$SCHEME_BUILDIT://$PATH_CHAT"
        is DeepLinkDestination.DirectMessage -> "$SCHEME_BUILDIT://$PATH_DM/${destination.pubkey}"
        is DeepLinkDestination.Profile -> "$SCHEME_BUILDIT://$PATH_PROFILE/${destination.pubkey}"
        is DeepLinkDestination.Event -> "$SCHEME_BUILDIT://$PATH_EVENT/${destination.eventId}"
        is DeepLinkDestination.Group -> "$SCHEME_BUILDIT://$PATH_GROUP/${destination.groupId}"
        is DeepLinkDestination.CalendarEvent -> "$SCHEME_BUILDIT://$PATH_CALENDAR_EVENT/${destination.eventId}"
        is DeepLinkDestination.Settings -> "$SCHEME_BUILDIT://$PATH_SETTINGS"
        is DeepLinkDestination.DeviceSync -> "$SCHEME_BUILDIT://$PATH_SYNC"
        is DeepLinkDestination.Document -> "$SCHEME_BUILDIT://$PATH_DOCUMENT/${destination.documentId}"
        is DeepLinkDestination.Proposal -> "$SCHEME_BUILDIT://$PATH_PROPOSAL/${destination.proposalId}"
        is DeepLinkDestination.MutualAidRequest -> "$SCHEME_BUILDIT://$PATH_MUTUAL_AID/${destination.requestId}"
        is DeepLinkDestination.SocialPost -> "$SCHEME_BUILDIT://$PATH_SOCIAL/${destination.postId}"
        is DeepLinkDestination.Invalid -> null
    }
}
