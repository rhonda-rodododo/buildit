package network.buildit.core.crypto

import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import network.buildit.testutil.FakeKeystore
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

@DisplayName("CryptoManager")
class CryptoManagerTest {

    private lateinit var keystoreManager: KeystoreManager
    private lateinit var cryptoManager: CryptoManager
    private lateinit var fakeKeystore: FakeKeystore

    @BeforeEach
    fun setup() {
        keystoreManager = mockk(relaxed = true)
        cryptoManager = CryptoManager(keystoreManager)
        fakeKeystore = FakeKeystore().apply { initialize() }
    }

    @Nested
    @DisplayName("getPublicKeyHex")
    inner class GetPublicKeyHex {

        @Test
        @DisplayName("returns hex string when public key is available")
        fun returnsHexStringWhenKeyAvailable() {
            val publicKeyBytes = byteArrayOf(0x0A, 0x0B, 0x0C, 0x0D)
            every { keystoreManager.getPublicKeyBytes() } returns publicKeyBytes

            val result = cryptoManager.getPublicKeyHex()

            assertNotNull(result)
            assertEquals("0a0b0c0d", result)
        }

        @Test
        @DisplayName("returns null when no public key is available")
        fun returnsNullWhenNoKey() {
            every { keystoreManager.getPublicKeyBytes() } returns null

            val result = cryptoManager.getPublicKeyHex()

            assertNull(result)
        }

        @Test
        @DisplayName("converts empty bytes to empty string")
        fun convertsEmptyBytesToEmptyString() {
            every { keystoreManager.getPublicKeyBytes() } returns byteArrayOf()

            val result = cryptoManager.getPublicKeyHex()

            assertEquals("", result)
        }
    }

    @Nested
    @DisplayName("encrypt")
    inner class Encrypt {

        @BeforeEach
        fun setupEncryptTests() {
            // Mock the private key for encryption tests
            every { keystoreManager.getPrivateKeyBytes() } returns TestFixtures.testPrivateKeyBytes
        }

        @Test
        @DisplayName("encrypts plaintext successfully")
        fun encryptsSuccessfully() = runTest {
            val plaintext = "Hello, World!".toByteArray()
            val recipientPublicKey = TestFixtures.TEST_PUBLIC_KEY_HEX

            val encrypted = cryptoManager.encrypt(plaintext, recipientPublicKey)

            assertNotNull(encrypted)
            assertTrue(encrypted!!.isNotEmpty())
            // Should be at least: version (1) + nonce (12) + ciphertext
            assertTrue(encrypted.size >= 13)
        }

        @Test
        @DisplayName("encrypted data starts with version byte 0x01")
        fun encryptedDataStartsWithVersionByte() = runTest {
            val plaintext = "Test".toByteArray()
            val recipientPublicKey = TestFixtures.TEST_PUBLIC_KEY_HEX

            val encrypted = cryptoManager.encrypt(plaintext, recipientPublicKey)

            assertNotNull(encrypted)
            assertEquals(0x01.toByte(), encrypted!![0])
        }

        @Test
        @DisplayName("same plaintext produces different ciphertext each time")
        fun producesDifferentCiphertextEachTime() = runTest {
            val plaintext = "Same message".toByteArray()
            val recipientPublicKey = TestFixtures.TEST_PUBLIC_KEY_HEX

            val encrypted1 = cryptoManager.encrypt(plaintext, recipientPublicKey)
            val encrypted2 = cryptoManager.encrypt(plaintext, recipientPublicKey)

            assertNotNull(encrypted1)
            assertNotNull(encrypted2)
            // Due to random nonce and ephemeral key, ciphertexts should differ
            assertNotEquals(encrypted1!!.toList(), encrypted2!!.toList())
        }

        @Test
        @DisplayName("returns null for invalid public key")
        fun returnsNullForInvalidPublicKey() = runTest {
            val plaintext = "Test".toByteArray()
            val invalidPublicKey = "invalid" // Odd length, not valid hex

            val encrypted = cryptoManager.encrypt(plaintext, invalidPublicKey)

            assertNull(encrypted)
        }

        @ParameterizedTest
        @ValueSource(strings = ["", "a", "ab", "abc"])
        @DisplayName("handles various plaintext sizes")
        fun handlesVariousPlaintextSizes(text: String) = runTest {
            val plaintext = text.toByteArray()
            val recipientPublicKey = TestFixtures.TEST_PUBLIC_KEY_HEX

            val encrypted = cryptoManager.encrypt(plaintext, recipientPublicKey)

            assertNotNull(encrypted)
        }
    }

    @Nested
    @DisplayName("decrypt")
    inner class Decrypt {

        @Test
        @DisplayName("returns null for ciphertext that is too short")
        fun returnsNullForTooShortCiphertext() = runTest {
            val shortCiphertext = ByteArray(44) // Less than minimum 45 bytes
            val senderPublicKey = TestFixtures.TEST_PUBLIC_KEY_HEX

            every { keystoreManager.getPrivateKeyBytes() } returns TestFixtures.testPrivateKeyBytes

            val decrypted = cryptoManager.decrypt(shortCiphertext, senderPublicKey)

            assertNull(decrypted)
        }

        @Test
        @DisplayName("returns null for invalid version byte")
        fun returnsNullForInvalidVersion() = runTest {
            val invalidVersion = ByteArray(50).apply { this[0] = 0x02 }
            val senderPublicKey = TestFixtures.TEST_PUBLIC_KEY_HEX

            every { keystoreManager.getPrivateKeyBytes() } returns TestFixtures.testPrivateKeyBytes

            val decrypted = cryptoManager.decrypt(invalidVersion, senderPublicKey)

            assertNull(decrypted)
        }

        @Test
        @DisplayName("returns null when private key is unavailable")
        fun returnsNullWhenNoPrivateKey() = runTest {
            // Construct minimal valid-looking ciphertext
            val ciphertext = ByteArray(50).apply { this[0] = 0x01 }
            val senderPublicKey = TestFixtures.TEST_PUBLIC_KEY_HEX

            every { keystoreManager.getPrivateKeyBytes() } returns null

            val decrypted = cryptoManager.decrypt(ciphertext, senderPublicKey)

            assertNull(decrypted)
        }
    }

    @Nested
    @DisplayName("sign")
    inner class Sign {

        @Test
        @DisplayName("signs data successfully when private key is available")
        fun signsSuccessfully() = runTest {
            val data = "Data to sign".toByteArray()
            val expectedSignature = "test_signature".toByteArray()
            coEvery { keystoreManager.signWithIdentityKey(data) } returns expectedSignature

            val signature = cryptoManager.sign(data)

            assertNotNull(signature)
            assertTrue(signature!!.isNotEmpty())
        }

        @Test
        @DisplayName("returns null when private key is unavailable")
        fun returnsNullWhenNoPrivateKey() = runTest {
            val data = "Data to sign".toByteArray()
            coEvery { keystoreManager.signWithIdentityKey(data) } returns null

            val signature = cryptoManager.sign(data)

            assertNull(signature)
        }

        @Test
        @DisplayName("same data produces same signature")
        fun sameDataProducesSameSignature() = runTest {
            val data = "Consistent data".toByteArray()
            val expectedSignature = "consistent_signature".toByteArray()
            coEvery { keystoreManager.signWithIdentityKey(data) } returns expectedSignature

            val signature1 = cryptoManager.sign(data)
            val signature2 = cryptoManager.sign(data)

            assertNotNull(signature1)
            assertNotNull(signature2)
            assertArrayEquals(signature1, signature2)
        }

        @Test
        @DisplayName("different data produces different signatures")
        fun differentDataProducesDifferentSignatures() = runTest {
            val data1 = "Data 1".toByteArray()
            val data2 = "Data 2".toByteArray()
            coEvery { keystoreManager.signWithIdentityKey(data1) } returns "signature1".toByteArray()
            coEvery { keystoreManager.signWithIdentityKey(data2) } returns "signature2".toByteArray()

            val signature1 = cryptoManager.sign(data1)
            val signature2 = cryptoManager.sign(data2)

            assertNotNull(signature1)
            assertNotNull(signature2)
            assertTrue(!signature1!!.contentEquals(signature2!!))
        }
    }

    @Nested
    @DisplayName("verify")
    inner class Verify {

        @Test
        @DisplayName("returns false without native library loaded")
        fun returnsFalseWithoutNativeLibrary() = runTest {
            val data = "Signed data".toByteArray()
            val signature = "signature".toByteArray()
            val publicKey = TestFixtures.TEST_PUBLIC_KEY_HEX

            // Without native library, verify returns false (cannot verify)
            val isValid = cryptoManager.verify(data, signature, publicKey)

            assertFalse(isValid)
        }
    }

    @Nested
    @DisplayName("randomBytes")
    inner class RandomBytes {

        @Test
        @DisplayName("generates bytes of requested size")
        fun generatesCorrectSize() {
            val size = 32

            val randomBytes = cryptoManager.randomBytes(size)

            assertEquals(size, randomBytes.size)
        }

        @Test
        @DisplayName("generates different bytes each time")
        fun generatesDifferentBytesEachTime() {
            val size = 32

            val bytes1 = cryptoManager.randomBytes(size)
            val bytes2 = cryptoManager.randomBytes(size)

            // Extremely unlikely to be equal for random data
            assertTrue(!bytes1.contentEquals(bytes2))
        }

        @ParameterizedTest
        @ValueSource(ints = [0, 1, 16, 32, 64, 128, 256])
        @DisplayName("handles various sizes")
        fun handlesVariousSizes(size: Int) {
            val randomBytes = cryptoManager.randomBytes(size)

            assertEquals(size, randomBytes.size)
        }
    }

    @Nested
    @DisplayName("sha256")
    inner class Sha256 {

        @Test
        @DisplayName("produces 32-byte hash")
        fun produces32ByteHash() {
            val data = "Hello".toByteArray()

            val hash = cryptoManager.sha256(data)

            assertEquals(32, hash.size)
        }

        @Test
        @DisplayName("same input produces same hash")
        fun sameInputProducesSameHash() {
            val data = "Consistent".toByteArray()

            val hash1 = cryptoManager.sha256(data)
            val hash2 = cryptoManager.sha256(data)

            assertArrayEquals(hash1, hash2)
        }

        @Test
        @DisplayName("different inputs produce different hashes")
        fun differentInputsProduceDifferentHashes() {
            val data1 = "Input 1".toByteArray()
            val data2 = "Input 2".toByteArray()

            val hash1 = cryptoManager.sha256(data1)
            val hash2 = cryptoManager.sha256(data2)

            assertTrue(!hash1.contentEquals(hash2))
        }

        @Test
        @DisplayName("produces known hash for known input")
        fun producesKnownHash() {
            // SHA-256 of "test" is well-known
            val data = "test".toByteArray()

            val hash = cryptoManager.sha256(data)

            // SHA-256("test") = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
            val expectedPrefix = byteArrayOf(
                0x9f.toByte(), 0x86.toByte(), 0xd0.toByte(), 0x81.toByte()
            )
            assertTrue(hash.take(4).toByteArray().contentEquals(expectedPrefix))
        }
    }

    @Nested
    @DisplayName("Extension functions")
    inner class ExtensionFunctions {

        @Test
        @DisplayName("ByteArray.toHexString converts correctly")
        fun byteArrayToHexString() {
            val bytes = byteArrayOf(0x0A, 0x0B, 0x0C, 0xFF.toByte())

            val hex = bytes.toHexString()

            assertEquals("0a0b0cff", hex)
        }

        @Test
        @DisplayName("String.hexToByteArray converts correctly")
        fun stringHexToByteArray() {
            val hex = "0a0b0cff"

            val bytes = hex.hexToByteArray()

            assertArrayEquals(byteArrayOf(0x0A, 0x0B, 0x0C, 0xFF.toByte()), bytes)
        }

        @Test
        @DisplayName("hexToByteArray throws for odd-length string")
        fun hexToByteArrayThrowsForOddLength() {
            val oddHex = "abc"

            org.junit.jupiter.api.assertThrows<IllegalStateException> {
                oddHex.hexToByteArray()
            }
        }

        @Test
        @DisplayName("round-trip conversion preserves data")
        fun roundTripPreservesData() {
            val original = byteArrayOf(0x00, 0x01, 0xFE.toByte(), 0xFF.toByte())

            val hex = original.toHexString()
            val restored = hex.hexToByteArray()

            assertArrayEquals(original, restored)
        }
    }
}
