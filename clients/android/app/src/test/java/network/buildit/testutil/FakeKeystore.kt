package network.buildit.testutil

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import network.buildit.core.crypto.EncryptedData
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Fake implementation of KeystoreManager for testing.
 *
 * Provides in-memory key storage without requiring Android Keystore.
 * This allows unit tests to run without Android dependencies.
 */
class FakeKeystore {

    private val _isInitialized = MutableStateFlow(false)
    val isInitialized: StateFlow<Boolean> = _isInitialized.asStateFlow()

    private val _biometricEnabled = MutableStateFlow(false)
    val biometricEnabled: StateFlow<Boolean> = _biometricEnabled.asStateFlow()

    private var identityPrivateKey: ByteArray? = null
    private var identityPublicKey: ByteArray? = null
    private var localEncryptionKey: ByteArray? = null

    private val secureRandom = SecureRandom()

    /**
     * Configures whether biometric is available.
     */
    fun setBiometricEnabled(enabled: Boolean) {
        _biometricEnabled.value = enabled
    }

    /**
     * Initializes the fake keystore with test keys.
     */
    fun initialize(requireBiometric: Boolean = false): Boolean {
        if (_isInitialized.value) return true

        return try {
            // Generate fake identity key pair
            identityPrivateKey = ByteArray(32).also { secureRandom.nextBytes(it) }
            identityPublicKey = derivePublicKey(identityPrivateKey!!)

            // Generate local encryption key
            localEncryptionKey = ByteArray(32).also { secureRandom.nextBytes(it) }

            _isInitialized.value = true
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Initializes with specific keys for deterministic testing.
     */
    fun initializeWithKeys(
        privateKey: ByteArray,
        publicKey: ByteArray,
        encryptionKey: ByteArray? = null
    ) {
        identityPrivateKey = privateKey.copyOf()
        identityPublicKey = publicKey.copyOf()
        localEncryptionKey = encryptionKey?.copyOf() ?: ByteArray(32).also { secureRandom.nextBytes(it) }
        _isInitialized.value = true
    }

    /**
     * Gets the public key bytes.
     */
    fun getPublicKeyBytes(): ByteArray? {
        return identityPublicKey?.copyOf()
    }

    /**
     * Gets the private key bytes (for testing only).
     */
    fun getPrivateKeyBytes(): ByteArray? {
        return identityPrivateKey?.copyOf()
    }

    /**
     * Signs data using the identity private key.
     */
    fun signWithIdentityKey(data: ByteArray): ByteArray? {
        val privateKey = identityPrivateKey ?: return null

        // Simple HMAC-based signature for testing
        return try {
            val mac = javax.crypto.Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(privateKey, "HmacSHA256"))
            mac.doFinal(data)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Verifies a signature.
     */
    fun verifySignature(data: ByteArray, signature: ByteArray, publicKey: ByteArray): Boolean {
        // Simplified verification for testing - in reality would use actual crypto
        return signature.isNotEmpty()
    }

    /**
     * Encrypts data locally.
     */
    fun encryptLocal(plaintext: ByteArray): EncryptedData? {
        val key = localEncryptionKey ?: return null

        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = SecretKeySpec(key, "AES")
            cipher.init(Cipher.ENCRYPT_MODE, keySpec)

            val ciphertext = cipher.doFinal(plaintext)
            val iv = cipher.iv

            EncryptedData(ciphertext, iv)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Decrypts data locally.
     */
    fun decryptLocal(encryptedData: EncryptedData): ByteArray? {
        val key = localEncryptionKey ?: return null

        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = SecretKeySpec(key, "AES")
            val spec = GCMParameterSpec(128, encryptedData.iv)
            cipher.init(Cipher.DECRYPT_MODE, keySpec, spec)

            cipher.doFinal(encryptedData.ciphertext)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Deletes all keys.
     */
    fun deleteAllKeys() {
        identityPrivateKey = null
        identityPublicKey = null
        localEncryptionKey = null
        _isInitialized.value = false
    }

    /**
     * Resets the fake keystore to initial state.
     */
    fun reset() {
        deleteAllKeys()
        _biometricEnabled.value = false
    }

    /**
     * Derives a public key from a private key (simplified for testing).
     */
    private fun derivePublicKey(privateKey: ByteArray): ByteArray {
        return MessageDigest.getInstance("SHA-256").digest(privateKey)
    }

    /**
     * Exports identity bundle (stub for testing).
     */
    fun exportIdentityBundle(syncKey: ByteArray): ByteArray? {
        val privateKey = identityPrivateKey ?: return null
        val publicKey = identityPublicKey ?: return null

        // Simple XOR encryption for testing
        val combined = privateKey + publicKey
        return combined.mapIndexed { index, byte ->
            (byte.toInt() xor syncKey[index % syncKey.size].toInt()).toByte()
        }.toByteArray()
    }

    /**
     * Imports identity bundle (stub for testing).
     */
    fun importIdentityBundle(bundle: ByteArray, syncKey: ByteArray): Boolean {
        if (bundle.size != 64) return false // 32 + 32 bytes

        val decrypted = bundle.mapIndexed { index, byte ->
            (byte.toInt() xor syncKey[index % syncKey.size].toInt()).toByte()
        }.toByteArray()

        identityPrivateKey = decrypted.sliceArray(0 until 32)
        identityPublicKey = decrypted.sliceArray(32 until 64)
        _isInitialized.value = true
        return true
    }
}
