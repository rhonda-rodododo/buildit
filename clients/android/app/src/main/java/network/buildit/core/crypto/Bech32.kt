package network.buildit.core.crypto

/**
 * Bech32/Bech32m encoding and decoding for Nostr keys.
 *
 * Supports:
 * - npub (public keys)
 * - nsec (private keys)
 * - note (event IDs)
 * - nprofile, nevent, naddr (NIP-19 TLV encoded)
 */
object Bech32 {

    private const val CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
    private val CHARSET_REV = IntArray(128) { -1 }.apply {
        CHARSET.forEachIndexed { index, c -> this[c.code] = index }
    }

    private val GENERATOR = intArrayOf(0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3)

    /**
     * Result of decoding a bech32 string.
     */
    data class Bech32Data(
        val hrp: String,
        val data: ByteArray
    ) {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Bech32Data) return false
            return hrp == other.hrp && data.contentEquals(other.data)
        }

        override fun hashCode(): Int {
            return 31 * hrp.hashCode() + data.contentHashCode()
        }
    }

    /**
     * Decodes a bech32 string (npub, nsec, note, etc.) to its raw bytes.
     *
     * @param bech32 The bech32 encoded string
     * @return Bech32Data containing HRP and decoded bytes, or null if invalid
     */
    fun decode(bech32: String): Bech32Data? {
        val lowered = bech32.lowercase()

        // Find separator
        val separatorIndex = lowered.lastIndexOf('1')
        if (separatorIndex < 1 || separatorIndex + 7 > lowered.length) {
            return null
        }

        val hrp = lowered.substring(0, separatorIndex)
        val dataString = lowered.substring(separatorIndex + 1)

        // Decode data characters to 5-bit values
        val data5bit = IntArray(dataString.length)
        for (i in dataString.indices) {
            val c = dataString[i]
            if (c.code >= 128 || CHARSET_REV[c.code] == -1) {
                return null
            }
            data5bit[i] = CHARSET_REV[c.code]
        }

        // Verify checksum
        if (!verifyChecksum(hrp, data5bit)) {
            return null
        }

        // Remove checksum (last 6 values)
        val values = data5bit.copyOf(data5bit.size - 6)

        // Convert from 5-bit to 8-bit
        val intBytes = convertBits(values, 5, 8, false) ?: return null

        // Convert IntArray to ByteArray
        val bytes = intBytes.map { it.toByte() }.toByteArray()

        return Bech32Data(hrp, bytes)
    }

    /**
     * Encodes raw bytes to a bech32 string.
     *
     * @param hrp The human-readable part (npub, nsec, note, etc.)
     * @param data The raw bytes to encode
     * @return The bech32 encoded string, or null if encoding fails
     */
    fun encode(hrp: String, data: ByteArray): String? {
        // Convert from 8-bit to 5-bit
        val values = convertBits(data.map { it.toInt() and 0xFF }.toIntArray(), 8, 5, true)
            ?: return null

        // Create checksum
        val checksum = createChecksum(hrp, values)

        // Build result
        val result = StringBuilder(hrp.length + 1 + values.size + 6)
        result.append(hrp)
        result.append('1')
        for (v in values) {
            result.append(CHARSET[v])
        }
        for (v in checksum) {
            result.append(CHARSET[v])
        }

        return result.toString()
    }

    /**
     * Decodes an npub to a hex public key.
     *
     * @param npub The npub string (e.g., "npub1...")
     * @return The 64-character hex public key, or null if invalid
     */
    fun npubToHex(npub: String): String? {
        val decoded = decode(npub) ?: return null
        if (decoded.hrp != "npub" || decoded.data.size != 32) {
            return null
        }
        return decoded.data.toHexString()
    }

    /**
     * Encodes a hex public key to an npub.
     *
     * @param hexPubkey The 64-character hex public key
     * @return The npub string, or null if invalid
     */
    fun hexToNpub(hexPubkey: String): String? {
        if (hexPubkey.length != 64) return null
        val bytes = hexPubkey.hexToByteArray() ?: return null
        return encode("npub", bytes)
    }

    /**
     * Decodes an nsec to a hex private key.
     *
     * @param nsec The nsec string
     * @return The 64-character hex private key, or null if invalid
     */
    fun nsecToHex(nsec: String): String? {
        val decoded = decode(nsec) ?: return null
        if (decoded.hrp != "nsec" || decoded.data.size != 32) {
            return null
        }
        return decoded.data.toHexString()
    }

    /**
     * Encodes a hex private key to an nsec.
     *
     * @param hexPrivkey The 64-character hex private key
     * @return The nsec string, or null if invalid
     */
    fun hexToNsec(hexPrivkey: String): String? {
        if (hexPrivkey.length != 64) return null
        val bytes = hexPrivkey.hexToByteArray() ?: return null
        return encode("nsec", bytes)
    }

    /**
     * Decodes a note ID to hex.
     *
     * @param noteId The note ID string (e.g., "note1...")
     * @return The 64-character hex event ID, or null if invalid
     */
    fun noteToHex(noteId: String): String? {
        val decoded = decode(noteId) ?: return null
        if (decoded.hrp != "note" || decoded.data.size != 32) {
            return null
        }
        return decoded.data.toHexString()
    }

    /**
     * Encodes a hex event ID to a note ID.
     *
     * @param hexEventId The 64-character hex event ID
     * @return The note ID string, or null if invalid
     */
    fun hexToNote(hexEventId: String): String? {
        if (hexEventId.length != 64) return null
        val bytes = hexEventId.hexToByteArray() ?: return null
        return encode("note", bytes)
    }

    /**
     * Checks if a string is a valid npub.
     */
    fun isValidNpub(npub: String): Boolean {
        return npubToHex(npub) != null
    }

    /**
     * Checks if a string is a valid nsec.
     */
    fun isValidNsec(nsec: String): Boolean {
        return nsecToHex(nsec) != null
    }

    /**
     * Checks if a string is a valid note ID.
     */
    fun isValidNote(noteId: String): Boolean {
        return noteToHex(noteId) != null
    }

    // Internal helpers

    private fun polymod(values: IntArray): Int {
        var chk = 1
        for (v in values) {
            val top = chk shr 25
            chk = (chk and 0x1ffffff shl 5) xor v
            for (i in 0..4) {
                if ((top shr i and 1) != 0) {
                    chk = chk xor GENERATOR[i]
                }
            }
        }
        return chk
    }

    private fun hrpExpand(hrp: String): IntArray {
        val result = IntArray(hrp.length * 2 + 1)
        for (i in hrp.indices) {
            result[i] = hrp[i].code shr 5
        }
        result[hrp.length] = 0
        for (i in hrp.indices) {
            result[hrp.length + 1 + i] = hrp[i].code and 31
        }
        return result
    }

    private fun verifyChecksum(hrp: String, values: IntArray): Boolean {
        val expanded = hrpExpand(hrp)
        val combined = IntArray(expanded.size + values.size)
        expanded.copyInto(combined)
        values.copyInto(combined, expanded.size)
        return polymod(combined) == 1
    }

    private fun createChecksum(hrp: String, values: IntArray): IntArray {
        val expanded = hrpExpand(hrp)
        val combined = IntArray(expanded.size + values.size + 6)
        expanded.copyInto(combined)
        values.copyInto(combined, expanded.size)
        val mod = polymod(combined) xor 1
        return IntArray(6) { (mod shr (5 * (5 - it))) and 31 }
    }

    private fun convertBits(data: IntArray, fromBits: Int, toBits: Int, pad: Boolean): IntArray? {
        var acc = 0
        var bits = 0
        val maxV = (1 shl toBits) - 1
        val result = mutableListOf<Int>()

        for (value in data) {
            if (value < 0 || value shr fromBits != 0) {
                return null
            }
            acc = (acc shl fromBits) or value
            bits += fromBits
            while (bits >= toBits) {
                bits -= toBits
                result.add((acc shr bits) and maxV)
            }
        }

        if (pad) {
            if (bits > 0) {
                result.add((acc shl (toBits - bits)) and maxV)
            }
        } else if (bits >= fromBits || ((acc shl (toBits - bits)) and maxV) != 0) {
            return null
        }

        return result.toIntArray()
    }

    private fun ByteArray.toHexString(): String {
        return joinToString("") { "%02x".format(it) }
    }

    private fun String.hexToByteArray(): ByteArray? {
        if (length % 2 != 0) return null
        return try {
            ByteArray(length / 2) { i ->
                substring(i * 2, i * 2 + 2).toInt(16).toByte()
            }
        } catch (e: NumberFormatException) {
            null
        }
    }
}
