package network.buildit.modules.calling.service

import network.buildit.core.redacted
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telecom.VideoProfile
import android.annotation.SuppressLint
import android.util.Log
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * Android ConnectionService for system call integration.
 *
 * Provides native Android call experience with:
 * - System call UI on lock screen
 * - Integration with phone app
 * - Audio routing management
 * - Do Not Disturb awareness
 */
@AndroidEntryPoint
class CallConnectionService : ConnectionService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "CallConnectionService created")
    }

    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest
    ): Connection {
        val extras = request.extras
        val callId = extras.getString(EXTRA_CALL_ID) ?: UUID.randomUUID().toString()
        val callerPubkey = extras.getString(EXTRA_CALLER_PUBKEY) ?: "unknown"
        val callerName = extras.getString(EXTRA_CALLER_NAME)
        val hasVideo = extras.getBoolean(EXTRA_HAS_VIDEO, false)

        Log.d(TAG, "Creating incoming connection: $callId from ${callerPubkey.redacted()}")

        return BuildItCallConnection(callId, callerPubkey, isOutgoing = false).apply {
            setCallerDisplayName(
                callerName ?: "Unknown Caller",
                TelecomManager.PRESENTATION_ALLOWED
            )
            setAddress(
                Uri.fromParts(SCHEME_BUILDIT, callerPubkey, null),
                TelecomManager.PRESENTATION_ALLOWED
            )

            connectionCapabilities = Connection.CAPABILITY_HOLD or
                    Connection.CAPABILITY_SUPPORT_HOLD or
                    Connection.CAPABILITY_MUTE

            if (hasVideo) {
                connectionCapabilities = connectionCapabilities or
                        Connection.CAPABILITY_SUPPORTS_VT_LOCAL_TX or
                        Connection.CAPABILITY_SUPPORTS_VT_REMOTE_TX or
                        Connection.CAPABILITY_SUPPORTS_VT_LOCAL_RX or
                        Connection.CAPABILITY_SUPPORTS_VT_REMOTE_RX
                videoState = VideoProfile.STATE_BIDIRECTIONAL
            } else {
                videoState = VideoProfile.STATE_AUDIO_ONLY
            }

            setRinging()
        }
    }

    override fun onCreateOutgoingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest
    ): Connection {
        val extras = request.extras
        val callId = extras.getString(EXTRA_CALL_ID) ?: UUID.randomUUID().toString()
        val calleePubkey = extras.getString(EXTRA_CALLEE_PUBKEY)
            ?: request.address?.schemeSpecificPart
            ?: "unknown"
        val calleeName = extras.getString(EXTRA_CALLEE_NAME)
        val hasVideo = extras.getBoolean(EXTRA_HAS_VIDEO, false)

        Log.d(TAG, "Creating outgoing connection: $callId to ${calleePubkey.redacted()}")

        return BuildItCallConnection(callId, calleePubkey, isOutgoing = true).apply {
            setCallerDisplayName(
                calleeName ?: "Unknown",
                TelecomManager.PRESENTATION_ALLOWED
            )
            setAddress(
                Uri.fromParts(SCHEME_BUILDIT, calleePubkey, null),
                TelecomManager.PRESENTATION_ALLOWED
            )

            connectionCapabilities = Connection.CAPABILITY_HOLD or
                    Connection.CAPABILITY_SUPPORT_HOLD or
                    Connection.CAPABILITY_MUTE

            if (hasVideo) {
                connectionCapabilities = connectionCapabilities or
                        Connection.CAPABILITY_SUPPORTS_VT_LOCAL_TX or
                        Connection.CAPABILITY_SUPPORTS_VT_REMOTE_TX or
                        Connection.CAPABILITY_SUPPORTS_VT_LOCAL_RX or
                        Connection.CAPABILITY_SUPPORTS_VT_REMOTE_RX
                videoState = VideoProfile.STATE_BIDIRECTIONAL
            } else {
                videoState = VideoProfile.STATE_AUDIO_ONLY
            }

            setDialing()
        }
    }

    override fun onCreateIncomingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest
    ) {
        Log.e(TAG, "Failed to create incoming connection")
    }

    override fun onCreateOutgoingConnectionFailed(
        connectionManagerPhoneAccount: PhoneAccountHandle,
        request: ConnectionRequest
    ) {
        Log.e(TAG, "Failed to create outgoing connection")
    }

    /**
     * BuildIt-specific Connection implementation.
     */
    inner class BuildItCallConnection(
        val callId: String,
        val remotePubkey: String,
        val isOutgoing: Boolean
    ) : Connection() {

        init {
            connectionProperties = PROPERTY_SELF_MANAGED
            audioModeIsVoip = true
        }

        override fun onAnswer() {
            Log.d(TAG, "Connection answered: $callId")
            setActive()

            // Notify the app
            scope.launch {
                ConnectionCallbackManager.onCallAnswered(callId)
            }
        }

        override fun onAnswer(videoState: Int) {
            Log.d(TAG, "Connection answered with video state $videoState: $callId")
            setActive()

            scope.launch {
                ConnectionCallbackManager.onCallAnswered(callId)
            }
        }

        override fun onReject() {
            Log.d(TAG, "Connection rejected: $callId")
            setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
            destroy()

            scope.launch {
                ConnectionCallbackManager.onCallRejected(callId)
            }
        }

        override fun onDisconnect() {
            Log.d(TAG, "Connection disconnected: $callId")
            setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
            destroy()

            scope.launch {
                ConnectionCallbackManager.onCallEnded(callId)
            }
        }

        override fun onAbort() {
            Log.d(TAG, "Connection aborted: $callId")
            setDisconnected(DisconnectCause(DisconnectCause.CANCELED))
            destroy()

            scope.launch {
                ConnectionCallbackManager.onCallEnded(callId)
            }
        }

        override fun onHold() {
            Log.d(TAG, "Connection hold: $callId")
            setOnHold()

            scope.launch {
                ConnectionCallbackManager.onCallHeld(callId, true)
            }
        }

        override fun onUnhold() {
            Log.d(TAG, "Connection unhold: $callId")
            setActive()

            scope.launch {
                ConnectionCallbackManager.onCallHeld(callId, false)
            }
        }

        override fun onPlayDtmfTone(c: Char) {
            Log.d(TAG, "DTMF tone: $c for $callId")
            // E2EE calls don't support DTMF
        }

        override fun onStopDtmfTone() {
            // No-op for E2EE calls
        }

        /**
         * Set call as ringing on remote end.
         */
        fun setRemoteRinging() {
            Log.d(TAG, "Remote ringing: $callId")
            // Connection is already dialing, wait for answer
        }

        /**
         * Set call as connected.
         */
        fun setCallConnected() {
            Log.d(TAG, "Call connected: $callId")
            setActive()
        }

        /**
         * End the call with a specific reason.
         */
        fun endCall(cause: Int) {
            Log.d(TAG, "Ending call: $callId with cause $cause")
            setDisconnected(DisconnectCause(cause))
            destroy()
        }
    }

    companion object {
        private const val TAG = "CallConnectionService"

        const val SCHEME_BUILDIT = "buildit"
        const val EXTRA_CALL_ID = "call_id"
        const val EXTRA_CALLER_PUBKEY = "caller_pubkey"
        const val EXTRA_CALLER_NAME = "caller_name"
        const val EXTRA_CALLEE_PUBKEY = "callee_pubkey"
        const val EXTRA_CALLEE_NAME = "callee_name"
        const val EXTRA_HAS_VIDEO = "has_video"

        /**
         * Get the PhoneAccountHandle for BuildIt calls.
         */
        fun getPhoneAccountHandle(context: Context): PhoneAccountHandle {
            return PhoneAccountHandle(
                ComponentName(context, CallConnectionService::class.java),
                "BuildIt"
            )
        }

        /**
         * Register the PhoneAccount with the system.
         */
        fun registerPhoneAccount(context: Context) {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val handle = getPhoneAccountHandle(context)

            val account = PhoneAccount.builder(handle, "BuildIt")
                .setCapabilities(
                    PhoneAccount.CAPABILITY_CALL_PROVIDER or
                            PhoneAccount.CAPABILITY_SELF_MANAGED
                )
                .addSupportedUriScheme(SCHEME_BUILDIT)
                .setShortDescription("Secure voice and video calls")
                .build()

            telecomManager.registerPhoneAccount(account)
            Log.d(TAG, "PhoneAccount registered")
        }

        /**
         * Check if we have call permissions.
         */
        fun hasCallPermission(context: Context): Boolean {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val handle = getPhoneAccountHandle(context)

            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                telecomManager.getPhoneAccount(handle)?.isEnabled == true
            } else {
                true
            }
        }

        /**
         * Request a new incoming call.
         */
        fun addIncomingCall(
            context: Context,
            callId: String,
            callerPubkey: String,
            callerName: String?,
            hasVideo: Boolean
        ) {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val handle = getPhoneAccountHandle(context)

            val extras = Bundle().apply {
                putString(EXTRA_CALL_ID, callId)
                putString(EXTRA_CALLER_PUBKEY, callerPubkey)
                putString(EXTRA_CALLER_NAME, callerName)
                putBoolean(EXTRA_HAS_VIDEO, hasVideo)
            }

            telecomManager.addNewIncomingCall(handle, extras)
            Log.d(TAG, "Added incoming call: $callId")
        }

        /**
         * Request a new outgoing call.
         */
        @SuppressLint("MissingPermission")
        fun placeOutgoingCall(
            context: Context,
            callId: String,
            calleePubkey: String,
            calleeName: String?,
            hasVideo: Boolean
        ) {
            val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            val handle = getPhoneAccountHandle(context)

            val extras = Bundle().apply {
                putString(EXTRA_CALL_ID, callId)
                putString(EXTRA_CALLEE_PUBKEY, calleePubkey)
                putString(EXTRA_CALLEE_NAME, calleeName)
                putBoolean(EXTRA_HAS_VIDEO, hasVideo)
                putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle)
            }

            telecomManager.placeCall(
                Uri.fromParts(SCHEME_BUILDIT, calleePubkey, null),
                extras
            )
            Log.d(TAG, "Placed outgoing call: $callId to ${calleePubkey.redacted()}")
        }
    }
}

/**
 * Callback manager for connection events.
 *
 * Allows the CallingUseCase to receive events from ConnectionService.
 */
object ConnectionCallbackManager {
    private var onAnswered: ((String) -> Unit)? = null
    private var onRejected: ((String) -> Unit)? = null
    private var onEnded: ((String) -> Unit)? = null
    private var onHeld: ((String, Boolean) -> Unit)? = null

    fun setCallbacks(
        onAnswered: (String) -> Unit,
        onRejected: (String) -> Unit,
        onEnded: (String) -> Unit,
        onHeld: (String, Boolean) -> Unit
    ) {
        this.onAnswered = onAnswered
        this.onRejected = onRejected
        this.onEnded = onEnded
        this.onHeld = onHeld
    }

    fun clearCallbacks() {
        onAnswered = null
        onRejected = null
        onEnded = null
        onHeld = null
    }

    internal fun onCallAnswered(callId: String) {
        onAnswered?.invoke(callId)
    }

    internal fun onCallRejected(callId: String) {
        onRejected?.invoke(callId)
    }

    internal fun onCallEnded(callId: String) {
        onEnded?.invoke(callId)
    }

    internal fun onCallHeld(callId: String, held: Boolean) {
        onHeld?.invoke(callId, held)
    }
}
