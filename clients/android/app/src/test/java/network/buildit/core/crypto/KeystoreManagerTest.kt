package network.buildit.core.crypto

import network.buildit.testutil.FakeKeystore
import network.buildit.testutil.TestFixtures
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Tests for KeystoreManager using FakeKeystore.
 *
 * Since KeystoreManager uses Android Keystore which cannot be unit tested directly,
 * these tests use FakeKeystore to verify the expected behavior and contract.
 */
@DisplayName("KeystoreManager")
class KeystoreManagerTest {

    private lateinit var fakeKeystore: FakeKeystore

    @BeforeEach
    fun setup() {
        fakeKeystore = FakeKeystore()
    }

    @Nested
    @DisplayName("Initialization")
    inner class Initialization {

        @Test
        @DisplayName("isInitialized returns false initially")
        fun isInitializedFalseInitially() {
            assertFalse(fakeKeystore.isInitialized.value)
        }

        @Test
        @DisplayName("initialize returns true on first call")
        fun initializeReturnsTrueFirstTime() {
            val result = fakeKeystore.initialize()

            assertTrue(result)
            assertTrue(fakeKeystore.isInitialized.value)
        }

        @Test
        @DisplayName("initialize returns true when already initialized")
        fun initializeReturnsTrueWhenAlreadyInitialized() {
            fakeKeystore.initialize()

            val result = fakeKeystore.initialize()

            assertTrue(result)
        }

        @Test
        @DisplayName("initialize with requireBiometric parameter")
        fun initializeWithBiometricRequirement() {
            val result = fakeKeystore.initialize(requireBiometric = true)

            assertTrue(result)
            assertTrue(fakeKeystore.isInitialized.value)
        }

        @Test
        @DisplayName("initializeWithKeys sets specific keys")
        fun initializeWithKeysWorks() {
            val privateKey = TestFixtures.testPrivateKeyBytes
            val publicKey = TestFixtures.testPublicKeyBytes
            val encryptionKey = ByteArray(32) { it.toByte() }

            fakeKeystore.initializeWithKeys(privateKey, publicKey, encryptionKey)

            assertTrue(fakeKeystore.isInitialized.value)
            assertArrayEquals(publicKey, fakeKeystore.getPublicKeyBytes())
            assertArrayEquals(privateKey, fakeKeystore.getPrivateKeyBytes())
        }
    }

    @Nested
    @DisplayName("Key Access")
    inner class KeyAccess {

        @BeforeEach
        fun initializeKeystore() {
            fakeKeystore.initialize()
        }

        @Test
        @DisplayName("getPublicKeyBytes returns key when initialized")
        fun getPublicKeyBytesWhenInitialized() {
            val publicKey = fakeKeystore.getPublicKeyBytes()

            assertNotNull(publicKey)
            assertTrue(publicKey!!.isNotEmpty())
        }

        @Test
        @DisplayName("getPublicKeyBytes returns null when not initialized")
        fun getPublicKeyBytesWhenNotInitialized() {
            val uninitializedKeystore = FakeKeystore()

            val publicKey = uninitializedKeystore.getPublicKeyBytes()

            assertNull(publicKey)
        }

        @Test
        @DisplayName("getPrivateKeyBytes returns key when initialized")
        fun getPrivateKeyBytesWhenInitialized() {
            val privateKey = fakeKeystore.getPrivateKeyBytes()

            assertNotNull(privateKey)
            assertTrue(privateKey!!.isNotEmpty())
        }

        @Test
        @DisplayName("getPrivateKeyBytes returns null when not initialized")
        fun getPrivateKeyBytesWhenNotInitialized() {
            val uninitializedKeystore = FakeKeystore()

            val privateKey = uninitializedKeystore.getPrivateKeyBytes()

            assertNull(privateKey)
        }

        @Test
        @DisplayName("keys are consistent across multiple calls")
        fun keysAreConsistent() {
            val publicKey1 = fakeKeystore.getPublicKeyBytes()
            val publicKey2 = fakeKeystore.getPublicKeyBytes()
            val privateKey1 = fakeKeystore.getPrivateKeyBytes()
            val privateKey2 = fakeKeystore.getPrivateKeyBytes()

            assertArrayEquals(publicKey1, publicKey2)
            assertArrayEquals(privateKey1, privateKey2)
        }

        @Test
        @DisplayName("returned keys are copies, not originals")
        fun keysAreCopies() {
            val publicKey1 = fakeKeystore.getPublicKeyBytes()
            val publicKey2 = fakeKeystore.getPublicKeyBytes()

            // Modify one array
            publicKey1!![0] = 0xFF.toByte()

            // Other array should be unchanged
            assertTrue(publicKey1[0] != publicKey2!![0] || publicKey1.size == 1)
        }
    }

    @Nested
    @DisplayName("Signing")
    inner class Signing {

        @BeforeEach
        fun initializeKeystore() {
            fakeKeystore.initialize()
        }

        @Test
        @DisplayName("signWithIdentityKey produces signature")
        fun signProducesSignature() {
            val data = "Data to sign".toByteArray()

            val signature = fakeKeystore.signWithIdentityKey(data)

            assertNotNull(signature)
            assertTrue(signature!!.isNotEmpty())
        }

        @Test
        @DisplayName("signWithIdentityKey returns null when not initialized")
        fun signReturnsNullWhenNotInitialized() {
            val uninitializedKeystore = FakeKeystore()
            val data = "Data to sign".toByteArray()

            val signature = uninitializedKeystore.signWithIdentityKey(data)

            assertNull(signature)
        }

        @Test
        @DisplayName("same data produces same signature")
        fun sameDataSameSignature() {
            val data = "Consistent data".toByteArray()

            val signature1 = fakeKeystore.signWithIdentityKey(data)
            val signature2 = fakeKeystore.signWithIdentityKey(data)

            assertArrayEquals(signature1, signature2)
        }

        @Test
        @DisplayName("different data produces different signatures")
        fun differentDataDifferentSignatures() {
            val data1 = "Data 1".toByteArray()
            val data2 = "Data 2".toByteArray()

            val signature1 = fakeKeystore.signWithIdentityKey(data1)
            val signature2 = fakeKeystore.signWithIdentityKey(data2)

            assertNotNull(signature1)
            assertNotNull(signature2)
            assertTrue(!signature1!!.contentEquals(signature2!!))
        }

        @Test
        @DisplayName("verifySignature returns true for valid signature")
        fun verifyValidSignature() {
            val data = "Signed data".toByteArray()
            val signature = fakeKeystore.signWithIdentityKey(data)!!
            val publicKey = fakeKeystore.getPublicKeyBytes()!!

            val isValid = fakeKeystore.verifySignature(data, signature, publicKey)

            assertTrue(isValid)
        }
    }

    @Nested
    @DisplayName("Local Encryption")
    inner class LocalEncryption {

        @BeforeEach
        fun initializeKeystore() {
            fakeKeystore.initialize()
        }

        @Test
        @DisplayName("encryptLocal produces encrypted data")
        fun encryptProducesData() {
            val plaintext = "Secret data".toByteArray()

            val encrypted = fakeKeystore.encryptLocal(plaintext)

            assertNotNull(encrypted)
            assertNotNull(encrypted!!.ciphertext)
            assertNotNull(encrypted.iv)
            assertTrue(encrypted.ciphertext.isNotEmpty())
            assertTrue(encrypted.iv.isNotEmpty())
        }

        @Test
        @DisplayName("encryptLocal returns null when not initialized")
        fun encryptReturnsNullWhenNotInitialized() {
            val uninitializedKeystore = FakeKeystore()
            val plaintext = "Secret data".toByteArray()

            val encrypted = uninitializedKeystore.encryptLocal(plaintext)

            assertNull(encrypted)
        }

        @Test
        @DisplayName("decryptLocal recovers original data")
        fun decryptRecoversOriginal() {
            val plaintext = "Secret data".toByteArray()
            val encrypted = fakeKeystore.encryptLocal(plaintext)!!

            val decrypted = fakeKeystore.decryptLocal(encrypted)

            assertNotNull(decrypted)
            assertArrayEquals(plaintext, decrypted)
        }

        @Test
        @DisplayName("decryptLocal returns null when not initialized")
        fun decryptReturnsNullWhenNotInitialized() {
            // First encrypt with initialized keystore
            val plaintext = "Secret data".toByteArray()
            val encrypted = fakeKeystore.encryptLocal(plaintext)!!

            // Then try to decrypt with uninitialized keystore
            val uninitializedKeystore = FakeKeystore()
            val decrypted = uninitializedKeystore.decryptLocal(encrypted)

            assertNull(decrypted)
        }

        @Test
        @DisplayName("ciphertext differs from plaintext")
        fun ciphertextDiffersFromPlaintext() {
            val plaintext = "Secret data".toByteArray()

            val encrypted = fakeKeystore.encryptLocal(plaintext)

            assertTrue(!encrypted!!.ciphertext.contentEquals(plaintext))
        }

        @Test
        @DisplayName("same plaintext produces different ciphertext due to random IV")
        fun differentCiphertextEachTime() {
            val plaintext = "Same data".toByteArray()

            val encrypted1 = fakeKeystore.encryptLocal(plaintext)
            val encrypted2 = fakeKeystore.encryptLocal(plaintext)

            // IV should be different
            assertTrue(!encrypted1!!.iv.contentEquals(encrypted2!!.iv))
            // Ciphertext might also differ
        }
    }

    @Nested
    @DisplayName("Biometric")
    inner class Biometric {

        @Test
        @DisplayName("biometricEnabled returns false by default")
        fun biometricDisabledByDefault() {
            assertFalse(fakeKeystore.biometricEnabled.value)
        }

        @Test
        @DisplayName("setBiometricEnabled changes state")
        fun setBiometricEnabledWorks() {
            fakeKeystore.setBiometricEnabled(true)

            assertTrue(fakeKeystore.biometricEnabled.value)
        }
    }

    @Nested
    @DisplayName("Key Deletion")
    inner class KeyDeletion {

        @Test
        @DisplayName("deleteAllKeys removes all keys")
        fun deleteAllKeysWorks() {
            fakeKeystore.initialize()
            assertTrue(fakeKeystore.isInitialized.value)

            fakeKeystore.deleteAllKeys()

            assertFalse(fakeKeystore.isInitialized.value)
            assertNull(fakeKeystore.getPublicKeyBytes())
            assertNull(fakeKeystore.getPrivateKeyBytes())
        }

        @Test
        @DisplayName("reset clears all state")
        fun resetClearsState() {
            fakeKeystore.initialize()
            fakeKeystore.setBiometricEnabled(true)

            fakeKeystore.reset()

            assertFalse(fakeKeystore.isInitialized.value)
            assertFalse(fakeKeystore.biometricEnabled.value)
        }
    }

    @Nested
    @DisplayName("Identity Export/Import")
    inner class IdentityExportImport {

        @BeforeEach
        fun initializeKeystore() {
            fakeKeystore.initialize()
        }

        @Test
        @DisplayName("exportIdentityBundle produces data")
        fun exportProducesData() {
            val syncKey = ByteArray(32) { it.toByte() }

            val bundle = fakeKeystore.exportIdentityBundle(syncKey)

            assertNotNull(bundle)
            assertEquals(64, bundle!!.size) // 32 + 32 bytes
        }

        @Test
        @DisplayName("exportIdentityBundle returns null when not initialized")
        fun exportReturnsNullWhenNotInitialized() {
            val uninitializedKeystore = FakeKeystore()
            val syncKey = ByteArray(32) { it.toByte() }

            val bundle = uninitializedKeystore.exportIdentityBundle(syncKey)

            assertNull(bundle)
        }

        @Test
        @DisplayName("importIdentityBundle restores keys")
        fun importRestoresKeys() {
            val syncKey = ByteArray(32) { it.toByte() }
            val originalPublicKey = fakeKeystore.getPublicKeyBytes()!!
            val bundle = fakeKeystore.exportIdentityBundle(syncKey)!!

            // Create new keystore and import
            val newKeystore = FakeKeystore()
            val result = newKeystore.importIdentityBundle(bundle, syncKey)

            assertTrue(result)
            assertTrue(newKeystore.isInitialized.value)
            assertArrayEquals(originalPublicKey, newKeystore.getPublicKeyBytes())
        }

        @Test
        @DisplayName("importIdentityBundle fails with wrong sync key")
        fun importFailsWithWrongKey() {
            val syncKey = ByteArray(32) { it.toByte() }
            val wrongKey = ByteArray(32) { (it + 1).toByte() }
            val bundle = fakeKeystore.exportIdentityBundle(syncKey)!!

            val newKeystore = FakeKeystore()
            val result = newKeystore.importIdentityBundle(bundle, wrongKey)

            // Import succeeds but keys are garbage
            assertTrue(result)
            // Keys won't match original
            assertTrue(!fakeKeystore.getPublicKeyBytes()!!.contentEquals(newKeystore.getPublicKeyBytes()!!))
        }

        @Test
        @DisplayName("importIdentityBundle fails with invalid bundle size")
        fun importFailsWithInvalidBundleSize() {
            val syncKey = ByteArray(32) { it.toByte() }
            val invalidBundle = ByteArray(32) // Wrong size

            val newKeystore = FakeKeystore()
            val result = newKeystore.importIdentityBundle(invalidBundle, syncKey)

            assertFalse(result)
        }
    }

    @Nested
    @DisplayName("EncryptedData")
    inner class EncryptedDataTests {

        @Test
        @DisplayName("equals returns true for identical data")
        fun equalsReturnsTrueForIdentical() {
            val data1 = EncryptedData(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 6))
            val data2 = EncryptedData(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 6))

            assertEquals(data1, data2)
        }

        @Test
        @DisplayName("equals returns false for different ciphertext")
        fun equalsReturnsFalseForDifferentCiphertext() {
            val data1 = EncryptedData(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 6))
            val data2 = EncryptedData(byteArrayOf(1, 2, 4), byteArrayOf(4, 5, 6))

            assertTrue(data1 != data2)
        }

        @Test
        @DisplayName("equals returns false for different IV")
        fun equalsReturnsFalseForDifferentIv() {
            val data1 = EncryptedData(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 6))
            val data2 = EncryptedData(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 7))

            assertTrue(data1 != data2)
        }

        @Test
        @DisplayName("hashCode is consistent for equal objects")
        fun hashCodeConsistentForEqual() {
            val data1 = EncryptedData(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 6))
            val data2 = EncryptedData(byteArrayOf(1, 2, 3), byteArrayOf(4, 5, 6))

            assertEquals(data1.hashCode(), data2.hashCode())
        }
    }
}
