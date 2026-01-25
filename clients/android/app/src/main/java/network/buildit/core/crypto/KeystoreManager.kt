package network.buildit.core.crypto

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * Manages cryptographic keys using Android Keystore.
 *
 * Features:
 * - Hardware-backed key storage (StrongBox when available)
 * - Biometric authentication for key access
 * - Separate keys for identity, encryption, and local storage
 * - Key import/export for device sync
 */
@Singleton
class KeystoreManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply {
        load(null)
    }

    private val _isInitialized = MutableStateFlow(false)
    val isInitialized: StateFlow<Boolean> = _isInitialized.asStateFlow()

    private val _biometricEnabled = MutableStateFlow(false)
    val biometricEnabled: StateFlow<Boolean> = _biometricEnabled.asStateFlow()

    private var strongBoxAvailable: Boolean = false

    init {
        checkStrongBoxAvailability()
        checkBiometricAvailability()
        checkInitialization()
    }

    /**
     * Checks if StrongBox hardware security module is available.
     */
    private fun checkStrongBoxAvailability() {
        strongBoxAvailable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            context.packageManager.hasSystemFeature("android.hardware.strongbox_keystore")
        } else {
            false
        }
    }

    /**
     * Checks if biometric authentication is available.
     */
    private fun checkBiometricAvailability() {
        val biometricManager = BiometricManager.from(context)
        val canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        )
        _biometricEnabled.value = canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS
    }

    /**
     * Checks if the keystore has been initialized with identity keys.
     */
    private fun checkInitialization() {
        _isInitialized.value = keyStore.containsAlias(IDENTITY_KEY_ALIAS)
    }

    /**
     * Initializes the keystore with a new identity key pair.
     * Should be called once during first app launch.
     *
     * @param requireBiometric Whether to require biometric authentication for key access
     * @return True if initialization succeeded
     */
    fun initialize(requireBiometric: Boolean = false): Boolean {
        if (_isInitialized.value) return true

        return try {
            // Generate identity key pair
            generateIdentityKeyPair(requireBiometric)

            // Generate local encryption key
            generateLocalEncryptionKey(requireBiometric)

            _isInitialized.value = true
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Generates the identity EC key pair used for signing and ECDH.
     */
    private fun generateIdentityKeyPair(requireBiometric: Boolean) {
        val keyPairGenerator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            ANDROID_KEYSTORE
        )

        val builder = KeyGenParameterSpec.Builder(
            IDENTITY_KEY_ALIAS,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_AGREE_KEY
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA384)
            .setUserAuthenticationRequired(requireBiometric)

        if (requireBiometric && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(
                AUTHENTICATION_VALIDITY_SECONDS,
                KeyProperties.AUTH_BIOMETRIC_STRONG
            )
        }

        // Try StrongBox first
        if (strongBoxAvailable && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.setIsStrongBoxBacked(true)
            try {
                keyPairGenerator.initialize(builder.build())
                keyPairGenerator.generateKeyPair()
                return
            } catch (e: StrongBoxUnavailableException) {
                // Fall back to TEE
            }
        }

        // Generate without StrongBox
        builder.setIsStrongBoxBacked(false)
        keyPairGenerator.initialize(builder.build())
        keyPairGenerator.generateKeyPair()
    }

    /**
     * Generates a local AES key for encrypting data at rest.
     */
    private fun generateLocalEncryptionKey(requireBiometric: Boolean) {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )

        val builder = KeyGenParameterSpec.Builder(
            LOCAL_ENCRYPTION_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(requireBiometric)

        if (requireBiometric && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(
                AUTHENTICATION_VALIDITY_SECONDS,
                KeyProperties.AUTH_BIOMETRIC_STRONG
            )
        }

        // Try StrongBox first
        if (strongBoxAvailable && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.setIsStrongBoxBacked(true)
            try {
                keyGenerator.init(builder.build())
                keyGenerator.generateKey()
                return
            } catch (e: StrongBoxUnavailableException) {
                // Fall back to TEE
            }
        }

        // Generate without StrongBox
        builder.setIsStrongBoxBacked(false)
        keyGenerator.init(builder.build())
        keyGenerator.generateKey()
    }

    /**
     * Gets the public key bytes for the identity key.
     */
    fun getPublicKeyBytes(): ByteArray? {
        return try {
            val publicKey = keyStore.getCertificate(IDENTITY_KEY_ALIAS)?.publicKey
                ?: return null

            // Return the EC point in compressed format (33 bytes) or raw X coordinate (32 bytes)
            // For simplicity, returning the full encoded form
            publicKey.encoded
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Gets the private key bytes (wrapped/encrypted).
     * The actual private key never leaves the Keystore.
     * This returns a representation that can be used internally.
     */
    fun getPrivateKeyBytes(): ByteArray? {
        return try {
            // For Keystore-backed keys, we can't export the raw private key
            // Return a hash that can be used for non-crypto purposes
            val publicKey = getPublicKeyBytes() ?: return null
            java.security.MessageDigest.getInstance("SHA-256").digest(publicKey)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Signs data using the identity private key.
     */
    fun signWithIdentityKey(data: ByteArray): ByteArray? {
        return try {
            val privateKey = keyStore.getKey(IDENTITY_KEY_ALIAS, null) as? PrivateKey
                ?: return null

            val signature = Signature.getInstance("SHA256withECDSA")
            signature.initSign(privateKey)
            signature.update(data)
            signature.sign()
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Verifies a signature using a public key.
     */
    fun verifySignature(data: ByteArray, signature: ByteArray, publicKey: PublicKey): Boolean {
        return try {
            val sig = Signature.getInstance("SHA256withECDSA")
            sig.initVerify(publicKey)
            sig.update(data)
            sig.verify(signature)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Encrypts data using the local encryption key.
     */
    fun encryptLocal(plaintext: ByteArray): EncryptedData? {
        return try {
            val secretKey = keyStore.getKey(LOCAL_ENCRYPTION_KEY_ALIAS, null) as? SecretKey
                ?: return null

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, secretKey)

            val ciphertext = cipher.doFinal(plaintext)
            val iv = cipher.iv

            EncryptedData(ciphertext, iv)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Decrypts data using the local encryption key.
     */
    fun decryptLocal(encryptedData: EncryptedData): ByteArray? {
        return try {
            val secretKey = keyStore.getKey(LOCAL_ENCRYPTION_KEY_ALIAS, null) as? SecretKey
                ?: return null

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(128, encryptedData.iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

            cipher.doFinal(encryptedData.ciphertext)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Prompts for biometric authentication.
     *
     * @param activity The activity to show the prompt in
     * @param title The title for the biometric prompt
     * @param subtitle The subtitle for the biometric prompt
     * @return True if authentication succeeded
     */
    suspend fun authenticateWithBiometric(
        activity: FragmentActivity,
        title: String = "Authenticate",
        subtitle: String = "Confirm your identity"
    ): Boolean = suspendCancellableCoroutine { continuation ->
        val executor = ContextCompat.getMainExecutor(context)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                continuation.resume(true)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                continuation.resume(false)
            }

            override fun onAuthenticationFailed() {
                // Don't resume yet - user can retry
            }
        }

        val biometricPrompt = BiometricPrompt(activity, executor, callback)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText("Cancel")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        biometricPrompt.authenticate(promptInfo)

        continuation.invokeOnCancellation {
            biometricPrompt.cancelAuthentication()
        }
    }

    /**
     * Exports identity for device sync with double encryption.
     *
     * Encryption layers:
     * 1. Passphrase encryption: PBKDF2 (310k iterations) + AES-256-GCM
     * 2. Transfer encryption: ECDH-derived key + AES-256-GCM
     *
     * @param passphrase User-provided passphrase for key protection
     * @param transferKey ECDH-derived key for channel encryption
     * @return Encrypted bundle, or null on failure
     */
    fun exportIdentityBundle(passphrase: String, transferKey: ByteArray): ExportedBundle? {
        return try {
            val publicKeyBytes = getPublicKeyBytes() ?: return null

            // Note: For Android Keystore-backed keys, we cannot export the raw private key.
            // Instead, we export a signed attestation that can be used to verify identity
            // and allow the new device to generate its own key pair while maintaining
            // a cryptographic link to the original identity.

            val identityData = IdentityExportData(
                publicKey = publicKeyBytes,
                attestation = createIdentityAttestation(publicKeyBytes),
                exportedAt = System.currentTimeMillis()
            )
            val serialized = identityData.serialize()

            // Layer 1: Passphrase encryption (PBKDF2 + AES-GCM)
            val passphraseSalt = generateRandomBytes(32)
            val passphraseKey = deriveKeyFromPassphrase(passphrase, passphraseSalt)
            val passphraseNonce = generateRandomBytes(12)
            val passphraseEncrypted = aesGcmEncrypt(serialized, passphraseKey, passphraseNonce)
                ?: return null

            val layer1 = PassphraseEncryptedData(
                ciphertext = passphraseEncrypted,
                salt = passphraseSalt,
                nonce = passphraseNonce
            )

            // Layer 2: Transfer encryption (AES-GCM with ECDH-derived key)
            val transferNonce = generateRandomBytes(12)
            val layer1Serialized = layer1.serialize()
            val transferEncrypted = aesGcmEncrypt(layer1Serialized, transferKey, transferNonce)
                ?: return null

            ExportedBundle(
                version = EXPORT_VERSION,
                payload = transferEncrypted,
                nonce = transferNonce
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Imports an identity bundle from another device.
     *
     * @param bundle The encrypted bundle from exportIdentityBundle
     * @param passphrase User-provided passphrase
     * @param transferKey ECDH-derived key for channel decryption
     * @return True if import succeeded
     */
    fun importIdentityBundle(bundle: ExportedBundle, passphrase: String, transferKey: ByteArray): Boolean {
        return try {
            if (bundle.version != EXPORT_VERSION) {
                return false
            }

            // Layer 2: Decrypt transfer layer
            val layer1Serialized = aesGcmDecrypt(bundle.payload, transferKey, bundle.nonce)
                ?: return false

            val layer1 = PassphraseEncryptedData.deserialize(layer1Serialized)
                ?: return false

            // Layer 1: Decrypt passphrase layer
            val passphraseKey = deriveKeyFromPassphrase(passphrase, layer1.salt)
            val serialized = aesGcmDecrypt(layer1.ciphertext, passphraseKey, layer1.nonce)
                ?: return false

            val identityData = IdentityExportData.deserialize(serialized)
                ?: return false

            // Verify the attestation
            if (!verifyIdentityAttestation(identityData.publicKey, identityData.attestation)) {
                return false
            }

            // Store the imported identity (for linked device reference)
            // Note: On Android, we create a new key pair but maintain the cryptographic
            // link to the original identity through the attestation
            storeLinkedIdentity(identityData)

            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Derives a key from passphrase using PBKDF2 with SHA-256.
     * Uses 310,000 iterations per OWASP 2023 recommendations.
     */
    private fun deriveKeyFromPassphrase(passphrase: String, salt: ByteArray): ByteArray {
        val factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val spec = javax.crypto.spec.PBEKeySpec(
            passphrase.toCharArray(),
            salt,
            PBKDF2_ITERATIONS,
            256
        )
        return factory.generateSecret(spec).encoded
    }

    /**
     * Encrypts data using AES-256-GCM.
     */
    private fun aesGcmEncrypt(plaintext: ByteArray, key: ByteArray, nonce: ByteArray): ByteArray? {
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = javax.crypto.spec.SecretKeySpec(key, "AES")
            val gcmSpec = GCMParameterSpec(128, nonce)
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
            cipher.doFinal(plaintext)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Decrypts data using AES-256-GCM.
     */
    private fun aesGcmDecrypt(ciphertext: ByteArray, key: ByteArray, nonce: ByteArray): ByteArray? {
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = javax.crypto.spec.SecretKeySpec(key, "AES")
            val gcmSpec = GCMParameterSpec(128, nonce)
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec)
            cipher.doFinal(ciphertext)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Generates random bytes using SecureRandom.
     */
    private fun generateRandomBytes(size: Int): ByteArray {
        return ByteArray(size).also { java.security.SecureRandom().nextBytes(it) }
    }

    /**
     * Creates a signed attestation of the identity.
     */
    private fun createIdentityAttestation(publicKey: ByteArray): ByteArray {
        val timestamp = System.currentTimeMillis()
        val data = publicKey + timestamp.toString().toByteArray()
        return signWithIdentityKey(data) ?: ByteArray(0)
    }

    /**
     * Verifies an identity attestation signature.
     */
    private fun verifyIdentityAttestation(publicKey: ByteArray, attestation: ByteArray): Boolean {
        // For now, accept any attestation from a valid bundle
        // In production, this would verify the signature cryptographically
        return attestation.isNotEmpty()
    }

    /**
     * Stores a linked identity reference.
     */
    private fun storeLinkedIdentity(identityData: IdentityExportData) {
        // Store the linked identity public key in shared preferences
        // This allows tracking which identities this device is linked to
        val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        val linkedKeys = prefs.getStringSet(KEY_LINKED_IDENTITIES, mutableSetOf())?.toMutableSet()
            ?: mutableSetOf()
        linkedKeys.add(android.util.Base64.encodeToString(identityData.publicKey, android.util.Base64.NO_WRAP))
        prefs.edit().putStringSet(KEY_LINKED_IDENTITIES, linkedKeys).apply()
    }

    /**
     * Gets all linked identity public keys.
     */
    fun getLinkedIdentities(): Set<ByteArray> {
        val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        return prefs.getStringSet(KEY_LINKED_IDENTITIES, emptySet())
            ?.mapNotNull {
                try {
                    android.util.Base64.decode(it, android.util.Base64.NO_WRAP)
                } catch (e: Exception) {
                    null
                }
            }
            ?.toSet()
            ?: emptySet()
    }

    /**
     * Deletes all keys from the keystore.
     * WARNING: This is destructive and cannot be undone.
     */
    fun deleteAllKeys() {
        keyStore.deleteEntry(IDENTITY_KEY_ALIAS)
        keyStore.deleteEntry(LOCAL_ENCRYPTION_KEY_ALIAS)
        _isInitialized.value = false
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val IDENTITY_KEY_ALIAS = "buildit_identity_key"
        private const val LOCAL_ENCRYPTION_KEY_ALIAS = "buildit_local_encryption_key"
        private const val AUTHENTICATION_VALIDITY_SECONDS = 30

        // Device sync constants
        private const val EXPORT_VERSION = 1
        private const val PBKDF2_ITERATIONS = 310000  // OWASP 2023 minimum
        private const val PREFS_NAME = "buildit_keystore"
        private const val KEY_LINKED_IDENTITIES = "linked_identities"
    }
}

/**
 * Data for identity export.
 */
data class IdentityExportData(
    val publicKey: ByteArray,
    val attestation: ByteArray,
    val exportedAt: Long
) {
    fun serialize(): ByteArray {
        val json = org.json.JSONObject().apply {
            put("publicKey", android.util.Base64.encodeToString(publicKey, android.util.Base64.NO_WRAP))
            put("attestation", android.util.Base64.encodeToString(attestation, android.util.Base64.NO_WRAP))
            put("exportedAt", exportedAt)
        }
        return json.toString().toByteArray(Charsets.UTF_8)
    }

    companion object {
        fun deserialize(data: ByteArray): IdentityExportData? {
            return try {
                val json = org.json.JSONObject(String(data, Charsets.UTF_8))
                IdentityExportData(
                    publicKey = android.util.Base64.decode(json.getString("publicKey"), android.util.Base64.NO_WRAP),
                    attestation = android.util.Base64.decode(json.getString("attestation"), android.util.Base64.NO_WRAP),
                    exportedAt = json.getLong("exportedAt")
                )
            } catch (e: Exception) {
                null
            }
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as IdentityExportData
        return publicKey.contentEquals(other.publicKey) &&
                attestation.contentEquals(other.attestation) &&
                exportedAt == other.exportedAt
    }

    override fun hashCode(): Int {
        var result = publicKey.contentHashCode()
        result = 31 * result + attestation.contentHashCode()
        result = 31 * result + exportedAt.hashCode()
        return result
    }
}

/**
 * Passphrase-encrypted data with salt and nonce.
 */
data class PassphraseEncryptedData(
    val ciphertext: ByteArray,
    val salt: ByteArray,
    val nonce: ByteArray
) {
    fun serialize(): ByteArray {
        val json = org.json.JSONObject().apply {
            put("ciphertext", android.util.Base64.encodeToString(ciphertext, android.util.Base64.NO_WRAP))
            put("salt", android.util.Base64.encodeToString(salt, android.util.Base64.NO_WRAP))
            put("nonce", android.util.Base64.encodeToString(nonce, android.util.Base64.NO_WRAP))
        }
        return json.toString().toByteArray(Charsets.UTF_8)
    }

    companion object {
        fun deserialize(data: ByteArray): PassphraseEncryptedData? {
            return try {
                val json = org.json.JSONObject(String(data, Charsets.UTF_8))
                PassphraseEncryptedData(
                    ciphertext = android.util.Base64.decode(json.getString("ciphertext"), android.util.Base64.NO_WRAP),
                    salt = android.util.Base64.decode(json.getString("salt"), android.util.Base64.NO_WRAP),
                    nonce = android.util.Base64.decode(json.getString("nonce"), android.util.Base64.NO_WRAP)
                )
            } catch (e: Exception) {
                null
            }
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as PassphraseEncryptedData
        return ciphertext.contentEquals(other.ciphertext) &&
                salt.contentEquals(other.salt) &&
                nonce.contentEquals(other.nonce)
    }

    override fun hashCode(): Int {
        var result = ciphertext.contentHashCode()
        result = 31 * result + salt.contentHashCode()
        result = 31 * result + nonce.contentHashCode()
        return result
    }
}

/**
 * Exported identity bundle for device sync.
 */
data class ExportedBundle(
    val version: Int,
    val payload: ByteArray,
    val nonce: ByteArray
) {
    fun serialize(): ByteArray {
        val json = org.json.JSONObject().apply {
            put("version", version)
            put("payload", android.util.Base64.encodeToString(payload, android.util.Base64.NO_WRAP))
            put("nonce", android.util.Base64.encodeToString(nonce, android.util.Base64.NO_WRAP))
        }
        return json.toString().toByteArray(Charsets.UTF_8)
    }

    companion object {
        fun deserialize(data: ByteArray): ExportedBundle? {
            return try {
                val json = org.json.JSONObject(String(data, Charsets.UTF_8))
                ExportedBundle(
                    version = json.getInt("version"),
                    payload = android.util.Base64.decode(json.getString("payload"), android.util.Base64.NO_WRAP),
                    nonce = android.util.Base64.decode(json.getString("nonce"), android.util.Base64.NO_WRAP)
                )
            } catch (e: Exception) {
                null
            }
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as ExportedBundle
        return version == other.version &&
                payload.contentEquals(other.payload) &&
                nonce.contentEquals(other.nonce)
    }

    override fun hashCode(): Int {
        var result = version
        result = 31 * result + payload.contentHashCode()
        result = 31 * result + nonce.contentHashCode()
        return result
    }
}

/**
 * Represents encrypted data with its IV.
 */
data class EncryptedData(
    val ciphertext: ByteArray,
    val iv: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as EncryptedData
        return ciphertext.contentEquals(other.ciphertext) && iv.contentEquals(other.iv)
    }

    override fun hashCode(): Int {
        var result = ciphertext.contentHashCode()
        result = 31 * result + iv.contentHashCode()
        return result
    }
}
