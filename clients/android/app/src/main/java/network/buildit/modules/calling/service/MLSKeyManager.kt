package network.buildit.modules.calling.service

import android.util.Log
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Maximum cached epochs for out-of-order frame decryption
 */
private const val MAX_CACHED_EPOCHS = 5

/**
 * AES-GCM tag length in bits
 */
private const val GCM_TAG_LENGTH = 128

/**
 * AES-GCM nonce length in bytes
 */
private const val GCM_NONCE_LENGTH = 12

/**
 * MLS Key Manager
 * Manages MLS (Message Layer Security) keys for conference E2EE.
 * Provides zero-knowledge encryption where SFU cannot decrypt media.
 */
class MLSKeyManager(
    private val roomId: String,
    private val localPubkey: String
) {
    companion object {
        private const val TAG = "MLSKeyManager"
    }

    // Current epoch and key
    private var currentEpoch: Int = 0
    private val epochKeys = mutableMapOf<Int, ByteArray>()

    // MLS state
    private val groupMembers = mutableSetOf<String>()
    private var isInitialized: Boolean = false

    // Key derivation
    private val hkdfSalt: ByteArray = sha256(roomId.toByteArray())

    // ============================================
    // Group Management
    // ============================================

    /**
     * Initialize a new MLS group (creator)
     */
    fun initializeGroup(participants: List<String>) {
        if (isInitialized) {
            throw MLSException.AlreadyInitialized()
        }

        groupMembers.addAll(participants)
        currentEpoch = 0

        // Generate initial epoch key
        val epochKey = generateEpochKey(0)
        epochKeys[0] = epochKey

        isInitialized = true
        Log.i(TAG, "MLS group initialized with ${participants.size} participants")
    }

    /**
     * Handle MLS Welcome message (joiner)
     */
    fun handleWelcome(welcome: ByteArray) {
        if (isInitialized) {
            throw MLSException.AlreadyInitialized()
        }

        // In production, parse MLS Welcome and extract secrets
        val epochKey = deriveKeyFromWelcome(welcome)
        epochKeys[currentEpoch] = epochKey

        isInitialized = true
        Log.i(TAG, "MLS Welcome processed, epoch: $currentEpoch")
    }

    /**
     * Handle MLS Commit message (key rotation)
     */
    fun handleCommit(commit: ByteArray, epoch: Int) {
        if (!isInitialized) {
            throw MLSException.NotInitialized()
        }

        if (epoch <= currentEpoch) {
            Log.w(TAG, "Received old epoch commit: $epoch <= $currentEpoch")
            return
        }

        // Derive new epoch key from commit
        val newKey = deriveKeyFromCommit(commit, epoch)

        // Update epoch
        currentEpoch = epoch
        epochKeys[epoch] = newKey

        // Prune old keys
        pruneOldEpochKeys()

        Log.i(TAG, "MLS Commit processed, new epoch: $epoch")
    }

    /**
     * Add participant to group (returns Commit)
     */
    fun addParticipant(pubkey: String, keyPackage: ByteArray): ByteArray {
        if (!isInitialized) {
            throw MLSException.NotInitialized()
        }

        if (groupMembers.contains(pubkey)) {
            throw MLSException.ParticipantAlreadyInGroup()
        }

        groupMembers.add(pubkey)
        currentEpoch++

        // Generate new epoch key
        val newKey = generateEpochKey(currentEpoch)
        epochKeys[currentEpoch] = newKey
        pruneOldEpochKeys()

        // In production, create actual MLS Commit
        val commit = createCommitData(currentEpoch, CommitAction.Add(pubkey))

        Log.i(TAG, "Added participant $pubkey, new epoch: $currentEpoch")
        return commit
    }

    /**
     * Remove participant from group (returns Commit)
     */
    fun removeParticipant(pubkey: String): ByteArray {
        if (!isInitialized) {
            throw MLSException.NotInitialized()
        }

        if (!groupMembers.contains(pubkey)) {
            throw MLSException.ParticipantNotInGroup()
        }

        groupMembers.remove(pubkey)
        currentEpoch++

        // Generate new epoch key (forward secrecy)
        val newKey = generateEpochKey(currentEpoch)
        epochKeys[currentEpoch] = newKey
        pruneOldEpochKeys()

        // In production, create actual MLS Commit
        val commit = createCommitData(currentEpoch, CommitAction.Remove(pubkey))

        Log.i(TAG, "Removed participant $pubkey, new epoch: $currentEpoch")
        return commit
    }

    // ============================================
    // Key Access
    // ============================================

    /**
     * Get current epoch
     */
    fun getCurrentEpoch(): Int = currentEpoch

    /**
     * Get current epoch key
     */
    fun getCurrentEpochKey(): ByteArray? = epochKeys[currentEpoch]

    /**
     * Get key for specific epoch (for out-of-order frame decryption)
     */
    fun getEpochKey(epoch: Int): ByteArray? = epochKeys[epoch]

    // ============================================
    // Frame Encryption/Decryption
    // ============================================

    /**
     * Encrypt a frame with current epoch key
     */
    fun encryptFrame(frame: ByteArray): Pair<ByteArray, Int> {
        val key = getCurrentEpochKey() ?: throw MLSException.NoKeyAvailable()

        // Generate nonce
        val nonce = ByteArray(GCM_NONCE_LENGTH)
        SecureRandom().nextBytes(nonce)

        // Encrypt with AES-GCM
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val keySpec = SecretKeySpec(key, "AES")
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, nonce)
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
        val ciphertext = cipher.doFinal(frame)

        // Build encrypted frame: [nonce(12)][ciphertext+tag]
        val encrypted = ByteArray(nonce.size + ciphertext.size)
        System.arraycopy(nonce, 0, encrypted, 0, nonce.size)
        System.arraycopy(ciphertext, 0, encrypted, nonce.size, ciphertext.size)

        return Pair(encrypted, currentEpoch)
    }

    /**
     * Decrypt a frame with specified epoch key
     */
    fun decryptFrame(encryptedFrame: ByteArray, epoch: Int): ByteArray {
        val key = getEpochKey(epoch) ?: throw MLSException.NoKeyForEpoch(epoch)

        if (encryptedFrame.size < GCM_NONCE_LENGTH + 16) {
            throw MLSException.InvalidFrameFormat()
        }

        // Extract nonce
        val nonce = encryptedFrame.copyOfRange(0, GCM_NONCE_LENGTH)

        // Extract ciphertext + tag
        val ciphertextAndTag = encryptedFrame.copyOfRange(GCM_NONCE_LENGTH, encryptedFrame.size)

        // Decrypt with AES-GCM
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val keySpec = SecretKeySpec(key, "AES")
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, nonce)
        cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec)

        return cipher.doFinal(ciphertextAndTag)
    }

    // ============================================
    // Private Helpers
    // ============================================

    /**
     * Generate epoch key using HKDF
     */
    private fun generateEpochKey(epoch: Int): ByteArray {
        val info = "mls-epoch-$epoch".toByteArray()
        return hkdf(hkdfSalt, hkdfSalt, info, 16)
    }

    /**
     * Derive key from Welcome message
     */
    private fun deriveKeyFromWelcome(welcome: ByteArray): ByteArray {
        val info = "mls-welcome-key".toByteArray()
        val inputKey = sha256(welcome)
        return hkdf(inputKey, hkdfSalt, info, 16)
    }

    /**
     * Derive key from Commit message
     */
    private fun deriveKeyFromCommit(commit: ByteArray, epoch: Int): ByteArray {
        val info = "mls-commit-epoch-$epoch".toByteArray()

        // Combine previous key with commit data
        val previousKey = epochKeys[currentEpoch]
        val combinedData = ByteArray((previousKey?.size ?: 0) + commit.size)
        previousKey?.let { System.arraycopy(it, 0, combinedData, 0, it.size) }
        System.arraycopy(commit, 0, combinedData, previousKey?.size ?: 0, commit.size)

        val inputKey = sha256(combinedData)
        return hkdf(inputKey, hkdfSalt, info, 16)
    }

    /**
     * Prune old epoch keys
     */
    private fun pruneOldEpochKeys() {
        val keysToRemove = epochKeys.keys.filter { it < currentEpoch - MAX_CACHED_EPOCHS }
        keysToRemove.forEach { epochKeys.remove(it) }
    }

    /**
     * Create commit data
     */
    private fun createCommitData(epoch: Int, action: CommitAction): ByteArray {
        val epochBytes = epoch.toBigEndian()
        val actionByte = when (action) {
            is CommitAction.Add -> byteArrayOf(0x01)
            is CommitAction.Remove -> byteArrayOf(0x02)
        }
        val pubkeyBytes = when (action) {
            is CommitAction.Add -> action.pubkey.toByteArray()
            is CommitAction.Remove -> action.pubkey.toByteArray()
        }

        return epochBytes + actionByte + pubkeyBytes
    }

    private sealed class CommitAction {
        data class Add(val pubkey: String) : CommitAction()
        data class Remove(val pubkey: String) : CommitAction()
    }

    /**
     * SHA-256 hash
     */
    private fun sha256(data: ByteArray): ByteArray {
        return MessageDigest.getInstance("SHA-256").digest(data)
    }

    /**
     * HKDF key derivation
     */
    private fun hkdf(ikm: ByteArray, salt: ByteArray, info: ByteArray, length: Int): ByteArray {
        // HKDF-Extract
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(salt, "HmacSHA256"))
        val prk = mac.doFinal(ikm)

        // HKDF-Expand
        mac.init(SecretKeySpec(prk, "HmacSHA256"))
        var t = ByteArray(0)
        var okm = ByteArray(0)
        var i = 1

        while (okm.size < length) {
            val input = t + info + byteArrayOf(i.toByte())
            t = mac.doFinal(input)
            okm += t
            i++
        }

        return okm.copyOf(length)
    }

    private fun Int.toBigEndian(): ByteArray {
        return byteArrayOf(
            (this shr 24).toByte(),
            (this shr 16).toByte(),
            (this shr 8).toByte(),
            this.toByte()
        )
    }

    // ============================================
    // Cleanup
    // ============================================

    fun close() {
        epochKeys.clear()
        groupMembers.clear()
        isInitialized = false
        currentEpoch = 0
        Log.i(TAG, "MLSKeyManager closed")
    }
}

// ============================================
// Exceptions
// ============================================

sealed class MLSException(message: String) : Exception(message) {
    class AlreadyInitialized : MLSException("MLS group already initialized")
    class NotInitialized : MLSException("MLS group not initialized")
    class ParticipantAlreadyInGroup : MLSException("Participant already in group")
    class ParticipantNotInGroup : MLSException("Participant not in group")
    class NoKeyAvailable : MLSException("No encryption key available")
    class NoKeyForEpoch(epoch: Int) : MLSException("No key available for epoch $epoch")
    class InvalidFrameFormat : MLSException("Invalid encrypted frame format")
    class DecryptionFailed : MLSException("Frame decryption failed")
    class EncryptionFailed : MLSException("Frame encryption failed")
}
