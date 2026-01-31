package network.buildit.modules.calling.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import network.buildit.generated.schemas.calling.CallSettings
import network.buildit.generated.schemas.calling.CallType

/**
 * Room entity for call settings.
 * Stores user preferences for calling functionality.
 */
@Entity(tableName = "call_settings")
data class CallSettingsEntity(
    /**
     * User pubkey - primary key to support multi-account.
     */
    @PrimaryKey
    val userPubkey: String,

    /**
     * Schema version for forward compatibility.
     */
    val schemaVersion: String = "1.0.0",

    /**
     * Default call type when initiating calls.
     */
    val defaultCallType: String = "voice", // "voice", "video"

    /**
     * Allow calls from unknown contacts.
     */
    val allowUnknownCallers: Boolean = false,

    /**
     * Automatically answer incoming calls (for accessibility/hands-free).
     */
    val autoAnswer: Boolean = false,

    /**
     * Enable automatic gain control for audio.
     */
    val autoGainControl: Boolean = true,

    /**
     * Enable echo cancellation.
     */
    val echoCancellation: Boolean = true,

    /**
     * Enable noise suppression.
     */
    val noiseSuppression: Boolean = true,

    /**
     * Do not disturb mode - reject all incoming calls.
     */
    val doNotDisturb: Boolean = false,

    /**
     * Preferred audio input device ID.
     */
    val preferredAudioInput: String? = null,

    /**
     * Preferred audio output device ID.
     */
    val preferredAudioOutput: String? = null,

    /**
     * Preferred video input device ID (camera).
     */
    val preferredVideoInput: String? = null,

    /**
     * Always use TURN relay servers for privacy.
     * This prevents direct peer-to-peer connections that could leak IP addresses.
     */
    val relayOnlyMode: Boolean = false,

    /**
     * Ring duration in seconds before marking as missed.
     */
    val ringDuration: Int = 30,

    /**
     * Whether to show call notifications on lockscreen.
     */
    val showOnLockscreen: Boolean = true,

    /**
     * Whether to use proximity sensor to turn off screen during calls.
     */
    val useProximitySensor: Boolean = true,

    /**
     * Maximum video resolution (for bandwidth management).
     */
    val maxVideoResolution: String = "720p", // "480p", "720p", "1080p"

    /**
     * Whether to start video calls with camera off by default.
     */
    val startWithCameraOff: Boolean = false,

    /**
     * Whether to start calls with microphone muted.
     */
    val startMuted: Boolean = false,

    /**
     * When settings were last updated.
     */
    val updatedAt: Long = System.currentTimeMillis()
) {
    /**
     * Converts to the schema CallSettings type.
     */
    fun toCallSettings(): CallSettings {
        return CallSettings(
            v = schemaVersion,
            defaultCallType = CallType.valueOf(defaultCallType.replaceFirstChar { it.uppercase() }),
            allowUnknownCallers = allowUnknownCallers,
            autoAnswer = autoAnswer,
            autoGainControl = autoGainControl,
            echoCancellation = echoCancellation,
            noiseSuppression = noiseSuppression,
            doNotDisturb = doNotDisturb,
            preferredAudioInput = preferredAudioInput,
            preferredAudioOutput = preferredAudioOutput,
            preferredVideoInput = preferredVideoInput,
            relayOnlyMode = relayOnlyMode
        )
    }

    companion object {
        /**
         * Creates an entity from a CallSettings schema type.
         */
        fun from(settings: CallSettings, userPubkey: String): CallSettingsEntity {
            return CallSettingsEntity(
                userPubkey = userPubkey,
                schemaVersion = settings.v ?: "1.0.0",
                defaultCallType = settings.defaultCallType?.value ?: "voice",
                allowUnknownCallers = settings.allowUnknownCallers ?: false,
                autoAnswer = settings.autoAnswer ?: false,
                autoGainControl = settings.autoGainControl ?: true,
                echoCancellation = settings.echoCancellation ?: true,
                noiseSuppression = settings.noiseSuppression ?: true,
                doNotDisturb = settings.doNotDisturb ?: false,
                preferredAudioInput = settings.preferredAudioInput,
                preferredAudioOutput = settings.preferredAudioOutput,
                preferredVideoInput = settings.preferredVideoInput,
                relayOnlyMode = settings.relayOnlyMode ?: false
            )
        }

        /**
         * Creates default settings for a user.
         */
        fun createDefault(userPubkey: String): CallSettingsEntity {
            return CallSettingsEntity(
                userPubkey = userPubkey
            )
        }
    }
}

/**
 * ICE server configuration for WebRTC.
 */
data class IceServer(
    val urls: List<String>,
    val username: String? = null,
    val credential: String? = null
) {
    companion object {
        /**
         * Default public STUN servers.
         */
        val DEFAULT_STUN_SERVERS = listOf(
            IceServer(urls = listOf("stun:stun.l.google.com:19302")),
            IceServer(urls = listOf("stun:stun1.l.google.com:19302")),
            IceServer(urls = listOf("stun:stun2.l.google.com:19302"))
        )
    }
}

/**
 * Audio device information for selection UI.
 */
data class AudioDevice(
    val id: String,
    val name: String,
    val type: AudioDeviceType,
    val isDefault: Boolean = false
)

/**
 * Types of audio devices.
 */
enum class AudioDeviceType {
    EARPIECE,
    SPEAKER,
    WIRED_HEADSET,
    BLUETOOTH,
    USB
}

/**
 * Video device information for selection UI.
 */
data class VideoDevice(
    val id: String,
    val name: String,
    val facing: CameraFacing,
    val isDefault: Boolean = false
)

/**
 * Camera facing direction.
 */
enum class CameraFacing {
    FRONT,
    BACK,
    EXTERNAL
}
