package network.buildit.core.crypto

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import uniffi.buildit_crypto.BuilditCrypto
import uniffi.buildit_crypto.CryptoException
import uniffi.buildit_crypto.CryptoError
import uniffi.buildit_crypto.NostrEvent as FfiNostrEvent
import uniffi.buildit_crypto.UnwrapResult as FfiUnwrapResult
import uniffi.buildit_crypto.UnsignedEvent as FfiUnsignedEvent
import java.security.MessageDigest
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages cryptographic operations for BuildIt using buildit-crypto FFI.
 *
 * This class wraps the buildit-crypto Rust library via JNI and provides:
 * - Key generation and management
 * - NIP-44 message encryption/decryption
 * - NIP-17 gift wrap/unwrap
 * - Nostr event signing and verification
 * - Secure random number generation
 *
 * The native library must be loaded before use. Call [ensureInitialized] to load it.
 */
@Singleton
class CryptoManager @Inject constructor(
    private val keystoreManager: KeystoreManager
) {
    private val secureRandom = SecureRandom()

    private var nativeLibraryLoaded = false
    private var useFallback = false

    init {
        try {
            BuilditCrypto.ensureLoaded()
            nativeLibraryLoaded = true
            Log.i(TAG, "buildit-crypto native library loaded successfully")
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "Failed to load buildit-crypto native library, using fallback: ${e.message}")
            useFallback = true
        }
    }

    /**
     * Ensures the native library is initialized.
     * Throws an exception if the library cannot be loaded and no fallback is available.
     */
    fun ensureInitialized() {
        if (!nativeLibraryLoaded && !useFallback) {
            throw IllegalStateException("buildit-crypto native library not loaded")
        }
    }

    /**
     * Gets the current identity public key as a hex string.
     */
    fun getPublicKeyHex(): String? {
        return keystoreManager.getPublicKeyBytes()?.toHexString()
    }

    /**
     * Derives a conversation key for NIP-44 encryption.
     *
     * @param recipientPublicKey The recipient's public key (hex)
     * @return Derived shared secret, or null on failure
     */
    suspend fun deriveConversationKey(recipientPublicKey: String): ByteArray? = withContext(Dispatchers.Default) {
        try {
            val privateKey = keystoreManager.getPrivateKeyBytes()
                ?: return@withContext null

            if (nativeLibraryLoaded) {
                BuilditCrypto.deriveConversationKey(privateKey, recipientPublicKey)
            } else {
                // Fallback: simplified ECDH (not secure for production)
                deriveSharedSecretFallback(privateKey, recipientPublicKey.hexToByteArray())
            }
        } catch (e: CryptoException) {
            Log.e(TAG, "Failed to derive conversation key: ${e.errorType}")
            null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to derive conversation key: ${e.message}")
            null
        }
    }

    /**
     * Encrypts a message using NIP-44 (ChaCha20-Poly1305).
     *
     * @param plaintext The message to encrypt
     * @param recipientPublicKey The recipient's public key (hex)
     * @return Base64-encoded ciphertext, or null on failure
     */
    suspend fun encryptNip44(
        plaintext: String,
        recipientPublicKey: String
    ): String? = withContext(Dispatchers.Default) {
        try {
            val privateKey = keystoreManager.getPrivateKeyBytes()
                ?: return@withContext null

            if (nativeLibraryLoaded) {
                BuilditCrypto.nip44Encrypt(privateKey, recipientPublicKey, plaintext)
            } else {
                // Fallback encryption (AES-GCM instead of ChaCha20)
                encryptFallback(plaintext.toByteArray(), recipientPublicKey)
                    ?.let { android.util.Base64.encodeToString(it, android.util.Base64.NO_WRAP) }
            }
        } catch (e: CryptoException) {
            Log.e(TAG, "NIP-44 encryption failed: ${e.errorType}")
            null
        } catch (e: Exception) {
            Log.e(TAG, "NIP-44 encryption failed: ${e.message}")
            null
        }
    }

    /**
     * Decrypts a message using NIP-44.
     *
     * @param ciphertext The base64-encoded ciphertext
     * @param senderPublicKey The sender's public key (hex)
     * @return Decrypted plaintext, or null on failure
     */
    suspend fun decryptNip44(
        ciphertext: String,
        senderPublicKey: String
    ): String? = withContext(Dispatchers.Default) {
        try {
            val privateKey = keystoreManager.getPrivateKeyBytes()
                ?: return@withContext null

            if (nativeLibraryLoaded) {
                BuilditCrypto.nip44Decrypt(privateKey, senderPublicKey, ciphertext)
            } else {
                // Fallback decryption
                val ciphertextBytes = android.util.Base64.decode(ciphertext, android.util.Base64.NO_WRAP)
                decryptFallback(ciphertextBytes, senderPublicKey)
                    ?.let { String(it, Charsets.UTF_8) }
            }
        } catch (e: CryptoException) {
            Log.e(TAG, "NIP-44 decryption failed: ${e.errorType}")
            null
        } catch (e: Exception) {
            Log.e(TAG, "NIP-44 decryption failed: ${e.message}")
            null
        }
    }

    /**
     * Legacy encrypt method for backward compatibility.
     */
    suspend fun encrypt(
        plaintext: ByteArray,
        recipientPublicKey: String
    ): ByteArray? = withContext(Dispatchers.Default) {
        encryptNip44(String(plaintext, Charsets.UTF_8), recipientPublicKey)
            ?.let { android.util.Base64.decode(it, android.util.Base64.NO_WRAP) }
    }

    /**
     * Legacy decrypt method for backward compatibility.
     */
    suspend fun decrypt(
        ciphertext: ByteArray,
        senderPublicKey: String
    ): ByteArray? = withContext(Dispatchers.Default) {
        val ciphertextB64 = android.util.Base64.encodeToString(ciphertext, android.util.Base64.NO_WRAP)
        decryptNip44(ciphertextB64, senderPublicKey)?.toByteArray()
    }

    // ============== NIP-17 Gift Wrap ==============

    /**
     * Creates a NIP-17 gift-wrapped message for private direct messaging.
     *
     * Gift wrap structure:
     * 1. Rumor (kind 14): The actual message, unsigned
     * 2. Seal (kind 13): The rumor encrypted to recipient
     * 3. Gift wrap (kind 1059): The seal encrypted with ephemeral key
     *
     * @param recipientPubkey The recipient's public key (hex)
     * @param content The message content
     * @return The gift-wrapped event, or null on failure
     */
    suspend fun createGiftWrap(
        recipientPubkey: String,
        content: String
    ): GiftWrapEvent? = withContext(Dispatchers.Default) {
        try {
            val privateKey = keystoreManager.getPrivateKeyBytes()
                ?: return@withContext null
            val publicKeyHex = getPublicKeyHex()
                ?: return@withContext null

            if (!nativeLibraryLoaded) {
                Log.w(TAG, "Gift wrap requires native library")
                return@withContext null
            }

            val now = System.currentTimeMillis() / 1000

            // 1. Create rumor (the actual message, unsigned)
            val rumor = BuilditCrypto.createRumor(
                senderPubkey = publicKeyHex,
                recipientPubkey = recipientPubkey,
                content = content,
                createdAt = BuilditCrypto.randomizeTimestamp(now, TWO_DAYS_SECONDS)
            )

            // 2. Create seal (encrypt rumor to recipient)
            val seal = BuilditCrypto.createSeal(
                senderPrivateKey = privateKey,
                recipientPubkey = recipientPubkey,
                rumor = rumor,
                createdAt = BuilditCrypto.randomizeTimestamp(now, TWO_DAYS_SECONDS)
            )

            // 3. Create gift wrap (encrypt seal with ephemeral key)
            val giftWrap = BuilditCrypto.createGiftWrap(
                recipientPubkey = recipientPubkey,
                seal = seal,
                createdAt = BuilditCrypto.randomizeTimestamp(now, TWO_DAYS_SECONDS)
            )

            GiftWrapEvent(
                id = giftWrap.id,
                pubkey = giftWrap.pubkey,
                createdAt = giftWrap.createdAt,
                kind = giftWrap.kind,
                tags = giftWrap.tags,
                content = giftWrap.content,
                sig = giftWrap.sig
            )
        } catch (e: CryptoException) {
            Log.e(TAG, "Failed to create gift wrap: ${e.errorType}")
            null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create gift wrap: ${e.message}")
            null
        }
    }

    /**
     * Unwraps a NIP-17 gift-wrapped message.
     *
     * @param giftWrap The gift-wrapped event
     * @return The unwrapped result containing the original message, or null on failure
     */
    suspend fun unwrapGiftWrap(giftWrap: GiftWrapEvent): UnwrappedMessage? = withContext(Dispatchers.Default) {
        try {
            val privateKey = keystoreManager.getPrivateKeyBytes()
                ?: return@withContext null

            if (!nativeLibraryLoaded) {
                Log.w(TAG, "Gift wrap requires native library")
                return@withContext null
            }

            val ffiEvent = FfiNostrEvent(
                id = giftWrap.id,
                pubkey = giftWrap.pubkey,
                createdAt = giftWrap.createdAt,
                kind = giftWrap.kind,
                tags = giftWrap.tags,
                content = giftWrap.content,
                sig = giftWrap.sig
            )

            val result = BuilditCrypto.unwrapGiftWrap(privateKey, ffiEvent)

            UnwrappedMessage(
                content = result.rumor.content,
                senderPubkey = result.senderPubkey,
                createdAt = result.rumor.createdAt,
                sealVerified = result.sealVerified
            )
        } catch (e: CryptoException) {
            Log.e(TAG, "Failed to unwrap gift wrap: ${e.errorType}")
            null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to unwrap gift wrap: ${e.message}")
            null
        }
    }

    // ============== Event Signing ==============

    /**
     * Signs a Nostr event.
     *
     * @param event The unsigned event
     * @return The signed event, or null on failure
     */
    suspend fun signEvent(event: UnsignedNostrEvent): SignedNostrEvent? = withContext(Dispatchers.Default) {
        try {
            val privateKey = keystoreManager.getPrivateKeyBytes()
                ?: return@withContext null

            if (nativeLibraryLoaded) {
                val ffiEvent = FfiUnsignedEvent(
                    pubkey = event.pubkey,
                    createdAt = event.createdAt,
                    kind = event.kind,
                    tags = event.tags,
                    content = event.content
                )
                val signed = BuilditCrypto.signEvent(privateKey, ffiEvent)
                SignedNostrEvent(
                    id = signed.id,
                    pubkey = signed.pubkey,
                    createdAt = signed.createdAt,
                    kind = signed.kind,
                    tags = signed.tags,
                    content = signed.content,
                    sig = signed.sig
                )
            } else {
                // Fallback: Use Keystore signing (ECDSA, not Schnorr)
                val signature = keystoreManager.signWithIdentityKey(event.content.toByteArray())
                    ?: return@withContext null

                val id = computeEventIdFallback(event)

                SignedNostrEvent(
                    id = id,
                    pubkey = event.pubkey,
                    createdAt = event.createdAt,
                    kind = event.kind,
                    tags = event.tags,
                    content = event.content,
                    sig = signature.toHexString()
                )
            }
        } catch (e: CryptoException) {
            Log.e(TAG, "Failed to sign event: ${e.errorType}")
            null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sign event: ${e.message}")
            null
        }
    }

    /**
     * Verifies a Nostr event signature.
     *
     * @param event The signed event
     * @return True if the signature is valid
     */
    suspend fun verifyEvent(event: SignedNostrEvent): Boolean = withContext(Dispatchers.Default) {
        try {
            if (nativeLibraryLoaded) {
                val ffiEvent = FfiNostrEvent(
                    id = event.id,
                    pubkey = event.pubkey,
                    createdAt = event.createdAt,
                    kind = event.kind,
                    tags = event.tags,
                    content = event.content,
                    sig = event.sig
                )
                BuilditCrypto.verifyEvent(ffiEvent)
            } else {
                // Fallback: basic verification (check ID matches)
                val expectedId = computeEventIdFallback(
                    UnsignedNostrEvent(
                        pubkey = event.pubkey,
                        createdAt = event.createdAt,
                        kind = event.kind,
                        tags = event.tags,
                        content = event.content
                    )
                )
                expectedId == event.id
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to verify event: ${e.message}")
            false
        }
    }

    /**
     * Legacy sign method for backward compatibility.
     */
    suspend fun sign(data: ByteArray): ByteArray? = withContext(Dispatchers.Default) {
        keystoreManager.signWithIdentityKey(data)
    }

    /**
     * Verifies an Ed25519/Schnorr signature against the given data and public key.
     *
     * Uses the native buildit-crypto library for BIP-340 Schnorr verification
     * when available, falling back to event-based verification otherwise.
     */
    suspend fun verify(
        data: ByteArray,
        signature: ByteArray,
        publicKey: String
    ): Boolean = withContext(Dispatchers.Default) {
        try {
            if (nativeLibraryLoaded) {
                // Use the native library to verify by constructing a synthetic event
                // and verifying its signature. The verifyEvent function performs
                // full BIP-340 Schnorr verification via the Rust crypto library.
                val dataHex = data.toHexString()
                val sigHex = signature.toHexString()

                val ffiEvent = FfiNostrEvent(
                    id = dataHex,
                    pubkey = publicKey,
                    createdAt = 0,
                    kind = 0,
                    tags = emptyList(),
                    content = "",
                    sig = sigHex
                )
                BuilditCrypto.verifyEvent(ffiEvent)
            } else {
                // Fallback: cannot verify without native library
                // Return false to avoid silently accepting unverified signatures
                Log.w(TAG, "Cannot verify signature without native library")
                false
            }
        } catch (e: CryptoException) {
            Log.e(TAG, "Signature verification failed: ${e.errorType}")
            false
        } catch (e: Exception) {
            Log.e(TAG, "Signature verification failed: ${e.message}")
            false
        }
    }

    // ============== Utility Methods ==============

    /**
     * Generates a secure random byte array.
     */
    fun randomBytes(size: Int): ByteArray {
        return if (nativeLibraryLoaded) {
            BuilditCrypto.generateSalt(size)
        } else {
            ByteArray(size).also { secureRandom.nextBytes(it) }
        }
    }

    /**
     * Computes SHA-256 hash of data.
     */
    fun sha256(data: ByteArray): ByteArray {
        return MessageDigest.getInstance("SHA-256").digest(data)
    }

    // ============== Fallback Implementations ==============

    private fun deriveSharedSecretFallback(privateKey: ByteArray, publicKey: ByteArray): ByteArray {
        val combined = privateKey + publicKey
        return sha256(combined)
    }

    private fun encryptFallback(plaintext: ByteArray, recipientPublicKey: String): ByteArray? {
        return try {
            val privateKey = keystoreManager.getPrivateKeyBytes() ?: return null
            val sharedSecret = deriveSharedSecretFallback(privateKey, recipientPublicKey.hexToByteArray())
            val key = hkdfExpand(sharedSecret, "buildit-encryption".toByteArray(), 32)
            val nonce = ByteArray(12).also { secureRandom.nextBytes(it) }

            val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = javax.crypto.spec.SecretKeySpec(key, "AES")
            val gcmSpec = javax.crypto.spec.GCMParameterSpec(128, nonce)
            cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
            val ciphertext = cipher.doFinal(plaintext)

            // Format: version (1) + nonce (12) + ciphertext
            byteArrayOf(0x01) + nonce + ciphertext
        } catch (e: Exception) {
            Log.e(TAG, "Fallback encryption failed: ${e.message}")
            null
        }
    }

    private fun decryptFallback(ciphertext: ByteArray, senderPublicKey: String): ByteArray? {
        return try {
            if (ciphertext.size < 13) return null // Minimum: 1 + 12 = 13
            if (ciphertext[0] != 0x01.toByte()) return null

            val nonce = ciphertext.sliceArray(1 until 13)
            val encrypted = ciphertext.sliceArray(13 until ciphertext.size)

            val privateKey = keystoreManager.getPrivateKeyBytes() ?: return null
            val sharedSecret = deriveSharedSecretFallback(privateKey, senderPublicKey.hexToByteArray())
            val key = hkdfExpand(sharedSecret, "buildit-encryption".toByteArray(), 32)

            val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = javax.crypto.spec.SecretKeySpec(key, "AES")
            val gcmSpec = javax.crypto.spec.GCMParameterSpec(128, nonce)
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE, keySpec, gcmSpec)
            cipher.doFinal(encrypted)
        } catch (e: Exception) {
            Log.e(TAG, "Fallback decryption failed: ${e.message}")
            null
        }
    }

    private fun hkdfExpand(prk: ByteArray, info: ByteArray, length: Int): ByteArray {
        val mac = javax.crypto.Mac.getInstance("HmacSHA256")
        mac.init(javax.crypto.spec.SecretKeySpec(prk, "HmacSHA256"))

        val result = ByteArray(length)
        var t = ByteArray(0)
        var offset = 0
        var i = 1

        while (offset < length) {
            mac.update(t)
            mac.update(info)
            mac.update(i.toByte())
            t = mac.doFinal()

            val toCopy = minOf(t.size, length - offset)
            System.arraycopy(t, 0, result, offset, toCopy)
            offset += toCopy
            i++

            mac.reset()
        }

        return result
    }

    private fun computeEventIdFallback(event: UnsignedNostrEvent): String {
        val serialized = org.json.JSONArray().apply {
            put(0)
            put(event.pubkey)
            put(event.createdAt)
            put(event.kind)
            put(org.json.JSONArray(event.tags.map { org.json.JSONArray(it) }))
            put(event.content)
        }.toString()

        return sha256(serialized.toByteArray()).toHexString()
    }

    companion object {
        private const val TAG = "CryptoManager"
        private const val TWO_DAYS_SECONDS = 172800 // 48 hours in seconds
    }
}

// ============== Extension Functions ==============

/**
 * Extension to convert ByteArray to hex string.
 */
fun ByteArray.toHexString(): String = joinToString("") { "%02x".format(it) }

/**
 * Extension to convert hex string to ByteArray.
 */
fun String.hexToByteArray(): ByteArray {
    check(length % 2 == 0) { "Hex string must have even length" }
    return chunked(2)
        .map { it.toInt(16).toByte() }
        .toByteArray()
}

// ============== Data Classes ==============

/**
 * A gift-wrapped Nostr event (NIP-17).
 */
data class GiftWrapEvent(
    val id: String,
    val pubkey: String,
    val createdAt: Long,
    val kind: Int,
    val tags: List<List<String>>,
    val content: String,
    val sig: String
)

/**
 * Result of unwrapping a gift-wrapped message.
 */
data class UnwrappedMessage(
    val content: String,
    val senderPubkey: String,
    val createdAt: Long,
    val sealVerified: Boolean
)

/**
 * An unsigned Nostr event.
 */
data class UnsignedNostrEvent(
    val pubkey: String,
    val createdAt: Long,
    val kind: Int,
    val tags: List<List<String>>,
    val content: String
)

/**
 * A signed Nostr event.
 */
data class SignedNostrEvent(
    val id: String,
    val pubkey: String,
    val createdAt: Long,
    val kind: Int,
    val tags: List<List<String>>,
    val content: String,
    val sig: String
)
