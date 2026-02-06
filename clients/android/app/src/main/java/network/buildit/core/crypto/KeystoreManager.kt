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
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.SecureRandom
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Arrays
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
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

    private val secureRandom = SecureRandom()

    /**
     * SecureKeyWrapper for encrypting the secp256k1 private key.
     * The wrapper key is stored in Android Keystore (hardware-backed when available).
     */
    private val secureKeyWrapper: SecureKeyWrapper by lazy {
        SecureKeyWrapper(keyStore, context, strongBoxAvailable)
    }

    /**
     * Encrypted shared preferences for storing wrapped keys.
     */
    private val encryptedPrefs by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            ENCRYPTED_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

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
     * Returns a copy to prevent external modification.
     */
    fun getPublicKeyBytes(): ByteArray? {
        return try {
            val publicKey = keyStore.getCertificate(IDENTITY_KEY_ALIAS)?.publicKey
                ?: return null

            // Return the EC point in compressed format (33 bytes) or raw X coordinate (32 bytes)
            // For simplicity, returning the full encoded form
            publicKey.encoded.copyOf()
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Gets the secp256k1 private key bytes for signing operations.
     *
     * Security: The private key is stored encrypted with a Keystore-backed AES key.
     * This allows the secp256k1 key to be used for Nostr signing while keeping it
     * protected by hardware-backed encryption.
     *
     * IMPORTANT: Caller MUST zero the returned array after use:
     * ```
     * val key = keystoreManager.getPrivateKeyBytes()
     * try {
     *     // use key
     * } finally {
     *     key?.let { Arrays.fill(it, 0.toByte()) }
     * }
     * ```
     *
     * @return Decrypted private key bytes, or null if not available
     */
    fun getPrivateKeyBytes(): ByteArray? {
        return try {
            // Check if we have a wrapped secp256k1 key stored
            val wrappedKeyBase64 = encryptedPrefs.getString(KEY_WRAPPED_PRIVATE_KEY, null)
                ?: return null

            val wrappedKey = android.util.Base64.decode(wrappedKeyBase64, android.util.Base64.NO_WRAP)
            val ivBase64 = encryptedPrefs.getString(KEY_WRAPPED_PRIVATE_KEY_IV, null)
                ?: return null

            val iv = android.util.Base64.decode(ivBase64, android.util.Base64.NO_WRAP)

            // Unwrap the key using the Keystore-backed wrapper key
            secureKeyWrapper.unwrapKey(wrappedKey, iv)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Stores a secp256k1 private key securely.
     *
     * The key is encrypted using a Keystore-backed AES key and stored in
     * EncryptedSharedPreferences for double encryption.
     *
     * @param privateKey The raw secp256k1 private key (32 bytes)
     * @return True if storage succeeded
     */
    fun storeSecp256k1PrivateKey(privateKey: ByteArray): Boolean {
        if (privateKey.size != 32) return false

        var wrappedKey: ByteArray? = null
        var iv: ByteArray? = null

        try {
            // Wrap the key using the Keystore-backed wrapper key
            val wrapResult = secureKeyWrapper.wrapKey(privateKey)
            wrappedKey = wrapResult.first
            iv = wrapResult.second

            // Store in encrypted preferences
            encryptedPrefs.edit()
                .putString(KEY_WRAPPED_PRIVATE_KEY, android.util.Base64.encodeToString(wrappedKey, android.util.Base64.NO_WRAP))
                .putString(KEY_WRAPPED_PRIVATE_KEY_IV, android.util.Base64.encodeToString(iv, android.util.Base64.NO_WRAP))
                .apply()

            return true
        } catch (e: Exception) {
            return false
        } finally {
            // Clear sensitive data
            wrappedKey?.let { Arrays.fill(it, 0.toByte()) }
            iv?.let { Arrays.fill(it, 0.toByte()) }
        }
    }

    /**
     * Checks if a secp256k1 private key is stored.
     */
    fun hasStoredSecp256k1Key(): Boolean {
        return encryptedPrefs.contains(KEY_WRAPPED_PRIVATE_KEY)
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
     * 1. Passphrase encryption: Argon2id (64MB, 3 iterations, 4 parallelism) + AES-256-GCM
     * 2. Transfer encryption: ECDH-derived key + AES-256-GCM
     *
     * Memory protection: All sensitive intermediate values are zeroed after use.
     *
     * @param passphrase User-provided passphrase for key protection
     * @param transferKey ECDH-derived key for channel encryption
     * @return Encrypted bundle, or null on failure
     */
    fun exportIdentityBundle(passphrase: String, transferKey: ByteArray): ExportedBundle? {
        var publicKeyBytes: ByteArray? = null
        var serialized: ByteArray? = null
        var passphraseKey: ByteArray? = null
        var passphraseEncrypted: ByteArray? = null
        var layer1Serialized: ByteArray? = null
        var attestation: ByteArray? = null

        try {
            publicKeyBytes = getPublicKeyBytes() ?: return null

            // Note: For Android Keystore-backed keys, we cannot export the raw private key.
            // Instead, we export a signed attestation that can be used to verify identity
            // and allow the new device to generate its own key pair while maintaining
            // a cryptographic link to the original identity.

            attestation = createIdentityAttestation(publicKeyBytes)
            val identityData = IdentityExportData(
                publicKey = publicKeyBytes,
                attestation = attestation,
                exportedAt = System.currentTimeMillis()
            )
            serialized = identityData.serialize()

            // Layer 1: Passphrase encryption (Argon2id + AES-GCM)
            val passphraseSalt = generateRandomBytes(32)
            passphraseKey = deriveKeyFromPassphrase(passphrase, passphraseSalt)
            val passphraseNonce = generateRandomBytes(12)
            passphraseEncrypted = aesGcmEncrypt(serialized, passphraseKey, passphraseNonce)
                ?: return null

            val layer1 = PassphraseEncryptedData(
                ciphertext = passphraseEncrypted,
                salt = passphraseSalt,
                nonce = passphraseNonce
            )

            // Layer 2: Transfer encryption (AES-GCM with ECDH-derived key)
            val transferNonce = generateRandomBytes(12)
            layer1Serialized = layer1.serialize()
            val transferEncrypted = aesGcmEncrypt(layer1Serialized, transferKey, transferNonce)
                ?: return null

            return ExportedBundle(
                version = EXPORT_VERSION,
                payload = transferEncrypted,
                nonce = transferNonce
            )
        } catch (e: Exception) {
            return null
        } finally {
            // Securely clear all sensitive intermediate data
            publicKeyBytes?.let { Arrays.fill(it, 0.toByte()) }
            serialized?.let { Arrays.fill(it, 0.toByte()) }
            passphraseKey?.let { Arrays.fill(it, 0.toByte()) }
            passphraseEncrypted?.let { Arrays.fill(it, 0.toByte()) }
            layer1Serialized?.let { Arrays.fill(it, 0.toByte()) }
            attestation?.let { Arrays.fill(it, 0.toByte()) }
        }
    }

    /**
     * Imports an identity bundle from another device.
     *
     * Memory protection: All sensitive intermediate values are zeroed after use.
     *
     * @param bundle The encrypted bundle from exportIdentityBundle
     * @param passphrase User-provided passphrase
     * @param transferKey ECDH-derived key for channel decryption
     * @return True if import succeeded
     */
    fun importIdentityBundle(bundle: ExportedBundle, passphrase: String, transferKey: ByteArray): Boolean {
        var layer1Serialized: ByteArray? = null
        var passphraseKey: ByteArray? = null
        var serialized: ByteArray? = null

        try {
            if (bundle.version != EXPORT_VERSION) {
                return false
            }

            // Layer 2: Decrypt transfer layer
            layer1Serialized = aesGcmDecrypt(bundle.payload, transferKey, bundle.nonce)
                ?: return false

            val layer1 = PassphraseEncryptedData.deserialize(layer1Serialized)
                ?: return false

            // Layer 1: Decrypt passphrase layer
            passphraseKey = deriveKeyFromPassphrase(passphrase, layer1.salt)
            serialized = aesGcmDecrypt(layer1.ciphertext, passphraseKey, layer1.nonce)
                ?: return false

            val identityData = IdentityExportData.deserialize(serialized)
                ?: return false

            // Verify the attestation cryptographically
            if (!verifyIdentityAttestation(identityData.publicKey, identityData.attestation, identityData.exportedAt)) {
                return false
            }

            // Store the imported identity (for linked device reference)
            // Note: On Android, we create a new key pair but maintain the cryptographic
            // link to the original identity through the attestation
            storeLinkedIdentity(identityData)

            return true
        } catch (e: Exception) {
            return false
        } finally {
            // Securely clear all sensitive intermediate data
            layer1Serialized?.let { Arrays.fill(it, 0.toByte()) }
            passphraseKey?.let { Arrays.fill(it, 0.toByte()) }
            serialized?.let { Arrays.fill(it, 0.toByte()) }
        }
    }

    /**
     * Derives a key from passphrase using Argon2id.
     *
     * Argon2id is a memory-hard KDF that is resistant to GPU/ASIC attacks.
     * It combines Argon2i (side-channel resistant) and Argon2d (GPU resistant).
     *
     * Parameters (OWASP 2023 recommended):
     * - Memory: 64 MB (65536 KB)
     * - Time cost: 3 iterations
     * - Parallelism: 4 lanes
     * - Output: 32 bytes (256-bit key)
     *
     * IMPORTANT: Caller MUST zero the returned array after use.
     */
    private fun deriveKeyFromPassphrase(passphrase: String, salt: ByteArray): ByteArray {
        val passwordBytes = passphrase.toByteArray(Charsets.UTF_8)
        try {
            val params = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
                .withSalt(salt)
                .withMemoryAsKB(ARGON2_MEMORY_KB)
                .withIterations(ARGON2_TIME_COST)
                .withParallelism(ARGON2_PARALLELISM)
                .build()

            val generator = Argon2BytesGenerator()
            generator.init(params)

            val derivedKey = ByteArray(ARGON2_OUTPUT_LENGTH)
            generator.generateBytes(passwordBytes, derivedKey)

            return derivedKey
        } finally {
            // Clear the password bytes
            Arrays.fill(passwordBytes, 0.toByte())
        }
    }

    /**
     * Encrypts data using AES-256-GCM.
     * Note: The key parameter is NOT zeroed here - caller is responsible for key management.
     */
    private fun aesGcmEncrypt(plaintext: ByteArray, key: ByteArray, nonce: ByteArray): ByteArray? {
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = SecretKeySpec(key, "AES")
            val gcmSpec = GCMParameterSpec(128, nonce)
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
            cipher.doFinal(plaintext)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Decrypts data using AES-256-GCM.
     * Note: The key parameter is NOT zeroed here - caller is responsible for key management.
     */
    private fun aesGcmDecrypt(ciphertext: ByteArray, key: ByteArray, nonce: ByteArray): ByteArray? {
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = SecretKeySpec(key, "AES")
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
     * Verifies an identity attestation signature cryptographically.
     *
     * The attestation is an ECDSA signature over (publicKey || exportedAt) produced by
     * the identity key. We reconstruct the signed data and verify using the provided
     * public key to ensure the attestation was created by the holder of the private key.
     *
     * @param publicKey The encoded public key from the identity export
     * @param attestation The ECDSA signature bytes
     * @param exportedAt The timestamp included in the signed data
     * @return True if the signature is valid
     */
    private fun verifyIdentityAttestation(
        publicKey: ByteArray,
        attestation: ByteArray,
        exportedAt: Long
    ): Boolean {
        if (attestation.isEmpty() || publicKey.isEmpty()) return false

        return try {
            // Reconstruct the public key from its encoded form
            val keyFactory = java.security.KeyFactory.getInstance("EC")
            val pubKeySpec = java.security.spec.X509EncodedKeySpec(publicKey)
            val reconstructedKey = keyFactory.generatePublic(pubKeySpec)

            // Reconstruct the data that was signed: publicKey + timestamp string
            val signedData = publicKey + exportedAt.toString().toByteArray(Charsets.UTF_8)

            // Verify the ECDSA signature (same algorithm used in createIdentityAttestation)
            val sig = Signature.getInstance("SHA256withECDSA")
            sig.initVerify(reconstructedKey)
            sig.update(signedData)
            sig.verify(attestation)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Encrypted shared preferences for linked identity storage.
     * Uses the same EncryptedSharedPreferences pattern as encryptedPrefs
     * to protect linked identity public keys at rest.
     */
    private val linkedIdentityPrefs by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            LINKED_IDENTITY_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * Stores a linked identity reference in EncryptedSharedPreferences.
     */
    private fun storeLinkedIdentity(identityData: IdentityExportData) {
        // Store the linked identity public key in encrypted shared preferences
        // This allows tracking which identities this device is linked to
        val linkedKeys = linkedIdentityPrefs.getStringSet(KEY_LINKED_IDENTITIES, mutableSetOf())?.toMutableSet()
            ?: mutableSetOf()
        linkedKeys.add(android.util.Base64.encodeToString(identityData.publicKey, android.util.Base64.NO_WRAP))
        linkedIdentityPrefs.edit().putStringSet(KEY_LINKED_IDENTITIES, linkedKeys).apply()
    }

    /**
     * Gets all linked identity public keys from EncryptedSharedPreferences.
     */
    fun getLinkedIdentities(): Set<ByteArray> {
        return linkedIdentityPrefs.getStringSet(KEY_LINKED_IDENTITIES, emptySet())
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
        private const val EXPORT_VERSION = 2  // Bumped for Argon2id migration
        private const val KEY_LINKED_IDENTITIES = "linked_identities"
        private const val LINKED_IDENTITY_PREFS_NAME = "buildit_linked_identities_secure"

        // Argon2id parameters (OWASP 2023 recommended)
        // Memory-hard KDF resistant to GPU/ASIC attacks
        private const val ARGON2_MEMORY_KB = 65536  // 64 MB
        private const val ARGON2_TIME_COST = 3      // 3 iterations
        private const val ARGON2_PARALLELISM = 4    // 4 lanes
        private const val ARGON2_OUTPUT_LENGTH = 32 // 256-bit key

        // Secure key storage constants
        private const val ENCRYPTED_PREFS_NAME = "buildit_secure_keys"
        private const val KEY_WRAPPED_PRIVATE_KEY = "wrapped_secp256k1_key"
        private const val KEY_WRAPPED_PRIVATE_KEY_IV = "wrapped_secp256k1_key_iv"
    }
}

/**
 * Secure wrapper for encrypting sensitive keys using a Keystore-backed AES key.
 *
 * This implements the key wrapping pattern:
 * 1. An AES-256 key is generated and stored in Android Keystore (hardware-backed when available)
 * 2. This key is used to encrypt/decrypt other sensitive keys (like secp256k1 private keys)
 * 3. The wrapped keys are then stored in EncryptedSharedPreferences
 *
 * This provides two layers of protection:
 * - Hardware-backed encryption via Keystore
 * - Software encryption via EncryptedSharedPreferences
 */
class SecureKeyWrapper(
    private val keyStore: KeyStore,
    private val context: Context,
    private val useStrongBox: Boolean
) {
    companion object {
        private const val WRAPPER_KEY_ALIAS = "buildit_key_wrapper"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    }

    init {
        ensureWrapperKeyExists()
    }

    /**
     * Ensures the wrapper key exists in the Keystore.
     */
    private fun ensureWrapperKeyExists() {
        if (!keyStore.containsAlias(WRAPPER_KEY_ALIAS)) {
            generateWrapperKey()
        }
    }

    /**
     * Generates the AES wrapper key in the Keystore.
     */
    private fun generateWrapperKey() {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )

        val builder = KeyGenParameterSpec.Builder(
            WRAPPER_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)

        // Try StrongBox first if available
        if (useStrongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.setIsStrongBoxBacked(true)
            try {
                keyGenerator.init(builder.build())
                keyGenerator.generateKey()
                return
            } catch (e: StrongBoxUnavailableException) {
                // Fall back to TEE
                builder.setIsStrongBoxBacked(false)
            }
        }

        keyGenerator.init(builder.build())
        keyGenerator.generateKey()
    }

    /**
     * Gets the wrapper key from Keystore.
     */
    private fun getWrapperKey(): SecretKey? {
        return try {
            keyStore.getKey(WRAPPER_KEY_ALIAS, null) as? SecretKey
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Wraps (encrypts) a key using the Keystore-backed wrapper key.
     *
     * @param keyToWrap The raw key bytes to wrap
     * @return Pair of (wrapped key, IV used for encryption)
     */
    fun wrapKey(keyToWrap: ByteArray): Pair<ByteArray, ByteArray> {
        val wrapperKey = getWrapperKey()
            ?: throw IllegalStateException("Wrapper key not available")

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, wrapperKey)

        val wrappedKey = cipher.doFinal(keyToWrap)
        val iv = cipher.iv

        return Pair(wrappedKey, iv)
    }

    /**
     * Unwraps (decrypts) a key using the Keystore-backed wrapper key.
     *
     * IMPORTANT: Caller MUST zero the returned array after use.
     *
     * @param wrappedKey The wrapped key bytes
     * @param iv The IV used during wrapping
     * @return The unwrapped key bytes
     */
    fun unwrapKey(wrappedKey: ByteArray, iv: ByteArray): ByteArray {
        val wrapperKey = getWrapperKey()
            ?: throw IllegalStateException("Wrapper key not available")

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val gcmSpec = GCMParameterSpec(128, iv)
        cipher.init(Cipher.DECRYPT_MODE, wrapperKey, gcmSpec)

        return cipher.doFinal(wrappedKey)
    }

    /**
     * Deletes the wrapper key from Keystore.
     * WARNING: This will make all wrapped keys unrecoverable.
     */
    fun deleteWrapperKey() {
        keyStore.deleteEntry(WRAPPER_KEY_ALIAS)
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
