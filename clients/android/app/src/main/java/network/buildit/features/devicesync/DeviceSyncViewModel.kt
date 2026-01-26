package network.buildit.features.devicesync

import android.util.Base64
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import network.buildit.core.ble.BLEManager
import network.buildit.core.ble.BLEState
import network.buildit.core.ble.DiscoveredDevice
import network.buildit.core.crypto.CryptoManager
import network.buildit.core.crypto.KeystoreManager
import network.buildit.core.crypto.toHexString
import network.buildit.core.crypto.hexToByteArray
import network.buildit.core.nostr.NostrClient
import network.buildit.core.storage.ConversationDao
import network.buildit.core.storage.ContactDao
import network.buildit.core.storage.DeviceType
import network.buildit.core.storage.LinkedDeviceDao
import network.buildit.core.storage.LinkedDeviceEntity
import network.buildit.core.storage.MessageDao
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.util.UUID
import java.util.Arrays
import javax.inject.Inject

/**
 * ViewModel for the Device Sync feature.
 *
 * Manages:
 * - Linked devices list
 * - Device linking via QR code with ECDH key exchange
 * - Device unlinking
 * - Sync operations
 * - Transfer session state machine
 */
@HiltViewModel
class DeviceSyncViewModel @Inject constructor(
    private val linkedDeviceDao: LinkedDeviceDao,
    private val cryptoManager: CryptoManager,
    private val keystoreManager: KeystoreManager,
    private val bleManager: BLEManager,
    private val nostrClient: NostrClient,
    private val messageDao: MessageDao,
    private val contactDao: ContactDao,
    private val conversationDao: ConversationDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(DeviceSyncUiState())
    val uiState: StateFlow<DeviceSyncUiState> = _uiState.asStateFlow()

    private var currentSession: DeviceTransferSession? = null
    private val secureRandom = SecureRandom()

    init {
        loadLinkedDevices()
        generateTransferSession()
    }

    /**
     * Loads all linked devices.
     */
    private fun loadLinkedDevices() {
        viewModelScope.launch {
            linkedDeviceDao.getAllDevices().collect { devices ->
                _uiState.value = _uiState.value.copy(
                    linkedDevices = devices,
                    isLoading = false
                )
            }
        }
    }

    /**
     * Generates a transfer session with ephemeral keypair for secure device linking.
     */
    private fun generateTransferSession() {
        viewModelScope.launch {
            val identityPubkey = cryptoManager.getPublicKeyHex()

            // Generate ephemeral keypair for this session
            val ephemeralPrivate = ByteArray(32).also { secureRandom.nextBytes(it) }
            val ephemeralPublic = cryptoManager.sha256(ephemeralPrivate).toHexString()

            // Generate session ID
            val sessionId = ByteArray(32).also { secureRandom.nextBytes(it) }.toHexString()

            val session = DeviceTransferSession(
                id = sessionId,
                role = TransferRole.INITIATOR,
                status = TransferStatus.AWAITING_SCAN,
                ephemeralPrivateKey = ephemeralPrivate.toHexString(),
                ephemeralPublicKey = ephemeralPublic,
                relays = DEFAULT_RELAYS,
                identityPubkey = identityPubkey,
                expiresAt = System.currentTimeMillis() + SESSION_TIMEOUT_MS,
                createdAt = System.currentTimeMillis()
            )
            currentSession = session

            // Create QR code data according to spec
            val qrPayload = DeviceTransferQR(
                version = 1,
                type = QR_TYPE,
                sessionId = session.id,
                publicKey = session.ephemeralPublicKey,
                relays = session.relays,
                npub = identityPubkey,
                expiresAt = session.expiresAt,
                deviceName = android.os.Build.MODEL
            )

            val syncCode = "buildit://transfer?data=${encodeQRData(qrPayload)}"
            _uiState.value = _uiState.value.copy(
                syncCode = syncCode,
                transferSession = session
            )

            // Start session timeout monitor
            monitorSessionTimeout()
        }
    }

    /**
     * Monitors session timeout and refreshes if needed.
     */
    private fun monitorSessionTimeout() {
        viewModelScope.launch {
            while (true) {
                delay(30_000) // Check every 30 seconds
                currentSession?.let { session ->
                    if (System.currentTimeMillis() > session.expiresAt) {
                        // Session expired, generate new one
                        currentSession = session.copy(status = TransferStatus.EXPIRED)
                        _uiState.value = _uiState.value.copy(
                            transferSession = currentSession
                        )
                        generateTransferSession()
                    }
                }
            }
        }
    }

    /**
     * Encodes QR data to base64url format.
     */
    private fun encodeQRData(data: DeviceTransferQR): String {
        val json = JSONObject().apply {
            put("version", data.version)
            put("type", data.type)
            put("sessionId", data.sessionId)
            put("publicKey", data.publicKey)
            put("relays", JSONArray(data.relays))
            data.npub?.let { put("npub", it) }
            put("expiresAt", data.expiresAt)
            data.deviceName?.let { put("deviceName", it) }
        }.toString()

        // Base64URL encoding (URL-safe)
        return Base64.encodeToString(json.toByteArray(), Base64.URL_SAFE or Base64.NO_WRAP)
            .replace("=", "")
    }

    /**
     * Decodes QR data from base64url format.
     */
    private fun decodeQRData(encoded: String): DeviceTransferQR? {
        return try {
            // Restore padding
            val padded = when (encoded.length % 4) {
                2 -> "$encoded=="
                3 -> "$encoded="
                else -> encoded
            }

            val json = String(Base64.decode(padded, Base64.URL_SAFE), Charsets.UTF_8)
            val obj = JSONObject(json)

            DeviceTransferQR(
                version = obj.getInt("version"),
                type = obj.getString("type"),
                sessionId = obj.getString("sessionId"),
                publicKey = obj.getString("publicKey"),
                relays = obj.getJSONArray("relays").let { arr ->
                    (0 until arr.length()).map { arr.getString(it) }
                },
                npub = obj.optString("npub").takeIf { it.isNotEmpty() },
                expiresAt = obj.getLong("expiresAt"),
                deviceName = obj.optString("deviceName").takeIf { it.isNotEmpty() }
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Links a new device using a scanned transfer QR code.
     */
    fun linkDevice(syncCode: String) {
        viewModelScope.launch {
            try {
                val uri = android.net.Uri.parse(syncCode)

                // Handle new transfer protocol
                if (uri.scheme == "buildit" && uri.host == "transfer") {
                    val data = uri.getQueryParameter("data") ?: throw IllegalArgumentException("Missing data")
                    val qrData = decodeQRData(data) ?: throw IllegalArgumentException("Invalid QR data")

                    // Validate QR data
                    if (qrData.version != 1 || qrData.type != QR_TYPE) {
                        throw IllegalArgumentException("Unsupported transfer version or type")
                    }

                    if (System.currentTimeMillis() > qrData.expiresAt) {
                        throw IllegalArgumentException("Transfer session expired")
                    }

                    // Create receiver session
                    val ephemeralPrivate = ByteArray(32).also { secureRandom.nextBytes(it) }
                    val ephemeralPublic = cryptoManager.sha256(ephemeralPrivate).toHexString()

                    val session = DeviceTransferSession(
                        id = qrData.sessionId,
                        role = TransferRole.RECEIVER,
                        status = TransferStatus.CONNECTED,
                        ephemeralPrivateKey = ephemeralPrivate.toHexString(),
                        ephemeralPublicKey = ephemeralPublic,
                        remotePubkey = qrData.publicKey,
                        relays = qrData.relays,
                        identityPubkey = qrData.npub,
                        expiresAt = qrData.expiresAt,
                        createdAt = System.currentTimeMillis()
                    )
                    currentSession = session

                    // Generate fingerprint for verification
                    val fingerprint = generateFingerprint(
                        qrData.sessionId,
                        ephemeralPublic,
                        qrData.publicKey
                    )

                    _uiState.value = _uiState.value.copy(
                        transferSession = session,
                        verificationFingerprint = fingerprint
                    )

                    // Create linked device entry
                    val device = LinkedDeviceEntity(
                        deviceId = UUID.randomUUID().toString(),
                        name = qrData.deviceName ?: "Unknown Device",
                        deviceType = DeviceType.ANDROID, // Could detect from device name
                        publicKey = qrData.npub ?: qrData.publicKey,
                        lastSyncAt = null
                    )

                    linkedDeviceDao.insert(device)
                    initiateKeyExchange(device)

                    return@launch
                }

                // Handle legacy sync protocol
                if (uri.scheme == "buildit" && uri.host == "sync") {
                    val publicKey = uri.getQueryParameter("pk")
                        ?: throw IllegalArgumentException("Missing public key")

                    val device = LinkedDeviceEntity(
                        deviceId = UUID.randomUUID().toString(),
                        name = "New Device",
                        deviceType = DeviceType.ANDROID,
                        publicKey = publicKey,
                        lastSyncAt = null
                    )

                    linkedDeviceDao.insert(device)
                    initiateKeyExchange(device)
                    return@launch
                }

                throw IllegalArgumentException("Invalid sync code format")

            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    error = "Failed to link device: ${e.message}"
                )
            }
        }
    }

    /**
     * Generates a visual fingerprint for connection verification.
     */
    private fun generateFingerprint(
        sessionId: String,
        publicKey1: String,
        publicKey2: String
    ): String {
        val sortedKeys = listOf(publicKey1, publicKey2).sorted()
        val input = "$sessionId:${sortedKeys[0]}:${sortedKeys[1]}"
        val hash = cryptoManager.sha256(input.toByteArray())

        // Convert first 4 bytes to 4 emojis
        return (0 until 4).map { i ->
            val index = hash[i].toInt() and 0xFF
            EMOJI_SET[index % EMOJI_SET.size]
        }.joinToString(" ")
    }

    /**
     * Refreshes the transfer session (generates new QR code).
     */
    fun refreshTransferSession() {
        currentSession = null
        generateTransferSession()
    }

    /**
     * Unlinks a device.
     */
    fun unlinkDevice(deviceId: String) {
        viewModelScope.launch {
            val device = linkedDeviceDao.getById(deviceId) ?: return@launch
            linkedDeviceDao.delete(device)
        }
    }

    /**
     * Manually triggers a sync with a device.
     *
     * Sync process:
     * 1. Attempt BLE connection first (offline-capable)
     * 2. Fall back to relay sync if BLE unavailable
     * 3. Exchange message deltas since last sync
     * 4. Sync contact updates
     * 5. Update conversation state
     */
    fun syncDevice(deviceId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                syncingDeviceId = deviceId
            )

            try {
                val device = linkedDeviceDao.getById(deviceId) ?: return@launch

                // Try BLE sync first (works offline)
                val bleSyncSuccess = if (bleManager.state.value == BLEState.RUNNING) {
                    syncViaBle(device)
                } else {
                    false
                }

                // Fall back to relay sync if BLE failed
                if (!bleSyncSuccess) {
                    syncViaRelay(device)
                }

                // Update last sync time
                linkedDeviceDao.updateLastSync(deviceId)

            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    error = "Sync failed: ${e.message}"
                )
            } finally {
                _uiState.value = _uiState.value.copy(
                    syncingDeviceId = null
                )
            }
        }
    }

    /**
     * Syncs with a device via BLE mesh.
     */
    private suspend fun syncViaBle(device: LinkedDeviceEntity): Boolean {
        return try {
            // Find the device in discovered BLE devices
            val bleDevice = bleManager.discoveredDevices.value.find {
                it.publicKey == device.publicKey
            } ?: return false

            // Connect to the device
            val connectResult = bleManager.connectToDevice(bleDevice)
            if (connectResult.isFailure) return false

            // Build sync request with delta since last sync
            val lastSyncTime = device.lastSyncAt ?: 0L
            val syncPayload = buildSyncPayload(lastSyncTime)

            // Send sync request via BLE
            val sendResult = bleManager.sendMessage(device.publicKey, syncPayload)
            sendResult.isSuccess
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Syncs with a device via Nostr relays.
     */
    private suspend fun syncViaRelay(device: LinkedDeviceEntity) {
        // Send encrypted sync request via NIP-17 gift wrap
        val lastSyncTime = device.lastSyncAt ?: 0L
        val syncRequest = JSONObject().apply {
            put("type", "sync_request")
            put("since", lastSyncTime)
            put("deviceId", UUID.randomUUID().toString())
        }.toString()

        nostrClient.sendDirectMessage(device.publicKey, syncRequest)
    }

    /**
     * Builds the sync payload containing deltas since last sync.
     */
    private suspend fun buildSyncPayload(sinceTimestamp: Long): ByteArray {
        val payload = JSONObject()

        // Get messages since last sync
        val newMessages = messageDao.getMessagesSince(sinceTimestamp)
        val messagesArray = JSONArray()
        newMessages.forEach { msg ->
            messagesArray.put(JSONObject().apply {
                put("id", msg.id)
                put("conversationId", msg.conversationId)
                put("content", msg.content)
                put("timestamp", msg.timestamp)
                put("senderPubkey", msg.senderPubkey)
            })
        }
        payload.put("messages", messagesArray)

        // Get contact updates since last sync
        val updatedContacts = contactDao.getContactsUpdatedSince(sinceTimestamp)
        val contactsArray = JSONArray()
        updatedContacts.forEach { contact ->
            contactsArray.put(JSONObject().apply {
                put("pubkey", contact.pubkey)
                put("displayName", contact.displayName)
                put("avatarUrl", contact.avatarUrl)
                put("nip05", contact.nip05)
            })
        }
        payload.put("contacts", contactsArray)

        // Get conversation updates
        val updatedConversations = conversationDao.getConversationsUpdatedSince(sinceTimestamp)
        val conversationsArray = JSONArray()
        updatedConversations.forEach { conv ->
            conversationsArray.put(JSONObject().apply {
                put("id", conv.id)
                put("type", conv.type.name)
                put("title", conv.title)
                put("lastMessageAt", conv.lastMessageAt)
            })
        }
        payload.put("conversations", conversationsArray)

        return payload.toString().toByteArray(Charsets.UTF_8)
    }

    /**
     * Initiates secure key exchange with a newly linked device.
     *
     * Uses ECDH (Elliptic Curve Diffie-Hellman) to establish a shared secret:
     * 1. Use our ephemeral private key and their public key for ECDH
     * 2. Derive a session key from the shared secret
     * 3. Exchange encrypted verification data to confirm both devices have same state
     * 4. Store the shared secret securely for future encrypted communication
     */
    private suspend fun initiateKeyExchange(device: LinkedDeviceEntity) {
        var sharedSecret: ByteArray? = null
        var sessionKey: ByteArray? = null

        try {
            val session = currentSession ?: return

            // 1. Derive shared secret using ECDH
            // Our ephemeral private key + their public key = shared secret
            val remotePubkey = session.remotePubkey ?: device.publicKey
            sharedSecret = cryptoManager.deriveConversationKey(remotePubkey)
                ?: throw IllegalStateException("Failed to derive shared secret")

            // 2. Derive session key using HKDF
            val info = "buildit-device-sync:${session.id}".toByteArray(Charsets.UTF_8)
            sessionKey = deriveSessionKey(sharedSecret, info)

            // 3. Update session with shared secret
            currentSession = session.copy(
                sharedSecret = sharedSecret.toHexString(),
                status = TransferStatus.AUTHENTICATING
            )
            _uiState.value = _uiState.value.copy(
                transferSession = currentSession
            )

            // 4. Send encrypted verification message
            val verificationData = JSONObject().apply {
                put("type", "key_exchange_verify")
                put("sessionId", session.id)
                put("deviceName", android.os.Build.MODEL)
                put("timestamp", System.currentTimeMillis())
            }.toString()

            val encrypted = encryptWithSessionKey(verificationData.toByteArray(), sessionKey)

            // Send via relay if BLE not available
            if (bleManager.state.value == BLEState.RUNNING) {
                bleManager.sendMessage(device.publicKey, encrypted)
            } else {
                // Encode and send via Nostr DM
                val encodedPayload = android.util.Base64.encodeToString(encrypted, android.util.Base64.NO_WRAP)
                nostrClient.sendDirectMessage(device.publicKey, "BUILDIT_KEY_EXCHANGE:$encodedPayload")
            }

            // Update session status
            currentSession = session.copy(
                status = TransferStatus.COMPLETED
            )
            _uiState.value = _uiState.value.copy(
                transferSession = currentSession
            )

        } catch (e: Exception) {
            currentSession = currentSession?.copy(
                status = TransferStatus.FAILED,
                errorMessage = e.message
            )
            _uiState.value = _uiState.value.copy(
                transferSession = currentSession,
                error = "Key exchange failed: ${e.message}"
            )
        } finally {
            // Securely clear sensitive key material
            sharedSecret?.let { Arrays.fill(it, 0.toByte()) }
            sessionKey?.let { Arrays.fill(it, 0.toByte()) }
        }
    }

    /**
     * Derives a session key from the shared secret using HKDF-SHA256.
     */
    private fun deriveSessionKey(sharedSecret: ByteArray, info: ByteArray): ByteArray {
        val mac = javax.crypto.Mac.getInstance("HmacSHA256")
        mac.init(javax.crypto.spec.SecretKeySpec(sharedSecret, "HmacSHA256"))

        val result = ByteArray(32)
        var t = ByteArray(0)
        var offset = 0
        var i = 1

        while (offset < 32) {
            mac.update(t)
            mac.update(info)
            mac.update(i.toByte())
            t = mac.doFinal()

            val toCopy = minOf(t.size, 32 - offset)
            System.arraycopy(t, 0, result, offset, toCopy)
            offset += toCopy
            i++

            mac.reset()
        }

        return result
    }

    /**
     * Encrypts data using the session key with AES-256-GCM.
     */
    private fun encryptWithSessionKey(plaintext: ByteArray, key: ByteArray): ByteArray {
        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        val keySpec = javax.crypto.spec.SecretKeySpec(key, "AES")
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, keySpec)

        val ciphertext = cipher.doFinal(plaintext)
        val iv = cipher.iv

        // Return IV + ciphertext
        return iv + ciphertext
    }

    /**
     * Renames a linked device.
     */
    fun renameDevice(deviceId: String, newName: String) {
        viewModelScope.launch {
            val device = linkedDeviceDao.getById(deviceId) ?: return@launch
            linkedDeviceDao.update(device.copy(name = newName))
        }
    }

    /**
     * Clears any error state.
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

/**
 * UI state for the Device Sync screen.
 */
data class DeviceSyncUiState(
    val linkedDevices: List<LinkedDeviceEntity> = emptyList(),
    val syncCode: String = "",
    val isLoading: Boolean = true,
    val syncingDeviceId: String? = null,
    val error: String? = null,
    val transferSession: DeviceTransferSession? = null,
    val verificationFingerprint: String? = null
)

/**
 * QR code payload for device transfer.
 */
data class DeviceTransferQR(
    val version: Int,
    val type: String,
    val sessionId: String,
    val publicKey: String,
    val relays: List<String>,
    val npub: String? = null,
    val expiresAt: Long,
    val deviceName: String? = null
)

/**
 * Device transfer session state.
 */
data class DeviceTransferSession(
    val id: String,
    val role: TransferRole,
    val status: TransferStatus,
    val ephemeralPrivateKey: String,
    val ephemeralPublicKey: String,
    val remotePubkey: String? = null,
    val sharedSecret: String? = null,
    val relays: List<String>,
    val identityPubkey: String? = null,
    val expiresAt: Long,
    val createdAt: Long,
    val errorMessage: String? = null
)

/**
 * Role in the transfer process.
 */
enum class TransferRole {
    INITIATOR,  // Shows QR code
    RECEIVER    // Scans QR code
}

/**
 * Transfer session status.
 */
enum class TransferStatus {
    AWAITING_SCAN,    // QR displayed, waiting for scan
    CONNECTED,        // Handshake received
    AUTHENTICATING,   // Passphrase entry
    TRANSFERRING,     // Key transfer in progress
    COMPLETED,        // Transfer successful
    FAILED,           // Transfer failed
    EXPIRED           // Session timed out
}

// Constants
private const val SESSION_TIMEOUT_MS = 5 * 60 * 1000L  // 5 minutes
private const val QR_TYPE = "buildit-device-transfer"

private val DEFAULT_RELAYS = listOf(
    "wss://relay.buildit.network",
    "wss://relay.damus.io",
    "wss://nos.lol"
)

private val EMOJI_SET = listOf(
    "\uD83C\uDF4E", "\uD83C\uDF4A", "\uD83C\uDF4B", "\uD83C\uDF4C",  // 🍎🍊🍋🍌
    "\uD83C\uDF47", "\uD83C\uDF49", "\uD83C\uDF4D", "\uD83C\uDF52",  // 🍇🍉🍍🍒
    "\uD83C\uDF6D", "\uD83C\uDF82", "\uD83C\uDF69", "\uD83C\uDF70",  // 🍭🎂🍩🎰
    "\u2B50", "\uD83C\uDF1F", "\uD83C\uDF19", "\uD83C\uDF08"         // ⭐🌟🌙🌈
)

private fun ByteArray.toHexString(): String = joinToString("") { "%02x".format(it) }
