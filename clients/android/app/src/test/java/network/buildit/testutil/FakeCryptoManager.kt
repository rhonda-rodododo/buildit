package network.buildit.testutil

import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Fake implementation of CryptoManager for testing.
 *
 * Provides deterministic behavior for:
 * - Key operations
 * - Encryption/decryption
 * - Signing/verification
 * - Random generation (with seed support)
 */
class FakeCryptoManager {

    // Configuration
    var publicKeyHex: String? = TestFixtures.TEST_PUBLIC_KEY_HEX
    var encryptResult: ByteArray? = "encrypted_content".toByteArray()
    var decryptResult: ByteArray? = "decrypted_content".toByteArray()
    var signResult: ByteArray? = ByteArray(64) { it.toByte() }
    var verifyResult: Boolean = true

    // Track method calls
    val encryptCalls = mutableListOf<EncryptCall>()
    val decryptCalls = mutableListOf<DecryptCall>()
    val signCalls = mutableListOf<ByteArray>()
    val verifyCalls = mutableListOf<VerifyCall>()

    // Seed for deterministic random generation
    private var randomSeed: Long = System.currentTimeMillis()
    private val seededRandom = SecureRandom()

    init {
        seededRandom.setSeed(randomSeed)
    }

    // ============== CryptoManager-like Methods ==============

    suspend fun encrypt(plaintext: ByteArray, recipientPublicKey: String): ByteArray? {
        encryptCalls.add(EncryptCall(plaintext, recipientPublicKey))
        return encryptResult
    }

    suspend fun decrypt(ciphertext: ByteArray, senderPublicKey: String): ByteArray? {
        decryptCalls.add(DecryptCall(ciphertext, senderPublicKey))
        return decryptResult
    }

    suspend fun sign(data: ByteArray): ByteArray? {
        signCalls.add(data)
        return signResult
    }

    suspend fun verify(data: ByteArray, signature: ByteArray, publicKey: String): Boolean {
        verifyCalls.add(VerifyCall(data, signature, publicKey))
        return verifyResult
    }

    fun randomBytes(size: Int): ByteArray {
        return ByteArray(size).also { seededRandom.nextBytes(it) }
    }

    fun sha256(data: ByteArray): ByteArray {
        return MessageDigest.getInstance("SHA-256").digest(data)
    }

    // ============== Test Control ==============

    /**
     * Set the random seed for deterministic random generation.
     */
    fun setRandomSeed(seed: Long) {
        randomSeed = seed
        seededRandom.setSeed(seed)
    }

    /**
     * Simulate encryption failure.
     */
    fun simulateEncryptFailure() {
        encryptResult = null
    }

    /**
     * Simulate decryption failure.
     */
    fun simulateDecryptFailure() {
        decryptResult = null
    }

    /**
     * Simulate signing failure.
     */
    fun simulateSignFailure() {
        signResult = null
    }

    /**
     * Simulate verification failure.
     */
    fun simulateVerifyFailure() {
        verifyResult = false
    }

    /**
     * Clear all tracked calls.
     */
    fun clearCalls() {
        encryptCalls.clear()
        decryptCalls.clear()
        signCalls.clear()
        verifyCalls.clear()
    }

    /**
     * Reset to default state.
     */
    fun reset() {
        publicKeyHex = TestFixtures.TEST_PUBLIC_KEY_HEX
        encryptResult = "encrypted_content".toByteArray()
        decryptResult = "decrypted_content".toByteArray()
        signResult = ByteArray(64) { it.toByte() }
        verifyResult = true
        clearCalls()
    }

    // ============== NIP-17 Gift Wrap Operations ==============

    /**
     * Create a gift wrap for testing.
     */
    fun createGiftWrap(
        senderPrivateKey: ByteArray,
        recipientPubkey: String,
        content: String
    ): GiftWrapResult? {
        // Simplified implementation for testing
        val rumor = TestNostrEvent(
            id = "rumor-${System.currentTimeMillis()}",
            pubkey = publicKeyHex ?: return null,
            createdAt = System.currentTimeMillis() / 1000,
            kind = 14,
            tags = listOf(listOf("p", recipientPubkey)),
            content = content,
            sig = ""
        )

        val seal = TestNostrEvent(
            id = "seal-${System.currentTimeMillis()}",
            pubkey = publicKeyHex ?: return null,
            createdAt = System.currentTimeMillis() / 1000,
            kind = 13,
            tags = emptyList(),
            content = "encrypted_rumor",
            sig = "seal_signature"
        )

        val giftWrap = TestNostrEvent(
            id = "giftwrap-${System.currentTimeMillis()}",
            pubkey = "ephemeral_pubkey",
            createdAt = System.currentTimeMillis() / 1000,
            kind = 1059,
            tags = listOf(listOf("p", recipientPubkey)),
            content = "encrypted_seal",
            sig = "giftwrap_signature"
        )

        return GiftWrapResult(rumor, seal, giftWrap)
    }

    /**
     * Unwrap a gift wrap for testing.
     */
    fun unwrapGiftWrap(
        recipientPrivateKey: ByteArray,
        giftWrap: TestNostrEvent
    ): UnwrapResult? {
        if (giftWrap.kind != 1059) return null

        return UnwrapResult(
            rumor = TestNostrEvent(
                id = "unwrapped-rumor",
                pubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
                createdAt = System.currentTimeMillis() / 1000,
                kind = 14,
                tags = emptyList(),
                content = "unwrapped_content",
                sig = ""
            ),
            senderPubkey = TestFixtures.TEST_PUBLIC_KEY_HEX,
            sealVerified = true
        )
    }
}

/**
 * Data class for tracking encrypt calls.
 */
data class EncryptCall(
    val plaintext: ByteArray,
    val recipientPublicKey: String
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as EncryptCall
        return plaintext.contentEquals(other.plaintext) && recipientPublicKey == other.recipientPublicKey
    }

    override fun hashCode(): Int {
        var result = plaintext.contentHashCode()
        result = 31 * result + recipientPublicKey.hashCode()
        return result
    }
}

/**
 * Data class for tracking decrypt calls.
 */
data class DecryptCall(
    val ciphertext: ByteArray,
    val senderPublicKey: String
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as DecryptCall
        return ciphertext.contentEquals(other.ciphertext) && senderPublicKey == other.senderPublicKey
    }

    override fun hashCode(): Int {
        var result = ciphertext.contentHashCode()
        result = 31 * result + senderPublicKey.hashCode()
        return result
    }
}

/**
 * Data class for tracking verify calls.
 */
data class VerifyCall(
    val data: ByteArray,
    val signature: ByteArray,
    val publicKey: String
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as VerifyCall
        return data.contentEquals(other.data) &&
                signature.contentEquals(other.signature) &&
                publicKey == other.publicKey
    }

    override fun hashCode(): Int {
        var result = data.contentHashCode()
        result = 31 * result + signature.contentHashCode()
        result = 31 * result + publicKey.hashCode()
        return result
    }
}

/**
 * Simplified Nostr event for testing.
 */
data class TestNostrEvent(
    val id: String,
    val pubkey: String,
    val createdAt: Long,
    val kind: Int,
    val tags: List<List<String>>,
    val content: String,
    val sig: String
)

/**
 * Result of creating a gift wrap.
 */
data class GiftWrapResult(
    val rumor: TestNostrEvent,
    val seal: TestNostrEvent,
    val giftWrap: TestNostrEvent
)

/**
 * Result of unwrapping a gift wrap.
 */
data class UnwrapResult(
    val rumor: TestNostrEvent,
    val senderPubkey: String,
    val sealVerified: Boolean
)
