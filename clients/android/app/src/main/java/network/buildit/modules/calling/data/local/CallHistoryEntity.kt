package network.buildit.modules.calling.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import network.buildit.generated.schemas.calling.CallHistory
import network.buildit.generated.schemas.calling.CallHistoryCallType
import network.buildit.generated.schemas.calling.CallStateDirection
import network.buildit.generated.schemas.calling.Reason

/**
 * Room entity for call history records.
 * Maps to the CallHistory schema type from protocol.
 */
@Entity(
    tableName = "call_history",
    indices = [
        Index("remotePubkey"),
        Index("startedAt"),
        Index("groupId"),
        Index("roomId")
    ]
)
data class CallHistoryEntity(
    @PrimaryKey
    val callId: String,

    /**
     * Schema version for forward compatibility.
     */
    val schemaVersion: String = "1.0.0",

    /**
     * Type of call: voice, video, or group.
     */
    val callType: String?, // "voice", "video", "group"

    /**
     * Direction of the call.
     */
    val direction: String, // "incoming", "outgoing"

    /**
     * Nostr pubkey of the remote party (for 1:1 calls).
     */
    val remotePubkey: String,

    /**
     * Display name of remote party (cached for offline display).
     */
    val remoteName: String?,

    /**
     * Unix timestamp when call was initiated.
     */
    val startedAt: Long,

    /**
     * Unix timestamp when call connected (null if never connected).
     */
    val connectedAt: Long?,

    /**
     * Unix timestamp when call ended.
     */
    val endedAt: Long?,

    /**
     * Duration in seconds (null if never connected).
     */
    val duration: Long?,

    /**
     * Reason for call termination.
     */
    val endReason: String?, // "completed", "cancelled", "rejected", "no_answer", "busy", "timeout", "network_failure"

    /**
     * Whether the call was encrypted.
     */
    val wasEncrypted: Boolean = true,

    /**
     * Group ID for group calls.
     */
    val groupId: String?,

    /**
     * Room ID for group calls.
     */
    val roomId: String?,

    /**
     * Number of participants for group calls.
     */
    val participantCount: Long?,

    /**
     * When this record was created locally.
     */
    val createdAt: Long = System.currentTimeMillis()
) {
    /**
     * Whether the call was answered/connected.
     */
    val wasAnswered: Boolean
        get() = connectedAt != null

    /**
     * Whether this is a missed call (incoming + not answered).
     */
    val isMissedCall: Boolean
        get() = direction == "incoming" && !wasAnswered && endReason != "rejected"

    /**
     * Whether this is a group call.
     */
    val isGroupCall: Boolean
        get() = callType == "group" || roomId != null

    /**
     * Formatted duration string.
     */
    val durationDisplay: String
        get() {
            val dur = duration ?: return ""
            val minutes = dur / 60
            val seconds = dur % 60
            return if (minutes > 0) {
                "${minutes}m ${seconds}s"
            } else {
                "${seconds}s"
            }
        }

    /**
     * Converts to the schema CallHistory type.
     */
    fun toCallHistory(): CallHistory {
        return CallHistory(
            v = schemaVersion,
            callID = callId,
            callType = callType?.let { CallHistoryCallType.valueOf(it.uppercase()) },
            direction = CallStateDirection.values().find { it.value == direction.lowercase() } ?: CallStateDirection.Outgoing,
            remotePubkey = remotePubkey,
            remoteName = remoteName,
            startedAt = startedAt,
            connectedAt = connectedAt,
            endedAt = endedAt,
            duration = duration,
            endReason = endReason?.let {
                Reason.values().find { r -> r.value == it }
            },
            wasEncrypted = wasEncrypted,
            groupID = groupId,
            roomID = roomId,
            participantCount = participantCount
        )
    }

    companion object {
        /**
         * Creates an entity from a CallHistory schema type.
         */
        fun from(callHistory: CallHistory): CallHistoryEntity {
            return CallHistoryEntity(
                callId = callHistory.callID,
                schemaVersion = callHistory.v,
                callType = callHistory.callType?.value,
                direction = callHistory.direction.value,
                remotePubkey = callHistory.remotePubkey,
                remoteName = callHistory.remoteName,
                startedAt = callHistory.startedAt,
                connectedAt = callHistory.connectedAt,
                endedAt = callHistory.endedAt,
                duration = callHistory.duration,
                endReason = callHistory.endReason?.value,
                wasEncrypted = callHistory.wasEncrypted ?: true,
                groupId = callHistory.groupID,
                roomId = callHistory.roomID,
                participantCount = callHistory.participantCount
            )
        }

        /**
         * Creates a new outgoing call history entry.
         */
        fun createOutgoing(
            callId: String,
            remotePubkey: String,
            remoteName: String?,
            callType: String,
            groupId: String? = null,
            roomId: String? = null
        ): CallHistoryEntity {
            return CallHistoryEntity(
                callId = callId,
                callType = callType,
                direction = "outgoing",
                remotePubkey = remotePubkey,
                remoteName = remoteName,
                startedAt = System.currentTimeMillis() / 1000,
                connectedAt = null,
                endedAt = null,
                duration = null,
                endReason = null,
                groupId = groupId,
                roomId = roomId,
                participantCount = null
            )
        }

        /**
         * Creates a new incoming call history entry.
         */
        fun createIncoming(
            callId: String,
            remotePubkey: String,
            remoteName: String?,
            callType: String,
            groupId: String? = null,
            roomId: String? = null
        ): CallHistoryEntity {
            return CallHistoryEntity(
                callId = callId,
                callType = callType,
                direction = "incoming",
                remotePubkey = remotePubkey,
                remoteName = remoteName,
                startedAt = System.currentTimeMillis() / 1000,
                connectedAt = null,
                endedAt = null,
                duration = null,
                endReason = null,
                groupId = groupId,
                roomId = roomId,
                participantCount = null
            )
        }
    }
}

/**
 * Represents a call in progress with additional runtime state.
 * Not persisted - used for active call tracking.
 */
data class ActiveCallState(
    val callId: String,
    val callType: String, // "voice", "video"
    val direction: String, // "incoming", "outgoing"
    val remotePubkey: String,
    val remoteName: String?,
    val state: String, // "initiating", "ringing", "connecting", "connected", "reconnecting", "on_hold", "ended"
    val startedAt: Long,
    val connectedAt: Long? = null,
    val isMuted: Boolean = false,
    val isVideoEnabled: Boolean = true,
    val isScreenSharing: Boolean = false,
    val isEncrypted: Boolean = true,
    val qualityBandwidth: Long? = null,
    val qualityPacketLoss: Double? = null,
    val qualityRoundTripTime: Double? = null
) {
    val isActive: Boolean
        get() = state in listOf("initiating", "ringing", "connecting", "connected", "reconnecting", "on_hold")

    val isConnected: Boolean
        get() = state == "connected"

    val isRinging: Boolean
        get() = state == "ringing"

    /**
     * Duration since connection in seconds.
     */
    val currentDuration: Long?
        get() {
            val connected = connectedAt ?: return null
            return (System.currentTimeMillis() / 1000) - connected
        }
}
