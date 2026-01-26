package network.buildit.core.deeplink

import network.buildit.core.crypto.Bech32

/**
 * Parser for Nostr URIs (nostr:// scheme) following NIP-19 and NIP-21.
 *
 * Supports:
 * - npub: Public keys
 * - note: Event IDs
 * - nevent: Event with additional metadata (author, relays, kind)
 * - nprofile: Profile with relay hints
 * - naddr: Parameterized replaceable events
 *
 * TLV (Type-Length-Value) encoding for nevent, nprofile, naddr:
 * - Type 0: special (depends on bech32 prefix)
 * - Type 1: relay
 * - Type 2: author (32-byte pubkey)
 * - Type 3: kind (32-bit big-endian integer)
 */
object NostrURIParser {

    // TLV types as defined in NIP-19
    private const val TLV_SPECIAL = 0
    private const val TLV_RELAY = 1
    private const val TLV_AUTHOR = 2
    private const val TLV_KIND = 3

    /**
     * Parsed result from a Nostr URI.
     */
    sealed class NostrEntity {
        /**
         * A public key (npub or from nprofile).
         */
        data class Pubkey(
            val hex: String,
            val relayHints: List<String> = emptyList()
        ) : NostrEntity()

        /**
         * A note/event ID (note or nevent).
         */
        data class EventId(
            val hex: String,
            val authorPubkey: String? = null,
            val kind: Int? = null,
            val relayHints: List<String> = emptyList()
        ) : NostrEntity()

        /**
         * An addressable/replaceable event (naddr).
         */
        data class Address(
            val identifier: String,
            val pubkey: String,
            val kind: Int,
            val relayHints: List<String> = emptyList()
        ) : NostrEntity()

        /**
         * Invalid or unrecognized entity.
         */
        data class Invalid(val reason: String) : NostrEntity()
    }

    /**
     * Parses a Nostr URI (nostr:npub..., nostr:note..., etc.) or bare bech32 string.
     *
     * @param uri The Nostr URI or bech32 string to parse
     * @return The parsed NostrEntity
     */
    fun parse(uri: String): NostrEntity {
        // Remove nostr: prefix if present
        val bech32 = uri.removePrefix("nostr:")
            .removePrefix("NOSTR:")
            .trim()

        if (bech32.isEmpty()) {
            return NostrEntity.Invalid("Empty URI")
        }

        return when {
            bech32.startsWith("npub", ignoreCase = true) -> parseNpub(bech32)
            bech32.startsWith("note", ignoreCase = true) -> parseNote(bech32)
            bech32.startsWith("nevent", ignoreCase = true) -> parseNevent(bech32)
            bech32.startsWith("nprofile", ignoreCase = true) -> parseNprofile(bech32)
            bech32.startsWith("naddr", ignoreCase = true) -> parseNaddr(bech32)
            bech32.startsWith("nsec", ignoreCase = true) -> NostrEntity.Invalid("Private keys (nsec) should not be shared via deep links")
            else -> NostrEntity.Invalid("Unknown Nostr entity type")
        }
    }

    /**
     * Parses an npub (public key).
     */
    private fun parseNpub(bech32: String): NostrEntity {
        val hex = Bech32.npubToHex(bech32)
            ?: return NostrEntity.Invalid("Invalid npub encoding")
        return NostrEntity.Pubkey(hex)
    }

    /**
     * Parses a note (event ID).
     */
    private fun parseNote(bech32: String): NostrEntity {
        val hex = Bech32.noteToHex(bech32)
            ?: return NostrEntity.Invalid("Invalid note encoding")
        return NostrEntity.EventId(hex)
    }

    /**
     * Parses an nevent (event with TLV metadata).
     */
    private fun parseNevent(bech32: String): NostrEntity {
        val decoded = Bech32.decode(bech32)
            ?: return NostrEntity.Invalid("Invalid nevent encoding")

        if (decoded.hrp != "nevent") {
            return NostrEntity.Invalid("Expected nevent, got ${decoded.hrp}")
        }

        val tlv = parseTLV(decoded.data)
            ?: return NostrEntity.Invalid("Invalid TLV data in nevent")

        val eventIdBytes = tlv[TLV_SPECIAL]?.firstOrNull()
        if (eventIdBytes == null || eventIdBytes.size != 32) {
            return NostrEntity.Invalid("nevent missing or invalid event ID")
        }

        val eventId = eventIdBytes.toHexString()
        val relays = tlv[TLV_RELAY]?.mapNotNull { it.toUtf8String() } ?: emptyList()
        val authorPubkey = tlv[TLV_AUTHOR]?.firstOrNull()?.takeIf { it.size == 32 }?.toHexString()
        val kind = tlv[TLV_KIND]?.firstOrNull()?.toInt32BigEndian()

        return NostrEntity.EventId(
            hex = eventId,
            authorPubkey = authorPubkey,
            kind = kind,
            relayHints = relays
        )
    }

    /**
     * Parses an nprofile (profile with TLV relay hints).
     */
    private fun parseNprofile(bech32: String): NostrEntity {
        val decoded = Bech32.decode(bech32)
            ?: return NostrEntity.Invalid("Invalid nprofile encoding")

        if (decoded.hrp != "nprofile") {
            return NostrEntity.Invalid("Expected nprofile, got ${decoded.hrp}")
        }

        val tlv = parseTLV(decoded.data)
            ?: return NostrEntity.Invalid("Invalid TLV data in nprofile")

        val pubkeyBytes = tlv[TLV_SPECIAL]?.firstOrNull()
        if (pubkeyBytes == null || pubkeyBytes.size != 32) {
            return NostrEntity.Invalid("nprofile missing or invalid pubkey")
        }

        val pubkey = pubkeyBytes.toHexString()
        val relays = tlv[TLV_RELAY]?.mapNotNull { it.toUtf8String() } ?: emptyList()

        return NostrEntity.Pubkey(
            hex = pubkey,
            relayHints = relays
        )
    }

    /**
     * Parses an naddr (parameterized replaceable event).
     */
    private fun parseNaddr(bech32: String): NostrEntity {
        val decoded = Bech32.decode(bech32)
            ?: return NostrEntity.Invalid("Invalid naddr encoding")

        if (decoded.hrp != "naddr") {
            return NostrEntity.Invalid("Expected naddr, got ${decoded.hrp}")
        }

        val tlv = parseTLV(decoded.data)
            ?: return NostrEntity.Invalid("Invalid TLV data in naddr")

        val identifierBytes = tlv[TLV_SPECIAL]?.firstOrNull()
        val identifier = identifierBytes?.toUtf8String()
            ?: return NostrEntity.Invalid("naddr missing identifier")

        val pubkeyBytes = tlv[TLV_AUTHOR]?.firstOrNull()
        if (pubkeyBytes == null || pubkeyBytes.size != 32) {
            return NostrEntity.Invalid("naddr missing or invalid pubkey")
        }

        val kindBytes = tlv[TLV_KIND]?.firstOrNull()
        val kind = kindBytes?.toInt32BigEndian()
            ?: return NostrEntity.Invalid("naddr missing kind")

        val relays = tlv[TLV_RELAY]?.mapNotNull { it.toUtf8String() } ?: emptyList()

        return NostrEntity.Address(
            identifier = identifier,
            pubkey = pubkeyBytes.toHexString(),
            kind = kind,
            relayHints = relays
        )
    }

    /**
     * Parses TLV-encoded data into a map of type -> list of values.
     * Each type can appear multiple times (e.g., multiple relay hints).
     */
    private fun parseTLV(data: ByteArray): Map<Int, List<ByteArray>>? {
        val result = mutableMapOf<Int, MutableList<ByteArray>>()
        var offset = 0

        while (offset < data.size) {
            // Read type (1 byte)
            if (offset >= data.size) break
            val type = data[offset].toInt() and 0xFF
            offset++

            // Read length (1 byte)
            if (offset >= data.size) return null
            val length = data[offset].toInt() and 0xFF
            offset++

            // Read value
            if (offset + length > data.size) return null
            val value = data.copyOfRange(offset, offset + length)
            offset += length

            result.getOrPut(type) { mutableListOf() }.add(value)
        }

        return result
    }

    /**
     * Converts a byte array to a hex string.
     */
    private fun ByteArray.toHexString(): String =
        joinToString("") { "%02x".format(it) }

    /**
     * Converts a byte array to a UTF-8 string.
     */
    private fun ByteArray.toUtf8String(): String? = try {
        String(this, Charsets.UTF_8)
    } catch (e: Exception) {
        null
    }

    /**
     * Converts a byte array (up to 4 bytes) to an Int32 (big-endian).
     */
    private fun ByteArray.toInt32BigEndian(): Int? {
        if (isEmpty() || size > 4) return null
        var result = 0
        for (byte in this) {
            result = (result shl 8) or (byte.toInt() and 0xFF)
        }
        return result
    }

    /**
     * Validates if a string is a valid Nostr URI or bech32 entity.
     */
    fun isValidNostrURI(uri: String): Boolean {
        return parse(uri) !is NostrEntity.Invalid
    }

    /**
     * Converts a NostrEntity to a DeepLinkDestination.
     */
    fun toDeepLinkDestination(entity: NostrEntity): DeepLinkDestination = when (entity) {
        is NostrEntity.Pubkey -> DeepLinkDestination.Profile(
            pubkey = entity.hex,
            relayHints = entity.relayHints
        )
        is NostrEntity.EventId -> DeepLinkDestination.Event(
            eventId = entity.hex,
            authorPubkey = entity.authorPubkey,
            kind = entity.kind,
            relayHints = entity.relayHints
        )
        is NostrEntity.Address -> DeepLinkDestination.Event(
            eventId = "${entity.kind}:${entity.pubkey}:${entity.identifier}",
            authorPubkey = entity.pubkey,
            kind = entity.kind,
            relayHints = entity.relayHints
        )
        is NostrEntity.Invalid -> DeepLinkDestination.Invalid(
            uri = "nostr:...",
            reason = entity.reason
        )
    }
}
