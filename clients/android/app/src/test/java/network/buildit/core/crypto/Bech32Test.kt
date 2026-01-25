package network.buildit.core.crypto

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.ValueSource

@DisplayName("Bech32")
class Bech32Test {

    @Nested
    @DisplayName("npubToHex")
    inner class NpubToHex {

        @Test
        @DisplayName("decodes valid npub to hex")
        fun decodesValidNpub() {
            // Known test vector - npub for all zeros pubkey
            val npub = "npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme"
            val hex = Bech32.npubToHex(npub)

            assertNotNull(hex)
            assertEquals(64, hex!!.length)
            assertEquals("0000000000000000000000000000000000000000000000000000000000000000", hex)
        }

        @Test
        @DisplayName("decodes real-world npub correctly")
        fun decodesRealWorldNpub() {
            // Jack Dorsey's npub (well-known test case)
            val npub = "npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m"
            val hex = Bech32.npubToHex(npub)

            assertNotNull(hex)
            assertEquals("82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2", hex)
        }

        @Test
        @DisplayName("returns null for invalid npub prefix")
        fun returnsNullForInvalidPrefix() {
            val invalidNpub = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsf4nj8"

            val result = Bech32.npubToHex(invalidNpub)

            assertNull(result)
        }

        @Test
        @DisplayName("returns null for truncated npub")
        fun returnsNullForTruncated() {
            val truncated = "npub1qqqqqqqq"

            val result = Bech32.npubToHex(truncated)

            assertNull(result)
        }

        @Test
        @DisplayName("returns null for invalid checksum")
        fun returnsNullForInvalidChecksum() {
            // Valid npub with last character changed (invalid checksum)
            val invalidChecksum = "npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63x"

            val result = Bech32.npubToHex(invalidChecksum)

            assertNull(result)
        }

        @Test
        @DisplayName("returns null for invalid bech32 characters")
        fun returnsNullForInvalidCharacters() {
            // 'b', 'i', 'o' are not in bech32 charset
            val invalidChars = "npub1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

            val result = Bech32.npubToHex(invalidChars)

            assertNull(result)
        }

        @Test
        @DisplayName("handles uppercase npub (case insensitive)")
        fun handlesCaseInsensitive() {
            val npubLower = "npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme"
            val npubUpper = "NPUB1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQZQUJME"

            val hexLower = Bech32.npubToHex(npubLower)
            val hexUpper = Bech32.npubToHex(npubUpper)

            assertNotNull(hexLower)
            assertNotNull(hexUpper)
            assertEquals(hexLower, hexUpper)
        }
    }

    @Nested
    @DisplayName("hexToNpub")
    inner class HexToNpub {

        @Test
        @DisplayName("encodes hex to valid npub")
        fun encodesHexToNpub() {
            val hex = "0000000000000000000000000000000000000000000000000000000000000000"

            val npub = Bech32.hexToNpub(hex)

            assertNotNull(npub)
            assertTrue(npub!!.startsWith("npub1"))
        }

        @Test
        @DisplayName("returns null for wrong length hex")
        fun returnsNullForWrongLength() {
            val shortHex = "0000000000000000"

            val result = Bech32.hexToNpub(shortHex)

            assertNull(result)
        }

        @Test
        @DisplayName("returns null for invalid hex characters")
        fun returnsNullForInvalidHex() {
            val invalidHex = "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg"

            val result = Bech32.hexToNpub(invalidHex)

            assertNull(result)
        }
    }

    @Nested
    @DisplayName("nsecToHex")
    inner class NsecToHex {

        @Test
        @DisplayName("decodes valid nsec to hex")
        fun decodesValidNsec() {
            val nsec = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqwkhnav"
            val hex = Bech32.nsecToHex(nsec)

            assertNotNull(hex)
            assertEquals(64, hex!!.length)
            assertEquals("0000000000000000000000000000000000000000000000000000000000000000", hex)
        }

        @Test
        @DisplayName("returns null for npub passed as nsec")
        fun returnsNullForWrongHrp() {
            val npub = "npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme"

            val result = Bech32.nsecToHex(npub)

            assertNull(result)
        }
    }

    @Nested
    @DisplayName("hexToNsec")
    inner class HexToNsec {

        @Test
        @DisplayName("encodes hex to valid nsec")
        fun encodesHexToNsec() {
            val hex = "0000000000000000000000000000000000000000000000000000000000000000"

            val nsec = Bech32.hexToNsec(hex)

            assertNotNull(nsec)
            assertTrue(nsec!!.startsWith("nsec1"))
        }
    }

    @Nested
    @DisplayName("noteToHex")
    inner class NoteToHex {

        @Test
        @DisplayName("decodes valid note to hex")
        fun decodesValidNote() {
            val note = "note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqn2l0z3"
            val hex = Bech32.noteToHex(note)

            assertNotNull(hex)
            assertEquals(64, hex!!.length)
            assertEquals("0000000000000000000000000000000000000000000000000000000000000000", hex)
        }
    }

    @Nested
    @DisplayName("hexToNote")
    inner class HexToNote {

        @Test
        @DisplayName("encodes hex to valid note")
        fun encodesHexToNote() {
            val hex = "0000000000000000000000000000000000000000000000000000000000000000"

            val note = Bech32.hexToNote(hex)

            assertNotNull(note)
            assertTrue(note!!.startsWith("note1"))
        }
    }

    @Nested
    @DisplayName("Round-trip encoding")
    inner class RoundTrip {

        @ParameterizedTest
        @ValueSource(strings = [
            "0000000000000000000000000000000000000000000000000000000000000000",
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2",
            "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
        ])
        @DisplayName("npub round-trip preserves hex")
        fun npubRoundTripPreservesHex(originalHex: String) {
            val npub = Bech32.hexToNpub(originalHex)
            assertNotNull(npub)

            val restoredHex = Bech32.npubToHex(npub!!)
            assertNotNull(restoredHex)

            assertEquals(originalHex.lowercase(), restoredHex!!.lowercase())
        }

        @ParameterizedTest
        @ValueSource(strings = [
            "0000000000000000000000000000000000000000000000000000000000000000",
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        ])
        @DisplayName("nsec round-trip preserves hex")
        fun nsecRoundTripPreservesHex(originalHex: String) {
            val nsec = Bech32.hexToNsec(originalHex)
            assertNotNull(nsec)

            val restoredHex = Bech32.nsecToHex(nsec!!)
            assertNotNull(restoredHex)

            assertEquals(originalHex.lowercase(), restoredHex!!.lowercase())
        }

        @ParameterizedTest
        @ValueSource(strings = [
            "0000000000000000000000000000000000000000000000000000000000000000",
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        ])
        @DisplayName("note round-trip preserves hex")
        fun noteRoundTripPreservesHex(originalHex: String) {
            val note = Bech32.hexToNote(originalHex)
            assertNotNull(note)

            val restoredHex = Bech32.noteToHex(note!!)
            assertNotNull(restoredHex)

            assertEquals(originalHex.lowercase(), restoredHex!!.lowercase())
        }
    }

    @Nested
    @DisplayName("Validation")
    inner class Validation {

        @Test
        @DisplayName("isValidNpub returns true for valid npub")
        fun isValidNpubReturnsTrueForValid() {
            val validNpub = "npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m"

            assertTrue(Bech32.isValidNpub(validNpub))
        }

        @Test
        @DisplayName("isValidNpub returns false for invalid npub")
        fun isValidNpubReturnsFalseForInvalid() {
            assertFalse(Bech32.isValidNpub("invalid"))
            assertFalse(Bech32.isValidNpub("npub1"))
            assertFalse(Bech32.isValidNpub(""))
            assertFalse(Bech32.isValidNpub("nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqwkhnav"))
        }

        @Test
        @DisplayName("isValidNsec returns true for valid nsec")
        fun isValidNsecReturnsTrueForValid() {
            val validNsec = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqwkhnav"

            assertTrue(Bech32.isValidNsec(validNsec))
        }

        @Test
        @DisplayName("isValidNote returns true for valid note")
        fun isValidNoteReturnsTrueForValid() {
            val validNote = "note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqn2l0z3"

            assertTrue(Bech32.isValidNote(validNote))
        }
    }

    @Nested
    @DisplayName("Edge cases")
    inner class EdgeCases {

        @Test
        @DisplayName("handles empty string")
        fun handlesEmptyString() {
            assertNull(Bech32.npubToHex(""))
            assertNull(Bech32.nsecToHex(""))
            assertNull(Bech32.noteToHex(""))
        }

        @Test
        @DisplayName("handles string without separator")
        fun handlesNoSeparator() {
            assertNull(Bech32.npubToHex("npubqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"))
        }

        @Test
        @DisplayName("handles string with only separator")
        fun handlesOnlySeparator() {
            assertNull(Bech32.decode("1"))
            assertNull(Bech32.decode("n1"))
        }

        @Test
        @DisplayName("handles mixed case input")
        fun handlesMixedCase() {
            // Mixed case should be normalized to lowercase
            val mixed = "nPuB1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m"
            val hex = Bech32.npubToHex(mixed)

            assertNotNull(hex)
            assertEquals("82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2", hex)
        }
    }
}
