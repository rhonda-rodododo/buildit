package network.buildit.core.nostr

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import android.util.Log
import okhttp3.CertificatePinner
import okhttp3.Handshake
import okhttp3.OkHttpClient
import org.json.JSONObject
import java.io.IOException
import java.security.MessageDigest
import java.security.cert.Certificate
import java.security.cert.X509Certificate
import javax.inject.Inject
import javax.inject.Singleton
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLPeerUnverifiedException
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

/**
 * Certificate pinning configuration.
 */
data class CertPinConfig(
    /** Whether TOFU is enabled for unknown relays */
    val tofuEnabled: Boolean = true,

    /** Whether to warn (vs block) when TOFU certificate changes */
    val tofuWarnOnChange: Boolean = true,

    /** Whether write operations require pinned certificates */
    val requirePinnedForWrite: Boolean = true,

    /** Days before pins should be refreshed */
    val pinExpiryDays: Int = 365
)

/**
 * Configuration for a single relay's certificate pins.
 */
data class RelayPinConfig(
    /** Primary certificate pins (SHA-256 fingerprints) */
    val pins: List<String>,

    /** Backup pins for certificate rotation */
    val backupPins: List<String>,

    /** When this pin was last verified */
    val lastVerified: Long? = null,

    /** Optional notes */
    val notes: String? = null
)

/**
 * Result of certificate verification.
 */
sealed class CertVerifyResult {
    /** Certificate matched a known pin */
    object Pinned : CertVerifyResult()

    /** Certificate matched a TOFU pin */
    object Tofu : CertVerifyResult()

    /** First use of this certificate (TOFU) */
    object TofuFirstUse : CertVerifyResult()

    /** TOFU certificate changed (warning mode) */
    data class TofuChanged(val previous: String, val current: String) : CertVerifyResult()
}

/**
 * Certificate pinning errors.
 */
sealed class CertPinError : Exception() {
    data class PinMismatch(
        val host: String,
        val expected: List<String>,
        val actual: String
    ) : CertPinError() {
        override val message: String
            get() = "Certificate pin mismatch for $host: expected ${expected.joinToString()}, got $actual"
    }

    data class TofuCertificateChanged(
        val host: String,
        val previous: String,
        val current: String
    ) : CertPinError() {
        override val message: String
            get() = "Certificate changed for TOFU host $host: was $previous, now $current"
    }

    object NoCertificate : CertPinError() {
        override val message: String
            get() = "No certificate provided by server"
    }

    data class InvalidCertificate(override val message: String) : CertPinError()

    data class StorageError(override val message: String) : CertPinError()

    data class ConfigError(override val message: String) : CertPinError()
}

/**
 * Certificate pin store and verification for Nostr relay connections.
 *
 * Implements certificate pinning to prevent MITM attacks:
 * - Pre-configured pins for known relays
 * - Trust-on-First-Use (TOFU) for unknown relays
 * - Backup pins for certificate rotation
 */
@Singleton
class CertificatePinStore @Inject constructor(
    private val context: Context
) {
    companion object {
        private const val TAG = "CertificatePinStore"
        private const val TOFU_PREFS_NAME = "buildit_tofu_pins"
        private const val TOFU_PINS_KEY = "pins"
    }

    /** Configuration */
    var config: CertPinConfig = CertPinConfig()
        private set

    /** Pre-configured relay pins */
    private val knownPins = mutableMapOf<String, RelayPinConfig>()

    /** TOFU pins (learned at runtime) */
    private val tofuPins = mutableMapOf<String, String>()

    /** SharedPreferences for TOFU persistence */
    private val tofuPrefs: SharedPreferences by lazy {
        context.getSharedPreferences(TOFU_PREFS_NAME, Context.MODE_PRIVATE)
    }

    init {
        loadKnownPins()
        loadTofuPins()
    }

    /**
     * Load known pins from bundled configuration.
     */
    private fun loadKnownPins() {
        try {
            val inputStream = context.assets.open("relay-pins.json")
            val jsonString = inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(jsonString)

            val relays = json.optJSONObject("relays") ?: return

            for (url in relays.keys()) {
                val pinData = relays.getJSONObject(url)
                val pins = mutableListOf<String>()
                val backupPins = mutableListOf<String>()

                pinData.optJSONArray("pins")?.let { arr ->
                    for (i in 0 until arr.length()) {
                        pins.add(arr.getString(i))
                    }
                }

                pinData.optJSONArray("backup_pins")?.let { arr ->
                    for (i in 0 until arr.length()) {
                        backupPins.add(arr.getString(i))
                    }
                }

                knownPins[url] = RelayPinConfig(
                    pins = pins,
                    backupPins = backupPins,
                    notes = pinData.optString("notes", null)
                )
            }

            Log.i(TAG, "Loaded ${knownPins.size} known relay pins")
        } catch (e: IOException) {
            Log.w(TAG, "Could not load relay-pins.json: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error loading known pins", e)
        }
    }

    /**
     * Load TOFU pins from SharedPreferences.
     */
    private fun loadTofuPins() {
        val pinsJson = tofuPrefs.getString(TOFU_PINS_KEY, null) ?: return
        try {
            val json = JSONObject(pinsJson)
            for (key in json.keys()) {
                tofuPins[key] = json.getString(key)
            }
            Log.i(TAG, "Loaded ${tofuPins.size} TOFU pins")
        } catch (e: Exception) {
            Log.e(TAG, "Error loading TOFU pins", e)
        }
    }

    /**
     * Save TOFU pins to SharedPreferences.
     */
    private fun saveTofuPins() {
        val json = JSONObject()
        tofuPins.forEach { (key, value) -> json.put(key, value) }
        tofuPrefs.edit().putString(TOFU_PINS_KEY, json.toString()).apply()
    }

    /**
     * Add a known relay pin.
     */
    fun addKnownPin(url: String, config: RelayPinConfig) {
        synchronized(knownPins) {
            knownPins[url] = config
        }
    }

    /**
     * Compute SHA-256 fingerprint of a certificate.
     */
    fun computeFingerprint(certificate: Certificate): String {
        val encoded = certificate.encoded
        val digest = MessageDigest.getInstance("SHA-256").digest(encoded)
        return "sha256/" + Base64.encodeToString(digest, Base64.NO_WRAP)
    }

    /**
     * Compute SHA-256 fingerprint of raw certificate data.
     */
    fun computeFingerprint(certificateData: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(certificateData)
        return "sha256/" + Base64.encodeToString(digest, Base64.NO_WRAP)
    }

    /**
     * Verify a certificate against known or TOFU pins.
     */
    fun verifyCertificate(host: String, certificate: Certificate): Result<CertVerifyResult> {
        val fingerprint = computeFingerprint(certificate)
        val normalizedHost = normalizeHost(host)

        return synchronized(this) {
            // Check known pins first
            knownPins[normalizedHost]?.let { pinConfig ->
                val allPins = pinConfig.pins + pinConfig.backupPins

                if (allPins.isNotEmpty()) {
                    if (fingerprint in allPins) {
                        return@synchronized Result.success(CertVerifyResult.Pinned)
                    } else {
                        return@synchronized Result.failure(
                            CertPinError.PinMismatch(
                                host = normalizedHost,
                                expected = allPins,
                                actual = fingerprint
                            )
                        )
                    }
                }
                // Empty pins = known relay but no pins configured yet, fall through to TOFU
            }

            // Check TOFU pins
            if (config.tofuEnabled) {
                tofuPins[normalizedHost]?.let { storedPin ->
                    if (storedPin == fingerprint) {
                        return@synchronized Result.success(CertVerifyResult.Tofu)
                    } else {
                        // Certificate changed!
                        if (config.tofuWarnOnChange) {
                            Log.w(
                                TAG,
                                "Certificate changed for TOFU host $normalizedHost: was $storedPin, now $fingerprint"
                            )
                            return@synchronized Result.success(
                                CertVerifyResult.TofuChanged(
                                    previous = storedPin,
                                    current = fingerprint
                                )
                            )
                        } else {
                            return@synchronized Result.failure(
                                CertPinError.TofuCertificateChanged(
                                    host = normalizedHost,
                                    previous = storedPin,
                                    current = fingerprint
                                )
                            )
                        }
                    }
                }

                // First time seeing this host - store the pin
                tofuPins[normalizedHost] = fingerprint
                saveTofuPins()
                Log.i(TAG, "TOFU: Stored initial certificate pin for $normalizedHost: $fingerprint")
                return@synchronized Result.success(CertVerifyResult.TofuFirstUse)
            }

            // No TOFU enabled and no known pins
            Result.failure(
                CertPinError.ConfigError(
                    "No certificate pin configured for $normalizedHost and TOFU is disabled"
                )
            )
        }
    }

    /**
     * Check if a relay is pinned (known or TOFU).
     */
    fun isPinned(host: String): Boolean {
        val normalizedHost = normalizeHost(host)
        return synchronized(this) {
            knownPins[normalizedHost]?.pins?.isNotEmpty() == true ||
                    tofuPins.containsKey(normalizedHost)
        }
    }

    /**
     * Clear TOFU pin for a specific host.
     */
    fun clearTofuPin(host: String) {
        val normalizedHost = normalizeHost(host)
        synchronized(this) {
            tofuPins.remove(normalizedHost)
            saveTofuPins()
        }
    }

    /**
     * Normalize host URL.
     */
    private fun normalizeHost(host: String): String {
        return if (host.startsWith("wss://") || host.startsWith("ws://")) {
            host
        } else {
            "wss://$host"
        }
    }

    /**
     * Build an OkHttpClient with certificate pinning for known relays.
     *
     * Note: This only pins known relays. TOFU verification happens in
     * the custom TrustManager.
     */
    fun buildPinnedOkHttpClient(baseBuilder: OkHttpClient.Builder = OkHttpClient.Builder()): OkHttpClient {
        // Build CertificatePinner for known relays with configured pins
        val pinnerBuilder = CertificatePinner.Builder()

        synchronized(knownPins) {
            for ((url, config) in knownPins) {
                val allPins = config.pins + config.backupPins
                if (allPins.isNotEmpty()) {
                    // Extract hostname from URL
                    val hostname = url
                        .removePrefix("wss://")
                        .removePrefix("ws://")
                        .removeSuffix("/")
                        .split("/")[0]

                    for (pin in allPins) {
                        pinnerBuilder.add(hostname, pin)
                    }
                }
            }
        }

        // Create custom TrustManager for TOFU
        val tofuTrustManager = TofuTrustManager(this)

        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, arrayOf<TrustManager>(tofuTrustManager), null)

        return baseBuilder
            .certificatePinner(pinnerBuilder.build())
            .sslSocketFactory(sslContext.socketFactory, tofuTrustManager)
            .hostnameVerifier(TofuHostnameVerifier(this))
            .build()
    }
}

/**
 * Custom X509TrustManager that implements TOFU.
 */
class TofuTrustManager(
    private val pinStore: CertificatePinStore
) : X509TrustManager {

    companion object {
        private const val TAG = "TofuTrustManager"
    }

    // Get the default trust manager
    private val defaultTrustManager: X509TrustManager by lazy {
        val trustManagerFactory =
            javax.net.ssl.TrustManagerFactory.getInstance(javax.net.ssl.TrustManagerFactory.getDefaultAlgorithm())
        trustManagerFactory.init(null as java.security.KeyStore?)
        trustManagerFactory.trustManagers
            .filterIsInstance<X509TrustManager>()
            .first()
    }

    override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {
        defaultTrustManager.checkClientTrusted(chain, authType)
    }

    override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
        // First, do default certificate chain validation
        defaultTrustManager.checkServerTrusted(chain, authType)

        // Then verify against our TOFU pins
        // Note: Known pins are handled by CertificatePinner in OkHttp
        if (chain.isNullOrEmpty()) {
            throw SSLPeerUnverifiedException("No certificates provided")
        }

        val leafCert = chain[0]

        // We'll verify in the hostname verifier where we have the host
        // Store the certificate temporarily for verification
        Log.d(TAG, "Server certificate validated by chain, TOFU check deferred to hostname verifier")
    }

    override fun getAcceptedIssuers(): Array<X509Certificate> {
        return defaultTrustManager.acceptedIssuers
    }
}

/**
 * Hostname verifier that implements TOFU verification.
 */
class TofuHostnameVerifier(
    private val pinStore: CertificatePinStore
) : HostnameVerifier {

    companion object {
        private const val TAG = "TofuHostnameVerifier"
    }

    // Default hostname verifier
    private val defaultVerifier = javax.net.ssl.HttpsURLConnection.getDefaultHostnameVerifier()

    override fun verify(hostname: String, session: javax.net.ssl.SSLSession): Boolean {
        // First, do default hostname verification
        if (!defaultVerifier.verify(hostname, session)) {
            Log.e(TAG, "Default hostname verification failed for $hostname")
            return false
        }

        // Get the certificate
        val certificates = try {
            session.peerCertificates
        } catch (e: SSLPeerUnverifiedException) {
            Log.e(TAG, "No peer certificates for $hostname")
            return false
        }

        if (certificates.isEmpty()) {
            Log.e(TAG, "Empty certificate chain for $hostname")
            return false
        }

        val leafCert = certificates[0]

        // Verify against TOFU pins
        val result = pinStore.verifyCertificate(hostname, leafCert)

        return result.fold(
            onSuccess = { verifyResult ->
                when (verifyResult) {
                    is CertVerifyResult.Pinned -> {
                        Log.i(TAG, "Certificate verified (pinned) for $hostname")
                        true
                    }
                    is CertVerifyResult.Tofu -> {
                        Log.i(TAG, "Certificate verified (TOFU) for $hostname")
                        true
                    }
                    is CertVerifyResult.TofuFirstUse -> {
                        Log.i(TAG, "First use certificate stored (TOFU) for $hostname")
                        true
                    }
                    is CertVerifyResult.TofuChanged -> {
                        Log.w(
                            TAG,
                            "Certificate changed for $hostname (TOFU warning): " +
                                    "${verifyResult.previous} -> ${verifyResult.current}"
                        )
                        // Allow but warn - caller should handle this
                        true
                    }
                }
            },
            onFailure = { error ->
                Log.e(TAG, "Certificate verification failed for $hostname: ${error.message}")
                false
            }
        )
    }
}

/**
 * Callback interface for certificate pinning events.
 */
interface CertificatePinningCallback {
    /** Called when a certificate is verified successfully */
    fun onCertificateVerified(host: String, result: CertVerifyResult)

    /** Called when certificate verification fails */
    fun onCertificateError(host: String, error: CertPinError)
}
